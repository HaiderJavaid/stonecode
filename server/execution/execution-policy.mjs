import { findCourseLanguageCapability } from "../course-generation/language-capabilities.mjs";

const DEFAULT_CODE_LIMIT = 64_000;
const DEFAULT_STDIN_LIMIT = 8_000;
const DEFAULT_OUTPUT_LIMIT = 32_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MEMORY_KB = 131_072;
const RATE_WINDOW_MS = 60_000;
const rateState = new Map();

export function resolveExecutionConfig(env) {
  const apiUrl = trimUrl(env.JUDGE0_API_URL);
  const provider = env.CODE_RUNNER_PROVIDER ?? (apiUrl ? "judge0" : "disabled");
  return {
    provider,
    configured: provider === "judge0" && Boolean(apiUrl),
    apiUrl,
    apiKey: env.JUDGE0_API_KEY ?? "",
    apiKeyHeader: env.JUDGE0_API_KEY_HEADER ?? "X-Auth-Token",
    rapidApiHost: env.JUDGE0_RAPIDAPI_HOST ?? "",
    timeoutMs: boundedNumber(env.EXECUTION_TIMEOUT_MS, 500, 15_000, DEFAULT_TIMEOUT_MS),
    memoryKb: boundedNumber(env.EXECUTION_MEMORY_KB, 32_000, 512_000, DEFAULT_MEMORY_KB),
    outputLimit: boundedNumber(env.EXECUTION_OUTPUT_LIMIT, 1_000, 100_000, DEFAULT_OUTPUT_LIMIT),
    codeLimit: boundedNumber(env.EXECUTION_CODE_LIMIT, 1_000, 150_000, DEFAULT_CODE_LIMIT),
    stdinLimit: boundedNumber(env.EXECUTION_STDIN_LIMIT, 0, 32_000, DEFAULT_STDIN_LIMIT),
    runsPerMinute: boundedNumber(env.EXECUTION_RUNS_PER_MINUTE, 1, 120, 20)
  };
}

export function normalizeExecutionInput(input, config) {
  const code = typeof input?.code === "string" ? input.code : "";
  const stdin = typeof input?.stdin === "string" ? input.stdin : "";
  const filePath = typeof input?.filePath === "string" ? input.filePath.trim().slice(0, 160) : "";
  const requestedLanguage = typeof input?.language === "string" && input.language.trim()
    ? input.language
    : filePath;
  const capability = findCourseLanguageCapability(requestedLanguage);
  if (!code.trim()) throw executionError("execution_empty_code", "Code is required.", 400);
  if (code.length > config.codeLimit) throw executionError("execution_code_too_large", `Code exceeds the ${config.codeLimit} character limit.`, 413);
  if (stdin.length > config.stdinLimit) throw executionError("execution_stdin_too_large", `Input exceeds the ${config.stdinLimit} character limit.`, 413);
  if (!capability) throw executionError("execution_language_unsupported", "This language is not registered for sandbox execution.", 400);
  if (["html", "css"].includes(capability.id)) throw executionError("execution_preview_only", `${capability.label} uses the Visual preview instead of the code sandbox.`, 400);
  return {
    language: capability.label,
    languageId: capability.id,
    filePath: filePath || capability.filePath,
    code,
    stdin
  };
}

export function consumeExecutionRateLimit(userId, config, now = Date.now()) {
  const key = String(userId ?? "anonymous");
  const current = rateState.get(key);
  if (!current || now - current.windowStartedAt >= RATE_WINDOW_MS) {
    rateState.set(key, { windowStartedAt: now, count: 1 });
    return { allowed: true, remaining: Math.max(0, config.runsPerMinute - 1) };
  }
  if (current.count >= config.runsPerMinute) return { allowed: false, remaining: 0 };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, config.runsPerMinute - current.count) };
}

export function truncateExecutionOutput(value, limit) {
  const text = typeof value === "string" ? value : "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[output truncated]`;
}

export function executionError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function trimUrl(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function boundedNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), minimum), maximum);
}
