import { buildTutorContext, TutorContextInput } from "@/ai/buildTutorContext";

export async function requestTutorReply(input: TutorContextInput) {
  const response = await fetch("/api/tutor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      context: buildTutorContext(input)
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Tutor request failed.");
  }

  if (typeof payload?.reply !== "string" || !payload.reply.trim()) {
    throw new Error("Tutor returned an empty reply.");
  }

  return payload.reply.trim();
}
