import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { learningDomainCatalog, launchTechnologyIds, productionTechnologyIds, technologyCatalog } from "../shared/stonecode-product.mjs";
import { selectCuratedRagChunks } from "../server/rag/curriculum-sources.mjs";
import { learningDomainCorpora, validateLearningDomainCorpora } from "../server/rag/learning-domain-corpora.mjs";
import { resolveRagTechnologyId, technologyCorpora, validateTechnologyCorpora } from "../server/rag/technology-corpora.mjs";

assert.equal(technologyCatalog.length, 22);
assert.equal(productionTechnologyIds.length, 21);
assert.deepEqual(productionTechnologyIds, launchTechnologyIds);
assert.ok(!productionTechnologyIds.includes("julia"));
assert.equal(technologyCorpora.length, 22);
assert.deepEqual(new Set(technologyCorpora.map((corpus) => corpus.technologyId)), new Set(technologyCatalog.map((technology) => technology.id)));
assert.deepEqual(validateTechnologyCorpora(), { valid: true, errors: [] });
assert.equal(learningDomainCatalog.length, 5);
assert.equal(learningDomainCorpora.length, 4);
assert.deepEqual(validateLearningDomainCorpora(), { valid: true, errors: [] });
assert.ok(technologyCorpora.every((corpus) => corpus.status === "draft" && corpus.version === 1));
assert.ok(technologyCorpora.every((corpus) => corpus.sources.length >= 1 && corpus.chunks.length >= 3 && corpus.evaluationFixtures.length >= 3));
assert.ok(technologyCorpora.every((corpus) => corpus.evaluationFixtures.every((fixture) => fixture.forbiddenTechnologyIds.length === 21)));
assert.equal(resolveRagTechnologyId("Build a React dashboard"), "javascript");
assert.equal(resolveRagTechnologyId("Learn C++ pointers"), "cpp");
assert.equal(resolveRagTechnologyId("C# console app"), "csharp");
assert.equal(resolveRagTechnologyId("Go programming"), "go");
assert.equal(resolveRagTechnologyId("machine learning"), null);

const pythonFallback = selectCuratedRagChunks({ subject: "Python", limit: 20 });
assert.ok(pythonFallback.every((chunk) => chunk.sourceType === "stonecode-curriculum"), "unapproved technology sources must not leak into static fallback");
for (const technology of technologyCatalog) {
  const fallback = selectCuratedRagChunks({ subject: technology.displayName, limit: 20 });
  assert.ok(fallback.every((chunk) => chunk.sourceType === "stonecode-curriculum"), `${technology.displayName} fallback must not bypass corpus approval`);
}

const migration = readFileSync(new URL("../supabase/migrations/2026-08-01-learning-domains-and-expanded-catalog.sql", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../server/runtime/capability-catalog.mjs", import.meta.url), "utf8");
const evaluator = readFileSync(new URL("./evaluate-rag-corpora.mjs", import.meta.url), "utf8");
const reviewer = readFileSync(new URL("./review-rag-sources.mjs", import.meta.url), "utf8");
const approver = readFileSync(new URL("./approve-learning-capability.mjs", import.meta.url), "utf8");
assert.match(migration, /match_technology text default null/);
assert.match(migration, /match_domain text default null/);
assert.match(migration, /rag_corpora\.technology_id = match_technology/);
assert.match(migration, /rag_corpora\.domain_id = match_domain/);
assert.match(migration, /rag_corpora_exactly_one_scope/);
assert.match(runtime, /top_five_relevance \?\? 0\) >= 0\.9/);
assert.match(runtime, /cross_language_leakage_count \?\? 0\) === 0/);
assert.match(evaluator, /status: enabled \? "enabled" : "disabled"/);
assert.match(reviewer, /provenanceStatus: "rejected"/);
assert.match(reviewer, /launchStatus: "rejected"/);
assert.match(approver, /confirm-corpus-key/);
assert.match(approver, /top_five_relevance/);
assert.match(approver, /provenanceStatus/);
assert.match(approver, /judge0LanguageAvailable/);
assert.ok(learningDomainCorpora.every((corpus) => corpus.status === "draft" && corpus.sources.length >= 1 && corpus.evaluationFixtures.length >= 3));

console.log("22 language + 4 domain isolated RAG corpus checks passed");
