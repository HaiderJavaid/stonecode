import { buildTutorContext, TutorContextInput } from "@/ai/buildTutorContext";
import { supabase } from "@/lib/supabaseClient";

export async function requestTutorReplyStream(
  input: TutorContextInput,
  handlers: {
    onDelta: (chunk: string) => void;
  }
) {
  const token = await readAccessToken();
  const response = await fetch("/api/tutor", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      context: buildTutorContext(input)
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Tutor request failed.");
  }

  if (!response.body) {
    throw new Error("Tutor returned an empty response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let reply = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    reply += chunk;
    handlers.onDelta(chunk);
  }

  reply += decoder.decode();
  if (!reply.trim()) {
    throw new Error("Tutor returned an empty reply.");
  }

  return reply.trim();
}

async function readAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error(error?.message ?? "Authentication is required to use the tutor.");
  }

  return token;
}
