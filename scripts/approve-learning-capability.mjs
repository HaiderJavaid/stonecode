import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { findLearningDomain, findTechnology } from "../shared/stonecode-product.mjs";
import { resolveExecutionConfig } from "../server/execution/index.mjs";
import { judge0LanguageAvailable, listJudge0Languages } from "../server/execution/language-map.mjs";

loadLocalEnv();
const args = parseArguments(process.argv.slice(2));
if (args.technology && args.domain || !args.technology && !args.domain) throw new Error("Choose exactly one --technology=<id> or --domain=<id>.");
if (!args.approve && !args.approvePendingRuntime || !args.reviewer || !args.confirmCorpusKey) throw new Error("Approval requires --approve (or --approve-pending-runtime for a hidden technology), --reviewer=<identity>, and --confirm-corpus-key=<key>.");
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service role is required.");
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const technology = args.technology ? findTechnology(args.technology) : null;
const domain = args.domain ? findLearningDomain(args.domain) : null;
if (!technology && !domain || domain?.id === "programming") throw new Error("Unknown or derived capability.");
if (args.approvePendingRuntime && !technology?.hiddenUntilRuntime) throw new Error("Only a catalog-hidden technology may use --approve-pending-runtime.");
const capabilityId = technology?.id ?? domain.id;
const corpusKey = technology?.ragCorpusKey ?? domain.ragCorpusKey;
if (args.confirmCorpusKey !== corpusKey) throw new Error("Corpus-key confirmation does not match the shared catalog.");

const corpusQuery = admin.from("rag_corpora")
  .select("id,corpus_key,technology_id,domain_id,status,top_five_relevance,provenance_complete,cross_language_leakage_count")
  .eq(technology ? "technology_id" : "domain_id", capabilityId)
  .eq("corpus_key", corpusKey)
  .order("version", { ascending: false })
  .limit(1);
const { data: corpora, error: corpusError } = await corpusQuery;
if (corpusError) throw corpusError;
const corpus = corpora?.[0];
if (!corpus || corpus.status !== "enabled" || Number(corpus.top_five_relevance) < 0.9 || corpus.provenance_complete !== true || Number(corpus.cross_language_leakage_count) !== 0) {
  throw new Error("Corpus is not fully approved/evaluated (enabled, >=0.90 relevance, complete provenance, zero leakage). Never flip this manifest directly.");
}
const { data: documents, error: documentError } = await admin.from("rag_documents").select("id,source_type,url,source_version,license,metadata").eq("corpus_id", corpus.id);
if (documentError) throw documentError;
if (!documents?.length || documents.some((document) =>
  !document.source_version || !document.license || document.license === "pending-review"
  || document.metadata?.provenanceStatus !== "approved"
  || !/^[a-f0-9]{64}$/i.test(String(document.metadata?.contentHash ?? ""))
  || !Number.isInteger(document.metadata?.chunkCount) || document.metadata.chunkCount < 1
  || document.source_type !== "stonecode-curriculum" && (!document.url || !isHttpsUrl(document.metadata?.licenseUrl))
)) throw new Error("One or more sources lack approved hash, chunks, license, attribution URL, or provenance.");

if (technology?.runtime === "judge0") {
  const execution = resolveExecutionConfig(process.env);
  if (!execution.configured) throw new Error("Judge0 must be configured before approving this technology.");
  const languages = await listJudge0Languages(execution);
  const runtimeAvailable = judge0LanguageAvailable(languages, technology.id);
  if (args.approvePendingRuntime && runtimeAvailable) throw new Error(`${technology.displayName} is now available in Judge0; update the catalog/runtime plan before enabling.`);
  if (!args.approvePendingRuntime && !runtimeAvailable) throw new Error(`Judge0 does not provide ${technology.displayName}; leave it hidden/disabled.`);
}
if (domain?.defaultTechnologyId) {
  const { data: runtimeManifest, error } = await admin.from("technology_manifests").select("enabled").eq("technology_id", domain.defaultTechnologyId).single();
  if (error || runtimeManifest?.enabled !== true) throw new Error(`Domain requires enabled runtime technology ${domain.defaultTechnologyId}.`);
}

const table = technology ? "technology_manifests" : "learning_domain_manifests";
const idColumn = technology ? "technology_id" : "domain_id";
const { data: manifest, error: manifestError } = await admin.from(table).select("metadata").eq(idColumn, capabilityId).single();
if (manifestError) throw manifestError;
const now = new Date().toISOString();
const launchStatus = args.approvePendingRuntime ? "approved_pending_runtime" : "approved";
const { error: updateError } = await admin.from(table).update({
  enabled: !args.approvePendingRuntime,
  metadata: { ...(manifest.metadata ?? {}), launchStatus, launchReviewedAt: now, launchReviewedBy: args.reviewer, approvedCorpusKey: corpusKey },
  updated_at: now
}).eq(idColumn, capabilityId);
if (updateError) throw updateError;
console.log(`${args.approvePendingRuntime ? "approved pending runtime" : "approved and enabled"} ${capabilityId}; corpus=${corpusKey}; reviewer=${args.reviewer}`);

function isHttpsUrl(value) {
  try {
    return new URL(String(value ?? "")).protocol === "https:";
  } catch {
    return false;
  }
}

function parseArguments(values) {
  const valueFor = (name) => values.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)?.trim() || null;
  return {
    technology: valueFor("--technology")?.toLowerCase() || null,
    domain: valueFor("--domain")?.toLowerCase() || null,
    reviewer: valueFor("--reviewer"),
    confirmCorpusKey: valueFor("--confirm-corpus-key"),
    approve: values.includes("--approve"),
    approvePendingRuntime: values.includes("--approve-pending-runtime")
  };
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
