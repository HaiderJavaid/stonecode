import { selectCuratedRagChunks } from "./curriculum-sources.mjs";

const defaultEmbeddingModel = "text-embedding-3-small";

export async function retrieveRagContext({ admin = null, config = null, subject = "", task = "course-generation", query = "", limit = 8 } = {}) {
  const curated = selectCuratedRagChunks({ subject, task, limit });
  if (!admin || !config?.apiKey) return curated;

  const embeddingResult = await requestEmbedding({ config, input: `${subject}\n${task}\n${query}` }).catch(() => null);
  if (!embeddingResult?.embedding?.length) return curated;

  const { data, error } = await admin.rpc("match_rag_chunks", {
    query_embedding: embeddingResult.embedding,
    match_count: limit,
    match_subject: subject || null,
    match_task: task || null
  });

  if (error || !Array.isArray(data) || !data.length) return curated;

  const vectorChunks = data.map((row) => ({
    id: row.chunk_id ?? row.id,
    sourceType: row.source_type ?? "vector",
    kind: row.kind ?? "retrieved",
    blockKind: row.block_kind ?? undefined,
    title: row.title ?? "Retrieved context",
    url: row.url ?? undefined,
    content: row.content ?? "",
    similarity: row.similarity
  })).filter((chunk) => chunk.content);

  return mergeChunks(vectorChunks, curated).slice(0, limit);
}

export async function requestEmbedding({ config, input }) {
  const model = config.embeddingModel ?? process.env.OPENAI_MODEL_EMBEDDING ?? defaultEmbeddingModel;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: String(input).slice(0, 7000)
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `OpenAI embedding request failed with HTTP ${response.status}.`);
  }
  return {
    model,
    embedding: payload?.data?.[0]?.embedding ?? []
  };
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
