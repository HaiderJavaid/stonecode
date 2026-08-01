const baseUrl = argumentValue("--base-url") ?? "http://127.0.0.1:5174";
const requestCount = boundedInteger(argumentValue("--requests"), 1, 1_000, 200);
const concurrency = boundedInteger(argumentValue("--concurrency"), 1, 50, 20);
const maximumP95Ms = boundedInteger(argumentValue("--max-p95-ms"), 50, 30_000, 2_000);
const target = new URL("/api/features", baseUrl);
if (!isLoopback(target.hostname) && !process.argv.includes("--allow-remote")) {
  throw new Error("Remote load checks require the explicit --allow-remote flag.");
}

const latencies = [];
const failures = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
  while (cursor < requestCount) {
    const index = cursor;
    cursor += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10_000) });
      const payload = await response.json().catch(() => null);
      latencies.push(performance.now() - startedAt);
      if (!response.ok || Object.keys(payload?.features ?? {}).length !== 7) {
        failures.push({ index, status: response.status, reason: "unexpected_response" });
      }
    } catch (error) {
      latencies.push(performance.now() - startedAt);
      failures.push({ index, status: null, reason: String(error?.message ?? error).slice(0, 160) });
    }
  }
}));

latencies.sort((a, b) => a - b);
const p50Ms = percentile(latencies, 0.5);
const p95Ms = percentile(latencies, 0.95);
const passed = failures.length === 0 && p95Ms <= maximumP95Ms;
console.log(JSON.stringify({
  passed,
  target: target.href,
  requests: requestCount,
  concurrency,
  failures: failures.length,
  p50Ms: Number(p50Ms.toFixed(2)),
  p95Ms: Number(p95Ms.toFixed(2)),
  maximumP95Ms
}, null, 2));
if (!passed) process.exitCode = 1;

function percentile(values, quantile) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  return values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)];
}

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(hostname).toLowerCase());
}

function argumentValue(name) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
