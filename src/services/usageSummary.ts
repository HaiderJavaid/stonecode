import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type UsageSummary = {
  totalTutorMessages: number;
  statusCounts: {
    success: number;
    failed: number;
    blocked: number;
  };
  latestEventAt: string | null;
};

export const defaultUsageSummary: UsageSummary = {
  totalTutorMessages: 0,
  statusCounts: {
    success: 0,
    failed: 0,
    blocked: 0
  },
  latestEventAt: null
};

export async function loadUsageSummary(_user: User): Promise<UsageSummary> {
  const token = await readAccessToken();
  const response = await fetch("/api/usage", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load usage.");
  }

  return payload.usage as UsageSummary;
}

async function readAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error(error?.message ?? "Authentication is required to load usage.");
  }

  return token;
}
