import { User } from "@supabase/supabase-js";
import { PlanTier } from "@/lib/database.types";
import { planLimits } from "@/lib/planLimits";
import { authenticatedJson } from "@/services/authenticatedApi";

export type SubscriptionState = {
  plan: PlanTier;
  status: "free" | "trialing" | "active" | "past_due" | "canceled";
  planName: "Free" | "Pro";
  activeCourseLimit: number;
  aiMessagesPerMonth: number;
  aiImagesPerMonth: number;
  judge0ActionsPerDay: number;
  registrationCredits: number;
  monthlyCredits: number;
  proposalsPerDay: number;
  monthlyExperienceGenerationLimit: number | null;
  firstModuleOnly: boolean;
  requiresOwnOpenAiKey: boolean;
  generatedExperiencesThisMonth: number;
  remainingExperienceGenerations: number | null;
  currentPeriodEnd: string | null;
};

export const defaultSubscriptionState: SubscriptionState = {
  plan: "free",
  status: "free",
  planName: "Free",
  activeCourseLimit: planLimits.free.activeCourseLimit,
  aiMessagesPerMonth: planLimits.free.aiMessagesPerMonth,
  aiImagesPerMonth: planLimits.free.aiImagesPerMonth,
  judge0ActionsPerDay: planLimits.free.judge0ActionsPerDay,
  registrationCredits: planLimits.free.registrationCredits,
  monthlyCredits: planLimits.free.monthlyCredits,
  proposalsPerDay: planLimits.free.proposalsPerDay,
  monthlyExperienceGenerationLimit: planLimits.free.monthlyExperienceGenerationLimit,
  firstModuleOnly: planLimits.free.firstModuleOnly,
  requiresOwnOpenAiKey: planLimits.free.requiresOwnOpenAiKey,
  generatedExperiencesThisMonth: 0,
  remainingExperienceGenerations: planLimits.free.monthlyExperienceGenerationLimit,
  currentPeriodEnd: null
};

export async function loadSubscriptionState(_user: User): Promise<SubscriptionState> {
  const payload = await authenticatedJson<{ subscription: SubscriptionState }>("/api/subscription", {}, "load subscription");
  return payload.subscription as SubscriptionState;
}
