import { supabase } from "@/lib/supabaseClient";

export type ProfilePreferences = {
  displayName: string;
  timezone: string;
};

export async function loadProfilePreferences(userId: string): Promise<ProfilePreferences> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return {
    displayName: typeof data?.display_name === "string" ? data.display_name : "",
    timezone: typeof data?.timezone === "string" ? data.timezone : "UTC"
  };
}

export async function saveProfilePreferences({
  userId,
  displayName,
  timezone
}: {
  userId: string;
  displayName?: string;
  timezone?: string;
}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const updates: Record<string, string> = {
    updated_at: new Date().toISOString()
  };
  if (displayName !== undefined) updates.display_name = displayName.trim();
  if (timezone !== undefined) updates.timezone = timezone;

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}
