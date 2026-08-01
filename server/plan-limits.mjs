import { planCatalog } from "../shared/stonecode-product.mjs";

export const planLimits = {
  free: {
    activeCourseLimit: planCatalog.free.activePathLimit,
    aiMessagesPerMonth: planCatalog.free.tutorRepliesPerMonth,
    aiImagesPerMonth: planCatalog.free.aiImagesPerMonth,
    judge0ActionsPerDay: planCatalog.free.judge0ActionsPerDay,
    registrationCredits: planCatalog.free.registrationCredits,
    monthlyCredits: planCatalog.free.monthlyCredits,
    proposalsPerDay: 3,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  },
  basic: {
    activeCourseLimit: 2,
    aiMessagesPerMonth: 500,
    aiImagesPerMonth: 25,
    judge0ActionsPerDay: 50,
    registrationCredits: 0,
    monthlyCredits: 0,
    proposalsPerDay: 5,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  },
  pro: {
    activeCourseLimit: planCatalog.pro.activePathLimit,
    aiMessagesPerMonth: planCatalog.pro.tutorRepliesPerMonth,
    aiImagesPerMonth: planCatalog.pro.aiImagesPerMonth,
    judge0ActionsPerDay: planCatalog.pro.judge0ActionsPerDay,
    registrationCredits: planCatalog.pro.registrationCredits,
    monthlyCredits: planCatalog.pro.monthlyCredits,
    proposalsPerDay: 10,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  }
};

export function normalizePlanTier(value) {
  return value === "basic" || value === "pro" || value === "free" ? value : "free";
}

export function resolvePlanLimit(plan) {
  return planLimits[normalizePlanTier(plan)];
}

export function canCreateActiveCourse(plan, activeCourseCount) {
  return activeCourseCount < resolvePlanLimit(plan).activeCourseLimit;
}

export function canGenerateExperience(plan, generatedThisMonth) {
  const limit = resolvePlanLimit(plan).monthlyExperienceGenerationLimit;
  return limit === null || generatedThisMonth < limit;
}
