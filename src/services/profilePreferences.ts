import { supabase } from "@/lib/supabaseClient";

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
