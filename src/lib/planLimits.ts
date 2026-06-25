import { PlanTier } from "@/lib/database.types";

export const planLimits: Record<PlanTier, {
  activeCourseLimit: number;
  aiMessagesPerMonth: number;
  independentExercisesPerDay: number;
}> = {
  free: {
    activeCourseLimit: 1,
    aiMessagesPerMonth: 50,
    independentExercisesPerDay: 2
  },
  basic: {
    activeCourseLimit: 2,
    aiMessagesPerMonth: 500,
    independentExercisesPerDay: 10
  },
  pro: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000,
    independentExercisesPerDay: 30
  }
};

export function canCreateActiveCourse(plan: PlanTier, activeCourseCount: number) {
  return activeCourseCount < planLimits[plan].activeCourseLimit;
}
