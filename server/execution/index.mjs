import { executeWithJudge0 } from "./judge0-adapter.mjs";
import {
  consumeExecutionRateLimit,
  executionError,
  normalizeExecutionInput,
  resolveExecutionConfig
} from "./execution-policy.mjs";

export { resolveExecutionConfig } from "./execution-policy.mjs";

export async function runSandboxedCode({ env, userId, input, fetchImpl = fetch, consumeRateLimit = true }) {
  const config = resolveExecutionConfig(env);
  if (!config.configured) {
    throw executionError("execution_not_configured", "The multi-language execution sandbox is not configured yet.", 503);
  }
  if (consumeRateLimit) {
    const rate = consumeExecutionRateLimit(userId, config);
    if (!rate.allowed) throw executionError("execution_rate_limited", "Too many code runs. Wait one minute and try again.", 429);
  }
  const normalizedInput = normalizeExecutionInput(input, config);
  if (config.provider === "judge0") {
    return executeWithJudge0({ config, input: normalizedInput, fetchImpl });
  }
  throw executionError("execution_provider_unsupported", `Unsupported execution provider: ${config.provider}.`, 503);
}

export async function gradeWithSandbox({ env, userId, language, filePath, code, starterCode, resultCode, fetchImpl = fetch }) {
  const learner = await runSandboxedCode({ env, userId, input: { language, filePath, code }, fetchImpl });
  if (!learner.ok) return { passed: false, feedback: executionFeedback(learner), execution: learner };
  const hasOracle = typeof resultCode === "string" && resultCode.trim() && resultCode.trim() !== String(starterCode ?? "").trim();
  if (!hasOracle) return { passed: true, feedback: "Code compiled and ran successfully.", execution: learner };
  const oracle = await runSandboxedCode({
    env,
    userId,
    input: { language, filePath, code: resultCode },
    fetchImpl,
    consumeRateLimit: false
  });
  if (!oracle.ok) {
    throw executionError("execution_oracle_invalid", "The generated expected solution did not run. This exercise needs regeneration.", 502);
  }
  const passed = normalizeOutput(learner.stdout) === normalizeOutput(oracle.stdout);
  return {
    passed,
    feedback: passed ? "Code ran and matched the expected behavior." : buildOutputMismatchFeedback(learner.stdout, oracle.stdout),
    execution: learner
  };
}

function executionFeedback(result) {
  if (result.status === "compile_error") return `Compilation failed. ${result.stderr || "Check the syntax and try again."}`.slice(0, 800);
  if (result.status === "timeout") return "Execution timed out. Check for an infinite loop or work that is too large.";
  return `Execution stopped. ${result.stderr || "Check the runtime error and try again."}`.slice(0, 800);
}

function buildOutputMismatchFeedback(actual, expected) {
  const actualText = normalizeOutput(actual) || "(no output)";
  const expectedText = normalizeOutput(expected) || "(no output)";
  return `Code ran, but the visible result differs. Received: ${actualText.slice(0, 180)}. Expected: ${expectedText.slice(0, 180)}.`;
}

function normalizeOutput(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}
