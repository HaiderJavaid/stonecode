import { buildJudge0Headers, resolveJudge0LanguageId } from "./language-map.mjs";
import { truncateExecutionOutput } from "./execution-policy.mjs";

export async function executeWithJudge0({ config, input, fetchImpl = fetch }) {
  const languageId = await resolveJudge0LanguageId({ config, languageId: input.languageId, fetchImpl });
  const startedAt = Date.now();
  const response = await fetchImpl(`${config.apiUrl}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: buildJudge0Headers(config),
    signal: AbortSignal.timeout(config.timeoutMs + 5_000),
    body: JSON.stringify({
      language_id: languageId,
      source_code: input.code,
      stdin: input.stdin,
      cpu_time_limit: Math.max(0.5, config.timeoutMs / 1000),
      wall_time_limit: Math.max(1, config.timeoutMs / 1000),
      memory_limit: config.memoryKb,
      max_file_size: Math.max(1024, Math.ceil(config.outputLimit / 1024))
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(payload?.message ?? payload?.error ?? `Judge0 execution failed with HTTP ${response.status}.`);
    error.code = "execution_provider_error";
    error.status = 502;
    throw error;
  }
  return normalizeJudge0Result(payload, config.outputLimit, Date.now() - startedAt);
}

export function normalizeJudge0Result(payload, outputLimit, durationMs = 0) {
  const statusId = Number(payload?.status?.id);
  const stdout = truncateExecutionOutput(payload?.stdout, outputLimit);
  const stderr = truncateExecutionOutput([payload?.compile_output, payload?.stderr, payload?.message].filter(Boolean).join("\n"), outputLimit);
  const status = statusId === 3
    ? "passed"
    : statusId === 5
      ? "timeout"
      : statusId === 6
        ? "compile_error"
        : "runtime_error";
  return {
    ok: status === "passed",
    status,
    stdout,
    stderr,
    exitCode: Number.isInteger(payload?.exit_code) ? payload.exit_code : status === "passed" ? 0 : null,
    timeSeconds: payload?.time == null ? null : Number(payload.time),
    memoryKb: payload?.memory == null ? null : Number(payload.memory),
    durationMs
  };
}
