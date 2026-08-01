import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chooseExpectedChunkKeys } from "../server/rag/official-source-ingestion.mjs";
import { technologyCorpora } from "../server/rag/technology-corpora.mjs";

loadLocalEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service role is required to refresh RAG evaluation fixtures.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const technologyFilter = process.argv.find((argument) => argument.startsWith("--technology="))?.split("=")[1];
const selected = technologyFilter ? technologyCorpora.filter((item) => item.technologyId === technologyFilter) : technologyCorpora;
if (!selected.length) throw new Error(`Unknown technology filter: ${technologyFilter}`);

for (const spec of selected) {
  const { data: corpus, error: corpusError } = await admin
    .from("rag_corpora")
    .select("id")
    .eq("corpus_key", spec.corpusKey)
    .eq("version", spec.version)
    .single();
  if (corpusError) throw corpusError;
  const { data: documents, error: documentError } = await admin.from("rag_documents").select("id").eq("corpus_id", corpus.id);
  if (documentError) throw documentError;
  const documentIds = (documents ?? []).map((item) => item.id);
  if (!documentIds.length) throw new Error(`${spec.technologyId} has no ingested documents.`);
  const { data: chunks, error: chunkError } = await admin
    .from("rag_chunks")
    .select("chunk_key,title,content")
    .in("document_id", documentIds);
  if (chunkError) throw chunkError;
  const normalizedChunks = (chunks ?? []).map((chunk) => ({ key: chunk.chunk_key, title: chunk.title, content: chunk.content }));
  if (normalizedChunks.length < 3) throw new Error(`${spec.technologyId} has insufficient chunks.`);
  for (const fixture of spec.evaluationFixtures) {
    const { error } = await admin.from("rag_evaluation_cases").upsert({
      corpus_id: corpus.id,
      case_key: fixture.key,
      query: fixture.query,
      expected_chunk_keys: chooseExpectedChunkKeys(normalizedChunks, fixture.query, 10),
      forbidden_technology_ids: fixture.forbiddenTechnologyIds
    }, { onConflict: "corpus_id,case_key" });
    if (error) throw error;
  }
  console.log(`${spec.technologyId}: refreshed ${spec.evaluationFixtures.length} fixtures from ${normalizedChunks.length} official chunks`);
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
