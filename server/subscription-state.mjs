import { normalizePlanTier, resolvePlanLimit } from "./plan-limits.mjs";

const activeStatuses = new Set(["active"]);
const planNames = {
  free: "Free",
  pro: "Pro"
};

export function isPaidSubscriptionStatus(status) {
  return activeStatuses.has(status);
}

export function formatSubscriptionState(record) {
  const status = typeof record?.status === "string" ? record.status : "free";
  const normalizedPlan = record && isPaidSubscriptionStatus(status) ? normalizePlanTier(record.plan) : "free";
  const plan = normalizedPlan === "pro" ? "pro" : "free";
  const limit = resolvePlanLimit(plan);

  return {
    plan,
    status,
    planName: planNames[plan],
    activeCourseLimit: limit.activeCourseLimit,
    aiMessagesPerMonth: limit.aiMessagesPerMonth,
    aiImagesPerMonth: limit.aiImagesPerMonth,
    judge0ActionsPerDay: limit.judge0ActionsPerDay,
    registrationCredits: limit.registrationCredits,
    monthlyCredits: limit.monthlyCredits,
    proposalsPerDay: limit.proposalsPerDay,
    monthlyExperienceGenerationLimit: limit.monthlyExperienceGenerationLimit,
    firstModuleOnly: limit.firstModuleOnly,
    requiresOwnOpenAiKey: limit.requiresOwnOpenAiKey,
    currentPeriodEnd: typeof record?.current_period_end === "string" ? record.current_period_end : null
  };
}
