import assert from "node:assert/strict";
import { gradeWithSandbox, runSandboxedCode } from "../server/execution/index.mjs";
import { normalizeJudge0Result } from "../server/execution/judge0-adapter.mjs";
import { normalizeExecutionInput, resolveExecutionConfig } from "../server/execution/execution-policy.mjs";

const env = {
  CODE_RUNNER_PROVIDER: "judge0",
  JUDGE0_API_URL: "https://judge0.test",
  JUDGE0_API_KEY: "secret",
  EXECUTION_TIMEOUT_MS: "3000",
  EXECUTION_MEMORY_KB: "65536",
  EXECUTION_OUTPUT_LIMIT: "2000",
  EXECUTION_RUNS_PER_MINUTE: "4"
};

const config = resolveExecutionConfig(env);
assert.equal(config.configured, true);
assert.equal(config.timeoutMs, 3000);
assert.equal(config.memoryKb, 65536);
assert.equal(resolveExecutionConfig({}).configured, false);

const normalized = normalizeExecutionInput({ filePath: "main.py", code: "print('hello')", stdin: "" }, config);
assert.equal(normalized.languageId, "python");
assert.equal(normalized.language, "Python");
assert.throws(() => normalizeExecutionInput({ filePath: "index.html", code: "<h1>x</h1>" }, config), /Visual preview/);
assert.throws(() => normalizeExecutionInput({ filePath: "main.py", code: "" }, config), /Code is required/);
assert.throws(() => normalizeExecutionInput({ language: "Bash", filePath: "script.unknown", code: "echo unsafe" }, config), /not registered/);

const calls = [];
const successfulFetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (url.endsWith("/languages")) return response(200, [{ id: 71, name: "Python (3.8.1)" }]);
  return response(200, { status: { id: 3 }, stdout: "hello\n", stderr: null, exit_code: 0, time: "0.01", memory: 1024 });
};

const runResult = await runSandboxedCode({
  env,
  userId: "runner-user",
  input: { language: "Python", filePath: "main.py", code: "print('hello')" },
  fetchImpl: successfulFetch
});
assert.equal(runResult.ok, true);
assert.equal(runResult.stdout, "hello\n");
assert.equal(calls.length, 2);
const submission = JSON.parse(calls[1].options.body);
assert.equal(submission.language_id, 71);
assert.equal(submission.source_code, "print('hello')");
assert.equal(submission.cpu_time_limit, 3);
assert.equal(submission.memory_limit, 65536);
assert.equal(calls[0].options.headers["X-Auth-Token"], "secret");

const compileFailure = normalizeJudge0Result({ status: { id: 6 }, compile_output: "Syntax error" }, 1000, 12);
assert.equal(compileFailure.ok, false);
assert.equal(compileFailure.status, "compile_error");
assert.match(compileFailure.stderr, /Syntax error/);
const truncated = normalizeJudge0Result({ status: { id: 3 }, stdout: "x".repeat(200) }, 40, 1);
assert.match(truncated.stdout, /output truncated/);

await assert.rejects(
  () => runSandboxedCode({ env: {}, userId: "disabled-user", input: { language: "Python", code: "print('x')" }, fetchImpl: successfulFetch }),
  /not configured/
);

const limitedEnv = { ...env, JUDGE0_API_URL: "https://judge0-limit.test", EXECUTION_RUNS_PER_MINUTE: "1" };
await runSandboxedCode({ userId: "limited-user", env: limitedEnv, input: { language: "Python", code: "print('x')" }, fetchImpl: successfulFetch });
await assert.rejects(
  () => runSandboxedCode({ userId: "limited-user", env: limitedEnv, input: { language: "Python", code: "print('x')" }, fetchImpl: successfulFetch }),
  /Too many code runs/
);

let submissionCount = 0;
const gradingFetch = async (url) => {
  if (url.endsWith("/languages")) return response(200, [{ id: 63, name: "JavaScript (Node.js 12.14.0)" }]);
  submissionCount += 1;
  return response(200, { status: { id: 3 }, stdout: "Hello, Mina\n", exit_code: 0 });
};
const grade = await gradeWithSandbox({
  env: { ...env, JUDGE0_API_URL: "https://judge0-grade.test" },
  userId: "grade-user",
  language: "JavaScript",
  filePath: "main.js",
  code: "console.log('Hello, Mina')",
  starterCode: "console.log('Ready')",
  resultCode: "console.log('Hello, Mina')",
  fetchImpl: gradingFetch
});
assert.equal(grade.passed, true);
assert.equal(submissionCount, 2, "grading should execute learner code and the generated oracle");

const mismatchFetch = async (url) => {
  if (url.endsWith("/languages")) return response(200, [{ id: 71, name: "Python (3.8.1)" }]);
  mismatchFetch.count = (mismatchFetch.count ?? 0) + 1;
  return response(200, { status: { id: 3 }, stdout: mismatchFetch.count === 1 ? "wrong\n" : "right\n", exit_code: 0 });
};
const mismatch = await gradeWithSandbox({
  env: { ...env, JUDGE0_API_URL: "https://judge0-mismatch.test" },
  userId: "mismatch-user",
  language: "Python",
  filePath: "main.py",
  code: "print('wrong')",
  starterCode: "print('start')",
  resultCode: "print('right')",
  fetchImpl: mismatchFetch
});
assert.equal(mismatch.passed, false);
assert.match(mismatch.feedback, /differs/);

console.log("execution sandbox checks passed");

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}
