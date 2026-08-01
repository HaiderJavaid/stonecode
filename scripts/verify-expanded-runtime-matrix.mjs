import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { courseLanguageCapabilities } from "../server/course-generation/language-capabilities.mjs";
import { runSandboxedCode } from "../server/execution/index.mjs";
import { resolveExecutionConfig } from "../server/execution/execution-policy.mjs";
import { judge0LanguageAvailable, listJudge0Languages, selectJudge0Language } from "../server/execution/language-map.mjs";
import { launchTechnologyIds, technologyCatalog } from "../shared/stonecode-product.mjs";

loadLocalEnv();
const launch = technologyCatalog.filter((technology) => launchTechnologyIds.includes(technology.id));
const judge0 = launch.filter((technology) => technology.runtime === "judge0");
const browser = launch.filter((technology) => technology.runtime === "browser");
assert.equal(judge0.length, 18);
assert.deepEqual(browser.map((technology) => technology.id).sort(), ["css", "html", "javascript"]);
assert.ok(technologyCatalog.find((technology) => technology.id === "julia")?.hiddenUntilRuntime);
const collisionFixture = [
  { id: 47, name: "Basic (FBC 1.07.1)" },
  { id: 57, name: "Elixir (1.9.4)" },
  { id: 75, name: "C (Clang 7.0.1)" },
  { id: 110, name: "C (Clang 19.1.7)" },
  { id: 80, name: "R (4.0.0)" },
  { id: 99, name: "R (4.4.1)" }
];
assert.equal(selectJudge0Language(collisionFixture, "c")?.id, 110, "C must not collide with Basic and should use the newest runtime");
assert.equal(selectJudge0Language(collisionFixture, "r")?.id, 80, "R must not collide with Elixir and must use the reviewed runtime that meets the CPU ceiling");
assert.equal(selectJudge0Language(collisionFixture, "basic")?.id, 47);
for (const technology of launch) {
  const language = courseLanguageCapabilities.find((candidate) => candidate.id === technology.id);
  assert.ok(language, `${technology.id} needs an execution contract`);
  assert.equal(language.filePath, technology.defaultFilePath);
  assert.ok(language.starterCode.trim());
}

if (!process.argv.includes("--live")) {
  console.table(launch.map((technology) => ({ technology: technology.displayName, runtime: technology.runtime, file: technology.defaultFilePath })));
  console.log("Expanded runtime contract passed: 18 Judge0 + JavaScript/HTML/CSS browser; Julia hidden. Add --live for real Judge0 smoke runs.");
  process.exit(0);
}

const config = resolveExecutionConfig(process.env);
if (!config.configured) throw new Error("Judge0 is not configured.");
const providerLanguages = await listJudge0Languages(config);
assert.equal(judge0LanguageAvailable(providerLanguages, "julia"), false, "Julia must stay hidden while Judge0 lacks it");
const results = [];
for (const technology of judge0) {
  const language = courseLanguageCapabilities.find((candidate) => candidate.id === technology.id);
  try {
    assert.ok(judge0LanguageAvailable(providerLanguages, technology.id), `${technology.displayName} runtime missing`);
    const result = await runSandboxedCode({
      env: { ...process.env, EXECUTION_RUNS_PER_MINUTE: "120" },
      userId: `runtime-matrix-${technology.id}`,
      input: { language: technology.displayName, filePath: technology.defaultFilePath, code: language.starterCode }
    });
    assert.equal(result.ok, true, result.stderr || `${technology.displayName} failed`);
    results.push({ technology: technology.displayName, runtime: "Judge0", status: "passed" });
  } catch (error) {
    results.push({ technology: technology.displayName, runtime: "Judge0", status: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}
console.table(results);
assert.ok(results.every((result) => result.status === "passed"), JSON.stringify(results.filter((result) => result.status !== "passed"), null, 2));
console.log("18 Judge0 runtime smoke checks passed; browser Output remains covered by rendered UI QA.");

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
