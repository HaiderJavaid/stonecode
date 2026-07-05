import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { curatedRagChunks } from "../server/rag/curriculum-sources.mjs";
import { requestEmbedding } from "../server/rag/retrieve.mjs";
import { resolveTutorProviderConfig } from "../server/llm-providers.mjs";

loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service role is required to seed RAG corpus.");

const providerConfig = resolveTutorProviderConfig(process.env);
if (providerConfig.error) throw new Error(providerConfig.error);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

for (const chunk of curatedRagChunks) {
  const { data: document, error: documentError } = await admin
    .from("rag_documents")
    .upsert({
      source_key: chunk.id,
      source_type: chunk.sourceType,
      title: chunk.title,
      url: chunk.url ?? null,
      metadata: { seeded: true },
      updated_at: new Date().toISOString()
    }, { onConflict: "source_key" })
    .select("id")
    .single();
  if (documentError) throw documentError;

  const embedding = await requestEmbedding({
    config: providerConfig,
    input: `${chunk.title}\n${chunk.content}`
  });

  const { error: chunkError } = await admin
    .from("rag_chunks")
    .upsert({
      document_id: document.id,
      chunk_key: chunk.id,
      subject_tags: inferSubjectTags(chunk),
      task_tags: inferTaskTags(chunk),
      kind: chunk.kind,
      block_kind: chunk.blockKind ?? null,
      title: chunk.title,
      content: chunk.content,
      metadata: { url: chunk.url ?? null },
      embedding: embedding.embedding,
      updated_at: new Date().toISOString()
    }, { onConflict: "chunk_key" });
  if (chunkError) throw chunkError;
}

console.log(`seeded ${curatedRagChunks.length} RAG chunks`);

function inferSubjectTags(chunk) {
  const text = `${chunk.title} ${chunk.content}`.toLowerCase();
  const tags = [];
  for (const tag of ["react", "next", "javascript", "c++", "c#", "unity", "workshop", "lab", "project"]) {
    if (text.includes(tag)) tags.push(tag);
  }
  return tags;
}

function inferTaskTags(chunk) {
  const tags = ["course-generation"];
  if (chunk.kind === "project-spine") tags.push("blueprint");
  if (chunk.kind === "official-reference") tags.push("assessment-plan");
  if (chunk.blockKind) tags.push(chunk.blockKind);
  return tags;
}

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
