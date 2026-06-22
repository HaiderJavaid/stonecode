import { normalizePlanTier, resolvePlanLimit } from "./plan-limits.mjs";

const activeStatuses = new Set(["active", "trialing"]);
const planNames = {
  free: "Free",
  basic: "Basic",
  pro: "Pro"
};

export function isPaidSubscriptionStatus(status) {
  return activeStatuses.has(status);
}

export function formatSubscriptionState(record) {
  const status = typeof record?.status === "string" ? record.status : "free";
  const plan = record && isPaidSubscriptionStatus(status) ? normalizePlanTier(record.plan) : "free";
  const limit = resolvePlanLimit(plan);

  return {
    plan,
    status,
    planName: planNames[plan],
    activeCourseLimit: limit.activeCourseLimit,
    aiMessagesPerMonth: limit.aiMessagesPerMonth,
    currentPeriodEnd: typeof record?.current_period_end === "string" ? record.current_period_end : null
  };
}
