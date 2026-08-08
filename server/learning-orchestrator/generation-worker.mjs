import {
  buildAssessmentModuleContentPrompt,
  buildGeneratedModuleRepairPrompt,
  buildGeneratedTopicRepairPrompt,
  extractGeneratedModuleFromResponse,
  extractGeneratedTopicFromResponse,
  normalizeGeneratedCourseContent
} from "../course-generation.mjs";
import {
  approvedModuleStepRange,
  assembleCompleteApprovedCourse,
  assertCourseDeliveryScope,
  buildApprovedModuleDeliveryContract,
  countModuleSteps,
  createApprovedCourseSkeleton,
  mergeApprovedGeneratedModule,
} from "./course-delivery.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  groupGeneratedCourseWarningsByTopic,
  getBlockingGeneratedCourseQualityWarnings,
  hasRepairableGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "../course-generation-quality.mjs";
import { requestCourseGenerationJson, resolveTutorProviderConfig } from "../llm-providers.mjs";
import { releaseCredits } from "../credits/credit-store.mjs";
import { estimateOpenAiTextCost } from "../billing/ai-costs.mjs";
import { retrieveRagContext } from "../rag/retrieve.mjs";
import { buildRuntimeCapabilityCatalog } from "../runtime/capability-catalog.mjs";
import {
  buildExerciseProblemBatchPrompt,
  buildLearningExperiencePrompt,
  buildLearningExperienceRepairPrompt,
  normalizeExerciseProblemBatch,
  normalizeGeneratedLearningContent
} from "./generation.mjs";
import {
  normalizeLearningBrief,
  resolveExerciseMixCounts,
  resolveLearningBriefDomainId,
  resolveLearningBriefTechnologyId,
  subjectForLearningBrief
} from "./contracts.mjs";

export async function processGenerationJob({ admin, jobId, env = process.env }) {
  const job = await claimJob(admin, jobId);
  if (!job) return { status: "ignored" };

  try {
    const proposalRow = await readProposal(admin, job);
    const brief = normalizeLearningBrief(proposalRow.brief);
    const generationCapability = await assertGenerationCapability(admin, brief, env);
    const { domainId, technologyId } = generationCapability;
    await enforceActivePathLimit(admin, job.user_id, proposalRow.proposal?.type);
    await updateJob(admin, job.id, { progress: 10 });

    const providerConfig = resolveTutorProviderConfig(env, proposalRow.proposal?.type === "course" ? "course_structure" : proposalRow.proposal?.type === "exercise" ? "exercise_generation" : "guided_project");
    if (providerConfig.error) throw workerError("provider_unavailable", providerConfig.error);
    const fullGenerationProviderConfig = {
      ...providerConfig,
      serviceTier: resolveCourseGenerationServiceTier(env)
    };
    const ragContext = await retrieveRagContext({
      admin,
      config: providerConfig,
      technologyId,
      domainId,
      subject: subjectForLearningBrief(brief),
      task: proposalRow.proposal?.type === "exercise" ? "exercise-generation" : proposalRow.proposal?.type === "project" ? "guided-project" : "course-generation",
      query: [brief.goal, brief.desiredOutcome, ...(brief.topics ?? [])].filter(Boolean).join(" "),
      limit: 8
    });
    assertRequiredRagContext({ domainId, technologyId, ragContext });
    const assessmentReview = directReview(brief, proposalRow.proposal);
    let content;
    if (proposalRow.proposal?.type === "course" && await supportsProgressiveCourseGeneration(admin)) {
      return await generateProgressiveCourse({
        admin,
        job,
        env,
        providerConfig: fullGenerationProviderConfig,
        brief,
        proposal: proposalRow.proposal,
        assessmentReview,
        ragContext,
        generationCapability
      });
    }
    if (proposalRow.proposal?.type === "course") {
      content = await generateCompleteCourseContent({
        admin,
        job,
        env,
        providerConfig: fullGenerationProviderConfig,
        brief,
        proposal: proposalRow.proposal,
        assessmentReview,
        ragContext
      });
    } else if (proposalRow.proposal?.type === "exercise") {
      content = await generateExerciseContent({ admin, job, providerConfig: fullGenerationProviderConfig, brief, proposal: proposalRow.proposal, ragContext });
    } else {
      const prompt = generationPrompt({ brief, proposal: proposalRow.proposal, assessmentReview, ragContext });
      const maxTokens = 16000;
      const result = await requestCourseGenerationJson({ config: fullGenerationProviderConfig, prompt, maxTokens });
      await recordWorkerUsage(admin, job, fullGenerationProviderConfig, result, "learning_path_generation");
      if (!result.ok) throw workerError("generation_failed", result.error ?? "AI generation failed.");
      content = await normalizeAndRepairGeneratedContent({
        admin,
        job,
        env,
        providerConfig: fullGenerationProviderConfig,
        brief,
        assessmentReview,
        ragContext,
        prompt,
        maxTokens,
        result
      });
    }
    content = applyLearningBriefMetadata(content, brief, generationCapability);
    await updateJob(admin, job.id, { progress: 65 });

    const course = await persistGeneratedCourse(admin, {
      userId: job.user_id,
      jobId: job.id,
      brief,
      proposal: proposalRow.proposal,
      content,
      generationProvenance: buildGenerationProvenance(generationCapability, ragContext)
    });
    try {
      await completeGenerationJob(admin, {
        userId: job.user_id,
        jobId: job.id,
        courseId: course.id,
        reservationId: job.reservation_id
      });
    } catch (error) {
      await admin.from("courses").delete().eq("id", course.id).eq("user_id", job.user_id);
      throw error;
    }
    return { status: "succeeded", courseId: course.id };
  } catch (error) {
    const launchedJob = await readGenerationLaunch(admin, job.id);
    if (canRetryGenerationJob({ ...job, launch_ready_at: launchedJob?.launch_ready_at ?? job.launch_ready_at }, error)) {
      await markProgressiveGenerationInterrupted(admin, launchedJob, "queued").catch(() => null);
      await updateJob(admin, job.id, {
        status: "queued",
        progress: launchedJob?.launch_ready_at ? 100 : 5,
        error_code: error?.code ?? "generation_attempt_failed",
        error_message: String(error instanceof Error ? error.message : error).slice(0, 1200),
        started_at: null,
        completed_at: null
      });
      return { status: "queued", retry: true, error: error instanceof Error ? error.message : String(error) };
    }
    if (!launchedJob?.launch_ready_at) {
      await releaseCredits(admin, { userId: job.user_id, reservationId: job.reservation_id }).catch(() => null);
    }
    await markProgressiveGenerationInterrupted(admin, launchedJob, "paused").catch(() => null);
    await updateJob(admin, job.id, {
      status: "failed",
      error_code: error?.code ?? "generation_job_failed",
      error_message: String(error instanceof Error ? error.message : error).slice(0, 1200),
      completed_at: new Date().toISOString()
    });
    return {
      status: "failed",
      courseId: launchedJob?.result_course_id ?? null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function supportsProgressiveCourseGeneration(admin) {
  const { error } = await admin
    .from("generation_jobs")
    .select("generation_state,launch_ready_at")
    .limit(1);
  if (!error) return true;
  if (["PGRST204", "42703"].includes(String(error.code ?? "")) || /generation_state|launch_ready_at|schema cache/i.test(String(error.message ?? ""))) {
    console.warn("Progressive generation schema is unavailable; using full-course compatibility generation.");
    return false;
  }
  console.warn("Progressive generation schema check failed; using full-course compatibility generation.", {
    code: error.code ?? "unknown",
    message: error.message || error.details || "No database error message was returned."
  });
  return false;
}

async function generateProgressiveCourse({
  admin,
  job,
  env,
  providerConfig,
  brief,
  proposal,
  assessmentReview,
  ragContext,
  generationCapability
}) {
  const subject = subjectForLearningBrief(brief);
  const courseBlueprint = courseBlueprintFromProposal(proposal);
  const skeleton = createApprovedCourseSkeleton({
    proposal,
    subject,
    assessmentReview,
    courseBlueprint,
    ragSources: ragContext
  });
  const launchModuleCount = Math.min(2, skeleton.modules.length);
  const generationProvenance = buildGenerationProvenance(generationCapability, ragContext);
  let state = restoreProgressiveGenerationState(job.generation_state, { jobId: job.id, skeleton, launchModuleCount });
  let courseId = job.result_course_id ?? null;

  await updateJob(admin, job.id, {
    progress: courseId ? 100 : Math.max(Number(job.progress ?? 0), 15),
    generation_state: state
  });
  if (courseId) {
    await persistProgressiveCourseSnapshot(admin, {
      userId: job.user_id,
      courseId,
      jobId: job.id,
      brief,
      proposal,
      skeleton,
      state,
      generationCapability,
      generationProvenance
    });
  }

  for (let moduleIndex = 0; moduleIndex < skeleton.modules.length; moduleIndex += 1) {
    if (state.modules[moduleIndex]?.status === "ready" && state.modules[moduleIndex]?.content) continue;
    state = updateProgressiveModuleState(state, moduleIndex, { status: "generating", content: null });
    await updateJob(admin, job.id, {
      progress: courseId ? 100 : launchProgressBeforeModule(moduleIndex, launchModuleCount),
      generation_state: state,
      error_code: null,
      error_message: null
    });
    if (courseId) {
      await persistProgressiveCourseSnapshot(admin, {
        userId: job.user_id,
        courseId,
        jobId: job.id,
        brief,
        proposal,
        skeleton,
        state,
        generationCapability,
        generationProvenance
      });
    }

    const { minimum, maximum: preferredMaximum } = approvedModuleStepRange(proposal, moduleIndex);
    const modulePrompt = `${buildAssessmentModuleContentPrompt({
      subject,
      answers: [],
      assessmentReview,
      courseOutline: skeleton,
      courseBlueprint,
      retrievedContext: ragContext,
      moduleIndex
    })}\n\n${buildApprovedModuleDeliveryContract(proposal, moduleIndex)}${conceptualCourseGenerationContract(brief)}`;
    const generatedModule = await generateApprovedModule({
      admin,
      job,
      providerConfig,
      prompt: modulePrompt,
      skeleton,
      proposal,
      moduleIndex,
      minimum,
      preferredMaximum
    });
    const approvedModule = await approveProgressiveCourseModule({
      admin,
      job,
      env,
      brief,
      proposal,
      assessmentReview,
      ragContext,
      skeleton,
      moduleIndex,
      module: generatedModule
    });
    state = updateProgressiveModuleState(state, moduleIndex, { status: "ready", content: approvedModule });
    await updateJob(admin, job.id, {
      progress: courseId ? 100 : launchProgressAfterModule(moduleIndex, launchModuleCount),
      generation_state: state
    });

    if (!courseId && readyProgressiveModuleCount(state) >= launchModuleCount) {
      const course = await persistProgressiveCourseSnapshot(admin, {
        userId: job.user_id,
        courseId: null,
        jobId: job.id,
        brief,
        proposal,
        skeleton,
        state,
        generationCapability,
        generationProvenance
      });
      courseId = course.id;
      await launchProgressiveGenerationJob(admin, {
        userId: job.user_id,
        jobId: job.id,
        courseId,
        reservationId: job.reservation_id
      });
    } else if (courseId) {
      await persistProgressiveCourseSnapshot(admin, {
        userId: job.user_id,
        courseId,
        jobId: job.id,
        brief,
        proposal,
        skeleton,
        state,
        generationCapability,
        generationProvenance
      });
    }
  }

  if (!courseId) throw workerError("course_persistence_failed", "The launch modules were not persisted.");
  const generatedModules = state.modules.map((entry) => entry.content);
  let content = assembleCompleteApprovedCourse(skeleton, generatedModules, proposal);
  content = await repairGeneratedCourseQuality({ admin, job, env, brief, assessmentReview, ragContext, content, reportProgress: false });
  content = assembleCompleteApprovedCourse(
    skeleton,
    content.modules.map((module, moduleIndex) => mergeApprovedGeneratedModule(skeleton, module, moduleIndex, proposal)),
    proposal
  );
  state = completeProgressiveGenerationState(state, content.modules);
  await updateJob(admin, job.id, { progress: 100, generation_state: state });
  await persistProgressiveCourseSnapshot(admin, {
    userId: job.user_id,
    courseId,
    jobId: job.id,
    brief,
    proposal,
    skeleton,
    state,
    generationCapability,
    generationProvenance,
    completeContent: content
  });
  await completeProgressiveGenerationJob(admin, { userId: job.user_id, jobId: job.id, courseId });
  return { status: "succeeded", courseId, launchReady: true };
}

export async function generateCompleteCourseContent({
  admin,
  job,
  env,
  providerConfig,
  brief,
  proposal,
  assessmentReview,
  ragContext,
  existingModules = []
}) {
  const courseProviderConfig = {
    ...providerConfig,
    serviceTier: resolveCourseGenerationServiceTier(env)
  };
  const subject = subjectForLearningBrief(brief);
  const courseBlueprint = courseBlueprintFromProposal(proposal);
  const skeleton = createApprovedCourseSkeleton({
    proposal,
    subject,
    assessmentReview,
    courseBlueprint,
    ragSources: ragContext
  });
  await updateJob(admin, job.id, { progress: 15 });

  const modules = [];
  for (let moduleIndex = 0; moduleIndex < skeleton.modules.length; moduleIndex += 1) {
    const existing = existingModules[moduleIndex];
    const { minimum, maximum: preferredMaximum } = approvedModuleStepRange(proposal, moduleIndex);
    if (
      existing &&
      String(existing.title ?? "").trim().toLowerCase() === String(proposal.items[moduleIndex]?.title ?? "").trim().toLowerCase() &&
      countModuleSteps(existing) >= minimum
    ) {
      const preserved = mergeApprovedGeneratedModule(skeleton, existing, moduleIndex, proposal);
      modules.push(preserved);
      continue;
    }

    const modulePrompt = `${buildAssessmentModuleContentPrompt({
      subject,
      answers: [],
      assessmentReview,
      courseOutline: skeleton,
      courseBlueprint,
      retrievedContext: ragContext,
      moduleIndex
    })}\n\n${buildApprovedModuleDeliveryContract(proposal, moduleIndex)}${conceptualCourseGenerationContract(brief)}`;
    const generatedModule = await generateApprovedModule({
      admin,
      job,
      providerConfig: courseProviderConfig,
      prompt: modulePrompt,
      skeleton,
      proposal,
      moduleIndex,
      minimum,
      preferredMaximum
    });
    modules.push(generatedModule);
    await updateJob(admin, job.id, {
      progress: 15 + Math.round(((moduleIndex + 1) / skeleton.modules.length) * 40)
    });
  }

  let content = assembleCompleteApprovedCourse(skeleton, modules, proposal);
  content = await repairGeneratedCourseQuality({ admin, job, env, brief, assessmentReview, ragContext, content });
  return assembleCompleteApprovedCourse(
    skeleton,
    content.modules.map((module, moduleIndex) => mergeApprovedGeneratedModule(skeleton, module, moduleIndex, proposal)),
    proposal
  );
}

export function restoreProgressiveGenerationState(value, { jobId, skeleton, launchModuleCount }) {
  const storedModules = value?.version === "progressive-course-generation/v1" && Array.isArray(value.modules)
    ? value.modules
    : [];
  return {
    version: "progressive-course-generation/v1",
    jobId,
    launchModuleCount,
    totalModules: skeleton.modules.length,
    modules: skeleton.modules.map((module, moduleIndex) => {
      const stored = storedModules[moduleIndex];
      const content = stored?.content && countModuleSteps(stored.content) > 0 ? stored.content : null;
      return {
        index: moduleIndex,
        id: module.id,
        title: module.title,
        summary: module.summary,
        status: content ? "ready" : "queued",
        content
      };
    })
  };
}

export function buildProgressiveCourseContent({ skeleton, state, jobId, completeContent = null }) {
  const modules = completeContent?.modules ?? skeleton.modules.map((module, moduleIndex) => {
    const entry = state.modules[moduleIndex];
    if (entry?.status === "ready" && entry.content) return entry.content;
    return {
      ...module,
      unlocked: false,
      topics: (module.topics ?? []).map((topic) => ({
        ...topic,
        unlocked: false,
        blocks: (topic.blocks ?? []).map((block) => ({ ...block, steps: [] }))
      }))
    };
  });
  const readyModuleCount = state.modules.filter((entry) => entry.status === "ready").length;
  return {
    ...(completeContent ?? skeleton),
    modules,
    generationDepth: completeContent ? "full_course" : "full_structure_first_module",
    progressiveGeneration: {
      version: "progressive-course-generation/v1",
      jobId,
      launchModuleCount: state.launchModuleCount,
      totalModules: state.totalModules,
      readyModuleCount,
      status: completeContent ? "complete" : "background",
      modules: state.modules.map(({ index, id, title, summary, status }) => ({ index, id, title, summary, status }))
    }
  };
}

function updateProgressiveModuleState(state, moduleIndex, patch) {
  return {
    ...state,
    modules: state.modules.map((entry, index) => index === moduleIndex ? { ...entry, ...patch } : entry)
  };
}

function completeProgressiveGenerationState(state, modules) {
  return {
    ...state,
    modules: state.modules.map((entry, index) => ({ ...entry, status: "ready", content: modules[index] }))
  };
}

function readyProgressiveModuleCount(state) {
  return state.modules.filter((entry) => entry.status === "ready" && entry.content).length;
}

function launchProgressBeforeModule(moduleIndex, launchModuleCount) {
  if (moduleIndex >= launchModuleCount) return 100;
  return 15 + Math.round((moduleIndex / Math.max(launchModuleCount, 1)) * 80);
}

function launchProgressAfterModule(moduleIndex, launchModuleCount) {
  if (moduleIndex >= launchModuleCount) return 100;
  return Math.min(92, 15 + Math.round(((moduleIndex + 1) / Math.max(launchModuleCount, 1)) * 75));
}

async function approveProgressiveCourseModule({
  admin,
  job,
  env,
  brief,
  proposal,
  assessmentReview,
  ragContext,
  skeleton,
  moduleIndex,
  module
}) {
  const isolatedContent = {
    ...skeleton,
    generationDepth: "full_course",
    modules: [{ ...module, order: 0 }]
  };
  const repaired = await repairGeneratedCourseQuality({
    admin,
    job,
    env,
    brief,
    assessmentReview,
    ragContext,
    content: isolatedContent,
    reportProgress: false,
    moduleIndexOffset: moduleIndex,
    totalModuleCount: skeleton.modules.length
  });
  const approved = mergeApprovedGeneratedModule(skeleton, repaired.modules[0], moduleIndex, proposal);
  const { minimum } = approvedModuleStepRange(proposal, moduleIndex);
  if (countModuleSteps(approved) < minimum) {
    throw workerError("generation_scope_mismatch", `Module ${moduleIndex + 1} fell below its approved learner-step count after quality repair.`);
  }
  return approved;
}

async function persistProgressiveCourseSnapshot(admin, {
  userId,
  courseId,
  jobId,
  brief,
  proposal,
  skeleton,
  state,
  generationCapability,
  generationProvenance,
  completeContent = null
}) {
  const progressiveContent = buildProgressiveCourseContent({ skeleton, state, jobId, completeContent });
  const content = applyLearningBriefMetadata(progressiveContent, brief, generationCapability);
  const payload = {
    title: content.title,
    subject: content.subject,
    mode: "mixed",
    checkpoint: proposal.items?.[0]?.title ?? "Start here",
    description: content.description,
    required_section_count: Math.max(1, Number(proposal.totals?.modules ?? skeleton.modules.length)),
    experience_type: "course",
    course_content: { ...content, learningBrief: brief, generationProvenance },
    languages: Array.isArray(content.languages) ? content.languages : [],
    tags: Array.isArray(content.tags) ? content.tags : [],
    content_generation_state: completeContent ? "full_course" : "first_chapter",
    updated_at: new Date().toISOString()
  };
  if (courseId) {
    const { data, error } = await admin.from("courses").update(payload).eq("id", courseId).eq("user_id", userId).select("*").single();
    if (error) throw workerError("course_persistence_failed", error.message);
    return data;
  }

  const clientRequestId = `generation-job:${jobId}`;
  const { data: existing, error: existingError } = await admin
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  if (existingError) throw workerError("course_persistence_failed", existingError.message);
  if (existing) {
    const { data, error } = await admin.from("courses").update(payload).eq("id", existing.id).eq("user_id", userId).select("*").single();
    if (error) throw workerError("course_persistence_failed", error.message);
    return data;
  }

  const { data, error } = await admin.from("courses").insert({
    ...payload,
    user_id: userId,
    progress: 0,
    client_request_id: clientRequestId
  }).select("*").single();
  if (error) throw workerError("course_persistence_failed", error.message);
  return data;
}

async function readGenerationLaunch(admin, jobId) {
  const { data, error } = await admin
    .from("generation_jobs")
    .select("id,user_id,result_course_id,launch_ready_at,generation_state")
    .eq("id", jobId)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

async function markProgressiveGenerationInterrupted(admin, job, status) {
  if (!job?.generation_state || job.generation_state.version !== "progressive-course-generation/v1") return;
  const state = {
    ...job.generation_state,
    modules: job.generation_state.modules.map((entry) => entry.status === "generating" ? { ...entry, status } : entry)
  };
  await updateJob(admin, job.id, { generation_state: state });
  if (!job.result_course_id) return;
  const { data: course, error } = await admin
    .from("courses")
    .select("course_content")
    .eq("id", job.result_course_id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (error || !course?.course_content?.progressiveGeneration) return;
  const progressiveGeneration = {
    ...course.course_content.progressiveGeneration,
    modules: state.modules.map(({ index, id, title, summary, status: moduleStatus }) => ({ index, id, title, summary, status: moduleStatus }))
  };
  await admin.from("courses").update({
    course_content: { ...course.course_content, progressiveGeneration },
    updated_at: new Date().toISOString()
  }).eq("id", job.result_course_id).eq("user_id", job.user_id);
}

export async function repairExistingCourseDelivery({ admin, courseId, env = process.env }) {
  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id,user_id,title,course_content")
    .eq("id", courseId)
    .maybeSingle();
  if (courseError) throw workerError("course_repair_read_failed", courseError.message);
  if (!course) throw workerError("course_repair_not_found", "Course not found.");

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("result_course_id", courseId)
    .eq("user_id", course.user_id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (jobError) throw workerError("course_repair_job_read_failed", jobError.message);
  if (!job) throw workerError("course_repair_job_not_found", "Successful generation job not found for this course.");

  const proposalRow = await readProposal(admin, job);
  const proposal = proposalRow.proposal;
  if (proposal?.type !== "course") throw workerError("course_repair_type_invalid", "Only generated Courses can use course delivery repair.");
  try {
    const delivered = assertCourseDeliveryScope(proposal, course.course_content);
    return { status: "already_complete", courseId, ...delivered };
  } catch {
    // Continue only when the persisted course does not fulfill its approved scope.
  }

  const brief = normalizeLearningBrief(proposalRow.brief);
  const generationCapability = await assertGenerationCapability(admin, brief, env);
  const { domainId, technologyId } = generationCapability;
  const providerConfig = resolveTutorProviderConfig(env, "course_structure");
  if (providerConfig.error) throw workerError("provider_unavailable", providerConfig.error);
  const ragContext = await retrieveRagContext({
    admin,
    config: providerConfig,
    technologyId,
    domainId,
    subject: subjectForLearningBrief(brief),
    task: "course-delivery-repair",
    query: [brief.goal, brief.desiredOutcome, ...(brief.topics ?? [])].filter(Boolean).join(" "),
    limit: 8
  });
  assertRequiredRagContext({ domainId, technologyId, ragContext });

  const assessmentReview = directReview(brief, proposal);
  const existingModules = Array.isArray(course.course_content?.modules) ? course.course_content.modules : [];
  const generatedContent = await generateCompleteCourseContent({
    admin,
    job,
    env,
    providerConfig,
    brief,
    proposal,
    assessmentReview,
    ragContext,
    existingModules
  });
  const content = applyLearningBriefMetadata(generatedContent, brief, generationCapability);
  const generationProvenance = buildGenerationProvenance(generationCapability, ragContext);
  const { error: updateError } = await admin
    .from("courses")
    .update({
      title: content.title,
      subject: content.subject,
      description: content.description,
      required_section_count: content.modules.length,
      course_content: { ...content, learningBrief: brief, generationProvenance },
      languages: content.languages,
      tags: content.tags,
      content_generation_state: "full_course"
    })
    .eq("id", courseId)
    .eq("user_id", course.user_id);
  if (updateError) throw workerError("course_repair_write_failed", updateError.message);
  await updateJob(admin, job.id, { progress: 100, error_code: null, error_message: null });
  return { status: "repaired", courseId, ...assertCourseDeliveryScope(proposal, content) };
}

async function generateApprovedModule({ admin, job, providerConfig, prompt, skeleton, proposal, moduleIndex, minimum, preferredMaximum }) {
  let previousText = "";
  let previousError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\nMODULE REPAIR REQUIRED\nThe previous module failed the delivery contract: ${previousError}. Return a complete replacement module with at least ${minimum} visible learner steps; ${minimum}-${preferredMaximum} is the preferred range, but keep additional valid teaching steps when useful. Previous JSON: ${previousText.slice(0, 9000)}`;
    const maxTokens = Math.min(12000, Math.max(7000, preferredMaximum * 900));
    const result = await requestCourseGenerationJson({ config: providerConfig, prompt: requestPrompt, maxTokens });
    await recordWorkerUsage(admin, job, providerConfig, result, attempt === 0 ? "course_module_generation" : "course_module_scope_repair");
    if (!result.ok) {
      previousError = result.error ?? `Module ${moduleIndex + 1} generation failed.`;
      if (attempt === 1) throw workerError("generation_repair_failed", previousError);
      continue;
    }
    previousText = result.text;
    try {
      const extracted = extractGeneratedModuleFromResponse(parseJsonObject(result.text), skeleton.modules[moduleIndex], moduleIndex);
      const module = mergeApprovedGeneratedModule(skeleton, extracted, moduleIndex, proposal);
      const steps = countModuleSteps(module);
      if (steps < minimum) {
        throw new Error(`Module ${moduleIndex + 1} requires at least ${minimum} learner steps; generated ${steps}.`);
      }
      return module;
    } catch (error) {
      previousError = error instanceof Error ? error.message : `Module ${moduleIndex + 1} was invalid.`;
      if (attempt === 1) throw workerError("generation_scope_mismatch", previousError);
    }
  }
  throw workerError("generation_scope_mismatch", `Module ${moduleIndex + 1} could not satisfy the approved scope.`);
}

export function canRetryGenerationJob(job, error) {
  const maximumAttempts = job?.launch_ready_at ? 8 : 3;
  if (job?.heartbeat_at === undefined || Number(job?.attempt_count ?? 0) >= maximumAttempts) return false;
  const code = String(error?.code ?? "");
  if (code === "generation_scope_mismatch" && !job?.launch_ready_at) return false;
  if (code === "generation_validation_failed" && Number(job?.attempt_count ?? 0) >= (job?.launch_ready_at ? 5 : 2)) return false;
  return /^(?:generation_|exercise_batch_|rag_context_|provider_)/.test(code);
}

export function resolveCourseGenerationServiceTier(env = process.env) {
  const configured = String(env.OPENAI_COURSE_GENERATION_SERVICE_TIER ?? "fast").trim().toLowerCase();
  return ["default", "standard", "off", "false"].includes(configured) ? null : "fast";
}

async function normalizeAndRepairGeneratedContent({
  admin,
  job,
  env,
  providerConfig,
  brief,
  assessmentReview,
  ragContext,
  prompt,
  maxTokens,
  result
}) {
  let content;
  try {
    content = normalizeWorkerContent(parseJsonObject(result.text), { brief, assessmentReview });
  } catch (initialError) {
    const repair = await requestCourseGenerationJson({
      config: providerConfig,
      prompt: buildLearningExperienceRepairPrompt({
        originalPrompt: prompt,
        invalidOutput: result.text,
        validationError: initialError instanceof Error ? initialError.message : "Invalid generated learning content."
      }),
      maxTokens
    });
    await recordWorkerUsage(admin, job, providerConfig, repair, "learning_path_structure_repair");
    if (!repair.ok) throw workerError("generation_repair_failed", repair.error ?? "AI repair failed.");
    try {
      content = normalizeWorkerContent(parseJsonObject(repair.text), { brief, assessmentReview });
    } catch (repairError) {
      throw workerError(
        "generation_validation_failed",
        repairError instanceof Error ? repairError.message : "AI repair returned invalid learning content."
      );
    }
  }

  if (brief.type !== "course") return content;
  return repairGeneratedCourseQuality({ admin, job, env, brief, assessmentReview, ragContext, content });
}

async function repairGeneratedCourseQuality({ admin, job, env, brief, assessmentReview, ragContext, content, reportProgress = true, moduleIndexOffset = 0, totalModuleCount = content?.modules?.length ?? 1 }) {
  let repairedContent = repairMechanicalWorkshopIssues(content);
  let qualityWarnings = validateGeneratedCourseQuality(repairedContent, { conceptual: isConceptualLearningBrief(brief), moduleIndexOffset, totalModuleCount });
  if (!hasRepairableGeneratedCourseQualityWarnings(qualityWarnings)) return repairedContent;

  const resolvedRepairConfig = resolveTutorProviderConfig(env, "course_repair");
  const repairConfig = { ...resolvedRepairConfig, serviceTier: resolveCourseGenerationServiceTier(env) };
  if (repairConfig.error) throw workerError("provider_unavailable", repairConfig.error);
  const subject = subjectForLearningBrief(brief);

  for (let repairPass = 0; repairPass < 1 && hasRepairableGeneratedCourseQualityWarnings(qualityWarnings); repairPass += 1) {
    const repairedModules = [...(repairedContent.modules ?? [])];
    const repairWarnings = getBlockingGeneratedCourseQualityWarnings(qualityWarnings);
    for (const [moduleIndex, moduleWarnings] of groupGeneratedCourseWarningsByModule(repairWarnings).entries()) {
      const module = repairedModules[moduleIndex];
      if (!module) continue;
      const topicWarningGroups = groupGeneratedCourseWarningsByTopic(moduleWarnings, moduleIndex);
      const topicWarnings = new Set([...topicWarningGroups.values()].flat());
      const hasModuleLevelWarnings = moduleWarnings.some((warning) => !topicWarnings.has(warning));

      if (hasModuleLevelWarnings || topicWarningGroups.size === 0) {
        const repair = await requestCourseGenerationJson({
          config: repairConfig,
          prompt: buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex, qualityWarnings: moduleWarnings }),
          maxTokens: 7500
        });
        await recordWorkerUsage(admin, job, repairConfig, repair, "learning_path_module_repair");
        if (!repair.ok) throw workerError("generation_repair_failed", repair.error ?? `Module ${moduleIndex + 1} repair failed.`);
        try {
          repairedModules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(repair.text), module, moduleIndex);
        } catch (error) {
          throw workerError("generation_repair_failed", error instanceof Error ? error.message : `Module ${moduleIndex + 1} repair was invalid.`);
        }
        continue;
      }

      const repairedTopics = [...(module.topics ?? [])];
      for (const [topicIndex, warnings] of topicWarningGroups.entries()) {
        const topic = repairedTopics[topicIndex];
        if (!topic) continue;
        const repair = await requestCourseGenerationJson({
          config: repairConfig,
          prompt: buildGeneratedTopicRepairPrompt({ subject, topic, moduleIndex, topicIndex, qualityWarnings: warnings }),
          maxTokens: 5000
        });
        await recordWorkerUsage(admin, job, repairConfig, repair, "learning_path_topic_repair");
        if (!repair.ok) throw workerError("generation_repair_failed", repair.error ?? `Topic ${topicIndex + 1} repair failed.`);
        try {
          repairedTopics[topicIndex] = extractGeneratedTopicFromResponse(parseJsonObject(repair.text), topic, topicIndex, warnings);
        } catch (error) {
          throw workerError("generation_repair_failed", error instanceof Error ? error.message : `Topic ${topicIndex + 1} repair was invalid.`);
        }
      }
      repairedModules[moduleIndex] = { ...module, topics: repairedTopics };
    }

    try {
      repairedContent = repairMechanicalWorkshopIssues(
        normalizeWorkerContent({ ...repairedContent, modules: repairedModules }, { brief, assessmentReview })
      );
    } catch (error) {
      throw workerError("generation_repair_failed", error instanceof Error ? error.message : "Repaired course structure was invalid.");
    }
    qualityWarnings = validateGeneratedCourseQuality(repairedContent, { conceptual: isConceptualLearningBrief(brief), moduleIndexOffset, totalModuleCount });
    if (reportProgress) await updateJob(admin, job.id, { progress: 58 + repairPass * 2 });
  }

  let blockingWarnings = getBlockingGeneratedCourseQualityWarnings(qualityWarnings);
  if (blockingWarnings.length) {
    repairedContent = repairMechanicalWorkshopIssues(await regenerateInvalidCourseModules({
      admin,
      job,
      repairConfig,
      brief,
      assessmentReview,
      ragContext,
      content: repairedContent,
      blockingWarnings
    }));
    qualityWarnings = validateGeneratedCourseQuality(repairedContent, { conceptual: isConceptualLearningBrief(brief), moduleIndexOffset, totalModuleCount });
    blockingWarnings = getBlockingGeneratedCourseQualityWarnings(qualityWarnings);
    if (reportProgress) await updateJob(admin, job.id, { progress: 62 });
  }

  if (blockingWarnings.length) {
    console.warn("Course generation remained invalid after focused recovery", {
      jobId: job.id,
      warningCodes: [...new Set(blockingWarnings.map((warning) => warning.code))],
      warningPaths: blockingWarnings.slice(0, 12).map((warning) => warning.message)
    });
    throw workerError(
      "generation_validation_failed",
      `Course quality validation failed after focused recovery: ${[...new Set(blockingWarnings.map((warning) => warning.code))].slice(0, 8).join(", ")}.`
    );
  }
  return repairedContent;
}

export function repairMechanicalWorkshopIssues(content) {
  return {
    ...content,
    modules: (content?.modules ?? []).map((module) => ({
      ...module,
      topics: (module?.topics ?? []).map((topic) => ({
        ...topic,
        blocks: (topic?.blocks ?? []).map((block) => {
          if (block?.kind !== "workshop") return block;
          let previousWorkshopId = null;
          const steps = [];
          for (const step of block.steps ?? []) {
            if (step?.type !== "workshop") {
              steps.push(step);
              continue;
            }
            const starterCode = String(step.starterCode ?? "").trim();
            const resultCode = String(step.resultCode ?? "").trim();
            if (starterCode === resultCode) continue;
            const prompt = /\b(add|change|replace|write|create|call|print|show|return|move|wrap|put|type|edit|set|define)\b/i.test(String(step.prompt ?? ""))
              ? step.prompt
              : `Change the code with this exact edit: ${step.expectedChange || step.prompt || "apply the next workshop delta"}.`;
            const repairedStep = {
              ...step,
              prompt,
              buildsOnStepId: previousWorkshopId
            };
            steps.push(repairedStep);
            previousWorkshopId = repairedStep.id;
          }
          return { ...block, steps };
        })
      }))
    }))
  };
}

async function regenerateInvalidCourseModules({
  admin,
  job,
  repairConfig,
  brief,
  assessmentReview,
  ragContext,
  content,
  blockingWarnings
}) {
  const subject = subjectForLearningBrief(brief);
  const modules = [...(content.modules ?? [])];
  const groupedWarnings = groupGeneratedCourseWarningsByModule(blockingWarnings);

  for (const [moduleIndex, moduleWarnings] of groupedWarnings.entries()) {
    const module = modules[moduleIndex];
    if (!module) continue;
    const prompt = `${buildAssessmentModuleContentPrompt({
      subject,
      answers: [],
      assessmentReview,
      courseOutline: content,
      courseBlueprint: content.courseBlueprint,
      retrievedContext: ragContext,
      moduleIndex
    })}

FOCUSED RECOVERY
The previous module still failed these deterministic checks after smaller repairs:
${JSON.stringify(moduleWarnings).slice(0, 2600)}
Return one complete replacement for this module. Resolve every listed check without changing the course direction or using another language.`;
    const result = await requestCourseGenerationJson({ config: repairConfig, prompt, maxTokens: 12000 });
    await recordWorkerUsage(admin, job, repairConfig, result, "learning_path_module_regeneration");
    if (!result.ok) throw workerError("generation_repair_failed", result.error ?? `Module ${moduleIndex + 1} regeneration failed.`);
    try {
      modules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(result.text), module, moduleIndex);
    } catch (error) {
      throw workerError("generation_repair_failed", error instanceof Error ? error.message : `Module ${moduleIndex + 1} regeneration was invalid.`);
    }
  }

  try {
    return normalizeWorkerContent({ ...content, modules }, { brief, assessmentReview });
  } catch (error) {
    throw workerError("generation_repair_failed", error instanceof Error ? error.message : "Regenerated course module was invalid.");
  }
}

async function generateExerciseContent({ admin, job, providerConfig, brief, proposal, ragContext }) {
  const { codingCount, mcqCount } = resolveExerciseMixCounts(brief);
  const sequence = buildExerciseKindSequence(codingCount, mcqCount);
  const targets = [
    { kind: "code", positions: sequence.flatMap((kind, index) => kind === "code" ? [index] : []), batchSize: 4 },
    { kind: "mcq", positions: sequence.flatMap((kind, index) => kind === "mcq" ? [index] : []), batchSize: 6 }
  ];
  const problems = [];
  let batchIndex = 0;
  for (const target of targets) {
    let generatedForKind = 0;
    let attempts = 0;
    while (generatedForKind < target.positions.length) {
      attempts += 1;
      if (attempts > target.positions.length * 2 + 2) {
        throw workerError("exercise_batch_incomplete", `Could not complete the approved ${target.kind} problem count.`);
      }
      const requestedCount = Math.min(target.batchSize, target.positions.length - generatedForKind);
      const positions = target.positions.slice(generatedForKind, generatedForKind + requestedCount);
      const prompt = buildExerciseProblemBatchPrompt({
        brief,
        proposal,
        kind: target.kind,
        count: requestedCount,
        batchIndex,
        positions,
        existingTitles: problems.map((problem) => problem.title),
        retrievedContext: ragContext
      });
      const maxTokens = target.kind === "code" ? 3000 + requestedCount * 1400 : 1800 + requestedCount * 450;
      let result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens });
      await recordWorkerUsage(admin, job, providerConfig, result, "exercise_problem_batch");
      if (!result.ok) throw workerError("exercise_batch_failed", result.error ?? "Exercise batch generation failed.");
      let batchProblems;
      try {
        batchProblems = normalizeExerciseProblemBatch(parseJsonObject(result.text), {
          brief,
          kind: target.kind,
          count: requestedCount,
          positions
        });
      } catch (initialError) {
        result = await requestCourseGenerationJson({
          config: providerConfig,
          prompt: `${prompt}\n\nREPAIR REQUIRED\nThe previous batch was rejected: ${initialError instanceof Error ? initialError.message : "invalid exercise batch"}.\nPrevious JSON: ${String(result.text ?? "").slice(0, 9000)}\nReturn a complete replacement batch with one to ${requestedCount} valid ${target.kind} problems and JSON only.`,
          maxTokens
        });
        await recordWorkerUsage(admin, job, providerConfig, result, "exercise_problem_batch_repair");
        if (!result.ok) throw workerError("exercise_batch_repair_failed", result.error ?? "Exercise batch repair failed.");
        batchProblems = normalizeExerciseProblemBatch(parseJsonObject(result.text), {
          brief,
          kind: target.kind,
          count: requestedCount,
          positions
        });
      }
      problems.push(...batchProblems);
      generatedForKind += batchProblems.length;
      batchIndex += 1;
      await updateJob(admin, job.id, { progress: Math.min(60, 10 + Math.round((problems.length / (codingCount + mcqCount)) * 50)) });
    }
  }
  return normalizeGeneratedLearningContent({
    schemaVersion: "exercise-session/v1",
    title: proposal.title,
    subject: subjectForLearningBrief(brief),
    description: proposal.summary,
    languages: [brief.language || brief.framework || subjectForLearningBrief(brief)],
    tags: ["Practice"],
    strategy: brief.practiceScope === "weaknesses" ? "weakness" : brief.difficulty === "random" ? "random" : brief.difficulty === "adaptive" ? "adaptive" : "topic",
    diagnosticCount: brief.practiceScope === "weaknesses" ? Math.min(2, problems.length) : 0,
    problems: problems.sort((left, right) => left.order - right.order).map((problem, index) => ({ ...problem, order: index }))
  }, { brief });
}

export function buildExerciseKindSequence(codingCount, mcqCount) {
  const output = [];
  let code = codingCount;
  let mcq = mcqCount;
  const openingChecks = Math.min(mcq, 2);
  for (let index = 0; index < openingChecks; index += 1) {
    output.push("mcq");
    mcq -= 1;
  }
  while (code || mcq) {
    if (code) { output.push("code"); code -= 1; }
    if (mcq) { output.push("mcq"); mcq -= 1; }
  }
  return output;
}

async function recordWorkerUsage(admin, job, config, result, feature) {
  const model = result?.model ?? config.model;
  const inputTokens = integerOrNull(result?.usage?.inputTokens);
  const outputTokens = integerOrNull(result?.usage?.outputTokens);
  const cachedInputTokens = integerOrNull(result?.usage?.cachedInputTokens) ?? 0;
  const cacheWriteInputTokens = integerOrNull(result?.usage?.cacheWriteTokens) ?? 0;
  const reasoningTokens = integerOrNull(result?.usage?.reasoningTokens) ?? 0;
  const cost = estimateOpenAiTextCost({ model, serviceTier: result?.serviceTier, inputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens });
  const base = {
    user_id: job.user_id,
    course_id: null,
    event_type: "ai_generation",
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    feature,
    latency_ms: integerOrNull(result?.latencyMs),
    cost_category: "creation_credit_funded",
    status: result?.ok ? "success" : "failed"
  };
  const hardeningPayload = {
    ...base,
    generation_job_id: job.id,
    cached_input_tokens: cachedInputTokens,
    cache_write_input_tokens: cacheWriteInputTokens,
    reasoning_tokens: reasoningTokens,
    estimated_cost_microusd: cost.estimatedCostMicrousd,
    pricing_version: cost.pricingVersion
  };
  let { error } = await admin.from("usage_events").insert(hardeningPayload);
  if (error && isMissingHardeningColumn(error)) {
    const { cache_write_input_tokens: _cache_write_input_tokens, ...preLunaHardeningPayload } = hardeningPayload;
    ({ error } = await admin.from("usage_events").insert(preLunaHardeningPayload));
  }
  if (error && isMissingHardeningColumn(error)) {
    ({ error } = await admin.from("usage_events").insert(base));
  }
  if (error) console.error("Failed to record generation usage", error.message);
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

async function claimJob(admin, jobId) {
  const { data, error } = await admin.rpc("claim_stonecode_generation_job", { p_job_id: jobId });
  if (error) throw workerError("generation_job_claim_failed", error.message);
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

async function completeGenerationJob(admin, { userId, jobId, courseId, reservationId }) {
  const { error } = await admin.rpc("complete_stonecode_generation_job", {
    p_user_id: userId,
    p_job_id: jobId,
    p_course_id: courseId,
    p_reservation_id: reservationId
  });
  if (error) throw workerError("generation_job_completion_failed", error.message);
}

async function launchProgressiveGenerationJob(admin, { userId, jobId, courseId, reservationId }) {
  const { error } = await admin.rpc("launch_stonecode_generation_job", {
    p_user_id: userId,
    p_job_id: jobId,
    p_course_id: courseId,
    p_reservation_id: reservationId
  });
  if (error) throw workerError("generation_job_launch_failed", error.message);
}

async function completeProgressiveGenerationJob(admin, { userId, jobId, courseId }) {
  const { error } = await admin.rpc("complete_stonecode_progressive_generation_job", {
    p_user_id: userId,
    p_job_id: jobId,
    p_course_id: courseId
  });
  if (error) throw workerError("generation_job_completion_failed", error.message);
}

async function readProposal(admin, job) {
  const { data, error } = await admin
    .from("learning_proposals")
    .select("*")
    .eq("id", job.proposal_id)
    .eq("user_id", job.user_id)
    .single();
  if (error || !data) throw workerError("learning_proposal_not_found", error?.message ?? "Learning proposal not found.");
  return data;
}

async function assertGenerationCapability(admin, brief, env) {
  const domainId = resolveLearningBriefDomainId(brief);
  const technologyId = resolveLearningBriefTechnologyId(brief);
  const capabilities = await buildRuntimeCapabilityCatalog({ admin, env });
  const domain = capabilities.domains.find((item) => item.id === domainId);
  if (!domain?.available) {
    throw workerError("learning_domain_unavailable", `${domain?.displayName ?? "That learning area"} is not available for generation.`);
  }
  const technology = capabilities.technologies.find((item) => item.id === technologyId);
  if (technologyId && !technology?.available) {
    throw workerError("technology_unavailable", `${technology?.displayName ?? "That technology"} is not available for generation.`);
  }
  const normalizedType = brief.type === "guided_project" ? "project" : brief.type;
  if (domain.technologyRequiredFor.includes(normalizedType) && !technologyId) {
    throw workerError("technology_required", `${domain.displayName} ${normalizedType} paths require a runnable technology.`);
  }
  return { domainId, technologyId, domain, technology };
}

function buildGenerationProvenance({ domainId, technologyId }, ragContext) {
  return {
    version: "generation-provenance/v2",
    domainId,
    technologyId,
    generatedAt: new Date().toISOString(),
    sources: ragContext.slice(0, 8).map((chunk) => ({
      chunkId: String(chunk.id),
      title: String(chunk.title ?? "Approved source"),
      url: typeof chunk.url === "string" ? chunk.url : null,
      sourceType: String(chunk.sourceType ?? "retrieved"),
      technologyId: chunk.technologyId ?? null,
      domainId: chunk.domainId ?? null,
      corpusVersion: Number.isInteger(chunk.corpusVersion) ? chunk.corpusVersion : null
    }))
  };
}

function assertRequiredRagContext({ domainId, technologyId, ragContext }) {
  if (domainId !== "programming" && !ragContext.some((chunk) => chunk.domainId === domainId)) {
    throw workerError("rag_context_unavailable", `Approved ${domainId} retrieval context is temporarily unavailable.`);
  }
  if (technologyId && !ragContext.some((chunk) => chunk.technologyId === technologyId)) {
    throw workerError("rag_context_unavailable", `Approved ${technologyId} retrieval context is temporarily unavailable.`);
  }
}

function isConceptualLearningBrief(brief) {
  return brief?.type === "course"
    && !resolveLearningBriefTechnologyId(brief)
    && ["computer_fundamentals", "internet_web"].includes(resolveLearningBriefDomainId(brief));
}

function conceptualCourseGenerationContract(brief) {
  if (!isConceptualLearningBrief(brief)) return "";
  return `\n\nCONCEPTUAL COURSE CONTRACT\nThis approved Computer/IT or Internet/Web Course has no programming technology. Use substantial theory, analogies, examples, quizzes, reflections, reviews, and optional tutor-diagram cues. Do not create workshop, lab, project, code-editor, Output, or Terminal steps, and never pretend code can execute.`;
}

function applyLearningBriefMetadata(content, brief, { domainId, technologyId }) {
  return {
    ...content,
    domainId,
    technologyId,
    focusAreas: brief.focusAreas ?? [],
    learningBrief: brief,
    languages: isConceptualLearningBrief(brief) ? [] : content.languages
  };
}

async function enforceActivePathLimit(admin, userId, type) {
  if (type === "exercise") return;
  const [{ data: subscription }, { count, error }] = await Promise.all([
    admin.from("subscriptions").select("plan,status").eq("user_id", userId).maybeSingle(),
    admin.from("courses").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active").neq("experience_type", "exercise")
  ]);
  if (error) throw workerError("course_limit_check_failed", error.message);
  const pro = subscription?.status === "active" && subscription?.plan === "pro";
  const limit = pro ? 10 : 1;
  if ((count ?? 0) >= limit) throw workerError("active_path_limit_reached", `Active learning path limit reached (${limit}).`);
}

function generationPrompt({ brief, proposal, assessmentReview, ragContext }) {
  const proposalContract = `\n\nApproved LearningProposalV1 (follow this exact direction and scope):\n${JSON.stringify(proposal)}\nDo not add onboarding assessment questions. Generate learning-path exercises only inside the curriculum.`;
  return buildLearningExperiencePrompt({ brief, assessmentReview, learnerProfile: null, retrievedContext: ragContext }) + proposalContract;
}

function courseBlueprintFromProposal(proposal) {
  const outcomes = Array.isArray(proposal?.outcomes) ? proposal.outcomes : [];
  const items = Array.isArray(proposal?.items) ? proposal.items : [];
  const finalItem = items.at(-1);
  return {
    finalProject: {
      title: finalItem?.title ?? proposal?.title ?? "Course capstone",
      description: finalItem?.summary ?? proposal?.summary ?? "Apply the complete course path.",
      capabilities: outcomes.slice(0, 8)
    },
    miniProjects: items.slice(0, -1).map((item) => ({
      title: item.title,
      moduleId: item.id,
      topicId: "",
      blockKind: "workshop",
      connectsTo: item.summary
    })),
    conceptSequence: items.map((item) => item.title),
    prerequisiteBridges: [],
    moduleGoals: items.map((item) => ({ moduleId: item.id, goal: item.summary }))
  };
}

function normalizeWorkerContent(value, { brief, assessmentReview }) {
  if (brief.type === "course") {
    const content = normalizeGeneratedCourseContent(value);
    return { ...content, learningBrief: brief };
  }
  return normalizeGeneratedLearningContent(value, { brief, assessmentReview });
}

async function persistGeneratedCourse(admin, { userId, jobId, brief, proposal, content, generationProvenance }) {
  const experienceType = proposal.type === "project" ? "guided_project" : proposal.type === "exercise" ? "exercise" : "course";
  const sectionCount = proposal.type === "exercise"
    ? Number(proposal.totals?.exercises ?? content.problems?.length ?? 0)
    : Number(proposal.totals?.modules ?? content.modules?.length ?? content.milestones?.length ?? 1);
  const payload = {
    user_id: userId,
    title: content.title,
    subject: content.subject,
    mode: proposal.type === "project" ? "project" : proposal.type === "exercise" ? "leetcode" : "mixed",
    checkpoint: proposal.items?.[0]?.title ?? "Start here",
    description: content.description,
    progress: 0,
    required_section_count: Math.max(1, sectionCount),
    experience_type: experienceType,
    client_request_id: `generation-job:${jobId}`,
    course_content: { ...content, learningBrief: brief, generationProvenance },
    languages: Array.isArray(content.languages) ? content.languages : [],
    tags: Array.isArray(content.tags) ? content.tags : [],
    content_generation_state: "full_course"
  };
  const { data, error } = await admin.from("courses").insert(payload).select("*").single();
  if (error) throw workerError("course_persistence_failed", error.message);
  return data;
}

function directReview(brief, proposal) {
  return {
    strengths: [brief.priorKnowledge || "Starting point captured during discovery"],
    gaps: [],
    suggestedModules: (proposal?.items ?? []).map((item) => item.title).slice(0, 12)
  };
}

async function updateJob(admin, jobId, patch) {
  let { error } = await admin.from("generation_jobs").update({ ...patch, heartbeat_at: new Date().toISOString() }).eq("id", jobId);
  if (error && isMissingHardeningColumn(error)) {
    ({ error } = await admin.from("generation_jobs").update(patch).eq("id", jobId));
  }
  if (error) throw workerError("generation_job_update_failed", error.message);
}

function isMissingHardeningColumn(error) {
  return ["PGRST204", "42703"].includes(String(error?.code ?? "")) || /generation_job_id|cached_input_tokens|cache_write_input_tokens|reasoning_tokens|estimated_cost_microusd|pricing_version|heartbeat_at/i.test(String(error?.message ?? ""));
}

function parseJsonObject(value) {
  const parsed = JSON.parse(String(value ?? ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}

function workerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
