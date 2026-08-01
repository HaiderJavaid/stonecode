import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  approvedBrowserAssetUrls,
  browserFrameworkAllowlist,
  browserFrameworkCatalog,
  isApprovedBrowserAssetUrl,
  learningDomainCatalog,
  planCatalog,
  quoteCreationCredits,
  resolveStepSurfaceManifest,
  technologyCatalog
} from "../shared/stonecode-product.mjs";
import { buildRuntimeCapabilityCatalog } from "../server/runtime/capability-catalog.mjs";
import { normalizeLearningProposal } from "../server/learning-orchestrator/proposals.mjs";
import { resolveFeatureFlags } from "../server/feature-flags.mjs";

assert.deepEqual(Object.keys(planCatalog), ["free", "pro"]);
assert.equal(planCatalog.free.registrationCredits, 10);
assert.equal(planCatalog.free.activePathLimit, 1);
assert.equal(planCatalog.pro.priceMonthlyUsd, 9);
assert.equal(planCatalog.pro.monthlyCredits, 100);
assert.equal(planCatalog.pro.activePathLimit, 10);

assert.equal(quoteCreationCredits({ type: "exercise", exerciseCount: 5 }).credits, 1);
assert.equal(quoteCreationCredits({ type: "exercise", exerciseCount: 25 }).credits, 5);
assert.equal(quoteCreationCredits({ type: "project", stepCount: 7, fileCount: 3 }).credits, 10);
assert.equal(quoteCreationCredits({ type: "project", stepCount: 30, fileCount: 10 }).credits, 15);
assert.equal(quoteCreationCredits({ type: "course", moduleCount: 2, stepCount: 40 }).credits, 10);
assert.equal(quoteCreationCredits({ type: "course", moduleCount: 12, stepCount: 180 }).credits, 25);
assert.equal(quoteCreationCredits({ marketplaceClone: true }).credits, 1);
assert.throws(() => quoteCreationCredits({ type: "exercise", exerciseCount: 4 }), /5 to 25/);
assert.throws(() => quoteCreationCredits({ type: "course", moduleCount: 13, stepCount: 20 }), /1 to 12/);

assert.equal(technologyCatalog.length, 22);
assert.equal(new Set(technologyCatalog.map((item) => item.id)).size, 22);
assert.ok(browserFrameworkAllowlist.includes("react") && browserFrameworkAllowlist.includes("p5.js"));
assert.equal(browserFrameworkCatalog.length, 6);
assert.equal(browserFrameworkCatalog.find((item) => item.id === "react")?.version, "18.3.1");
assert.equal(approvedBrowserAssetUrls.length, 8);
assert.equal(isApprovedBrowserAssetUrl("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"), true);
assert.equal(isApprovedBrowserAssetUrl("https://cdn.jsdelivr.net/npm/d3@latest/dist/d3.min.js"), false);
assert.deepEqual(resolveStepSurfaceManifest({ technologyId: "python", requiresTerminal: true }), {
  available: ["code", "terminal"],
  recommended: "code"
});
assert.deepEqual(resolveStepSurfaceManifest({ technologyId: "html", requiresOutput: true, recommended: "output" }), {
  available: ["code", "output"],
  recommended: "output"
});

const projectProposal = normalizeLearningProposal({
  title: "Build a CLI task manager",
  summary: "Learn Python while building a persistent task manager.",
  type: "project",
  technology: "Python",
  outcomes: ["Build a working CLI"],
  items: Array.from({ length: 7 }, (_, index) => ({
    title: `Step ${index + 1}`,
    summary: `Build unit ${index + 1}`,
    stepCount: 1,
    fileCount: index < 3 ? index + 1 : 3
  })),
  totalSteps: 7,
  totalFiles: 3
}, {
  type: "guided_project",
  goal: "Build a CLI task manager",
  desiredOutcome: "Working task manager",
  language: "Python",
  platform: "terminal",
  priorKnowledge: "Beginner"
});
assert.equal(projectProposal.type, "project");
assert.equal(projectProposal.creditQuote.credits, 10);

assert.deepEqual(resolveFeatureFlags({
  FEATURE_CREDITS_V1: "true",
  FEATURE_MARKETPLACE_V1: "0"
}), {
  credits_v1: true,
  learning_proposals_v1: false,
  runtime_catalog_v1: false,
  structured_tutor_tools: false,
  chat_visuals_v1: false,
  dynamic_surfaces: false,
  marketplace_v1: false
});

const runtimeAdmin = {
  from(table) {
    if (table === "technology_manifests") {
      return {
        select: async () => ({
          data: technologyCatalog.map((item) => ({
            technology_id: item.id,
            editor_id: item.editorId,
            default_file_path: item.defaultFilePath,
            runtime_type: item.runtime,
            rag_corpus_key: item.ragCorpusKey,
            enabled: true,
            metadata: { grading: item.id !== "ruby" }
          })),
          error: null
        })
      };
    }
    if (table === "rag_corpora") {
      return {
        select: () => ({
          order: async () => ({
            data: [
              ...technologyCatalog.map((item) => ({
              corpus_key: item.ragCorpusKey,
              status: "enabled",
              top_five_relevance: 0.95,
              provenance_complete: true,
              cross_language_leakage_count: 0
              })),
              ...learningDomainCatalog.filter((item) => item.ragCorpusKey).map((item) => ({
                corpus_key: item.ragCorpusKey,
                status: "enabled",
                top_five_relevance: 0.95,
                provenance_complete: true,
                cross_language_leakage_count: 0
              }))
            ],
            error: null
          })
        })
      };
    }
    if (table === "learning_domain_manifests") {
      return {
        select: async () => ({
          data: learningDomainCatalog.filter((item) => item.ragCorpusKey).map((item) => ({
            domain_id: item.id,
            rag_corpus_key: item.ragCorpusKey,
            technology_required_for: [...item.technologyRequiredFor],
            default_technology_id: item.defaultTechnologyId,
            enabled: true,
            metadata: { launchStatus: "approved" }
          })),
          error: null
        })
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }
};
const runtimeCapabilities = await buildRuntimeCapabilityCatalog({
  admin: runtimeAdmin,
  env: { CODE_RUNNER_PROVIDER: "judge0", JUDGE0_API_URL: "https://judge0.test" },
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 63, name: "JavaScript (Node.js 12.14.0)" },
      { id: 71, name: "Python (3.8.1)" }
    ]
  })
});
assert.equal(runtimeCapabilities.technologies.find((item) => item.id === "html")?.available, true);
assert.equal(runtimeCapabilities.technologies.find((item) => item.id === "python")?.available, true);
assert.equal(runtimeCapabilities.technologies.find((item) => item.id === "ruby")?.gradingAvailable, false);
assert.equal(runtimeCapabilities.technologies.find((item) => item.id === "ruby")?.available, false);
assert.equal(runtimeCapabilities.technologies.find((item) => item.id === "julia")?.available, false);
assert.equal(runtimeCapabilities.version, "learning-capabilities/v2");
assert.equal(runtimeCapabilities.domains.find((item) => item.id === "programming")?.available, true);
assert.equal(runtimeCapabilities.domains.find((item) => item.id === "internet_web")?.available, true);

const unconfiguredCapabilities = await buildRuntimeCapabilityCatalog({ admin: null, env: {} });
assert.ok(unconfiguredCapabilities.technologies.every((item) => item.available === false));

const migration = readFileSync(new URL("../supabase/migrations/2026-07-29-production-revamp-foundation.sql", import.meta.url), "utf8");
const proposalStore = readFileSync(new URL("../server/learning-orchestrator/proposal-store.mjs", import.meta.url), "utf8");
const generationWorker = readFileSync(new URL("../server/learning-orchestrator/generation-worker.mjs", import.meta.url), "utf8");
for (const functionName of [
  "finalize_stonecode_learning_proposal",
  "claim_stonecode_generation_job",
  "complete_stonecode_generation_job"
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${functionName}`));
}
assert.match(proposalStore, /rpc\("finalize_stonecode_learning_proposal"/);
assert.match(generationWorker, /rpc\("claim_stonecode_generation_job"/);
assert.match(generationWorker, /rpc\("complete_stonecode_generation_job"/);

console.log("production revamp foundation checks passed");
