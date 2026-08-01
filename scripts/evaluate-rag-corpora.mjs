import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { requestEmbedding } from "../server/rag/retrieve.mjs";
import { resolveTutorProviderConfig } from "../server/llm-providers.mjs";

loadLocalEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service role is required to evaluate RAG corpora.");
const providerConfig = resolveTutorProviderConfig(process.env);
if (providerConfig.error) throw new Error(providerConfig.error);
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const technologyFilter = process.argv.find((argument) => argument.startsWith("--technology="))?.split("=")[1];
const domainFilter = process.argv.find((argument) => argument.startsWith("--domain="))?.split("=")[1];
if (technologyFilter && domainFilter) throw new Error("Choose either --technology or --domain, not both.");

let query = admin.from("rag_corpora").select("id,corpus_key,technology_id,domain_id,version,status").in("status", ["draft", "evaluating", "enabled", "disabled"]);
if (technologyFilter) query = query.eq("technology_id", technologyFilter);
if (domainFilter) query = query.eq("domain_id", domainFilter);
const { data: corpora, error: corporaError } = await query;
if (corporaError) throw corporaError;
if (!corpora?.length) throw new Error("No matching RAG corpora found. Seed them first.");

for (const corpus of corpora) await evaluateCorpus(corpus);

async function evaluateCorpus(corpus) {
  const [{ data: fixtures, error: fixtureError }, { data: sources, error: sourceError }] = await Promise.all([
    admin.from("rag_evaluation_cases").select("case_key,query,expected_chunk_keys,forbidden_technology_ids,forbidden_domain_ids").eq("corpus_id", corpus.id),
    admin.from("rag_documents").select("source_key,source_type,url,source_version,license,metadata").eq("corpus_id", corpus.id)
  ]);
  if (fixtureError) throw fixtureError;
  if (sourceError) throw sourceError;
  if (!fixtures?.length) throw new Error(`${corpus.corpus_key} has no evaluation fixtures.`);
  if (fixtures.some((fixture) => !fixture.expected_chunk_keys?.length)) throw new Error(`${corpus.corpus_key} has an evaluation fixture without expected chunks.`);

  let relevant = 0;
  let leakageCount = 0;
  const cases = [];
  for (const fixture of fixtures) {
    const embedding = await requestEmbedding({ config: providerConfig, input: fixture.query });
    const { data: matches, error } = await admin.rpc("match_rag_chunks", {
      query_embedding: embedding.embedding,
      match_count: 20,
      match_subject: null,
      match_task: null,
      match_technology: corpus.technology_id,
      include_draft: true,
      match_domain: corpus.domain_id
    });
    if (error) throw error;
    const scopedMatches = (matches ?? []).filter((match) =>
      match.technology_id === corpus.technology_id && match.domain_id === corpus.domain_id
    ).slice(0, 5);
    const keys = scopedMatches.map((match) => match.chunk_id);
    const hit = fixture.expected_chunk_keys.some((key) => keys.includes(key));
    const leaked = scopedMatches.filter((match) =>
      (fixture.forbidden_technology_ids ?? []).includes(match.technology_id)
      || (fixture.forbidden_domain_ids ?? []).includes(match.domain_id)
    ).map((match) => match.chunk_id);
    if (hit) relevant += 1;
    leakageCount += leaked.length;
    cases.push({ caseKey: fixture.case_key, hit, keys, leaked });
  }

  const relevance = relevant / fixtures.length;
  const provenanceComplete = sources.length > 0 && sources.every((source) =>
    (source.source_type === "stonecode-curriculum" || source.url)
    && source.source_version
    && source.license
    && source.license !== "pending-review"
    && source.metadata?.provenanceStatus === "approved"
  );
  const enabled = relevance >= 0.9 && provenanceComplete && leakageCount === 0;
  const result = { fixtureCount: fixtures.length, relevant, cases };
  const { error: runError } = await admin.from("rag_evaluation_runs").insert({
    corpus_id: corpus.id,
    relevance,
    provenance_complete: provenanceComplete,
    leakage_count: leakageCount,
    result
  });
  if (runError) throw runError;
  const { error: updateError } = await admin.from("rag_corpora").update({
    status: enabled ? "enabled" : "disabled",
    top_five_relevance: relevance,
    provenance_complete: provenanceComplete,
    cross_language_leakage_count: leakageCount,
    enabled_at: enabled ? new Date().toISOString() : null
  }).eq("id", corpus.id);
  if (updateError) throw updateError;
  console.log(`${corpus.technology_id ?? corpus.domain_id}: relevance=${relevance.toFixed(2)} provenance=${provenanceComplete} leakage=${leakageCount} status=${enabled ? "enabled" : "disabled"}`);
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
