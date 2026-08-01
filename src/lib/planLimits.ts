import { planCatalog } from "../../shared/stonecode-product.mjs";
import { PlanTier } from "@/lib/database.types";

export const planLimits: Record<PlanTier, {
  activeCourseLimit: number;
  aiMessagesPerMonth: number;
  aiImagesPerMonth: number;
  judge0ActionsPerDay: number;
  registrationCredits: number;
  monthlyCredits: number;
  proposalsPerDay: number;
  independentExercisesPerDay: number | null;
  monthlyExperienceGenerationLimit: number | null;
  firstModuleOnly: boolean;
  requiresOwnOpenAiKey: boolean;
}> = {
  free: {
    activeCourseLimit: planCatalog.free.activePathLimit,
    aiMessagesPerMonth: planCatalog.free.tutorRepliesPerMonth,
    aiImagesPerMonth: planCatalog.free.aiImagesPerMonth,
    judge0ActionsPerDay: planCatalog.free.judge0ActionsPerDay,
    registrationCredits: planCatalog.free.registrationCredits,
    monthlyCredits: planCatalog.free.monthlyCredits,
    proposalsPerDay: 3,
    independentExercisesPerDay: null,
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
    independentExercisesPerDay: null,
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
    independentExercisesPerDay: null,
    monthlyExperienceGenerationLimit: null,
    firstModuleOnly: false,
    requiresOwnOpenAiKey: false
  }
};

export function canCreateActiveCourse(plan: PlanTier, activeCourseCount: number) {
  return activeCourseCount < planLimits[plan].activeCourseLimit;
}
