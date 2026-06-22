export const planLimits = {
  free: {
    activeCourseLimit: 1,
    aiMessagesPerMonth: 50
  },
  basic: {
    activeCourseLimit: 2,
    aiMessagesPerMonth: 500
  },
  pro: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000
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
