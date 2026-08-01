import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  consumeOperatorUsage,
  consumePlanUsage,
  releaseOperatorUsage,
  resolveOperatorJudge0Limit,
  utcPeriodStart
} from "../server/usage-limits.mjs";

assert.equal(utcPeriodStart("month", new Date("2026-07-29T23:59:59Z")), "2026-07-01");
assert.equal(utcPeriodStart("day", new Date("2026-07-29T23:59:59Z")), "2026-07-29");
assert.equal(resolveOperatorJudge0Limit({ JUDGE0_GLOBAL_ACTIONS_PER_DAY: "2500" }), 2500);
assert.equal(resolveOperatorJudge0Limit({ JUDGE0_GLOBAL_ACTIONS_PER_DAY: "bad" }), 1000);

const rpcCalls = [];
const atomicAdmin = {
  async rpc(name, input) {
    rpcCalls.push({ name, input });
    return { data: { allowed: true, used: 3, limit: 10 }, error: null };
  }
};
const allowance = await consumePlanUsage({
  admin: atomicAdmin,
  userId: "00000000-0000-0000-0000-000000000001",
  feature: "learning_proposal",
  periodStart: "2026-07-29",
  limit: 10
});
assert.deepEqual(allowance, { allowed: true, used: 3, limit: 10, atomic: true });
assert.equal(rpcCalls[0].name, "consume_stonecode_plan_usage");

const missingAdmin = {
  async rpc() {
    return { data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } };
  }
};
const fallback = await consumePlanUsage({
  admin: missingAdmin,
  userId: "00000000-0000-0000-0000-000000000001",
  feature: "tutor_reply",
  periodStart: "2026-07-01",
  limit: 50,
  fallback: async () => ({ allowed: true, used: 2, limit: 50 })
});
assert.deepEqual(fallback, { allowed: true, used: 2, limit: 50, atomic: false });

const operatorOne = await consumeOperatorUsage({ admin: missingAdmin, feature: "judge0_action", periodStart: "2099-12-31", limit: 2 });
const operatorTwo = await consumeOperatorUsage({ admin: missingAdmin, feature: "judge0_action", periodStart: "2099-12-31", limit: 2 });
const operatorBlocked = await consumeOperatorUsage({ admin: missingAdmin, feature: "judge0_action", periodStart: "2099-12-31", limit: 2 });
assert.equal(operatorOne.allowed, true);
assert.equal(operatorTwo.used, 2);
assert.equal(operatorBlocked.allowed, false);
await releaseOperatorUsage({ admin: missingAdmin, feature: "judge0_action", periodStart: "2099-12-31" });
assert.equal((await consumeOperatorUsage({ admin: missingAdmin, feature: "judge0_action", periodStart: "2099-12-31", limit: 2 })).allowed, true);

const migration = readFileSync(new URL("../supabase/migrations/2026-07-30-atomic-usage-and-operator-limits.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
const visuals = readFileSync(new URL("../server/tutor/visuals.mjs", import.meta.url), "utf8");
for (const name of [
  "consume_stonecode_plan_usage",
  "release_stonecode_plan_usage",
  "consume_stonecode_operator_usage",
  "release_stonecode_operator_usage"
]) assert.match(migration, new RegExp(`create or replace function public\\.${name}`));
assert.match(server, /consumeTutorAllowance/);
assert.match(server, /consumeProposalAllowance/);
assert.match(server, /consumeJudge0Allowance/);
assert.match(visuals, /consumeImageAllowance/);

console.log("atomic plan and operator usage checks passed");
