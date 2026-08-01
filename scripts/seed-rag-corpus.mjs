import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { curatedRagChunks } from "../server/rag/curriculum-sources.mjs";
import {
  chooseExpectedChunkKeys,
  collectOfficialSource
} from "../server/rag/official-source-ingestion.mjs";
import { technologyCorpora, validateTechnologyCorpora } from "../server/rag/technology-corpora.mjs";
import { requestEmbedding, requestEmbeddings } from "../server/rag/retrieve.mjs";
import { resolveTutorProviderConfig } from "../server/llm-providers.mjs";

loadLocalEnv();

const args = parseArguments(process.argv.slice(2));
const validation = validateTechnologyCorpora();
if (!validation.valid) throw new Error(validation.errors.join("\n"));
if (!args.technology && !args.all) {
  throw new Error("Choose one corpus with --technology=<id>, or intentionally select every corpus with --all.");
}
const selectedCorpora = args.all
  ? technologyCorpora
  : technologyCorpora.filter((corpus) => corpus.technologyId === args.technology);
if (!selectedCorpora.length) throw new Error(`Unknown technology filter: ${args.technology}`);

let admin = null;
let providerConfig = null;
if (!args.dryRun) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service role is required to ingest RAG corpora.");
  providerConfig = resolveTutorProviderConfig(process.env);
  if (providerConfig.error) throw new Error(providerConfig.error);
  admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await seedCurriculumGuidance();
}

for (const corpus of selectedCorpora) {
  const collectedSources = [];
  for (const source of corpus.sources) {
    const collected = await collectOfficialSource({
      technologyId: corpus.technologyId,
      source,
      maxPages: args.maxPages,
      respectRobots: !args.ignoreRobots
    });
    collectedSources.push({ source, collected });
    console.log(`${corpus.technologyId}: fetched ${collected.pages.length} pages, extracted ${collected.chunks.length} chunks, skipped ${collected.warnings.length} invalid links, hash=${collected.contentHash.slice(0, 16)}`);
  }
  if (!args.dryRun) await persistTechnologyCorpus(corpus, collectedSources);
}

console.log(args.dryRun
  ? `dry-run complete for ${selectedCorpora.length} corpus/corpora; no database rows or embeddings were written`
  : `ingested ${selectedCorpora.length} corpus/corpora as pending review; run npm run review:rag -- --technology=<id> before approval`);

async function seedCurriculumGuidance() {
  for (const chunk of curatedRagChunks.filter((item) => item.sourceType === "stonecode-curriculum")) {
    const document = await upsertDocument({
      sourceKey: chunk.id,
      sourceType: chunk.sourceType,
      title: chunk.title,
      url: null,
      corpusId: null,
      sourceVersion: "stonecode:v1",
      license: "proprietary",
      metadata: { seeded: true, provenanceStatus: "approved" }
    });
    const embedding = await requestEmbedding({ config: providerConfig, input: `${chunk.title}\n${chunk.content}` });
    await upsertChunk(document.id, {
      key: chunk.id,
      title: chunk.title,
      content: chunk.content,
      subjectTags: [],
      taskTags: inferTaskTags(chunk),
      kind: chunk.kind,
      blockKind: chunk.blockKind ?? null,
      metadata: { curriculum: true },
      embedding: embedding.embedding
    });
  }
}

async function persistTechnologyCorpus(corpus, collectedSources) {
  const { data: corpusRow, error: corpusError } = await admin
    .from("rag_corpora")
    .upsert({
      corpus_key: corpus.corpusKey,
      technology_id: corpus.technologyId,
      version: corpus.version,
      status: "ingesting",
      provenance_complete: false,
      top_five_relevance: null,
      cross_language_leakage_count: 0,
      enabled_at: null
    }, { onConflict: "corpus_key,version" })
    .select("id")
    .single();
  if (corpusError) throw corpusError;

  const { data: ingestion, error: ingestionError } = await admin
    .from("rag_ingestion_runs")
    .insert({
      corpus_id: corpusRow.id,
      status: "running",
      source_count: collectedSources.length,
      chunk_count: 0,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (ingestionError) throw ingestionError;

  try {
    const allChunks = [];
    for (const { source, collected } of collectedSources) {
      const embeddedChunks = await embedChunks(collected.chunks);
      const existing = await findDocument(source.key);
      const unchangedApproval = existing?.metadata?.provenanceStatus === "approved"
        && existing.metadata.contentHash === collected.contentHash;
      const document = await upsertDocument({
        sourceKey: source.key,
        sourceType: "official-docs",
        title: source.title,
        url: collected.sourceUrl,
        corpusId: corpusRow.id,
        sourceVersion: collected.sourceVersion,
        license: unchangedApproval ? existing.license : "pending-review",
        metadata: {
          technologyId: corpus.technologyId,
          provenanceStatus: unchangedApproval ? "approved" : "pending_review",
          contentHash: collected.contentHash,
          pageUrls: collected.pageUrls,
          pageCount: collected.pages.length,
          chunkCount: embeddedChunks.length,
          retrievedAt: collected.retrievedAt,
          ingestionWarnings: collected.warnings,
          approvalInvalidatedByContentChange: Boolean(existing?.metadata?.contentHash && !unchangedApproval)
        }
      });
      const activeKeys = new Set();
      for (const chunk of embeddedChunks) {
        activeKeys.add(chunk.key);
        await upsertChunk(document.id, {
          ...chunk,
          subjectTags: [corpus.technologyId, corpus.displayName.toLowerCase()],
          taskTags: ["course-generation", "tutor", "grading"],
          kind: "official-reference",
          blockKind: null,
          metadata: { ...chunk.metadata, sourceKey: source.key, sourceVersion: collected.sourceVersion }
        });
      }
      await deleteStaleChunks(document.id, activeKeys);
      allChunks.push(...embeddedChunks);
    }

    for (const fixture of corpus.evaluationFixtures) {
      const expectedChunkKeys = chooseExpectedChunkKeys(allChunks, fixture.query, 10);
      const { error } = await admin.from("rag_evaluation_cases").upsert({
        corpus_id: corpusRow.id,
        case_key: fixture.key,
        query: fixture.query,
        expected_chunk_keys: expectedChunkKeys,
        forbidden_technology_ids: fixture.forbiddenTechnologyIds
      }, { onConflict: "corpus_id,case_key" });
      if (error) throw error;
    }

    const { error: completionError } = await admin.from("rag_ingestion_runs").update({
      status: "succeeded",
      chunk_count: allChunks.length,
      completed_at: new Date().toISOString()
    }).eq("id", ingestion.id);
    if (completionError) throw completionError;
    const { error: statusError } = await admin.from("rag_corpora").update({ status: "evaluating" }).eq("id", corpusRow.id);
    if (statusError) throw statusError;
  } catch (error) {
    await admin.from("rag_ingestion_runs").update({
      status: "failed",
      error_message: String(error?.message ?? error).slice(0, 1200),
      completed_at: new Date().toISOString()
    }).eq("id", ingestion.id);
    await admin.from("rag_corpora").update({ status: "disabled" }).eq("id", corpusRow.id);
    throw error;
  }
}

async function embedChunks(chunks) {
  const embedded = [];
  for (let index = 0; index < chunks.length; index += 32) {
    const batch = chunks.slice(index, index + 32);
    const result = await requestEmbeddings({
      config: providerConfig,
      inputs: batch.map((chunk) => `${chunk.title}\n${chunk.content}`)
    });
    if (result.embeddings.length !== batch.length || result.embeddings.some((embedding) => embedding.length !== 1536)) {
      throw new Error("Embedding provider returned an unexpected batch shape.");
    }
    embedded.push(...batch.map((chunk, offset) => ({ ...chunk, embedding: result.embeddings[offset] })));
  }
  return embedded;
}

async function findDocument(sourceKey) {
  const { data, error } = await admin.from("rag_documents").select("id,url,source_version,license,metadata").eq("source_key", sourceKey).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function upsertDocument({ sourceKey, sourceType, title, url, corpusId, sourceVersion, license, metadata }) {
  const { data, error } = await admin.from("rag_documents").upsert({
    source_key: sourceKey,
    source_type: sourceType,
    title,
    url,
    corpus_id: corpusId,
    source_version: sourceVersion,
    license,
    retrieved_at: new Date().toISOString(),
    metadata,
    updated_at: new Date().toISOString()
  }, { onConflict: "source_key" }).select("id").single();
  if (error) throw error;
  return data;
}

async function upsertChunk(documentId, chunk) {
  const { error } = await admin.from("rag_chunks").upsert({
    document_id: documentId,
    chunk_key: chunk.key,
    subject_tags: chunk.subjectTags,
    task_tags: chunk.taskTags,
    kind: chunk.kind,
    block_kind: chunk.blockKind,
    title: chunk.title,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: chunk.embedding,
    updated_at: new Date().toISOString()
  }, { onConflict: "chunk_key" });
  if (error) throw error;
}

async function deleteStaleChunks(documentId, activeKeys) {
  const { data, error } = await admin.from("rag_chunks").select("id,chunk_key").eq("document_id", documentId);
  if (error) throw error;
  const staleIds = (data ?? []).filter((row) => !activeKeys.has(row.chunk_key)).map((row) => row.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error: deletionError } = await admin.from("rag_chunks").delete().in("id", staleIds.slice(index, index + 100));
    if (deletionError) throw deletionError;
  }
}

function inferTaskTags(chunk) {
  const tags = ["course-generation"];
  if (chunk.kind === "project-spine") tags.push("blueprint");
  if (chunk.blockKind) tags.push(chunk.blockKind);
  return tags;
}

function parseArguments(values) {
  const valueFor = (name) => values.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
  return {
    technology: valueFor("--technology")?.trim().toLowerCase() || null,
    all: values.includes("--all"),
    dryRun: values.includes("--dry-run"),
    ignoreRobots: values.includes("--ignore-robots"),
    maxPages: Math.min(Math.max(Number.parseInt(valueFor("--max-pages") ?? "4", 10) || 4, 1), 20)
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
