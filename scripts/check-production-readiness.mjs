import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { resolveExecutionConfig } from "../server/execution/execution-policy.mjs";
import { judge0LanguageAvailable, listJudge0Languages } from "../server/execution/language-map.mjs";
import { learningDomainCatalog, productionTechnologyIds, technologyCatalog } from "../shared/stonecode-product.mjs";

loadLocalEnv();
const checks = [];
const requiredValues = [
  "OPENAI_API_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_SUCCESS_URL",
  "STRIPE_CANCEL_URL",
  "STRIPE_PORTAL_RETURN_URL",
  "STONECODE_INTERNAL_JOB_SECRET",
  "STONECODE_ALERT_WEBHOOK_URL",
  "STONECODE_LEGAL_SIGNOFF",
  "STONECODE_SECURITY_SIGNOFF",
  "STONECODE_PROVIDER_ALERTS_CONFIRMED",
  "VITE_SUPPORT_EMAIL",
  "JUDGE0_API_URL",
  "JUDGE0_API_KEY",
  "JUDGE0_API_KEY_HEADER",
  "JUDGE0_RAPIDAPI_HOST",
  "JUDGE0_GLOBAL_ACTIONS_PER_DAY"
];
for (const key of requiredValues) check(`env:${key}`, Boolean(process.env[key]), process.env[key] ? "configured" : "missing");
check("stripe:live secret", String(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_"), "must use a live-mode secret key");
check("stripe:live price", /^price_[A-Za-z0-9]+$/.test(String(process.env.STRIPE_PRO_PRICE_ID ?? "")), "must use a live Pro price id");
check("env:STONECODE_INTERNAL_JOB_SECRET strength", String(process.env.STONECODE_INTERNAL_JOB_SECRET ?? "").length >= 32, "must contain at least 32 characters");
for (const key of ["STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL", "STRIPE_PORTAL_RETURN_URL"]) {
  check(`env:${key} production URL`, isProductionHttpsUrl(process.env[key]), "must be HTTPS and non-localhost");
}
for (const flag of ["CREDITS_V1", "LEARNING_PROPOSALS_V1", "RUNTIME_CATALOG_V1", "STRUCTURED_TUTOR_TOOLS", "CHAT_VISUALS_V1", "DYNAMIC_SURFACES", "MARKETPLACE_V1"]) {
  check(`flag:${flag}`, readBoolean(process.env[`FEATURE_${flag}`]), readBoolean(process.env[`FEATURE_${flag}`]) ? "enabled" : "disabled");
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && serviceKey) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await checkDatabase(admin);
} else {
  check("database", false, "Supabase service configuration missing");
}

const executionConfig = resolveExecutionConfig(process.env);
if (executionConfig.configured) {
  try {
    const languages = await listJudge0Languages(executionConfig);
    check("judge0:authentication", true, `${languages.length} runtimes discovered`);
    for (const technology of technologyCatalog.filter((item) => item.runtime === "judge0" && productionTechnologyIds.includes(item.id))) {
      const available = judge0LanguageAvailable(languages, technology.id);
      check(`judge0:${technology.id}`, available, available ? "available" : "runtime missing");
    }
  } catch (error) {
    check("judge0:authentication", false, String(error?.message ?? error).slice(0, 300));
  }
} else {
  check("judge0:configuration", false, "Judge0 provider is not configured");
}

const baseUrl = argumentValue("--base-url");
if (baseUrl) await checkDeployment(baseUrl);

const failures = checks.filter((item) => !item.ok);
console.log(JSON.stringify({
  ready: failures.length === 0,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks
}, null, 2));
if (failures.length) process.exitCode = 1;

async function checkDatabase(admin) {
  const tables = [
    "credit_accounts", "credit_grants", "credit_quotes", "credit_reservations", "credit_reservation_allocations", "credit_ledger",
    "learning_proposals", "generation_jobs", "technology_manifests", "learning_domain_manifests", "rag_corpora", "rag_ingestion_runs", "rag_evaluation_cases",
    "rag_evaluation_runs", "tutor_visuals", "marketplace_templates", "marketplace_template_versions", "marketplace_stars", "marketplace_reports",
    "plan_usage_counters", "operator_usage_counters"
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).select("*", { count: "exact", head: true });
    check(`database:${table}`, !error, error ? `${error.code ?? "database_error"}: ${error.message}` : "available");
  }
  const [{ error: jobEconomicsError }, { error: usageEconomicsError }] = await Promise.all([
    admin.from("generation_jobs").select("heartbeat_at,estimated_ai_cost_microusd,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,stones_charged,nominal_creation_revenue_microusd", { head: true }),
    admin.from("usage_events").select("generation_job_id,proposal_id,cached_input_tokens,reasoning_tokens,estimated_cost_microusd,pricing_version", { head: true })
  ]);
  check("database:generation economics", !jobEconomicsError, jobEconomicsError?.message ?? "available");
  check("database:usage cost accounting", !usageEconomicsError, usageEconomicsError?.message ?? "available");
  await checkUsageRpcSurface(admin);
  const [{ data: manifests, error: manifestError }, { data: domainManifests, error: domainManifestError }, { data: corpora, error: corpusError }, { data: documents, error: documentError }, { data: buckets, error: bucketError }] = await Promise.all([
    admin.from("technology_manifests").select("technology_id,enabled,metadata"),
    admin.from("learning_domain_manifests").select("domain_id,enabled,metadata"),
    admin.from("rag_corpora").select("id,corpus_key,version,technology_id,domain_id,status,top_five_relevance,provenance_complete,cross_language_leakage_count"),
    admin.from("rag_documents").select("id,corpus_id,source_key,source_type,title,url,source_version,license,metadata"),
    admin.storage.listBuckets()
  ]);
  check("database:technology catalog", !manifestError && manifests?.length === 22, `${manifests?.length ?? 0}/22 manifests`);
  if (!manifestError) {
    for (const technology of technologyCatalog) {
      const manifest = manifests?.find((item) => item.technology_id === technology.id);
      const expectedEnabled = productionTechnologyIds.includes(technology.id);
      const rosterCorrect = manifest?.enabled === expectedEnabled
        && (expectedEnabled || manifest?.metadata?.launchStatus === "approved_pending_runtime");
      check(`technology:${technology.id}:launch-roster`, rosterCorrect, manifest ? `enabled=${manifest.enabled}, launchStatus=${manifest.metadata?.launchStatus ?? "unset"}` : "missing");
    }
  }
  const launchDomains = learningDomainCatalog.filter((domain) => domain.id !== "programming");
  check("database:learning domain catalog", !domainManifestError && domainManifests?.length === launchDomains.length, `${domainManifests?.length ?? 0}/${launchDomains.length} manifests`);
  if (!domainManifestError) {
    for (const domain of launchDomains) {
      const manifest = domainManifests?.find((item) => item.domain_id === domain.id);
      check(`domain:${domain.id}:launch-roster`, manifest?.enabled === true && manifest?.metadata?.launchStatus === "approved", manifest ? `enabled=${manifest.enabled}, launchStatus=${manifest.metadata?.launchStatus ?? "unset"}` : "missing");
    }
  }
  check("database:tutor visuals bucket", !bucketError && buckets?.some((bucket) => bucket.id === "tutor-visuals" && bucket.public === false), "private tutor-visuals bucket required");
  if (!corpusError && !documentError) {
    for (const technology of technologyCatalog) {
      const corpus = latestCorpus(corpora, (item) => item.corpus_key === technology.ragCorpusKey);
      const ready = corpus?.status === "enabled"
        && Number(corpus.top_five_relevance) >= 0.9
        && corpus.provenance_complete === true
        && Number(corpus.cross_language_leakage_count) === 0;
      check(`rag:${technology.id}`, ready, corpus ? `status=${corpus.status}, relevance=${corpus.top_five_relevance ?? "none"}, provenance=${corpus.provenance_complete}, leakage=${corpus.cross_language_leakage_count}` : "missing");
      checkCorpusSources(technology.id, corpus, documents);
    }
    for (const domain of learningDomainCatalog.filter((item) => item.ragCorpusKey)) {
      const corpus = latestCorpus(corpora, (item) => item.corpus_key === domain.ragCorpusKey);
      const ready = corpus?.status === "enabled"
        && Number(corpus.top_five_relevance) >= 0.9
        && corpus.provenance_complete === true
        && Number(corpus.cross_language_leakage_count) === 0;
      check(`rag:${domain.id}`, ready, corpus ? `status=${corpus.status}, relevance=${corpus.top_five_relevance ?? "none"}, provenance=${corpus.provenance_complete}, leakage=${corpus.cross_language_leakage_count}` : "missing");
      checkCorpusSources(domain.id, corpus, documents);
    }
  } else {
    check("rag:catalog", false, corpusError?.message ?? documentError?.message ?? "RAG catalog unavailable");
  }
}

function latestCorpus(corpora, predicate) {
  return (corpora ?? [])
    .filter(predicate)
    .sort((left, right) => Number(right.version ?? 0) - Number(left.version ?? 0))[0] ?? null;
}

function checkCorpusSources(capabilityId, corpus, documents) {
  const sources = (documents ?? []).filter((document) => document.corpus_id === corpus?.id);
  const ready = sources.length > 0 && sources.every((document) => {
    const metadata = document.metadata ?? {};
    const officialUrlPresent = document.source_type === "stonecode-curriculum" || isHttpsUrl(document.url);
    return Boolean(document.source_key)
      && Boolean(document.title)
      && officialUrlPresent
      && Boolean(document.source_version)
      && Boolean(document.license)
      && document.license !== "pending-review"
      && metadata.provenanceStatus === "approved"
      && /^[a-f0-9]{64}$/i.test(String(metadata.contentHash ?? ""))
      && Number.isInteger(metadata.chunkCount)
      && metadata.chunkCount > 0;
  });
  check(`rag:${capabilityId}:sources`, ready, ready ? `${sources.length} reviewed source${sources.length === 1 ? "" : "s"}` : `${sources.length} source(s); hash/chunks/license/attribution review incomplete`);
}

async function checkUsageRpcSurface(admin) {
  const zeroUser = "00000000-0000-0000-0000-000000000000";
  const period = "1970-01-01";
  const probes = [
    ["consume_stonecode_plan_usage", { p_user_id: zeroUser, p_feature: "tutor_reply", p_period_start: period, p_limit: 0, p_amount: 1 }],
    ["release_stonecode_plan_usage", { p_user_id: zeroUser, p_feature: "tutor_reply", p_period_start: period, p_amount: 1 }],
    ["consume_stonecode_operator_usage", { p_feature: "judge0_action", p_period_start: period, p_limit: 0, p_amount: 1 }],
    ["release_stonecode_operator_usage", { p_feature: "judge0_action", p_period_start: period, p_amount: 1 }]
  ];
  for (const [name, args] of probes) {
    const { error } = await admin.rpc(name, args);
    check(`database:rpc:${name}`, !error, error ? `${error.code ?? "database_error"}: ${error.message}` : "available");
  }
}

async function checkDeployment(value) {
  let origin;
  try {
    origin = new URL(value).origin;
  } catch {
    check("deployment:url", false, "invalid base URL");
    return;
  }
  try {
    const healthResponse = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const health = await healthResponse.json().catch(() => null);
    check("deployment:health", healthResponse.ok && health?.status === "ready", healthResponse.ok ? String(health?.status ?? "unknown") : `HTTP ${healthResponse.status}`);
    const response = await fetch(`${origin}/api/features`, { signal: AbortSignal.timeout(10_000) });
    const payload = await response.json().catch(() => null);
    check("deployment:feature endpoint", response.ok, response.ok ? "reachable" : `HTTP ${response.status}`);
    if (response.ok) {
      const enabled = Object.values(payload?.features ?? {}).every(Boolean) && Object.keys(payload?.features ?? {}).length === 7;
      check("deployment:feature flags", enabled, enabled ? "all enabled" : "one or more disabled");
    }
    await checkSocialMetadata(origin);
  } catch (error) {
    check("deployment:feature endpoint", false, String(error?.message ?? error).slice(0, 200));
  }
}

async function checkSocialMetadata(origin) {
  const response = await fetch(origin, { signal: AbortSignal.timeout(10_000) });
  const html = await response.text();
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical/i)?.[1];
  const meta = (property) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)`, "i"))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"))?.[1];
  check("metadata:canonical", canonical === `${origin}/`, canonical ?? "missing");
  for (const property of ["description", "og:title", "og:description", "og:type", "og:url", "og:image", "og:image:width", "og:image:height", "og:image:type", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
    check(`metadata:${property}`, Boolean(meta(property)), meta(property) ?? "missing");
  }
  const imageUrl = meta("og:image");
  if (!imageUrl) return;
  const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const png = imageResponse.ok && imageResponse.headers.get("content-type")?.toLowerCase().startsWith("image/png") && bytes.subarray(1, 4).toString("ascii") === "PNG";
  const dimensionsCorrect = png && bytes.length >= 24 && bytes.readUInt32BE(16) === 1200 && bytes.readUInt32BE(20) === 630;
  check("metadata:preview image", png && dimensionsCorrect, png ? `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)} ${imageResponse.headers.get("content-type")}` : `HTTP ${imageResponse.status} ${imageResponse.headers.get("content-type") ?? "unknown"}`);
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

function isProductionHttpsUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    return parsed.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value ?? "")).protocol === "https:";
  } catch {
    return false;
  }
}

function readBoolean(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "").trim().toLowerCase());
}

function argumentValue(name) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
