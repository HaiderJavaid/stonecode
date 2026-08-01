import { createHash } from "node:crypto";
import { resolvePlanLimit } from "../plan-limits.mjs";
import { consumePlanUsage, releasePlanUsage, utcPeriodStart } from "../usage-limits.mjs";

const visualBucket = "tutor-visuals";

export async function createOrReadTutorVisual({ admin, userId, courseId, stepId, plan, env = process.env, fetchImpl = fetch }) {
  const course = await readOwnedCourse(admin, userId, courseId);
  if (!course) throw visualError("course_not_found", "Learning path not found.", 404);
  const step = findCourseStep(course.course_content, stepId);
  const cue = normalizeCue(step?.visualCue);
  if (!cue) throw visualError("visual_cue_not_found", "This learning step has no visual cue.", 404);
  const cached = await readCachedVisual(admin, userId, courseId, stepId, cue.id);
  if (cached?.status === "ready") return attachment(cached);

  const wantsImage = cue.kind === "illustration" && cue.preferredRenderer !== "svg";
  const imageAllowance = wantsImage ? await consumeImageAllowance(admin, userId, plan) : null;
  const imageAllowed = imageAllowance?.allowed === true;
  let visualKind = "deterministic_svg";
  let inlineSvg = buildTutorDiagramSvg(cue);
  let storagePath = null;
  let metadata = { fallback: wantsImage ? imageAllowed ? "image_generation_failed" : "image_cap_reached" : null };

  if (imageAllowed && env.OPENAI_API_KEY) {
    const imageStartedAt = Date.now();
    try {
      const generated = await generateTutorImage({ cue, env, fetchImpl });
      storagePath = `${userId}/${courseId}/${stepId.replace(/[^a-z0-9-]+/gi, "-")}-${hash(cue.description).slice(0, 12)}.png`;
      const { error: uploadError } = await admin.storage.from(visualBucket).upload(storagePath, generated.image, {
        contentType: "image/png",
        upsert: true
      });
      if (uploadError) throw uploadError;
      visualKind = "ai_image";
      inlineSvg = null;
      metadata = { model: env.OPENAI_IMAGE_MODEL || "gpt-image-1" };
      await recordImageUsage(admin, { userId, courseId, model: metadata.model, latencyMs: generated.latencyMs, usage: generated.usage, status: "success" });
    } catch (error) {
      await releaseImageAllowance(admin, userId, imageAllowance).catch(() => null);
      await recordImageUsage(admin, { userId, courseId, model: env.OPENAI_IMAGE_MODEL || "gpt-image-1", latencyMs: Date.now() - imageStartedAt, status: "failed" });
      metadata = { fallback: "image_generation_failed", reason: String(error?.message ?? error).slice(0, 240) };
    }
  } else if (imageAllowed) {
    await releaseImageAllowance(admin, userId, imageAllowance).catch(() => null);
  }

  const row = {
    user_id: userId,
    course_id: courseId,
    step_id: stepId,
    cue_key: cue.id,
    visual_kind: visualKind,
    status: "ready",
    storage_path: storagePath,
    inline_svg: inlineSvg,
    alt_text: cue.altText,
    caption: cue.caption,
    prompt_hash: hash(cue.description),
    metadata
  };
  const { data, error } = await admin
    .from("tutor_visuals")
    .upsert(row, { onConflict: "course_id,step_id,cue_key" })
    .select("*")
    .single();
  if (error) {
    if (visualKind === "ai_image") await releaseImageAllowance(admin, userId, imageAllowance).catch(() => null);
    if (storagePath) await admin.storage.from(visualBucket).remove([storagePath]).catch(() => null);
    throw visualError("visual_persistence_failed", error.message, 500);
  }
  return attachment(data);
}

export async function readTutorVisualContent({ admin, userId, visualId }) {
  const { data, error } = await admin
    .from("tutor_visuals")
    .select("*")
    .eq("id", visualId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .maybeSingle();
  if (error || !data) throw visualError("visual_not_found", "Tutor visual not found.", 404);
  if (data.inline_svg) return { body: Buffer.from(data.inline_svg), contentType: "image/svg+xml; charset=utf-8" };
  if (!data.storage_path) throw visualError("visual_not_found", "Tutor visual asset is unavailable.", 404);
  const { data: blob, error: downloadError } = await admin.storage.from(visualBucket).download(data.storage_path);
  if (downloadError || !blob) throw visualError("visual_not_found", "Tutor visual asset is unavailable.", 404);
  return { body: Buffer.from(await blob.arrayBuffer()), contentType: blob.type || "image/png" };
}

export function buildTutorDiagramSvg(cueValue) {
  const cue = normalizeCue(cueValue) ?? {
    title: "Visual explanation",
    description: "A focused programming concept diagram.",
    caption: "Visual explanation",
    altText: "Programming concept diagram",
    labels: []
  };
  const labels = cue.labels.length ? cue.labels.slice(0, 4) : sentenceLabels(cue.description);
  const boxWidth = 152;
  const gap = 28;
  const startX = Math.max(34, (720 - (labels.length * boxWidth + Math.max(0, labels.length - 1) * gap)) / 2);
  const boxes = labels.map((label, index) => {
    const x = startX + index * (boxWidth + gap);
    const arrow = index < labels.length - 1
      ? `<path d="M ${x + boxWidth + 5} 184 H ${x + boxWidth + gap - 7}" stroke="#72da98" stroke-width="2" marker-end="url(#arrow)"/>`
      : "";
    return `<g><rect x="${x}" y="142" width="${boxWidth}" height="84" rx="12" fill="#142019" stroke="#4f8f66"/><text x="${x + boxWidth / 2}" y="181" text-anchor="middle" fill="#e8eee7" font-family="Inter, sans-serif" font-size="14">${escapeXml(shortLabel(label))}</text>${arrow}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(cue.title)}</title><desc id="desc">${escapeXml(cue.altText)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#72da98"/></marker><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#141714"/><stop offset="1" stop-color="#070907"/></linearGradient></defs><rect width="720" height="360" rx="18" fill="url(#bg)"/><text x="36" y="52" fill="#72da98" font-family="IBM Plex Mono, monospace" font-size="12" letter-spacing="1.5">STONECODE VISUAL</text><text x="36" y="88" fill="#f1f3eb" font-family="Inter, sans-serif" font-size="24" font-weight="600">${escapeXml(shortLabel(cue.title, 44))}</text>${boxes}<text x="360" y="292" text-anchor="middle" fill="#9ba59d" font-family="Inter, sans-serif" font-size="13">${escapeXml(shortLabel(cue.caption, 86))}</text></svg>`;
}

function findCourseStep(content, stepId) {
  const [moduleId, topicId, blockId, rawIndex] = String(stepId).split(":");
  const stepIndex = Number(rawIndex);
  if (!moduleId || !topicId || !blockId || !Number.isInteger(stepIndex)) return null;
  const modules = navigableModules(content);
  const module = modules.find((item) => item?.id === moduleId);
  const topics = Array.isArray(module?.topics) ? module.topics : [{ id: module?.id, blocks: module?.blocks ?? [] }];
  const topic = topics.find((item) => item?.id === topicId);
  const block = topic?.blocks?.find((item) => item?.id === blockId);
  return block?.steps?.[stepIndex] ?? null;
}

function navigableModules(content) {
  if (content?.schemaVersion === "guided-project-content/v2") {
    return [{ ...content.module, topics: [{ id: `${content.module?.id ?? "guided-project"}-build`, blocks: content.module?.blocks ?? [] }] }];
  }
  if (content?.schemaVersion === "exercise-session/v1") {
    return [{ id: "practice-session", topics: content.problems ?? [] }];
  }
  if (content?.schemaVersion === "short-course-content/v1") {
    return [{ id: "short-course", topics: content.sections ?? [] }];
  }
  return content?.modules ?? content?.milestones ?? [];
}

async function readOwnedCourse(admin, userId, courseId) {
  const { data, error } = await admin.from("courses").select("id,course_content").eq("id", courseId).eq("user_id", userId).maybeSingle();
  if (error) throw visualError("course_lookup_failed", error.message, 500);
  return data ?? null;
}

async function readCachedVisual(admin, userId, courseId, stepId, cueKey) {
  const { data } = await admin.from("tutor_visuals").select("*").eq("user_id", userId).eq("course_id", courseId).eq("step_id", stepId).eq("cue_key", cueKey).maybeSingle();
  return data ?? null;
}

async function consumeImageAllowance(admin, userId, plan) {
  const periodStart = utcPeriodStart("month");
  const limit = resolvePlanLimit(plan).aiImagesPerMonth;
  const allowance = await consumePlanUsage({
    admin,
    userId,
    feature: "ai_image",
    periodStart,
    limit,
    fallback: async () => {
      const { count, error } = await admin
        .from("tutor_visuals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("visual_kind", "ai_image")
        .eq("status", "ready")
        .gte("created_at", `${periodStart}T00:00:00.000Z`);
      if (error) return { allowed: false, used: limit, limit };
      return { allowed: (count ?? 0) < limit, used: count ?? 0, limit };
    }
  });
  return { ...allowance, periodStart };
}

async function releaseImageAllowance(admin, userId, allowance) {
  if (!allowance?.periodStart || allowance.atomic === false) return;
  await releasePlanUsage({ admin, userId, feature: "ai_image", periodStart: allowance.periodStart });
}

async function generateTutorImage({ cue, env, fetchImpl }) {
  const startedAt = Date.now();
  const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: `Educational programming illustration for a beginner. ${cue.description}. Dark stone-textured interface palette, clear focal structure, no logos, no decorative text.`,
      size: "1024x1024",
      quality: "low",
      output_format: "png"
    })
  });
  const payload = await response.json().catch(() => null);
  const base64 = payload?.data?.[0]?.b64_json;
  if (!response.ok || typeof base64 !== "string") throw new Error(payload?.error?.message ?? "AI image generation failed.");
  return { image: Buffer.from(base64, "base64"), latencyMs: Date.now() - startedAt, usage: payload?.usage ?? null };
}

async function recordImageUsage(admin, { userId, courseId, model, latencyMs, usage = null, status }) {
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    course_id: courseId,
    event_type: "ai_image",
    model,
    input_tokens: finiteInteger(usage?.input_tokens),
    output_tokens: finiteInteger(usage?.output_tokens),
    feature: "tutor_visual",
    latency_ms: finiteInteger(latencyMs),
    cost_category: "plan_included",
    status
  });
  if (error) console.error("Failed to record tutor image usage", error.message);
}

function finiteInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function normalizeCue(value) {
  if (!value || value.version !== "tutor-visual-cue/v1") return null;
  const description = clean(value.description, 800);
  const altText = clean(value.altText, 300);
  if (!description || !altText) return null;
  return {
    id: clean(value.id, 120) || "visual",
    kind: value.kind === "illustration" ? "illustration" : "diagram",
    title: clean(value.title, 120) || "Visual explanation",
    description,
    caption: clean(value.caption, 240) || clean(value.title, 120),
    altText,
    labels: [...new Set((Array.isArray(value.labels) ? value.labels : []).map((item) => clean(item, 80)).filter(Boolean))],
    preferredRenderer: ["auto", "svg", "image"].includes(value.preferredRenderer) ? value.preferredRenderer : "auto"
  };
}

function attachment(row) {
  return {
    version: "tutor-visual-attachment/v1",
    id: row.id,
    kind: row.visual_kind,
    caption: row.caption,
    altText: row.alt_text,
    contentUrl: `/api/visual-assets/${row.id}`,
    metadata: row.metadata ?? {}
  };
}

function sentenceLabels(value) {
  const labels = String(value).split(/[.>;→]+/).map((part) => part.trim()).filter(Boolean).slice(0, 4);
  return labels.length >= 2 ? labels : ["Input", "Process", "Result"];
}

function shortLabel(value, max = 24) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" })[character]);
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function visualError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
