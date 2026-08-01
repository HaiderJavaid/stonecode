import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chooseExpectedChunkKeys, collectOfficialSource } from "../server/rag/official-source-ingestion.mjs";
import { findLearningDomainCorpus, learningDomainCorpora, validateLearningDomainCorpora } from "../server/rag/learning-domain-corpora.mjs";
import { requestEmbeddings } from "../server/rag/retrieve.mjs";
import { resolveTutorProviderConfig } from "../server/llm-providers.mjs";

loadLocalEnv();
const args = parseArguments(process.argv.slice(2));
const validation = validateLearningDomainCorpora();
if (!validation.valid) throw new Error(validation.errors.join("\n"));
if (!args.domain && !args.all) throw new Error("Choose --domain=<id> or intentionally use --all.");
const selected = args.all ? learningDomainCorpora : [findLearningDomainCorpus(args.domain)].filter(Boolean);
if (!selected.length) throw new Error(`Unknown learning domain: ${args.domain}`);

let admin;
let providerConfig;
if (!args.dryRun) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service role is required.");
  providerConfig = resolveTutorProviderConfig(process.env);
  if (providerConfig.error) throw new Error(providerConfig.error);
  admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
for (const corpus of selected) {
  const collectedSources = [];
  for (const source of corpus.sources) {
    if (source.ingestionMode === "official_html") {
      const collected = await collectOfficialSource({ technologyId: corpus.domainId, source, maxPages: args.maxPages, respectRobots: !args.ignoreRobots });
      collectedSources.push({ source, collected });
      console.log(`${corpus.domainId}: fetched ${collected.pages.length} pages, ${collected.chunks.length} chunks, hash=${collected.contentHash.slice(0, 16)}`);
    } else {
      const contentHash = sha256((source.chunks ?? []).map((chunk) => `${chunk.title}\n${chunk.content}`).join("\n\n"));
      collectedSources.push({
        source,
        collected: {
          sourceUrl: null,
          sourceVersion: source.sourceVersion,
          contentHash,
          retrievedAt: new Date().toISOString(),
          pageUrls: [],
          pages: [],
          warnings: [],
          chunks: corpus.chunks.filter((chunk) => chunk.sourceKey === source.key)
        }
      });
      console.log(`${corpus.domainId}: prepared ${source.chunks.length} Stonecode-authored chunks, hash=${contentHash.slice(0, 16)}`);
    }
  }
  if (!args.dryRun) await persistCorpus(corpus, collectedSources);
}

console.log(args.dryRun
  ? `dry-run complete for ${selected.length} domain corpus/corpora; no database writes`
  : `ingested ${selected.length} domain corpus/corpora as pending review; approve sources, evaluate, then approve each capability manifest`);

async function persistCorpus(corpus, collectedSources) {
  const { data: corpusRow, error: corpusError } = await admin.from("rag_corpora").upsert({
    corpus_key: corpus.corpusKey,
    technology_id: null,
    domain_id: corpus.domainId,
    version: corpus.version,
    status: "ingesting",
    provenance_complete: false,
    top_five_relevance: null,
    cross_language_leakage_count: 0,
    enabled_at: null
  }, { onConflict: "corpus_key,version" }).select("id").single();
  if (corpusError) throw corpusError;
  const { data: run, error: runError } = await admin.from("rag_ingestion_runs").insert({
    corpus_id: corpusRow.id,
    status: "running",
    source_count: collectedSources.length,
    chunk_count: 0,
    started_at: new Date().toISOString()
  }).select("id").single();
  if (runError) throw runError;

  try {
    const allChunks = [];
    for (const { source, collected } of collectedSources) {
      const embeddedChunks = await embedChunks(collected.chunks);
      const existing = await findDocument(source.key);
      const unchangedApproval = existing?.metadata?.provenanceStatus === "approved" && existing.metadata.contentHash === collected.contentHash;
      const document = await upsertDocument({
        source_key: source.key,
        source_type: source.ingestionMode === "official_html" ? "official-docs" : "stonecode-curriculum",
        title: source.title,
        url: collected.sourceUrl,
        corpus_id: corpusRow.id,
        source_version: collected.sourceVersion,
        license: unchangedApproval ? existing.license : "pending-review",
        retrieved_at: collected.retrievedAt,
        metadata: {
          domainId: corpus.domainId,
          ingestionMode: source.ingestionMode,
          provenanceStatus: unchangedApproval ? "approved" : "pending_review",
          reviewedLicense: source.license,
          licenseUrl: source.licenseUrl,
          attribution: source.ingestionMode === "official_html" ? `${source.title} (${source.url})` : "Stonecode-authored material",
          references: source.references ?? [],
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
          subjectTags: [corpus.domainId, corpus.displayName.toLowerCase()],
          taskTags: ["course-generation", "guided-project", "exercise-generation", "tutor"],
          kind: source.ingestionMode === "official_html" ? "official-reference" : "domain-foundation",
          blockKind: null,
          metadata: { ...chunk.metadata, domainId: corpus.domainId, sourceKey: source.key }
        });
      }
      await deleteStaleChunks(document.id, activeKeys);
      allChunks.push(...embeddedChunks);
    }
    for (const fixture of corpus.evaluationFixtures) {
      const { error } = await admin.from("rag_evaluation_cases").upsert({
        corpus_id: corpusRow.id,
        case_key: fixture.key,
        query: fixture.query,
        expected_chunk_keys: chooseExpectedChunkKeys(allChunks, fixture.query, 10),
        forbidden_technology_ids: [],
        forbidden_domain_ids: fixture.forbiddenDomainIds
      }, { onConflict: "corpus_id,case_key" });
      if (error) throw error;
    }
    await admin.from("rag_ingestion_runs").update({ status: "succeeded", chunk_count: allChunks.length, completed_at: new Date().toISOString() }).eq("id", run.id).throwOnError();
    await admin.from("rag_corpora").update({ status: "evaluating" }).eq("id", corpusRow.id).throwOnError();
  } catch (error) {
    await admin.from("rag_ingestion_runs").update({ status: "failed", error_message: String(error?.message ?? error).slice(0, 1200), completed_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("rag_corpora").update({ status: "disabled" }).eq("id", corpusRow.id);
    throw error;
  }
}

async function embedChunks(chunks) {
  const output = [];
  for (let index = 0; index < chunks.length; index += 32) {
    const batch = chunks.slice(index, index + 32);
    const result = await requestEmbeddings({ config: providerConfig, inputs: batch.map((chunk) => `${chunk.title}\n${chunk.content}`) });
    if (result.embeddings.length !== batch.length || result.embeddings.some((embedding) => embedding.length !== 1536)) throw new Error("Embedding provider returned an unexpected shape.");
    output.push(...batch.map((chunk, offset) => ({ ...chunk, embedding: result.embeddings[offset] })));
  }
  return output;
}

async function findDocument(sourceKey) {
  const { data, error } = await admin.from("rag_documents").select("id,license,metadata").eq("source_key", sourceKey).maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertDocument(value) {
  const { data, error } = await admin.from("rag_documents").upsert({ ...value, updated_at: new Date().toISOString() }, { onConflict: "source_key" }).select("id").single();
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
  const stale = (data ?? []).filter((row) => !activeKeys.has(row.chunk_key)).map((row) => row.id);
  for (let index = 0; index < stale.length; index += 100) {
    const { error: deletionError } = await admin.from("rag_chunks").delete().in("id", stale.slice(index, index + 100));
    if (deletionError) throw deletionError;
  }
}

function parseArguments(values) {
  const valueFor = (name) => values.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
  return {
    domain: valueFor("--domain")?.trim().toLowerCase() || null,
    all: values.includes("--all"),
    dryRun: values.includes("--dry-run"),
    ignoreRobots: values.includes("--ignore-robots"),
    maxPages: Math.min(Math.max(Number.parseInt(valueFor("--max-pages") ?? "6", 10) || 6, 1), 20)
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
