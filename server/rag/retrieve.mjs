import { selectCuratedRagChunks } from "./curriculum-sources.mjs";
import { resolveRagTechnologyId } from "./technology-corpora.mjs";

const defaultEmbeddingModel = "text-embedding-3-small";

export async function retrieveRagContext({ admin = null, config = null, technologyId = null, domainId = null, subject = "", task = "course-generation", query = "", limit = 8 } = {}) {
  const curated = selectCuratedRagChunks({ subject, task, limit });
  if (!admin) return curated;
  const resolvedTechnologyId = technologyId || resolveRagTechnologyId(subject);
  const [technologyChunks, domainChunks] = await Promise.all([
    retrieveApprovedScopedChunks({ admin, scopeColumn: "technology_id", scopeId: resolvedTechnologyId, query: `${subject} ${task} ${query}`, limit }).catch(() => []),
    retrieveApprovedScopedChunks({ admin, scopeColumn: "domain_id", scopeId: domainId === "programming" ? null : domainId, query: `${subject} ${task} ${query}`, limit }).catch(() => [])
  ]);
  const lexical = interleaveChunks(domainChunks, technologyChunks);
  if (!config?.apiKey) return selectScopedChunks(mergeChunks(lexical, curated), { domainId, technologyId: resolvedTechnologyId, limit });

  const embeddingResult = await requestEmbedding({ config, input: `${subject}\n${task}\n${query}` }).catch(() => null);
  if (!embeddingResult?.embedding?.length) return selectScopedChunks(mergeChunks(lexical, curated), { domainId, technologyId: resolvedTechnologyId, limit });

  const { data, error } = await admin.rpc("match_rag_chunks", {
    query_embedding: embeddingResult.embedding,
    match_count: limit,
    match_subject: subject || null,
    match_task: task || null,
    match_technology: resolvedTechnologyId,
    include_draft: false,
    match_domain: domainId === "programming" ? null : domainId
  });

  if (error || !Array.isArray(data) || !data.length) return selectScopedChunks(mergeChunks(lexical, curated), { domainId, technologyId: resolvedTechnologyId, limit });

  const vectorChunks = data.map((row) => ({
    id: row.chunk_id ?? row.id,
    sourceType: row.source_type ?? "vector",
    kind: row.kind ?? "retrieved",
    blockKind: row.block_kind ?? undefined,
    title: row.title ?? "Retrieved context",
    url: row.url ?? undefined,
    content: row.content ?? "",
    technologyId: row.technology_id ?? undefined,
    domainId: row.domain_id ?? undefined,
    corpusVersion: Number.isInteger(row.corpus_version) ? row.corpus_version : undefined,
    similarity: row.similarity
  })).filter((chunk) => chunk.content);

  return selectScopedChunks(mergeChunks(vectorChunks, mergeChunks(lexical, curated)), { domainId, technologyId: resolvedTechnologyId, limit });
}

export async function requestEmbedding({ config, input }) {
  const result = await requestEmbeddings({ config, inputs: [input] });
  return { model: result.model, embedding: result.embeddings[0] ?? [] };
}

export async function requestEmbeddings({ config, inputs }) {
  const model = config.embeddingModel ?? process.env.OPENAI_MODEL_EMBEDDING ?? defaultEmbeddingModel;
  const normalizedInputs = (Array.isArray(inputs) ? inputs : [inputs])
    .map((input) => String(input ?? "").slice(0, 7000))
    .filter(Boolean);
  if (!normalizedInputs.length || normalizedInputs.length > 64) throw new Error("Embedding batches require 1 to 64 non-empty inputs.");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: normalizedInputs
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `OpenAI embedding request failed with HTTP ${response.status}.`);
  }
  return {
    model,
    embeddings: [...(payload?.data ?? [])]
      .sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0))
      .map((item) => item?.embedding ?? [])
  };
}

async function retrieveApprovedScopedChunks({ admin, scopeColumn, scopeId, query, limit }) {
  if (!scopeId || !["technology_id", "domain_id"].includes(scopeColumn)) return [];
  const selectColumns = scopeColumn === "technology_id" ? "id,version,technology_id" : "id,version,domain_id";
  const { data: corpus, error: corpusError } = await admin
    .from("rag_corpora")
    .select(selectColumns)
    .eq(scopeColumn, scopeId)
    .eq("status", "enabled")
    .eq("provenance_complete", true)
    .gte("top_five_relevance", 0.9)
    .eq("cross_language_leakage_count", 0)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (corpusError || !corpus) return [];
  const { data: documents, error: documentError } = await admin
    .from("rag_documents")
    .select("id,source_type,title,url")
    .eq("corpus_id", corpus.id);
  if (documentError || !Array.isArray(documents) || !documents.length) return [];
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const { data: chunks, error: chunkError } = await admin
    .from("rag_chunks")
    .select("id,document_id,chunk_key,kind,block_kind,title,content")
    .in("document_id", documents.map((document) => document.id))
    .limit(200);
  if (chunkError || !Array.isArray(chunks)) return [];
  const tokens = String(query).toLowerCase().split(/[^a-z0-9+#.]+/).filter((token) => token.length > 2);
  return chunks.map((chunk) => {
    const document = documentsById.get(chunk.document_id);
    const haystack = `${chunk.title} ${chunk.content}`.toLowerCase();
    const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
    return { chunk, document, score };
  }).sort((left, right) => right.score - left.score || String(left.chunk.chunk_key).localeCompare(String(right.chunk.chunk_key)))
    .slice(0, limit)
    .map(({ chunk, document }) => ({
      id: chunk.chunk_key ?? chunk.id,
      sourceType: document?.source_type ?? "official-docs",
      kind: chunk.kind,
      blockKind: chunk.block_kind ?? undefined,
      title: chunk.title,
      url: document?.url ?? undefined,
      content: chunk.content,
      corpusVersion: corpus.version,
      technologyId: corpus.technology_id ?? undefined,
      domainId: corpus.domain_id ?? undefined
    }));
}

function mergeChunks(primary, secondary) {
  const seen = new Set();
  const merged = [];
  for (const chunk of [...primary, ...secondary]) {
    if (!chunk?.id || seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    merged.push(chunk);
  }
  return merged;
}

function interleaveChunks(left, right) {
  const output = [];
  const maximum = Math.max(left.length, right.length);
  for (let index = 0; index < maximum; index += 1) {
    if (left[index]) output.push(left[index]);
    if (right[index]) output.push(right[index]);
  }
  return output;
}

function selectScopedChunks(chunks, { domainId, technologyId, limit }) {
  const required = [];
  if (domainId && domainId !== "programming") required.push(chunks.find((chunk) => chunk.domainId === domainId));
  if (technologyId) required.push(chunks.find((chunk) => chunk.technologyId === technologyId));
  return mergeChunks(required.filter(Boolean), chunks).slice(0, limit);
}
