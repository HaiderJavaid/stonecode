import { PlanTier } from "@/lib/database.types";

export const planLimits: Record<PlanTier, {
  activeCourseLimit: number;
  aiMessagesPerMonth: number;
  independentExercisesPerDay: number | null;
  monthlyExperienceGenerationLimit: number | null;
  firstModuleOnly: boolean;
  requiresOwnOpenAiKey: boolean;
}> = {
  free: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000,
    independentExercisesPerDay: null,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: true
  },
  basic: {
    activeCourseLimit: 2,
    aiMessagesPerMonth: 500,
    independentExercisesPerDay: null,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  },
  pro: {
    activeCourseLimit: 10,
    aiMessagesPerMonth: 3000,
    independentExercisesPerDay: null,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  }
};

export function canCreateActiveCourse(plan: PlanTier, activeCourseCount: number) {
  return activeCourseCount < planLimits[plan].activeCourseLimit;
}
