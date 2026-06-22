import assert from "node:assert/strict";
import { formatSubscriptionState, isPaidSubscriptionStatus } from "../server/subscription-state.mjs";

const freeState = formatSubscriptionState(null);
assert.equal(freeState.plan, "free");
assert.equal(freeState.status, "free");
assert.equal(freeState.planName, "Free");
assert.equal(freeState.activeCourseLimit, 1);

const basicState = formatSubscriptionState({ plan: "basic", status: "active", current_period_end: "2026-07-22T00:00:00Z" });
assert.equal(basicState.plan, "basic");
assert.equal(basicState.status, "active");
assert.equal(basicState.planName, "Basic");
assert.equal(basicState.activeCourseLimit, 2);
assert.equal(basicState.currentPeriodEnd, "2026-07-22T00:00:00Z");

const canceledState = formatSubscriptionState({ plan: "pro", status: "canceled", current_period_end: null });
assert.equal(canceledState.plan, "free");
assert.equal(canceledState.status, "canceled");
assert.equal(canceledState.planName, "Free");
assert.equal(canceledState.activeCourseLimit, 1);

assert.equal(isPaidSubscriptionStatus("trialing"), true);
assert.equal(isPaidSubscriptionStatus("past_due"), false);

console.log("subscription state checks passed");
