import assert from "node:assert/strict";
import { canCreateActiveCourse, normalizePlanTier, resolvePlanLimit } from "../server/plan-limits.mjs";

assert.equal(normalizePlanTier("basic"), "basic");
assert.equal(normalizePlanTier("unknown"), "free");
assert.equal(resolvePlanLimit("free").activeCourseLimit, 1);
assert.equal(resolvePlanLimit("basic").activeCourseLimit, 2);
assert.equal(resolvePlanLimit("pro").activeCourseLimit, 10);
assert.equal(canCreateActiveCourse("free", 0), true);
assert.equal(canCreateActiveCourse("free", 1), false);
assert.equal(canCreateActiveCourse("basic", 1), true);
assert.equal(canCreateActiveCourse("basic", 2), false);

console.log("plan limit checks passed");
