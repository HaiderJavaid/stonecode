export const planLimits = {
  free: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: true
  },
  basic: {
    activeCourseLimit: 2,
    aiMessagesPerMonth: 500,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  },
  pro: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000,
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
