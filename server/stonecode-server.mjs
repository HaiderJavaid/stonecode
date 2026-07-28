import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canCreateActiveCourse, canGenerateExperience, normalizePlanTier, resolvePlanLimit } from "./plan-limits.mjs";
import { formatSubscriptionState } from "./subscription-state.mjs";
import { createSseEventParser } from "./response-stream.mjs";
import {
  extractTutorStreamDelta,
  isTutorStreamDone,
  isTutorStreamFailed,
  requestCourseSetupReply,
  requestChatExerciseGrade,
  requestCourseGenerationJson,
  requestTutorStream,
  resolveTutorProviderConfig
} from "./llm-providers.mjs";
import {
  buildAssessmentPlanPrompt,
  buildCourseBlueprintPrompt,
  buildCourseGenerationPrompt,
  buildAssessmentCourseContentPrompt,
  buildAssessmentCourseGenerationPrompt,
  buildAssessmentModuleContentPrompt,
  buildAssessmentCourseOutlinePrompt,
  buildAssessmentQuestionPrompt,
  buildAssessmentReviewPrompt,
  buildChapterGenerationPrompt,
  buildGeneratedModuleRepairPrompt,
  buildGeneratedTopicRepairPrompt,
  buildCourseDiscoveryPrompt,
  buildCourseSetupReplyPrompt,
  createFallbackAssessmentReview,
  createGeneratedCourseSkeletonFromOutline,
  extractGeneratedModuleFromResponse,
  extractGeneratedTopicFromResponse,
  normalizeAssessmentPlan,
  normalizeAssessmentQuestion,
  normalizeCourseDiscoveryTurn,
  normalizeGeneratedCourseContent,
  mergeGeneratedChapter,
  stabilizeAssessmentQuestion
} from "./course-generation.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  groupGeneratedCourseWarningsByTopic,
  hasBlockingGeneratedCourseQualityWarnings,
  hasRepairableGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "./course-generation-quality.mjs";
import {
  buildLearningDiscoveryPrompt,
  missingLearningBriefFields,
  normalizeLearningBrief,
  normalizeLearningDiscoveryTurn,
  subjectForLearningBrief
} from "./learning-orchestrator/contracts.mjs";
import {
  buildGuidedProjectMilestonePrompt,
  buildLearningExperiencePrompt,
  buildLearningExperienceRepairPrompt,
  mergeGuidedProjectMilestone,
  normalizeGeneratedLearningContent
} from "./learning-orchestrator/generation.mjs";
import { retrieveRagContext } from "./rag/retrieve.mjs";
import {
  buildCheckoutMetadata,
  extractCheckoutSessionState,
  extractStripeSubscriptionState,
  patchCheckoutSessionState,
  upsertSubscriptionState
} from "./stripe-subscriptions.mjs";
import { formatUsageSummary } from "./usage-events.mjs";
import {
  decryptOpenAiKey,
  encryptOpenAiKey,
  isValidOpenAiKeyShape
} from "./user-ai-credentials.mjs";
import { gradeWithSandbox, resolveExecutionConfig, runSandboxedCode } from "./execution/index.mjs";
import {
  buildProgressionSummary,
  getDateKeyInTimezone,
  gradeDeterministicExercise,
  normalizeBadgeRows,
  parseChatGrade,
  resolveExerciseDefinition
} from "./progression.mjs";
import {
  evaluateAchievementProgress,
  exerciseXp,
  normalizeExerciseDifficulty,
  resolveSkillMetadata
} from "./skill-taxonomy.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isDev = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const port = Number(readCliOption("--port") ?? process.env.PORT ?? 5174);
const host = readCliOption("--host") ?? process.env.HOST ?? "127.0.0.1";
const maxRequestBytes = 180_000;

loadLocalEnv();

const tutorInstructions = buildTutorInstructions();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

let vite;
if (isDev) {
  const { createServer } = await import("vite");
  vite = await createServer({
    appType: "spa",
    root,
    server: { middlewareMode: true }
  });
}

const server = createHttpServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/tutor")) {
      await handleTutorRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/courses")) {
      await handleCourseRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/course-generation")) {
      await handleCourseGenerationRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/learning")) {
      await handleLearningRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/execution")) {
      await handleExecutionRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/subscription")) {
      await handleSubscriptionRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/ai-credentials/openai")) {
      await handleOpenAiCredentialRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/usage")) {
      await handleUsageRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/progression")) {
      await handleProgressionRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/billing/checkout")) {
      await handleCheckoutRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/billing/portal")) {
      await handleBillingPortalRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/stripe/webhook")) {
      await handleStripeWebhook(request, response);
      return;
    }

    if (vite) {
      vite.middlewares(request, response);
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
});

server.listen(port, host, () => {
  console.log(`Stonecode server ready at http://${host}:${port}`);
});

async function handleExecutionRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/api/execution/capabilities") {
    const config = resolveExecutionConfig(process.env);
    sendJson(response, 200, {
      provider: config.provider,
      configured: config.configured,
      limits: {
        timeoutMs: config.timeoutMs,
        memoryKb: config.memoryKb,
        outputCharacters: config.outputLimit,
        codeCharacters: config.codeLimit,
        runsPerMinute: config.runsPerMinute
      }
    });
    return;
  }
  if (request.method !== "POST" || url.pathname !== "/api/execution/run") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  const body = await readJsonBody(request);
  const courseId = typeof body?.courseId === "string" ? body.courseId : null;
  if (courseId && !(await userOwnsCourse(auth.admin, auth.user.id, courseId))) {
    sendJson(response, 404, { error: "Course not found." });
    return;
  }
  try {
    const result = await runSandboxedCode({
      env: process.env,
      userId: auth.user.id,
      input: {
        language: body?.language,
        filePath: body?.filePath,
        code: body?.code,
        stdin: body?.stdin
      }
    });
    sendJson(response, 200, { result });
  } catch (error) {
    sendJson(response, Number(error?.status) || 500, {
      error: error instanceof Error ? error.message : "Execution failed.",
      code: error?.code ?? "execution_failed"
    });
  }
}

async function handleTutorRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const body = await readJsonBody(request);
  const context = body?.context;
  if (!isTutorContext(context)) {
    sendJson(response, 400, { error: "Invalid tutor context." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "tutor_chat");
  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  if (providerConfig.error) {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "blocked"
    });
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const tutorRagContext = await retrieveRagContext({
    admin,
    config: providerConfig,
    subject: context.courseSubject,
    task: context.requestKind ?? "tutor-chat",
    query: JSON.stringify({
      message: context.userMessage,
      currentCourseStep: context.currentCourseStep,
      lesson: context.lesson
    }).slice(0, 2400),
    limit: 6
  });
  const upstreamResponse = await requestTutorStream({
    config: providerConfig,
    context: { ...context, ragContext: tutorRagContext },
    instructions: tutorInstructions
  });

  if (!upstreamResponse.ok) {
    const upstreamJson = await upstreamResponse.json().catch(() => null);
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "failed"
    });
    sendJson(response, upstreamResponse.status, {
      error: upstreamJson?.error?.message ?? `${providerConfig.provider} request failed.`
    });
    return;
  }

  if (!upstreamResponse.body) {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "failed"
    });
    sendJson(response, 502, { error: `${providerConfig.provider} response stream was empty.` });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let streamStatus = "failed";
  let hasReplyText = false;
  const parser = createSseEventParser((event) => {
    const delta = extractTutorStreamDelta(providerConfig.provider, event);
    if (delta) {
      hasReplyText = true;
      response.write(encoder.encode(delta));
      return;
    }

    if (isTutorStreamDone(providerConfig.provider, event)) {
      streamStatus = hasReplyText ? "success" : "failed";
      return;
    }

    if (isTutorStreamFailed(providerConfig.provider, event)) {
      streamStatus = "failed";
    }
  });

  try {
    for await (const chunk of upstreamResponse.body) {
      const decodedChunk = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      parser.push(decodedChunk);
    }

    const tail = decoder.decode();
    if (tail) parser.push(tail);
    if (hasReplyText) streamStatus = "success";
  } catch {
    streamStatus = "failed";
  } finally {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: streamStatus
    });
    response.end();
  }
}
async function handleCourseRequest(request, response) {
  if (request.method === "POST") {
    await handleCreateCourseRequest(request, response);
    return;
  }

  if (request.method === "DELETE") {
    await handleResetCoursesRequest(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleCourseGenerationRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const url = new URL(request.url ?? "/", "http://localhost");
  const body = await readJsonBody(request);

  if (url.pathname === "/api/course-generation/preview") {
    await handleCourseGenerationPreview(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/setup-reply") {
    await handleCourseSetupReply(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/discovery-turn") {
    await handleCourseDiscoveryTurn(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/assessment-plan") {
    await handleCourseAssessmentPlan(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/assessment-question") {
    await handleCourseAssessmentQuestion(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/assessment-review") {
    await handleCourseAssessmentReview(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/from-assessment") {
    await handleCourseGenerationFromAssessment(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/chapter") {
    await handleCourseGenerationChapter(auth, body, response);
    return;
  }

  if (url.pathname === "/api/course-generation/commit") {
    await createCourseFromDraft(auth, body?.course, response);
    return;
  }

  sendJson(response, 404, { error: "Unknown course generation route." });
}

async function handleLearningRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const url = new URL(request.url ?? "/", "http://localhost");
  const body = await readJsonBody(request);

  if (url.pathname === "/api/learning/discovery-turn") return handleLearningDiscoveryTurn(auth, body, response);
  if (url.pathname === "/api/learning/assessment-plan") return handleCourseAssessmentPlan(auth, { ...body, subject: subjectForLearningBrief(body?.brief) }, response);
  if (url.pathname === "/api/learning/assessment-question") return handleCourseAssessmentQuestion(auth, { ...body, subject: subjectForLearningBrief(body?.brief) }, response);
  if (url.pathname === "/api/learning/assessment-review") return handleCourseAssessmentReview(auth, { ...body, subject: subjectForLearningBrief(body?.brief) }, response);
  if (url.pathname === "/api/learning/generate") return handleLearningGeneration(auth, body, response);
  if (url.pathname === "/api/learning/project/milestone") return handleGuidedProjectMilestone(auth, body, response);
  sendJson(response, 404, { error: "Unknown learning route." });
}

async function handleLearningDiscoveryTurn({ admin, user }, body, response) {
  const messages = Array.isArray(body?.messages)
    ? body.messages.filter((message) => message && (message.role === "assistant" || message.role === "user") && typeof message.content === "string").slice(-12)
    : [];
  const turn = Number(body?.turn);
  if (!Number.isInteger(turn) || turn < 0 || turn > 24) {
    sendJson(response, 400, { error: "Learning discovery needs a valid turn number." });
    return;
  }
  const providerConfig = await resolveUserProviderConfig(admin, user, "learning_discovery");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }
  const result = await requestCourseGenerationJson({
    config: providerConfig,
    prompt: buildLearningDiscoveryPrompt({ messages, turn }),
    maxTokens: 900
  });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI learning discovery failed." });
    return;
  }
  try {
    const discovery = normalizeLearningDiscoveryTurn(parseJsonObject(result.text), { turn, messages });
    await recordUsageEvent(admin, { userId: user.id, courseId: null, model: providerConfig.model, status: "success" });
    sendJson(response, 200, { discovery, source: "ai" });
  } catch (error) {
    console.error("Learning discovery validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI learning discovery returned invalid content." });
  }
}

async function handleLearningGeneration({ admin, user }, body, response) {
  let brief;
  try {
    brief = normalizeLearningBrief(body?.brief ?? {});
  } catch {
    sendJson(response, 400, { error: "Learning generation needs a valid brief." });
    return;
  }
  const missingFields = missingLearningBriefFields(brief);
  if (missingFields.length) {
    sendJson(response, 400, { error: `Learning brief is missing: ${missingFields.join(", ")}.` });
    return;
  }
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const assessmentReview = body?.assessmentReview && typeof body.assessmentReview === "object"
    ? body.assessmentReview
    : { strengths: ["Ready to begin"], gaps: [], suggestedModules: [] };
  if (brief.type === "course") {
    return handleCourseGenerationFromAssessment({ admin, user }, {
      subject: subjectForLearningBrief(brief),
      answers,
      assessmentReview
    }, response);
  }
  const task = brief.type === "short_course" ? "short_course" : brief.type === "exercise" ? "exercise_generation" : "guided_project";
  const providerConfig = await resolveUserProviderConfig(admin, user, task);
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }
  try {
    const learnerProfile = await readLearnerProfile(admin, user.id);
    const practiceHistory = brief.type === "exercise" ? await readPracticeHistory(admin, user.id) : [];
    const generationProfile = practiceHistory.length ? { ...(learnerProfile ?? {}), practiceHistory } : learnerProfile;
    const generationPrompt = buildLearningExperiencePrompt({ brief, assessmentReview, learnerProfile: generationProfile });
    const maxTokens = brief.type === "guided_project"
      ? 9000
      : brief.type === "short_course"
        ? 6500
        : Math.min(15000, 2500 + (brief.codingCount ?? 7) * 650 + (brief.mcqCount ?? 3) * 260);
    const result = await requestCourseGenerationJson({ config: providerConfig, prompt: generationPrompt, maxTokens });
    if (!result.ok) {
      sendJson(response, 502, { error: result.error ?? "AI learning generation failed." });
      return;
    }
    let content;
    let parsedContent;
    try {
      parsedContent = parseJsonObject(result.text);
      content = normalizeGeneratedLearningContent(parsedContent, { brief, assessmentReview });
    } catch (initialError) {
      const validationError = initialError instanceof Error ? initialError.message : "Invalid generated learning experience.";
      console.warn("Learning generation needs repair", validationError);
      const repairResult = await requestCourseGenerationJson({
        config: providerConfig,
        prompt: buildLearningExperienceRepairPrompt({
          originalPrompt: generationPrompt,
          invalidOutput: result.text,
          validationError
        }),
        maxTokens
      });
      if (!repairResult.ok) {
        sendJson(response, 502, { error: "AI could not repair the generated learning experience. Your review remains available; retry generation." });
        return;
      }
      try {
        content = normalizeGeneratedLearningContent(parseJsonObject(repairResult.text), { brief, assessmentReview });
      } catch (repairError) {
        console.error("Learning generation repair failed", repairError instanceof Error ? repairError.message : repairError);
        const message = brief.type === "guided_project"
          ? "AI returned an incomplete guided project after repair. Your review remains available; retry generation."
          : "AI returned invalid learning content after repair. Your review remains available; retry generation.";
        sendJson(response, 502, { error: message });
        return;
      }
    }
    await recordUsageEvent(admin, { userId: user.id, courseId: null, model: providerConfig.model, status: "success" });
    sendJson(response, 200, { content, source: "ai" });
  } catch (error) {
    console.error("Learning generation validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI could not produce a valid learning experience. Your review remains available; retry generation." });
  }
}

async function handleGuidedProjectMilestone({ admin, user }, body, response) {
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  const milestoneIndex = Number(body?.milestoneIndex);
  if (!courseId || !Number.isInteger(milestoneIndex) || milestoneIndex < 1) {
    sendJson(response, 400, { error: "Project continuation needs a course and milestone index." });
    return;
  }
  if (!(await userOwnsCourse(admin, user.id, courseId))) {
    sendJson(response, 404, { error: "Learning conversation not found." });
    return;
  }
  let content;
  try {
    content = normalizeGeneratedLearningContent(body?.content, {
      brief: body?.content?.learningBrief,
      assessmentReview: body?.content?.assessmentReview,
      loadedMilestoneIndex: Math.max(0, milestoneIndex - 1)
    });
  } catch {
    sendJson(response, 400, { error: "Invalid guided-project content." });
    return;
  }
  if (content.schemaVersion !== "guided-project-content/v1" || !content.milestones[milestoneIndex]) {
    sendJson(response, 400, { error: "Requested milestone is unavailable." });
    return;
  }
  const providerConfig = await resolveUserProviderConfig(admin, user, "project_milestone");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }
  const { data: fileRows } = await admin.from("workspace_files").select("path,content").eq("course_id", courseId).order("path");
  const result = await requestCourseGenerationJson({
    config: providerConfig,
    prompt: buildGuidedProjectMilestonePrompt({ content, milestoneIndex, workspaceFiles: fileRows ?? [] }),
    maxTokens: 8000
  });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "Project milestone generation failed." });
    return;
  }
  try {
    const parsed = parseJsonObject(result.text);
    const nextContent = mergeGuidedProjectMilestone(content, parsed.milestone ?? parsed, milestoneIndex);
    const { error } = await admin.from("courses").update({ course_content: nextContent, updated_at: new Date().toISOString() }).eq("id", courseId).eq("user_id", user.id);
    if (error) throw error;
    await recordUsageEvent(admin, { userId: user.id, courseId, model: providerConfig.model, status: "success" });
    sendJson(response, 200, { content: nextContent, source: "ai" });
  } catch (error) {
    console.error("Project milestone validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI returned an invalid project milestone. Existing files and progress were preserved." });
  }
}

async function handleCourseSetupReply({ admin, user }, body, response) {
  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((message) => message && (message.role === "assistant" || message.role === "user") && typeof message.content === "string")
        .slice(-8)
    : [];
  const answerCount = Number(body?.answerCount);
  if (!messages.length || !Number.isInteger(answerCount)) {
    sendJson(response, 400, { error: "Course setup reply needs messages and answer count." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "setup_reply");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildCourseSetupReplyPrompt({ messages, answerCount });
  const result = await requestCourseSetupReply({ config: providerConfig, prompt });
  if (!result.ok || !result.text.trim()) {
    sendJson(response, 502, { error: result.error ?? "AI setup reply failed." });
    return;
  }
  const reply = result.text.trim().slice(0, 600);

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { reply, source: "ai" });
}

async function handleCourseDiscoveryTurn({ admin, user }, body, response) {
  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((message) => message && (message.role === "assistant" || message.role === "user") && typeof message.content === "string")
        .slice(-10)
    : [];
  const turn = Number(body?.turn);
  if (!Number.isInteger(turn) || turn < 0 || turn > 20) {
    sendJson(response, 400, { error: "Course discovery needs a valid turn number." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "setup_reply");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildCourseDiscoveryPrompt({ messages, turn });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 700 });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI course discovery failed." });
    return;
  }

  let discovery;
  try {
    discovery = normalizeCourseDiscoveryTurn(parseJsonObject(result.text));
  } catch (error) {
    console.error("Course discovery validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI course discovery returned invalid content." });
    return;
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { discovery, source: "ai" });
}

async function handleCourseGenerationPreview({ admin, user }, body, response) {
  const objective = typeof body?.objective === "string" ? body.objective : "";
  const level = typeof body?.level === "string" ? body.level : "";
  const outcome = typeof body?.outcome === "string" ? body.outcome : "";
  const amendments = Array.isArray(body?.amendments) ? body.amendments.filter((item) => typeof item === "string") : [];

  if (!objective.trim() || !level.trim() || !outcome.trim()) {
    sendJson(response, 400, { error: "Course generation needs objective, level, and outcome." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "course_structure");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildCourseGenerationPrompt({ objective, level, outcome, amendments });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI course preview failed." });
    return;
  }

  let content;
  try {
    content = normalizeGeneratedCourseContent(parseJsonObject(result.text));
  } catch (error) {
    console.error("Course generation validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI course preview returned invalid content." });
    return;
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { content, source: "ai" });
}

async function handleCourseAssessmentPlan({ admin, user }, body, response) {
  const subject = typeof body?.subject === "string" ? body.subject : "";
  if (!subject.trim()) {
    sendJson(response, 400, { error: "Assessment plan needs subject." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "assessment_plan");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const learnerProfile = await readLearnerProfile(admin, user.id);
  const retrievedContext = await retrieveRagContext({
    admin,
    config: providerConfig,
    subject,
    task: "assessment-plan",
    query: subject,
    limit: 8
  });
  const prompt = buildAssessmentPlanPrompt({ subject, learnerProfile, retrievedContext });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 900 });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI assessment plan failed." });
    return;
  }

  let plan;
  try {
    plan = normalizeAssessmentPlan(parseJsonObject(result.text), subject);
  } catch (error) {
    console.error("Assessment plan validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI assessment plan returned invalid content." });
    return;
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { plan, source: "ai" });
}

async function handleCourseAssessmentQuestion({ admin, user }, body, response) {
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const step = Number(body?.step);
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (!subject.trim() || !Number.isInteger(step)) {
    sendJson(response, 400, { error: "Assessment question needs subject and step." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "assessment_question");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildAssessmentQuestionPrompt({ subject, step, answers });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 450 });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI assessment question failed." });
    return;
  }

  let question;
  try {
    question = stabilizeAssessmentQuestion({
      question: normalizeAssessmentQuestion(parseJsonObject(result.text), subject, step),
      subject,
      step,
      answers
    });
  } catch (error) {
    console.error("Assessment question validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI assessment question returned invalid content." });
    return;
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { question, source: "ai" });
}

async function handleCourseAssessmentReview({ admin, user }, body, response) {
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (!subject.trim()) {
    sendJson(response, 400, { error: "Assessment review needs subject." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "assessment_review");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildAssessmentReviewPrompt({ subject, answers });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 900 });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI assessment review failed." });
    return;
  }

  let review;
  try {
    const parsed = parseJsonObject(result.text);
    const fallbackReview = createFallbackAssessmentReview({ subject, answers });
    review = {
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.some((item) => typeof item === "string" && item.trim())
        ? parsed.strengths.filter((item) => typeof item === "string" && item.trim()).slice(0, 6)
        : fallbackReview.strengths,
      gaps: Array.isArray(parsed.gaps) && parsed.gaps.some((item) => typeof item === "string" && item.trim())
        ? parsed.gaps.filter((item) => typeof item === "string" && item.trim()).slice(0, 6)
        : fallbackReview.gaps,
      suggestedModules: Array.isArray(parsed.suggestedModules) && parsed.suggestedModules.some((item) => typeof item === "string" && item.trim())
        ? parsed.suggestedModules.filter((item) => typeof item === "string" && item.trim()).slice(0, 8)
        : fallbackReview.suggestedModules
    };
  } catch (error) {
    console.error("Assessment review validation failed", error instanceof Error ? error.message : error);
    review = createFallbackAssessmentReview({ subject, answers });
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { review, source: "ai" });
}

async function handleCourseGenerationFromAssessment({ admin, user }, body, response) {
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const assessmentReview = body?.assessmentReview && typeof body.assessmentReview === "object" ? body.assessmentReview : null;
  if (!subject.trim()) {
    sendJson(response, 400, { error: "Course generation needs subject." });
    return;
  }
  if (!assessmentReview) {
    sendJson(response, 400, { error: "Course generation needs an AI assessment review." });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "course_structure");
  let content;
  let generationWarnings = [];
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  {
    const learnerProfile = await readLearnerProfile(admin, user.id);
    const retrievedContext = await retrieveRagContext({
      admin,
      config: providerConfig,
      subject,
      task: "course-generation",
      query: JSON.stringify({ subject, answers, assessmentReview, learnerProfile }).slice(0, 3000),
      limit: 10
    });
    const learnerContext = null;
    const blueprintPrompt = buildCourseBlueprintPrompt({ subject, answers, assessmentReview, learnerContext, retrievedContext });
    const blueprintResult = await requestCourseGenerationJson({ config: providerConfig, prompt: blueprintPrompt, maxTokens: 1600 });
    let courseBlueprint = null;
    if (blueprintResult.ok && blueprintResult.text.trim()) {
      try {
        const parsedBlueprint = parseJsonObject(blueprintResult.text);
        courseBlueprint = parsedBlueprint.courseBlueprint ?? parsedBlueprint;
      } catch (error) {
        console.error("Course blueprint parsing failed", error instanceof Error ? error.message : error);
      }
    }

    const outlinePrompt = buildAssessmentCourseOutlinePrompt({ subject, answers, assessmentReview, courseBlueprint, retrievedContext });
    const outlineResult = await requestCourseGenerationJson({ config: providerConfig, prompt: outlinePrompt, maxTokens: 2600 });
    let courseOutline = null;
    if (outlineResult.ok && outlineResult.text.trim()) {
      try {
        courseOutline = parseJsonObject(outlineResult.text);
      } catch (error) {
        console.error("Assessment course outline parsing failed", error instanceof Error ? error.message : error);
      }
    }

    if (courseOutline) {
      let skeleton = null;
      try {
        skeleton = createGeneratedCourseSkeletonFromOutline(courseOutline, {
          subject,
          assessmentReview,
          courseBlueprint,
          ragSources: retrievedContext
        });
        for (let moduleIndex = 0; moduleIndex < Math.min(1, skeleton.modules.length); moduleIndex += 1) {
          const moduleProviderConfig = await resolveUserProviderConfig(admin, user, "module_content");
          const modulePrompt = buildAssessmentModuleContentPrompt({ subject, answers, assessmentReview, courseOutline, courseBlueprint, retrievedContext, moduleIndex });
          const moduleResult = await requestCourseGenerationJson({ config: moduleProviderConfig, prompt: modulePrompt, maxTokens: 6500 });
          if (!moduleResult.ok) throw new Error(moduleResult.error ?? `Module ${moduleIndex + 1} generation failed.`);
          skeleton.modules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(moduleResult.text), skeleton.modules[moduleIndex], moduleIndex);
        }
        content = normalizeGeneratedCourseContent(skeleton);
      } catch (error) {
        console.error("Assessment module content generation failed", error instanceof Error ? error.message : error);
        if (skeleton) {
          try {
            content = normalizeGeneratedCourseContent(skeleton);
          } catch (fallbackError) {
            console.error("Assessment course skeleton normalization failed", fallbackError instanceof Error ? fallbackError.message : fallbackError);
          }
        }
      }
    } else {
      const prompt = buildAssessmentCourseGenerationPrompt({ subject, answers, assessmentReview, courseBlueprint, retrievedContext });
      const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 9000 });
      if (result.ok) {
        try {
          content = normalizeGeneratedCourseContent({
            ...parseJsonObject(result.text),
            courseBlueprint,
            ragSources: retrievedContext
          });
        } catch (error) {
          console.error("Assessment course generation validation failed", error instanceof Error ? error.message : error);
        }
      }
    }

    if (content) {
      let qualityWarnings = validateGeneratedCourseQuality(content);
      generationWarnings = qualityWarnings;
      if (qualityWarnings.length) {
        console.warn("Assessment course generation quality warnings", qualityWarnings.slice(0, 8));
      }
      if (hasRepairableGeneratedCourseQualityWarnings(qualityWarnings)) {
        try {
          let repairedContent = content;
          const repairProviderConfig = await resolveUserProviderConfig(admin, user, "course_repair");
          for (let repairPass = 0; repairPass < 2 && hasRepairableGeneratedCourseQualityWarnings(qualityWarnings); repairPass += 1) {
            const repairedModules = [...(repairedContent.modules ?? [])];
            for (const [moduleIndex, moduleWarnings] of groupGeneratedCourseWarningsByModule(qualityWarnings).entries()) {
              const module = repairedModules[moduleIndex];
              if (!module) continue;
              const topicWarningGroups = groupGeneratedCourseWarningsByTopic(moduleWarnings, moduleIndex);
              const scopedWarnings = new Set([...topicWarningGroups.values()].flat());
              const hasModuleLevelWarnings = moduleWarnings.some((warning) => !scopedWarnings.has(warning));

              if (hasModuleLevelWarnings || topicWarningGroups.size === 0) {
                const repairPrompt = buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex, qualityWarnings: moduleWarnings });
                const repairResult = await requestCourseGenerationJson({ config: repairProviderConfig, prompt: repairPrompt, maxTokens: 7500 });
                if (!repairResult.ok) throw new Error(repairResult.error ?? `Module ${moduleIndex + 1} repair failed.`);
                repairedModules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(repairResult.text), module, moduleIndex);
                continue;
              }

              const repairedTopics = [...(module.topics ?? [])];
              await Promise.all([...topicWarningGroups.entries()].map(async ([topicIndex, topicWarnings]) => {
                const topic = repairedTopics[topicIndex];
                if (!topic) return;
                const repairPrompt = buildGeneratedTopicRepairPrompt({ subject, topic, moduleIndex, topicIndex, qualityWarnings: topicWarnings });
                const repairResult = await requestCourseGenerationJson({ config: repairProviderConfig, prompt: repairPrompt, maxTokens: 5000 });
                if (!repairResult.ok) throw new Error(repairResult.error ?? `Module ${moduleIndex + 1}, topic ${topicIndex + 1} repair failed.`);
                repairedTopics[topicIndex] = extractGeneratedTopicFromResponse(parseJsonObject(repairResult.text), topic, topicIndex, topicWarnings);
              }));
              repairedModules[moduleIndex] = { ...module, topics: repairedTopics };
            }

            repairedContent = normalizeGeneratedCourseContent({ ...repairedContent, modules: repairedModules });
            qualityWarnings = validateGeneratedCourseQuality(repairedContent);
            generationWarnings = qualityWarnings;
            if (qualityWarnings.length) {
              console.warn(`Assessment course repair pass ${repairPass + 1} quality warnings`, qualityWarnings.slice(0, 8));
            }
          }
          content = hasBlockingGeneratedCourseQualityWarnings(qualityWarnings) ? null : repairedContent;
        } catch (error) {
          console.error("Assessment course repair failed", error instanceof Error ? error.message : error);
          generationWarnings = [{
            code: "ai_repair_failed",
            message: error instanceof Error ? error.message : "Course repair failed."
          }];
          content = null;
        }
      }
    }
  }

  if (!content) {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: null,
      model: providerConfig.model,
      status: "failed"
    });
    sendJson(response, 502, {
      error: "AI could not finish a valid first module after two repair attempts. Your assessment remains on this screen; press Finalize to retry.",
      warnings: generationWarnings
    });
    return;
  }
  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  await persistAssessmentAndLearnerProfile(admin, user.id, { subject, answers, assessmentReview, content });
  sendJson(response, 200, { content, source: "ai", warnings: generationWarnings });
}

async function handleCourseGenerationChapter({ admin, user }, body, response) {
  const chapterIndex = Number(body?.chapterIndex);
  let content;
  try {
    content = normalizeGeneratedCourseContent(body?.content);
  } catch {
    sendJson(response, 400, { error: "Valid generated course content is required." });
    return;
  }

  if (content.schemaVersion !== "course-content/v1") {
    sendJson(response, 400, { error: "Lazy chapter generation is only available for legacy chapter courses." });
    return;
  }

  if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= content.chapters.length) {
    sendJson(response, 400, { error: "Invalid chapter index." });
    return;
  }

  const plan = await readUserPlan(admin, user.id);
  if (resolvePlanLimit(plan).firstModuleOnly && chapterIndex > 0) {
    sendJson(response, 403, {
      error: "Upgrade to generate modules beyond the first module.",
      plan,
      firstModuleOnly: true
    });
    return;
  }

  const providerConfig = await resolveUserProviderConfig(admin, user, "chapter_content");
  if (providerConfig.error) {
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const prompt = buildChapterGenerationPrompt({ content, chapterIndex });
  const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 1800 });
  if (!result.ok) {
    sendJson(response, 502, { error: result.error ?? "AI chapter generation failed." });
    return;
  }

  let generated;
  try {
    generated = parseJsonObject(result.text);
    content = mergeGeneratedChapter(content, generated);
  } catch (error) {
    console.error("Chapter generation validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI chapter generation returned invalid content." });
    return;
  }

  const courseId = typeof body?.courseId === "string" ? body.courseId : null;
  if (courseId && await userOwnsCourse(admin, user.id, courseId)) {
    const { error } = await admin
      .from("courses")
      .update({
        course_content: content,
        content_generation_state: content.chapters.every((chapter) => chapter.sections.every((section) => section.blocks.length > 0)) ? "full_course" : "first_chapter",
        updated_at: new Date().toISOString()
      })
      .eq("id", courseId)
      .eq("user_id", user.id);
    if (error) {
      sendJson(response, 500, { error: formatGeneratedContentSchemaError(error) });
      return;
    }
  }

  await recordUsageEvent(admin, {
    userId: user.id,
    courseId,
    model: providerConfig.model,
    status: "success"
  });
  sendJson(response, 200, { content, chapter: generated.chapter, chapterIndex, source: "ai" });
}

async function handleSubscriptionRequest(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  const { data, error } = await admin
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  const subscription = formatSubscriptionState(data);
  const generatedThisMonth = await readMonthlyExperienceGenerationCount(admin, user.id);
  sendJson(response, 200, {
    subscription: {
      ...subscription,
      generatedExperiencesThisMonth: generatedThisMonth,
      remainingExperienceGenerations: subscription.monthlyExperienceGenerationLimit === null
        ? null
        : Math.max(subscription.monthlyExperienceGenerationLimit - generatedThisMonth, 0)
    }
  });
}

async function handleOpenAiCredentialRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  if (request.method === "GET") {
    const { data, error } = await admin
      .from("user_ai_credentials")
      .select("provider,last_four,verified_at,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      sendJson(response, 500, { error: formatGeneratedContentSchemaError(error) });
      return;
    }
    sendJson(response, 200, {
      credential: data
        ? {
            configured: true,
            provider: data.provider,
            lastFour: data.last_four,
            verifiedAt: data.verified_at,
            updatedAt: data.updated_at
          }
        : { configured: false, provider: "openai", lastFour: null, verifiedAt: null, updatedAt: null }
    });
    return;
  }

  if (request.method === "DELETE") {
    const { error } = await admin.from("user_ai_credentials").delete().eq("user_id", user.id);
    if (error) {
      sendJson(response, 500, { error: formatGeneratedContentSchemaError(error) });
      return;
    }
    sendJson(response, 200, { deleted: true });
    return;
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const body = await readJsonBody(request);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!isValidOpenAiKeyShape(apiKey)) {
    sendJson(response, 400, { error: "Enter a valid OpenAI API key." });
    return;
  }

  const verification = await verifyOpenAiCredential(apiKey);
  if (!verification.ok) {
    sendJson(response, verification.status, { error: verification.error });
    return;
  }

  try {
    const encrypted = encryptOpenAiKey(apiKey);
    const now = new Date().toISOString();
    const profileError = await upsertServerProfile(admin, user);
    if (profileError) throw profileError;
    const { error } = await admin.from("user_ai_credentials").upsert({
      user_id: user.id,
      provider: "openai",
      encrypted_secret: encrypted.encryptedSecret,
      secret_iv: encrypted.secretIv,
      secret_tag: encrypted.secretTag,
      last_four: encrypted.lastFour,
      verified_at: now,
      updated_at: now
    });
    if (error) throw error;
    sendJson(response, 200, {
      credential: {
        configured: true,
        provider: "openai",
        lastFour: encrypted.lastFour,
        verifiedAt: now,
        updatedAt: now
      }
    });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Failed to save OpenAI key." });
  }
}

async function verifyOpenAiCredential(apiKey) {
  try {
    const verificationResponse = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (verificationResponse.ok) return { ok: true, status: 200, error: null };
    const payload = await verificationResponse.json().catch(() => null);
    return {
      ok: false,
      status: verificationResponse.status === 401 ? 401 : 502,
      error: payload?.error?.message ?? "OpenAI could not verify this API key."
    };
  } catch {
    return { ok: false, status: 502, error: "OpenAI key verification is temporarily unavailable." };
  }
}

async function handleUsageRequest(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const { data, error } = await admin
    .from("usage_events")
    .select("status,created_at")
    .eq("user_id", user.id)
    .eq("event_type", "tutor_message")
    .order("created_at", { ascending: false });

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { usage: formatUsageSummary(data ?? []) });
}

async function handleProgressionRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const url = new URL(request.url ?? "/api/progression", "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/progression") {
    await handleProgressionSummary(auth, response, url.searchParams.get("timezone"));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/progression/exercise") {
    await handleProgressionExercise(auth, request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/progression/title") {
    await handleEquipProgressionTitle(auth, request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/progression/section") {
    await handleSectionCompletion(auth, request, response);
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/progression/reset") {
    await handleProgressionReset(auth, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleProgressionSummary({ admin, user }, response, requestedTimezone) {
  if (requestedTimezone) {
    await admin.from("profiles").update({
      timezone: requestedTimezone,
      updated_at: new Date().toISOString()
    }).eq("id", user.id);
  }

  const [profileResult, activityResult, badgesResult, coursesResult, sectionsResult, attemptsResult] = await Promise.all([
    admin.from("profiles").select("timezone,equipped_badge_id").eq("id", user.id).maybeSingle(),
    admin.from("xp_ledger").select("id,language,primary_skill,parent_language,topic_ids,domain_ids,exercise_kind,xp,difficulty,earned_on,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    admin.from("user_badges").select("badge_key,earned_at").eq("user_id", user.id).order("earned_at", { ascending: true }),
    admin.from("courses").select("id,required_section_count,experience_type,domain_ids").eq("user_id", user.id),
    admin.from("course_section_completions").select("course_id").eq("user_id", user.id),
    admin.from("exercise_attempts").select("source,exercise_key,attempts,hint_used,status,completed_at").eq("user_id", user.id)
  ]);

  const error = [
    profileResult.error,
    activityResult.error,
    badgesResult.error,
    coursesResult.error,
    sectionsResult.error,
    attemptsResult.error
  ].find(Boolean);
  if (error) {
    sendJson(response, 500, { error: formatGeneratedContentSchemaError(error) });
    return;
  }

  const sectionCounts = new Map();
  for (const item of sectionsResult.data ?? []) {
    sectionCounts.set(item.course_id, (sectionCounts.get(item.course_id) ?? 0) + 1);
  }
  const completedCourses = (coursesResult.data ?? []).filter(
    (course) => (sectionCounts.get(course.id) ?? 0) >= Math.max(course.required_section_count ?? 5, 1)
  ).length;
  const completedPrograms = (coursesResult.data ?? []).filter((course) =>
    (course.experience_type === "course" || course.experience_type === "guided_project") &&
    (sectionCounts.get(course.id) ?? 0) >= Math.max(course.required_section_count ?? 5, 1)
  );
  const timezone = profileResult.data?.timezone ?? "UTC";
  const nowDateKey = getDateKeyInTimezone(timezone);
  const { data: dailyState } = await admin.from("exercise_daily_state")
    .select("completed_count,skip_used")
    .eq("user_id", user.id)
    .eq("activity_date", nowDateKey)
    .maybeSingle();
  const badges = normalizeBadgeRows(badgesResult.data ?? []);
  const achievementState = evaluateAchievementProgress({
    activity: activityResult.data ?? [],
    completedPrograms,
    earnedBadgeKeys: badges.map((badge) => badge.id)
  });

  sendJson(response, 200, {
    progression: {
      ...buildProgressionSummary({
        activity: activityResult.data ?? [],
        badges,
        equippedBadgeId: profileResult.data?.equipped_badge_id ?? null,
        completedCourses,
        nowDateKey,
        achievements: achievementState.progress
      }),
      timezone,
      attempts: (attemptsResult.data ?? []).map((attempt) => ({
        ...attempt,
        hint_used: attempt.hint_used_on ? attempt.hint_used_on === nowDateKey : Boolean(attempt.hint_used),
        hint_used_on: attempt.hint_used_on ?? null
      })),
      dailyState: {
        completedCount: dailyState?.completed_count ?? 0,
        skipUsed: dailyState?.skip_used ?? false
      }
    }
  });
}

async function handleProgressionExercise({ admin, user }, request, response) {
  const body = await readJsonBody(request);
  const action = body?.action;
  const source = body?.source;
  const exerciseKey = body?.exerciseKey;
  if (
    typeof exerciseKey !== "string" ||
    !["independent", "course-mcq", "course-chat"].includes(source) ||
    !["attempt", "hint", "skip", "complete"].includes(action)
  ) {
    sendJson(response, 400, { error: "Invalid exercise action." });
    return;
  }

  const courseId = typeof body?.courseId === "string" ? body.courseId : null;
  if (source !== "independent" && !courseId) {
    sendJson(response, 400, { error: "Course exercises require a course." });
    return;
  }
  if (courseId && !(await userOwnsCourse(admin, user.id, courseId))) {
    sendJson(response, 404, { error: "Course not found." });
    return;
  }
  const usesPracticeAllowance = Boolean(body?.usesPracticeAllowance && courseId && await isExerciseSessionCourse(admin, user.id, courseId));

  const definition = await resolveProgressionExerciseDefinition(admin, source, exerciseKey, courseId);
  if (!definition) {
    sendJson(response, 400, { error: "Invalid exercise action." });
    return;
  }
  const exerciseMetadata = {
    language: definition.parentLanguage || definition.language,
    primary_skill: definition.primarySkill || definition.language,
    parent_language: definition.parentLanguage || definition.language,
    topic_ids: definition.topicIds ?? [],
    domain_ids: definition.domainIds ?? [],
    exercise_kind: definition.kind === "mcq" ? "mcq" : definition.kind === "code" ? "code" : "chat"
  };

  const awardKey = source === "independent" ? exerciseKey : `${courseId}:${exerciseKey}`;
  const existingKey = awardKey;

  if (action === "skip") {
    const dateKey = await readUserDateKey(admin, user.id);
    const { data: current } = await admin.from("exercise_daily_state")
      .select("skip_used").eq("user_id", user.id).eq("activity_date", dateKey).maybeSingle();
    if (current?.skip_used) {
      sendJson(response, 409, { error: "Daily skip already used." });
      return;
    }
    const { error } = await admin.from("exercise_daily_state").upsert({
      user_id: user.id,
      activity_date: dateKey,
      skip_used: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,activity_date" });
    if (error) {
      sendJson(response, 500, { error: error.message });
      return;
    }
    sendJson(response, 200, { exercise: { skipped: true } });
    return;
  }

  if (action === "hint") {
    const dateKey = await readUserDateKey(admin, user.id);
    const { data: existing } = await admin.from("exercise_attempts")
      .select("hint_used").eq("user_id", user.id).eq("source", source).eq("exercise_key", existingKey).maybeSingle();
    if (existing?.hint_used) {
      sendJson(response, 409, { error: "Hint already used for this exercise today." });
      return;
    }
    const { error } = await admin.from("exercise_attempts").upsert({
      user_id: user.id,
      course_id: courseId,
      source,
      exercise_key: existingKey,
      ...exerciseMetadata,
      difficulty: definition.difficulty,
      hint_used: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,source,exercise_key" });
    if (error) {
      sendJson(response, 500, { error: error.message });
      return;
    }
    sendJson(response, 200, { exercise: { hintUsed: true } });
    return;
  }

  let passed = false;
  let feedback = "Not passing yet.";
  if (definition.kind === "chat" && action === "complete") {
    const providerConfig = await resolveUserProviderConfig(admin, user, "reflection_grade");
    if (providerConfig.error) {
      sendJson(response, 503, { error: providerConfig.error });
      return;
    }
    const gradeResponse = await requestChatExerciseGrade({
      config: providerConfig,
      answer: String(body?.submission?.answer ?? "").slice(0, 4000),
      prompt: definition.prompt,
      rubric: definition.rubric
    });
    if (!gradeResponse.ok) {
      sendJson(response, 502, { error: gradeResponse.error ?? "Exercise grader failed." });
      return;
    }
    const grade = parseChatGrade(gradeResponse.text);
    passed = grade.passed;
    feedback = grade.feedback;
  } else if (definition.kind === "mcq") {
    passed = action === "complete" && body?.submission?.answerIndex === definition.correctAnswerIndex;
    feedback = passed ? definition.explanation ?? "Correct." : "Not quite. Review the explanation, then continue.";
  } else if (definition.kind === "code") {
    const submittedCode = body?.submission?.code;
    const staticPassed = action === "complete" && gradeGeneratedCodeExercise(submittedCode, definition);
    const executionConfig = resolveExecutionConfig(process.env);
    if (action === "complete" && executionConfig.configured) {
      try {
        const sandboxGrade = await gradeWithSandbox({
          env: process.env,
          userId: user.id,
          language: definition.language,
          filePath: definition.filePath,
          code: submittedCode,
          starterCode: definition.starterCode,
          resultCode: definition.resultCode
        });
        passed = staticPassed && sandboxGrade.passed;
        feedback = passed
          ? sandboxGrade.feedback
          : !staticPassed
            ? "Code ran, but it does not satisfy the generated acceptance criteria yet."
            : sandboxGrade.feedback;
      } catch (error) {
        sendJson(response, Number(error?.status) || 502, {
          error: error instanceof Error ? error.message : "Exercise sandbox failed.",
          code: error?.code ?? "execution_failed"
        });
        return;
      }
    } else {
      passed = staticPassed;
      feedback = passed
        ? "Editor exercise passed static verification. Configure Judge0 for compile-and-run grading."
        : "Not enough yet. Update the active IDE file and try again.";
    }
  } else {
    passed = action === "complete" && gradeDeterministicExercise(source, exerciseKey, body?.submission);
    feedback = passed ? "Exercise verified." : "Not passing yet. Re-check the requirements.";
  }

  if (!passed) {
    const { error } = await admin.from("exercise_attempts").upsert({
      user_id: user.id,
      course_id: courseId,
      source,
      exercise_key: existingKey,
      ...exerciseMetadata,
      difficulty: definition.difficulty,
      attempts: 1,
      status: "failed",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,source,exercise_key" });
    if (error) {
      sendJson(response, 500, { error: error.message });
      return;
    }
    sendJson(response, 200, { exercise: { passed: false, feedback } });
    return;
  }

  const dateKey = await readUserDateKey(admin, user.id);
  const plan = source === "independent" || usesPracticeAllowance ? await readUserPlan(admin, user.id) : "pro";
  const dailyLimit = plan === "pro" ? 30 : plan === "basic" ? 10 : 2;
  const awardDefinition = definition.kind === "code" && await hasFailedExerciseAttempt(admin, user.id, source, existingKey)
    ? { ...definition, xp: Math.max(1, Math.ceil(definition.xp / 2)) }
    : definition;
  const awardResult = await awardExerciseCompletion(admin, {
    userId: user.id,
    courseId,
    source,
    exerciseKey: existingKey,
    awardKey,
    definition: awardDefinition,
    dateKey,
    dailyLimit,
    usesDailyAllowance: source === "independent" || usesPracticeAllowance
  });
  if (awardResult.error) {
    sendJson(response, awardResult.status, { error: awardResult.error });
    return;
  }
  if (awardResult.awarded) {
    try {
      await awardEligibleAchievementTitles(admin, user.id);
    } catch (error) {
      console.warn("Achievement award failed", error instanceof Error ? error.message : error);
    }
  }
  sendJson(response, 200, {
    exercise: {
      passed: true,
      feedback,
      awarded: awardResult.awarded,
      xp: awardResult.awarded ? awardDefinition.xp : 0
    }
  });
}

async function resolveProgressionExerciseDefinition(admin, source, exerciseKey, courseId) {
  const staticDefinition = resolveExerciseDefinition(source, exerciseKey);
  if (staticDefinition) {
    const skill = resolveSkillMetadata({ language: staticDefinition.language, subject: exerciseKey });
    return source === "course-chat"
      ? {
          ...staticDefinition,
          kind: "chat",
          primarySkill: skill.primarySkill,
          parentLanguage: skill.parentLanguage,
          domainIds: skill.domainIds,
          topicIds: [],
          prompt: "What should a function that returns the first array element return for an empty array, and why?",
          rubric: "Pass only when the learner identifies a deliberate empty-array result and gives coherent reasoning."
        }
      : { ...staticDefinition, primarySkill: skill.primarySkill, parentLanguage: skill.parentLanguage, domainIds: skill.domainIds, topicIds: [] };
  }
  if (!courseId || (source !== "course-mcq" && source !== "course-chat")) return null;

  const { data, error } = await admin.from("courses").select("course_content,languages,skill_ids,domain_ids").eq("id", courseId).maybeSingle();
  if (error || !data?.course_content) return null;

  const fallbackLanguage = Array.isArray(data.languages) && data.languages[0] ? data.languages[0] : "JavaScript";
  const exercises = flattenGeneratedExercises(data.course_content);
  for (const exercise of exercises) {
    const skill = resolveSkillMetadata({
      framework: exercise.primarySkill,
      language: exercise.parentLanguage || exercise.language || fallbackLanguage,
      subject: data.course_content.subject
    });
    const difficulty = normalizeExerciseDifficulty(exercise.difficulty);
    const common = {
      primarySkill: skill.primarySkill,
      parentLanguage: skill.parentLanguage,
      domainIds: exercise.domainIds?.length ? exercise.domainIds : (data.domain_ids?.length ? data.domain_ids : skill.domainIds),
      topicIds: exercise.topicIds ?? [],
      difficulty
    };
    if (source === "course-mcq" && exercise.type === "mcq" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "mcq")) {
      return {
        ...common,
        kind: "mcq",
        source,
        key: exerciseKey,
        language: common.parentLanguage || fallbackLanguage,
        xp: exerciseXp("mcq", difficulty),
        correctAnswerIndex: exercise.correctOptionIndex,
        explanation: exercise.explanation
      };
    }
    if (source === "course-chat" && exercise.type === "chat" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "chat")) {
      return {
        ...common,
        kind: "chat",
        source,
        key: exerciseKey,
        language: common.parentLanguage || fallbackLanguage,
        xp: 10,
        prompt: exercise.prompt,
        rubric: exercise.rubric
      };
    }
    if (source === "course-chat" && exercise.type === "code" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "code")) {
      return {
        ...common,
        kind: "code",
        source,
        key: exerciseKey,
        language: exercise.language || fallbackLanguage,
        filePath: exercise.filePath,
        xp: exerciseXp("code", difficulty),
        prompt: exercise.prompt,
        acceptanceCriteria: exercise.acceptanceCriteria,
        starterCode: exercise.starterCode,
        resultCode: exercise.resultCode,
        expectedChange: exercise.expectedChange
      };
    }
  }
  return null;
}

function flattenGeneratedExercises(content) {
  const modernModules = content?.schemaVersion === "course-content/v2"
    ? content.modules ?? []
    : content?.schemaVersion === "short-course-content/v1"
      ? [{ topics: content.sections ?? [] }]
      : content?.schemaVersion === "exercise-session/v1"
        ? [{ topics: content.problems ?? [] }]
        : content?.schemaVersion === "guided-project-content/v1"
          ? content.milestones ?? []
          : content?.schemaVersion === "guided-project-content/v2"
            ? [{ topics: [{ ...content.module, id: `${content.module.id}-build` }] }]
          : null;
  if (modernModules) {
    return modernModules.flatMap((module) =>
      (module.topics ?? []).flatMap((topic) =>
        (topic.blocks ?? []).flatMap((block) =>
          (block.steps ?? []).map((step, stepIndex) => {
            const keyBase = `${block.id}:${stepIndex}`;
            const metadata = {
              difficulty: topic.difficulty,
              primarySkill: topic.primarySkill,
              parentLanguage: topic.parentLanguage,
              topicIds: topic.topicIds,
              domainIds: topic.domainIds
            };
            if (step?.type === "mcq") return { ...metadata, type: "mcq", keyBase, legacyKeyBase: block.id, correctOptionIndex: step.correctOptionIndex, explanation: step.explanation };
            if (step?.type === "reflection") return { ...metadata, type: "chat", keyBase, legacyKeyBase: block.id, prompt: step.prompt, rubric: step.rubric };
            if (step?.type === "workshop" || step?.type === "lab" || step?.type === "project") {
              return {
                ...metadata,
                type: "code",
                keyBase,
                legacyKeyBase: block.id,
                prompt: step.prompt,
                language: step.language,
                filePath: step.filePath,
                starterCode: step.starterCode,
                resultCode: step.resultCode,
                expectedChange: step.expectedChange,
                acceptanceCriteria: Array.isArray(step.acceptanceCriteria) ? step.acceptanceCriteria : []
              };
            }
            return null;
          }).filter(Boolean)
        )
      )
    );
  }

  return (content?.chapters ?? []).flatMap((chapter) =>
    (chapter.sections ?? []).flatMap((section) =>
      (section.blocks ?? []).map((block, blockIndex) => {
        const keyBase = `${section.id}:${blockIndex}`;
        if (block?.type === "mcq") return { type: "mcq", keyBase, legacyKeyBase: section.id, correctOptionIndex: block.correctOptionIndex, explanation: block.explanation };
        if (block?.type === "chat_exercise") return { type: "chat", keyBase, legacyKeyBase: section.id, prompt: block.prompt, rubric: block.rubric };
        if (block?.type === "code_exercise") return { type: "code", keyBase, legacyKeyBase: section.id, prompt: block.prompt, language: block.language };
        return null;
      }).filter(Boolean)
    )
  );
}

function matchesGeneratedExerciseKey(exerciseKey, keyBase, legacyKeyBase, type) {
  return exerciseKey === `${keyBase}:${type}` || exerciseKey === `${legacyKeyBase}:${type}`;
}

function gradeGeneratedCodeExercise(code, definition = {}) {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  if (normalizedCode.length < 4) return false;
  if (typeof definition.starterCode === "string" && normalizedCode === definition.starterCode.trim()) return false;
  if (!/[=;{}()]|\b(console|return|def|function|const|let|class|static|void|func|fn|print|println|display|select|program|puts|echo)\b/i.test(normalizedCode)) return false;
  const criteria = Array.isArray(definition.acceptanceCriteria) ? definition.acceptanceCriteria : [];
  if (!criteria.length) return true;
  return criteria.every((criterion) => gradeCodeCriterion(normalizedCode, criterion));
}

function gradeCodeCriterion(code, criterion) {
  const normalizedCriterion = String(criterion ?? "").toLowerCase();
  const outputCount = countOutputCalls(code);
  const functionCallCount = countCallsToDefinedFunctions(code);
  if (!normalizedCriterion.trim()) return true;
  if (/second|two|2|both|twice/.test(normalizedCriterion) && /function|method|call/.test(normalizedCriterion)) {
    return functionCallCount >= 2;
  }
  if (/second|two|2|both|twice/.test(normalizedCriterion) && /output|print|log|show|visible|result|call/.test(normalizedCriterion)) {
    return outputCount >= 2;
  }
  if (/if statement|if path|if block|decision|choice|condition|fallback|else path|\belse\b/.test(normalizedCriterion)) {
    if (/else/.test(normalizedCriterion)) return /\bif\s*\(|\bif\b/.test(code) && /\belse\b/.test(code);
    return /\bif\s*\(|\bif\b|\bswitch\b|\bmatch\b|\?/.test(code);
  }
  if (/function|method|named rule|named/.test(normalizedCriterion)) {
    return /\bfunction\s+\w+\s*\(|=>|def\s+\w+\s*\(|static\s+\w+\s+\w+\s*\(|func\s+\w+\s*\(|fn\s+\w+\s*\(/i.test(code);
  }
  if (/print|log|output|visible|show|readable|result/.test(normalizedCriterion)) return outputCount > 0 || /\breturn\b/.test(code);
  if (/value|variable|stores|stored/.test(normalizedCriterion)) return /(const|let|var|string\s+\w+|int\s+\w+|var\s+\w+|\w+\s*=)/i.test(code);
  if (/same file|one file|simple file/.test(normalizedCriterion)) return true;
  return code.length > 24;
}

function countOutputCalls(code) {
  return (code.match(/console\.(log|write|writeline)\s*\(|print\s*(?:\*|\()|system\.out\.println|std::cout|printf\s*\(|fmt\.println|println!?\s*\(|puts\s+|echo\s+|\bdisplay\s+|\bselect\s+|\bprint\s+/gi) ?? []).length;
}

function countCallsToDefinedFunctions(code) {
  const definitionNames = Array.from(code.matchAll(/\b(?:function|def|func|fn)\s+([A-Za-z_]\w*)\s*\(|\bstatic\s+\w+\s+([A-Za-z_]\w*)\s*\(/gi))
    .map((match) => match[1] || match[2])
    .filter(Boolean);
  return definitionNames.reduce((total, name) => {
    const callMatches = code.match(new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, "g")) ?? [];
    return total + Math.max(0, callMatches.length - 1);
  }, 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function hasFailedExerciseAttempt(admin, userId, source, exerciseKey) {
  const { data } = await admin.from("exercise_attempts")
    .select("attempts,status")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("exercise_key", exerciseKey)
    .maybeSingle();
  return data?.status === "failed" || (data?.attempts ?? 0) > 0;
}

async function awardExerciseCompletion(admin, {
  userId,
  courseId,
  source,
  exerciseKey,
  awardKey,
  definition,
  dateKey,
  dailyLimit,
  usesDailyAllowance = false
}) {
  const { data: existingAward, error: existingError } = await admin.from("xp_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_key", awardKey)
    .maybeSingle();
  if (existingError) return { awarded: false, status: 500, error: existingError.message };
  if (existingAward) return { awarded: false, status: 200, error: null };

  let dailyState = null;
  if (usesDailyAllowance) {
    const dailyResult = await admin.from("exercise_daily_state")
      .select("completed_count,skip_used")
      .eq("user_id", userId)
      .eq("activity_date", dateKey)
      .maybeSingle();
    if (dailyResult.error) return { awarded: false, status: 500, error: dailyResult.error.message };
    dailyState = dailyResult.data;
    if ((dailyState?.completed_count ?? 0) >= dailyLimit) {
      return { awarded: false, status: 403, error: "Daily completion limit reached." };
    }
  }

  const { error: ledgerError } = await admin.from("xp_ledger").insert({
    user_id: userId,
    course_id: courseId,
    source,
    source_key: awardKey,
    language: definition.parentLanguage || definition.language,
    primary_skill: definition.primarySkill || definition.language,
    parent_language: definition.parentLanguage || definition.language,
    topic_ids: definition.topicIds ?? [],
    domain_ids: definition.domainIds ?? [],
    exercise_kind: definition.kind === "mcq" ? "mcq" : definition.kind === "code" ? "code" : "chat",
    difficulty: definition.difficulty,
    xp: definition.xp,
    earned_on: dateKey
  });
  if (ledgerError?.code === "23505") return { awarded: false, status: 200, error: null };
  if (ledgerError) return { awarded: false, status: 500, error: ledgerError.message };

  const now = new Date().toISOString();
  const writes = [
    admin.from("exercise_attempts").upsert({
      user_id: userId,
      course_id: courseId,
      source,
      exercise_key: exerciseKey,
      language: definition.parentLanguage || definition.language,
      primary_skill: definition.primarySkill || definition.language,
      parent_language: definition.parentLanguage || definition.language,
      topic_ids: definition.topicIds ?? [],
      domain_ids: definition.domainIds ?? [],
      exercise_kind: definition.kind === "mcq" ? "mcq" : definition.kind === "code" ? "code" : "chat",
      difficulty: definition.difficulty,
      attempts: 1,
      status: "completed",
      completed_at: now,
      updated_at: now
    }, { onConflict: "user_id,source,exercise_key" }),
    admin.from("user_badges").upsert({
      user_id: userId,
      badge_key: "first-steps",
      earned_at: now
    }, { onConflict: "user_id,badge_key" })
  ];
  if (usesDailyAllowance) {
    writes.splice(1, 0, admin.from("exercise_daily_state").upsert({
      user_id: userId,
      activity_date: dateKey,
      completed_count: (dailyState?.completed_count ?? 0) + 1,
      skip_used: dailyState?.skip_used ?? false,
      updated_at: now
    }, { onConflict: "user_id,activity_date" }));
  }
  const results = await Promise.all(writes);
  const writeError = results.find((result) => result.error)?.error;
  if (writeError) return { awarded: true, status: 500, error: writeError.message };
  return { awarded: true, status: 200, error: null };
}

async function isExerciseSessionCourse(admin, userId, courseId) {
  const { data } = await admin.from("courses")
    .select("experience_type,course_content")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.experience_type === "exercise" || data?.course_content?.schemaVersion === "exercise-session/v1";
}

async function handleEquipProgressionTitle({ admin, user }, request, response) {
  const body = await readJsonBody(request);
  const badgeId = body?.badgeId;
  if (badgeId === null) {
    const { error } = await admin.from("profiles").update({
      equipped_badge_id: null,
      updated_at: new Date().toISOString()
    }).eq("id", user.id);
    if (error) {
      sendJson(response, 500, { error: error.message });
      return;
    }
    sendJson(response, 200, { equippedBadgeId: null, equippedTitle: null });
    return;
  }
  if (typeof badgeId !== "string" || !badgeId.trim()) {
    sendJson(response, 400, { error: "Invalid badge." });
    return;
  }
  const { data: badge, error: badgeError } = await admin.from("user_badges")
    .select("badge_key").eq("user_id", user.id).eq("badge_key", badgeId).maybeSingle();
  if (badgeError || !badge) {
    sendJson(response, 404, { error: badgeError?.message ?? "Badge not earned." });
    return;
  }
  const { error } = await admin.from("profiles").update({
    equipped_badge_id: badge.badge_key,
    updated_at: new Date().toISOString()
  }).eq("id", user.id);
  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }
  const normalizedBadge = normalizeBadgeRows([{ badge_key: badge.badge_key, earned_at: null }])[0];
  sendJson(response, 200, { equippedBadgeId: badge.badge_key, equippedTitle: normalizedBadge.title });
}

async function handleSectionCompletion({ admin, user }, request, response) {
  const body = await readJsonBody(request);
  const courseId = body?.courseId;
  const sectionId = body?.sectionId;
  if (typeof courseId !== "string" || typeof sectionId !== "string" || !(await userOwnsCourse(admin, user.id, courseId))) {
    sendJson(response, 400, { error: "Invalid course section." });
    return;
  }
  const { error } = await admin.from("course_section_completions").upsert({
    user_id: user.id,
    course_id: courseId,
    section_id: sectionId
  });
  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }
  try {
    await awardEligibleAchievementTitles(admin, user.id);
  } catch (achievementError) {
    console.warn("Achievement award failed", achievementError instanceof Error ? achievementError.message : achievementError);
  }
  sendJson(response, 200, { completed: true });
}

async function awardEligibleAchievementTitles(admin, userId) {
  const [activityResult, badgesResult, coursesResult, sectionsResult] = await Promise.all([
    admin.from("xp_ledger")
      .select("id,language,parent_language,domain_ids,xp")
      .eq("user_id", userId),
    admin.from("user_badges").select("badge_key").eq("user_id", userId),
    admin.from("courses")
      .select("id,required_section_count,experience_type,domain_ids")
      .eq("user_id", userId),
    admin.from("course_section_completions").select("course_id").eq("user_id", userId)
  ]);
  const error = [activityResult.error, badgesResult.error, coursesResult.error, sectionsResult.error].find(Boolean);
  if (error) throw new Error(formatGeneratedContentSchemaError(error));
  const sectionCounts = new Map();
  for (const row of sectionsResult.data ?? []) sectionCounts.set(row.course_id, (sectionCounts.get(row.course_id) ?? 0) + 1);
  const completedPrograms = (coursesResult.data ?? []).filter((course) =>
    (course.experience_type === "course" || course.experience_type === "guided_project") &&
    (sectionCounts.get(course.id) ?? 0) >= Math.max(course.required_section_count ?? 1, 1)
  );
  const result = evaluateAchievementProgress({
    activity: activityResult.data ?? [],
    completedPrograms,
    earnedBadgeKeys: (badgesResult.data ?? []).map((badge) => badge.badge_key)
  });
  if (!result.newlyEarnedBadgeKeys.length) return [];
  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("user_badges").upsert(
    result.newlyEarnedBadgeKeys.map((badgeKey) => ({ user_id: userId, badge_key: badgeKey, earned_at: now })),
    { onConflict: "user_id,badge_key", ignoreDuplicates: true }
  );
  if (insertError) throw new Error(insertError.message);
  return result.newlyEarnedBadgeKeys;
}

async function handleProgressionReset({ admin, user }, response) {
  const tables = ["xp_ledger", "user_badges", "exercise_attempts", "exercise_daily_state", "course_section_completions"];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      sendJson(response, 500, { error: error.message });
      return;
    }
  }
  await admin.from("profiles").update({ equipped_badge_id: null, updated_at: new Date().toISOString() }).eq("id", user.id);
  sendJson(response, 200, { reset: true });
}

async function userOwnsCourse(admin, userId, courseId) {
  const { data } = await admin.from("courses").select("id").eq("id", courseId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

async function readLearnerProfile(admin, userId) {
  const { data, error } = await admin
    .from("learner_profiles")
    .select("known_subjects,weak_concepts,strong_concepts,assessment_history,teaching_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/learner_profiles/i.test(error.message) && /schema cache|does not exist|Could not find the table/i.test(error.message)) {
      return null;
    }
    console.warn("Learner profile read failed", error.message);
    return null;
  }
  return data ?? null;
}

async function readPracticeHistory(admin, userId) {
  const { data, error } = await admin
    .from("exercise_attempts")
    .select("source,language,difficulty,status,attempts,primary_skill,parent_language,topic_ids,domain_ids,exercise_kind,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(formatGeneratedContentSchemaError(error));
  return (data ?? []).map((item) => ({
    skill: item.primary_skill || item.language,
    language: item.parent_language || item.language,
    topics: item.topic_ids ?? [],
    domains: item.domain_ids ?? [],
    difficulty: item.difficulty,
    kind: item.exercise_kind,
    status: item.status,
    attempts: item.attempts
  }));
}

async function persistAssessmentAndLearnerProfile(admin, userId, { subject, answers, assessmentReview, content }) {
  const now = new Date().toISOString();
  const weakConcepts = uniqueServerStrings([
    ...(assessmentReview?.gaps ?? []),
    ...answers.filter((answer) => answer?.skipped || answer?.isCorrect === false).map((answer) => answer.assessmentArea || answer.prompt)
  ]).slice(0, 60);
  const strongConcepts = uniqueServerStrings([
    ...(assessmentReview?.strengths ?? []),
    ...answers.filter((answer) => answer?.isCorrect === true).map((answer) => answer.assessmentArea || answer.prompt)
  ]).slice(0, 60);

  const { error: assessmentError } = await admin.from("course_assessments").insert({
    user_id: userId,
    course_id: null,
    subject,
    raw_answers: answers,
    result: assessmentReview,
    created_at: now
  });
  if (assessmentError) {
    console.warn("Assessment persistence failed", assessmentError.message);
  }

  const prior = await readLearnerProfile(admin, userId);
  const knownSubjects = uniqueServerStrings([...(prior?.known_subjects ?? []), content?.subject, subject]).slice(0, 50);
  const assessmentHistory = [
    ...(Array.isArray(prior?.assessment_history) ? prior.assessment_history : []),
    {
      subject,
      at: now,
      strengths: assessmentReview?.strengths ?? [],
      gaps: assessmentReview?.gaps ?? [],
      suggestedModules: assessmentReview?.suggestedModules ?? []
    }
  ].slice(-25);

  const { error: profileError } = await admin.from("learner_profiles").upsert({
    user_id: userId,
    known_subjects: knownSubjects,
    weak_concepts: uniqueServerStrings([...(prior?.weak_concepts ?? []), ...weakConcepts]).slice(0, 80),
    strong_concepts: uniqueServerStrings([...(prior?.strong_concepts ?? []), ...strongConcepts]).slice(0, 80),
    assessment_history: assessmentHistory,
    teaching_preferences: prior?.teaching_preferences ?? {},
    updated_at: now
  });
  if (profileError) {
    if (/learner_profiles/i.test(profileError.message) && /schema cache|does not exist|Could not find the table/i.test(profileError.message)) {
      return;
    }
    console.warn("Learner profile persistence failed", profileError.message);
  }
}

function uniqueServerStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values ?? []) {
    const text = typeof value === "string" ? value.trim() : "";
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

async function readUserDateKey(admin, userId) {
  const { data } = await admin.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return getDateKeyInTimezone(data?.timezone ?? "UTC");
}

async function handleCreateCourseRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;

  const body = await readJsonBody(request);
  await createCourseFromDraft(auth, body?.course, response);
}

async function createCourseFromDraft({ admin, user }, draft, response) {
  if (!isCourseDraft(draft)) {
    sendJson(response, 400, { error: "Invalid course draft." });
    return;
  }

  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  const plan = await readUserPlan(admin, user.id);
  const experienceType = normalizeExperienceType(draft.experienceType);
  const skillMetadata = resolveSkillMetadata({
    framework: draft.learningBrief?.framework,
    language: draft.learningBrief?.language || draft.languages?.[0],
    subject: draft.learningBrief?.subject || draft.subject,
    platform: draft.learningBrief?.platform,
    motivation: draft.learningBrief?.motivation,
    goal: draft.learningBrief?.goal || draft.description
  });
  const clientRequestId = typeof draft.id === "string" && draft.id.trim() ? draft.id.trim().slice(0, 120) : null;
  if (clientRequestId) {
    const { data: existing } = await admin
      .from("courses")
      .select("*")
      .eq("user_id", user.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) {
      sendJson(response, 200, { course: existing, plan, idempotent: true });
      return;
    }
  }
  const { count, error: countError } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("experience_type", "exercise");

  if (countError) {
    sendJson(response, 500, { error: formatGeneratedContentSchemaError(countError) });
    return;
  }

  const activeCourseCount = count ?? 0;
  const limit = resolvePlanLimit(plan);
  const generatedThisMonth = await readMonthlyExperienceGenerationCount(admin, user.id);
  if (!canGenerateExperience(plan, generatedThisMonth)) {
    sendJson(response, 403, {
      error: "Free plan monthly generation limit reached.",
      plan,
      generatedExperiencesThisMonth: generatedThisMonth,
      monthlyExperienceGenerationLimit: limit.monthlyExperienceGenerationLimit
    });
    return;
  }
  if (experienceType !== "exercise" && !canCreateActiveCourse(plan, activeCourseCount)) {
    sendJson(response, 403, {
      error: `Active course limit reached for ${plan} plan.`,
      plan,
      activeCourseCount,
      activeCourseLimit: limit.activeCourseLimit
    });
    return;
  }

  const basePayload = {
    user_id: user.id,
    title: draft.title,
    subject: draft.subject,
    mode: draft.mode,
    checkpoint: draft.checkpoint,
    description: draft.description,
    progress: draft.progress,
    required_section_count: draft.syllabus.length,
    experience_type: experienceType,
    client_request_id: clientRequestId,
    skill_ids: uniqueServerStrings([skillMetadata.primarySkill, skillMetadata.parentLanguage]),
    domain_ids: skillMetadata.domainIds
  };
  const generatedPayload = draft.courseContent
    ? {
        course_content: draft.learningBrief ? { ...draft.courseContent, learningBrief: draft.learningBrief } : draft.courseContent,
        languages: Array.isArray(draft.languages) ? draft.languages : [],
        tags: Array.isArray(draft.tags) ? draft.tags : [],
        content_generation_state: draft.courseContent.schemaVersion === "course-content/v1" || draft.courseContent.schemaVersion === "guided-project-content/v1" ? "first_chapter" : "full_course"
      }
    : {};

  let { data, error } = await admin
    .from("courses")
    .insert({ ...basePayload, ...generatedPayload })
    .select("*")
    .single();

  if (error) {
    sendJson(response, 500, { error: formatGeneratedContentSchemaError(error) });
    return;
  }

  sendJson(response, 200, {
    course: data,
    plan,
    activeCourseCount: activeCourseCount + (experienceType === "exercise" ? 0 : 1),
    activeCourseLimit: limit.activeCourseLimit,
    generatedExperiencesThisMonth: generatedThisMonth + 1,
    monthlyExperienceGenerationLimit: limit.monthlyExperienceGenerationLimit
  });
}

async function readMonthlyExperienceGenerationCount(admin, userId) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function handleResetCoursesRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const { data, error } = await admin
    .from("courses")
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id");

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { archivedCount: data?.length ?? 0 });
}

async function readAuthenticatedUser(request, response) {
  const authToken = readBearerToken(request);
  if (!authToken) {
    sendJson(response, 401, { error: "Authentication is required." });
    return null;
  }

  const admin = await createSupabaseAdminClient(response);
  if (!admin) return null;

  const { data: userData, error: userError } = await admin.auth.getUser(authToken);
  const user = userData?.user;
  if (userError || !user) {
    sendJson(response, 401, { error: userError?.message ?? "Invalid authentication token." });
    return null;
  }

  return { admin, user };
}

async function handleCheckoutRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const plan = normalizePlanTier(body?.plan ?? "pro");
  const priceId = readStripePriceId(plan);
  const successUrl = body?.successUrl ?? process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = body?.cancelUrl ?? process.env.STRIPE_CANCEL_URL;

  if (!priceId || !successUrl || !cancelUrl) {
    sendJson(response, 400, { error: "Stripe price and redirect URLs are required." });
    return;
  }

  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  const customerId = await readOrCreateStripeCustomer(admin, stripe, user);
  const metadata = buildCheckoutMetadata(user.id, plan);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    metadata,
    subscription_data: {
      metadata
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true
  });

  sendJson(response, 200, { url: session.url });
}

async function handleBillingPortalRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const returnUrl = body?.returnUrl ?? process.env.STRIPE_PORTAL_RETURN_URL;
  const customerId = await readStripeCustomerId(admin, user.id);

  if (!customerId || !returnUrl) {
    sendJson(response, 400, { error: "Stripe customer and return URL are required. Start checkout before opening billing portal." });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });

  sendJson(response, 200, { url: session.url });
}

async function handleStripeWebhook(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    sendJson(response, 503, { error: "STRIPE_WEBHOOK_SECRET is not configured." });
    return;
  }

  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    sendJson(response, 400, { error: "Missing Stripe signature." });
    return;
  }

  const rawBody = await readRawBody(request);
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    const admin = await createSupabaseAdminClient(response);
    if (!admin) return;
    await syncStripeEventToSubscription(admin, event);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid Stripe webhook."
    });
    return;
  }

  sendJson(response, 200, { received: true });
}

async function createStripeClient(response) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    sendJson(response, 503, { error: "STRIPE_SECRET_KEY is not configured." });
    return null;
  }

  const { default: Stripe } = await import("stripe");
  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover"
  });
}

function readStripePriceId(plan) {
  if (plan === "pro") return process.env.STRIPE_PRO_PRICE_ID;
  return process.env.STRIPE_BASIC_PRICE_ID;
}

async function readStripeCustomerId(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.stripe_customer_id ?? null;
}

async function readOrCreateStripeCustomer(client, stripe, user) {
  const existingCustomerId = await readStripeCustomerId(client, user.id);
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: {
      user_id: user.id
    }
  });

  const { error } = await client.from("subscriptions").upsert({
    user_id: user.id,
    plan: "free",
    status: "free",
    stripe_customer_id: customer.id,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;

  return customer.id;
}

async function syncStripeEventToSubscription(client, event) {
  const subscriptionState = extractStripeSubscriptionState(event);
  if (subscriptionState) {
    await upsertSubscriptionState(client, subscriptionState);
    return;
  }

  const checkoutState = extractCheckoutSessionState(event);
  if (checkoutState) {
    await patchCheckoutSessionState(client, checkoutState);
  }
}

async function createSupabaseAdminClient(response) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 503, { error: "Supabase service role is not configured on the server." });
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function upsertServerProfile(client, user) {
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    updated_at: new Date().toISOString()
  });
  if (error) return error;

  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim().slice(0, 50)
    : "";
  if (displayName.length >= 2) {
    const { error: displayNameError } = await client
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("display_name", null);
    if (displayNameError) return displayNameError;
  }
  return null;
}

async function readUserPlan(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return "free";
  if (data.status !== "active" && data.status !== "trialing") return "free";
  return normalizePlanTier(data.plan);
}

async function resolveUserProviderConfig(admin, user, task) {
  const plan = await readUserPlan(admin, user.id);
  if (plan !== "free") return resolveTutorProviderConfig(process.env, task);

  const baseConfig = resolveTutorProviderConfig(process.env, task);
  const { data, error } = await admin
    .from("user_ai_credentials")
    .select("encrypted_secret,secret_iv,secret_tag")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return { ...baseConfig, apiKey: null, error: formatGeneratedContentSchemaError(error) };
  }
  if (!data) {
    return {
      ...baseConfig,
      apiKey: null,
      error: "Connect an OpenAI API key in Settings → Billing to use AI on the Free plan."
    };
  }
  try {
    const apiKey = decryptOpenAiKey(data);
    return resolveTutorProviderConfig({ ...process.env, OPENAI_API_KEY: apiKey }, task);
  } catch (error) {
    return {
      ...baseConfig,
      apiKey: null,
      error: error instanceof Error ? error.message : "The saved OpenAI key could not be decrypted."
    };
  }
}

async function recordUsageEvent(admin, { userId, courseId, model, status }) {
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    course_id: typeof courseId === "string" && courseId ? courseId : null,
    event_type: "tutor_message",
    model: typeof model === "string" ? model : null,
    input_tokens: null,
    output_tokens: null,
    status
  });

  if (error) {
    console.error("Failed to record usage event", error.message);
  }
}

function isTutorContext(context) {
  return Boolean(
    context &&
      (typeof context.courseId === "string" || context.courseId === null) &&
      typeof context.courseTitle === "string" &&
      typeof context.courseSubject === "string" &&
      (context.experienceType === undefined ||
        context.experienceType === "course" ||
        context.experienceType === "short_course" ||
        context.experienceType === "exercise" ||
        context.experienceType === "guided_project") &&
      (context.learningBrief === undefined || context.learningBrief === null || typeof context.learningBrief === "object") &&
      (context.courseMode === undefined ||
        context.courseMode === "fundamentals" ||
        context.courseMode === "project" ||
        context.courseMode === "leetcode" ||
        context.courseMode === "mixed") &&
      (context.courseDescription === undefined || typeof context.courseDescription === "string") &&
      (context.courseLanguages === undefined || Array.isArray(context.courseLanguages)) &&
      (context.courseTags === undefined || Array.isArray(context.courseTags)) &&
      (context.courseSyllabus === undefined || Array.isArray(context.courseSyllabus)) &&
      (context.requestKind === undefined ||
        context.requestKind === "chat" ||
        context.requestKind === "lesson_intro" ||
        context.requestKind === "exercise_hint" ||
        context.requestKind === "exercise_template") &&
      typeof context.checkpoint === "string" &&
      Array.isArray(context.fileTree) &&
      typeof context.userMessage === "string"
  );
}

function buildTutorInstructions() {
  return [
    readPrompt("core-system-prompt.md"),
    readPrompt("roles.md"),
    readPrompt("tutor-behavior.md"),
    readPrompt("onboarding-flow.md"),
    readPrompt("learning-modes.md"),
    readPrompt("save-memory-policy.md"),
    readPrompt("tool-use-policy.md"),
    readPrompt("response-contract.md"),
    readPrompt("safety.md")
  ].join("\n\n---\n\n");
}

function readPrompt(relativePath) {
  return readFileSync(join(root, "src", "ai", "prompts", relativePath), "utf8").trim();
}

function isCourseDraft(draft) {
  if (
    !(
    draft &&
      typeof draft.title === "string" &&
      draft.title.trim() &&
      typeof draft.subject === "string" &&
      draft.subject.trim() &&
      (draft.mode === "fundamentals" || draft.mode === "project" || draft.mode === "leetcode" || draft.mode === "mixed") &&
      typeof draft.checkpoint === "string" &&
      draft.checkpoint.trim() &&
      typeof draft.description === "string" &&
      Array.isArray(draft.syllabus) &&
      draft.syllabus.length > 0 &&
      Number.isInteger(draft.progress) &&
      draft.progress >= 0 &&
      draft.progress <= 100
    )
  ) {
    return false;
  }

  if (!draft.courseContent) return true;
  try {
    const experienceType = normalizeExperienceType(draft.experienceType);
    if (experienceType === "course") normalizeGeneratedCourseContent(draft.courseContent);
    else normalizeGeneratedLearningContent(draft.courseContent, {
      brief: draft.learningBrief ?? draft.courseContent?.learningBrief,
      assessmentReview: draft.courseContent?.assessmentReview
    });
    return true;
  } catch {
    return false;
  }
}

function formatGeneratedContentSchemaError(error) {
  const message = error?.message ?? "Course persistence failed.";
  if (/course_content|languages|tags|content_generation_state|required_section_count|experience_type|client_request_id|skill_ids|domain_ids|primary_skill|parent_language|topic_ids|exercise_kind|user_ai_credentials|schema cache/i.test(message)) {
    return "Learning persistence migration is missing. Apply the pending Supabase migrations, then retry; your learning brief remains available.";
  }
  return message;
}

function normalizeExperienceType(value) {
  return value === "short_course" || value === "exercise" || value === "guided_project" ? value : "course";
}

function readBearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxRequestBytes) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : null);
      } catch {
        rejectBody(new Error("Invalid JSON body."));
      }
    });

    request.on("error", rejectBody);
  });
}

function parseJsonObject(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Empty JSON response.");
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  throw new Error("No JSON object found.");
}

function readRawBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let length = 0;

    request.on("data", (chunk) => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > maxRequestBytes) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      resolveBody(Buffer.concat(chunks));
    });

    request.on("error", rejectBody);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function serveStatic(request, response) {
  const distRoot = join(root, "dist");
  const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(distRoot, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distRoot, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key]) return;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}

function readCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
