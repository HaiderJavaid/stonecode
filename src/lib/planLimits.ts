import { PlanTier } from "@/lib/database.types";

export const planLimits: Record<PlanTier, { activeCourseLimit: number; aiMessagesPerMonth: number }> = {
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

export function canCreateActiveCourse(plan: PlanTier, activeCourseCount: number) {
  return activeCourseCount < planLimits[plan].activeCourseLimit;
}
