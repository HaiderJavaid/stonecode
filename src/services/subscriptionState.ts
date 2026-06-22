import { User } from "@supabase/supabase-js";
import { PlanTier } from "@/lib/database.types";
import { planLimits } from "@/lib/planLimits";
import { supabase } from "@/lib/supabaseClient";

export type SubscriptionState = {
  plan: PlanTier;
  status: "free" | "trialing" | "active" | "past_due" | "canceled";
  planName: "Free" | "Basic" | "Pro";
  activeCourseLimit: number;
  aiMessagesPerMonth: number;
  currentPeriodEnd: string | null;
};

export const defaultSubscriptionState: SubscriptionState = {
  plan: "free",
  status: "free",
  planName: "Free",
  activeCourseLimit: planLimits.free.activeCourseLimit,
  aiMessagesPerMonth: planLimits.free.aiMessagesPerMonth,
  currentPeriodEnd: null
};

export async function loadSubscriptionState(_user: User): Promise<SubscriptionState> {
  const token = await readAccessToken();
  const response = await fetch("/api/subscription", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load subscription.");
  }

  return payload.subscription as SubscriptionState;
}

async function readAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error(error?.message ?? "Authentication is required to load subscription.");
  }

  return token;
}
