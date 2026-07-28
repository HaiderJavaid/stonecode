const languageCandidates = {
  javascript: ["javascript", "node.js"],
  typescript: ["typescript"],
  python: ["python"],
  ruby: ["ruby"],
  php: ["php"],
  java: ["java"],
  csharp: ["c#", "c sharp"],
  cpp: ["c++"],
  c: ["c ("],
  go: ["go ("],
  rust: ["rust"],
  swift: ["swift"],
  kotlin: ["kotlin"],
  dart: ["dart"],
  sql: ["sql", "sqlite"],
  r: ["r ("],
  julia: ["julia"],
  fortran: ["fortran"],
  cobol: ["cobol"],
  basic: ["basic", "visual basic"]
};

const languageCache = new Map();

export async function resolveJudge0LanguageId({ config, languageId, fetchImpl = fetch }) {
  const languages = await loadJudge0Languages(config, fetchImpl);
  const candidates = languageCandidates[languageId] ?? [languageId];
  const match = languages.find((language) => {
    const name = String(language?.name ?? "").toLowerCase();
    return candidates.some((candidate) => name === candidate || name.startsWith(candidate) || name.includes(candidate));
  });
  if (!match || !Number.isInteger(match.id)) {
    const error = new Error(`The configured Judge0 instance does not provide ${languageId}.`);
    error.code = "execution_language_unavailable";
    error.status = 400;
    throw error;
  }
  return match.id;
}

export function buildJudge0Headers(config) {
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers[config.apiKeyHeader] = config.apiKey;
  if (config.rapidApiHost) headers["X-RapidAPI-Host"] = config.rapidApiHost;
  return headers;
}

async function loadJudge0Languages(config, fetchImpl) {
  const cacheKey = `${config.apiUrl}:${config.apiKeyHeader}:${config.rapidApiHost}`;
  const cached = languageCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < 300_000) return cached.languages;
  const response = await fetchImpl(`${config.apiUrl}/languages`, {
    headers: buildJudge0Headers(config),
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload)) {
    const error = new Error(payload?.message ?? `Judge0 languages request failed with HTTP ${response.status}.`);
    error.code = "execution_provider_error";
    error.status = 502;
    throw error;
  }
  languageCache.set(cacheKey, { languages: payload, loadedAt: Date.now() });
  return payload;
}
