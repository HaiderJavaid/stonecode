import { authenticatedFetch, authenticatedJson } from "@/services/authenticatedApi";

export type TutorVisualAttachmentV1 = {
  version: "tutor-visual-attachment/v1";
  id: string;
  kind: "deterministic_svg" | "ai_image";
  caption: string;
  altText: string;
  contentUrl: string;
  metadata?: Record<string, unknown>;
};

export async function requestTutorVisual(courseId: string, stepId: string): Promise<TutorVisualAttachmentV1> {
  const payload = await authenticatedJson<{ visual: TutorVisualAttachmentV1 }>(`/api/courses/${encodeURIComponent(courseId)}/steps/${encodeURIComponent(stepId)}/tutor-visual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  }, "generate a tutor visual");
  return payload.visual;
}

export async function loadTutorVisualAsset(contentUrl: string): Promise<string> {
  const response = await authenticatedFetch(contentUrl, {}, "load a tutor visual");
  if (!response.ok) throw new Error("Tutor visual asset is unavailable.");
  return URL.createObjectURL(await response.blob());
}
