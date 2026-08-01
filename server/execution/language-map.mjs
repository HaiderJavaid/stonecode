const languageCandidates = {
  javascript: ["javascript", "node.js"],
  typescript: ["typescript"],
  python: ["python"],
  ruby: ["ruby"],
  php: ["php"],
  java: ["java"],
  csharp: ["c#", "c sharp"],
  cpp: ["c++"],
  c: ["c"],
  go: ["go"],
  rust: ["rust"],
  swift: ["swift"],
  kotlin: ["kotlin"],
  dart: ["dart"],
  sql: ["sql", "sqlite"],
  r: ["r"],
  julia: ["julia"],
  fortran: ["fortran"],
  cobol: ["cobol"],
  basic: ["basic", "visual basic"]
};

// R 4.4 exceeds the production three-second CPU ceiling on the configured
// Judge0 provider even for a one-line program. Keep the reviewed 4.0 runtime
// pinned; if it disappears, R becomes unavailable until a replacement passes QA.
const reviewedRuntimePatterns = {
  r: [/^r \(4\.0\.0\)$/]
};

const languageCache = new Map();

export async function resolveJudge0LanguageId({ config, languageId, fetchImpl = fetch }) {
  const languages = await listJudge0Languages(config, fetchImpl);
  const match = selectJudge0Language(languages, languageId);
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

export async function listJudge0Languages(config, fetchImpl = fetch) {
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

export function judge0LanguageAvailable(languages, languageId) {
  return Boolean(selectJudge0Language(languages, languageId));
}

export function selectJudge0Language(languages, languageId) {
  const candidates = languageCandidates[languageId] ?? [languageId];
  const matches = (Array.isArray(languages) ? languages : [])
    .filter((language) => {
      const name = String(language?.name ?? "").toLowerCase();
      return candidates.some((candidate) => languageNameMatches(name, candidate));
    });
  const reviewedPatterns = reviewedRuntimePatterns[languageId];
  const reviewedMatches = reviewedPatterns
    ? matches.filter((language) => reviewedPatterns.some((pattern) => pattern.test(String(language?.name ?? "").toLowerCase())))
    : matches;
  return reviewedMatches.sort(compareLanguageVersions)[0] ?? null;
}

function languageNameMatches(name, candidate) {
  if (name === candidate) return true;
  if (!name.startsWith(candidate)) return false;
  return /^[\s.(]/.test(name.slice(candidate.length));
}

function compareLanguageVersions(left, right) {
  const leftVersion = extractVersionParts(left?.name);
  const rightVersion = extractVersionParts(right?.name);
  for (let index = 0; index < Math.max(leftVersion.length, rightVersion.length); index += 1) {
    const difference = (rightVersion[index] ?? 0) - (leftVersion[index] ?? 0);
    if (difference) return difference;
  }
  return Number(right?.id ?? 0) - Number(left?.id ?? 0);
}

function extractVersionParts(name) {
  return (String(name ?? "").match(/\d+(?:\.\d+)+/)?.[0] ?? "0")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}
