import { createCreditQuote, releaseCredits, reserveCredits, settleCredits } from "../credits/credit-store.mjs";

export async function listMarketplaceTemplates(admin, filters = {}) {
  let query = admin
    .from("marketplace_templates")
    .select("id,owner_user_id,title,description,tags,technologies,status,current_version,star_count,clone_count,created_at,updated_at")
    .eq("status", "published")
    .order("star_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  const search = clean(filters.search, 100);
  const technology = clean(filters.technology, 60);
  if (search) query = query.or(`title.ilike.%${escapeFilter(search)}%,description.ilike.%${escapeFilter(search)}%`);
  if (technology) query = query.contains("technologies", [technology]);
  const { data: templates, error } = await query;
  if (error) throw marketplaceError("marketplace_list_failed", error.message, 500);
  const ids = (templates ?? []).map((item) => item.id);
  const versions = ids.length
    ? await admin.from("marketplace_template_versions").select("template_id,version,snapshot").in("template_id", ids)
    : { data: [], error: null };
  if (versions.error) throw marketplaceError("marketplace_list_failed", versions.error.message, 500);
  const viewerStars = ids.length && filters.userId
    ? await admin.from("marketplace_stars").select("template_id").eq("user_id", filters.userId).in("template_id", ids)
    : { data: [], error: null };
  if (viewerStars.error) throw marketplaceError("marketplace_list_failed", viewerStars.error.message, 500);
  const starredIds = new Set((viewerStars.data ?? []).map((star) => star.template_id));
  const currentVersions = new Map((versions.data ?? []).map((version) => [`${version.template_id}:${version.version}`, version.snapshot]));
  return (templates ?? []).map((template) => ({
    ...template,
    snapshot: currentVersions.get(`${template.id}:${template.current_version}`) ?? null,
    starredByViewer: starredIds.has(template.id)
  }));
}

export async function publishMarketplaceTemplate(admin, { userId, courseId, metadata }) {
  const { data: course, error } = await admin
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !course) throw marketplaceError("course_not_found", "Owned learning path not found.", 404);
  if (!course.course_content || !["course", "guided_project"].includes(course.experience_type)) {
    throw marketplaceError("marketplace_source_unsupported", "Only generated courses and guided projects can be published.", 400);
  }
  const listing = {
    title: clean(metadata?.title, 140) || course.title,
    description: clean(metadata?.description, 800) || course.description || "Shared Stonecode learning path.",
    tags: unique(metadata?.tags).slice(0, 12),
    technologies: unique(metadata?.technologies?.length ? metadata.technologies : course.languages).slice(0, 12)
  };
  const { data: existing, error: existingError } = await admin
    .from("marketplace_templates")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("source_course_id", courseId)
    .maybeSingle();
  if (existingError) throw marketplaceError("marketplace_publish_failed", existingError.message, 500);
  if (existing?.status === "suspended") throw marketplaceError("marketplace_listing_suspended", "This listing is suspended and cannot be republished.", 403);
  const version = existing ? Number(existing.current_version) + 1 : 1;
  const templatePayload = {
    owner_user_id: userId,
    source_course_id: courseId,
    ...listing,
    status: "published",
    current_version: version,
    updated_at: new Date().toISOString()
  };
  const snapshot = buildSnapshot(course, listing, version);
  if (existing) {
    const { error: versionError } = await admin.from("marketplace_template_versions").insert({ template_id: existing.id, version, snapshot });
    if (versionError) throw marketplaceError("marketplace_publish_failed", versionError.message, 500);
    const templateResult = await admin.from("marketplace_templates").update(templatePayload).eq("id", existing.id).eq("owner_user_id", userId).select("*").single();
    if (templateResult.error) {
      await admin.from("marketplace_template_versions").delete().eq("template_id", existing.id).eq("version", version);
      throw marketplaceError("marketplace_publish_failed", templateResult.error.message, 500);
    }
    return { ...templateResult.data, snapshot };
  }
  const templateResult = await admin.from("marketplace_templates").insert(templatePayload).select("*").single();
  if (templateResult.error) throw marketplaceError("marketplace_publish_failed", templateResult.error.message, 500);
  const { error: versionError } = await admin.from("marketplace_template_versions").insert({
    template_id: templateResult.data.id,
    version,
    snapshot
  });
  if (versionError) {
    await admin.from("marketplace_templates").delete().eq("id", templateResult.data.id).eq("owner_user_id", userId);
    throw marketplaceError("marketplace_publish_failed", versionError.message, 500);
  }
  return { ...templateResult.data, snapshot };
}

export async function unpublishMarketplaceTemplate(admin, { userId, templateId }) {
  const { data, error } = await admin
    .from("marketplace_templates")
    .update({ status: "unpublished", updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("owner_user_id", userId)
    .neq("status", "suspended")
    .select("id,status")
    .maybeSingle();
  if (error) throw marketplaceError("marketplace_unpublish_failed", error.message, 500);
  if (!data) throw marketplaceError("marketplace_template_not_found", "Marketplace listing not found.", 404);
  return data;
}

export async function setMarketplaceStar(admin, { userId, templateId, starred }) {
  await requirePublishedTemplate(admin, templateId);
  const operation = starred
    ? admin.from("marketplace_stars").upsert({ template_id: templateId, user_id: userId }, { onConflict: "template_id,user_id", ignoreDuplicates: true })
    : admin.from("marketplace_stars").delete().eq("template_id", templateId).eq("user_id", userId);
  const { error } = await operation;
  if (error) throw marketplaceError("marketplace_star_failed", error.message, 500);
  const { count } = await admin.from("marketplace_stars").select("template_id", { count: "exact", head: true }).eq("template_id", templateId);
  await admin.from("marketplace_templates").update({ star_count: count ?? 0 }).eq("id", templateId);
  return { starred: Boolean(starred), starCount: count ?? 0 };
}

export async function reportMarketplaceTemplate(admin, { userId, templateId, reason, details }) {
  await requirePublishedTemplate(admin, templateId);
  const normalizedReason = clean(reason, 80);
  if (!normalizedReason) throw marketplaceError("invalid_marketplace_report", "A report reason is required.", 400);
  const { data, error } = await admin.from("marketplace_reports").upsert({
    template_id: templateId,
    reporter_user_id: userId,
    reason: normalizedReason,
    details: clean(details, 1000) || null
  }, { onConflict: "template_id,reporter_user_id,reason" }).select("id,status").single();
  if (error) throw marketplaceError("marketplace_report_failed", error.message, 500);
  return data;
}

export async function cloneMarketplaceTemplate(admin, { userId, templateId, idempotencyKey, activePathLimit }) {
  const key = clean(idempotencyKey, 160);
  if (!key) throw marketplaceError("marketplace_idempotency_required", "An idempotency key is required.", 400);
  const clientRequestId = `marketplace-clone:${key}`.slice(0, 120);
  const { data: existing } = await admin.from("courses").select("*").eq("user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
  if (existing) return { course: existing, chargedCredits: 0, idempotent: true };
  const template = await requirePublishedTemplate(admin, templateId);
  const { data: version, error: versionError } = await admin
    .from("marketplace_template_versions")
    .select("snapshot")
    .eq("template_id", templateId)
    .eq("version", template.current_version)
    .single();
  if (versionError || !version?.snapshot?.course) throw marketplaceError("marketplace_snapshot_missing", "Marketplace snapshot is unavailable.", 409);
  const source = version.snapshot.course;
  if (source.experienceType !== "exercise") {
    const { count, error: countError } = await admin.from("courses").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active").neq("experience_type", "exercise");
    if (countError) throw marketplaceError("course_limit_check_failed", countError.message, 500);
    if ((count ?? 0) >= activePathLimit) throw marketplaceError("active_path_limit_reached", `Active learning path limit reached (${activePathLimit}).`, 403);
  }
  const quote = await createCreditQuote(admin, { userId, scope: { marketplaceClone: true }, idempotencyKey: `marketplace-quote:${key}` });
  const reservation = await reserveCredits(admin, { userId, quoteId: quote.id, idempotencyKey: `marketplace-reservation:${key}` });
  let createdCourseId = null;
  try {
    const { data: course, error: insertError } = await admin.from("courses").insert({
      user_id: userId,
      title: source.title,
      subject: source.subject,
      mode: source.mode,
      checkpoint: source.checkpoint,
      description: source.description,
      progress: 0,
      required_section_count: source.requiredSectionCount,
      experience_type: source.experienceType,
      client_request_id: clientRequestId,
      course_content: source.courseContent,
      languages: source.languages,
      tags: [...new Set([...(source.tags ?? []), "Marketplace clone"])],
      content_generation_state: "full_course"
    }).select("*").single();
    if (insertError) throw insertError;
    createdCourseId = course.id;
    await settleCredits(admin, { userId, reservationId: reservation.id });
    await admin.from("marketplace_templates").update({ clone_count: Number(template.clone_count ?? 0) + 1 }).eq("id", templateId);
    return { course, chargedCredits: 1, idempotent: false };
  } catch (error) {
    if (createdCourseId) await admin.from("courses").delete().eq("id", createdCourseId).eq("user_id", userId);
    await releaseCredits(admin, { userId, reservationId: reservation.id }).catch(() => null);
    throw marketplaceError("marketplace_clone_failed", error?.message ?? "Marketplace clone failed.", 500);
  }
}

export function buildSnapshot(course, listing, version) {
  return {
    version: "marketplace-template/v1",
    listing: { ...listing, version },
    course: {
      title: course.title,
      subject: course.subject,
      mode: course.mode,
      checkpoint: course.checkpoint,
      description: course.description,
      requiredSectionCount: course.required_section_count,
      experienceType: course.experience_type,
      courseContent: course.course_content,
      languages: course.languages ?? [],
      tags: course.tags ?? []
    }
  };
}

async function requirePublishedTemplate(admin, templateId) {
  const { data, error } = await admin.from("marketplace_templates").select("*").eq("id", templateId).eq("status", "published").maybeSingle();
  if (error || !data) throw marketplaceError("marketplace_template_not_found", "Published marketplace listing not found.", 404);
  return data;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 80)).filter(Boolean))];
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeFilter(value) {
  return value.replace(/[%_,()]/g, " ");
}

function marketplaceError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
