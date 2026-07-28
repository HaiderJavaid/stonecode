import assert from "node:assert/strict";
import { canCreateActiveCourse, canGenerateExperience, normalizePlanTier, resolvePlanLimit } from "../server/plan-limits.mjs";

assert.equal(normalizePlanTier("basic"), "basic");
assert.equal(normalizePlanTier("unknown"), "free");
assert.equal(resolvePlanLimit("free").activeCourseLimit, 10);
assert.equal(resolvePlanLimit("basic").activeCourseLimit, 2);
assert.equal(resolvePlanLimit("pro").activeCourseLimit, 10);
assert.equal(resolvePlanLimit("free").monthlyExperienceGenerationLimit, null);
assert.equal(resolvePlanLimit("free").firstModuleOnly, false);
assert.equal(resolvePlanLimit("basic").firstModuleOnly, false);
assert.equal(canGenerateExperience("free", 2), true);
assert.equal(canGenerateExperience("free", 300), true);
assert.equal(canGenerateExperience("basic", 300), true);
assert.equal(canCreateActiveCourse("free", 0), true);
assert.equal(canCreateActiveCourse("free", 9), true);
assert.equal(canCreateActiveCourse("free", 10), false);
assert.equal(canCreateActiveCourse("basic", 1), true);
assert.equal(canCreateActiveCourse("basic", 2), false);

console.log("plan limit checks passed");
