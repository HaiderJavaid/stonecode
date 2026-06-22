import assert from "node:assert/strict";
import { formatUsageSummary } from "../server/usage-events.mjs";

const emptySummary = formatUsageSummary([]);
assert.equal(emptySummary.totalTutorMessages, 0);
assert.deepEqual(emptySummary.statusCounts, {
  success: 0,
  failed: 0,
  blocked: 0
});
assert.equal(emptySummary.latestEventAt, null);

const summary = formatUsageSummary([
  { status: "success", created_at: "2026-06-22T08:00:00Z" },
  { status: "failed", created_at: "2026-06-22T09:00:00Z" },
  { status: "success", created_at: "2026-06-22T10:00:00Z" },
  { status: "blocked", created_at: "2026-06-22T11:00:00Z" }
]);

assert.equal(summary.totalTutorMessages, 4);
assert.deepEqual(summary.statusCounts, {
  success: 2,
  failed: 1,
  blocked: 1
});
assert.equal(summary.latestEventAt, "2026-06-22T11:00:00Z");

console.log("usage summary checks passed");
