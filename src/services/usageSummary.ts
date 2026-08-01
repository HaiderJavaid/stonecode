import { User } from "@supabase/supabase-js";
import { authenticatedJson } from "@/services/authenticatedApi";

export type UsageSummary = {
  totalTutorMessages: number;
  statusCounts: {
    success: number;
    failed: number;
    blocked: number;
  };
  latestEventAt: string | null;
  periodStart: string | null;
  plan: "free" | "basic" | "pro";
  allowances: Record<"tutorReplies" | "aiImages" | "judge0Actions" | "proposals" | "activePaths", {
    used: number;
    limit: number;
    remaining: number;
    period: "month" | "day" | "current";
  }>;
  tokens: { input: number; cachedInput: number; cacheWriteInput: number; output: number; reasoning: number; estimatedCostMicrousd: number };
  estimatedApiCostUsd: number;
};

export const defaultUsageSummary: UsageSummary = {
  totalTutorMessages: 0,
  statusCounts: {
    success: 0,
    failed: 0,
    blocked: 0
  },
  latestEventAt: null,
  periodStart: null,
  plan: "free",
  allowances: {
    tutorReplies: { used: 0, limit: 50, remaining: 50, period: "month" },
    aiImages: { used: 0, limit: 5, remaining: 5, period: "month" },
    judge0Actions: { used: 0, limit: 20, remaining: 20, period: "day" },
    proposals: { used: 0, limit: 3, remaining: 3, period: "day" },
    activePaths: { used: 0, limit: 1, remaining: 1, period: "current" }
  },
  tokens: { input: 0, cachedInput: 0, cacheWriteInput: 0, output: 0, reasoning: 0, estimatedCostMicrousd: 0 },
  estimatedApiCostUsd: 0
};

export async function loadUsageSummary(_user: User): Promise<UsageSummary> {
  const payload = await authenticatedJson<{ usage: UsageSummary }>("/api/usage", {}, "load usage");
  return payload.usage as UsageSummary;
}
