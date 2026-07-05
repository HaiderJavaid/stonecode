import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canCreateActiveCourse, normalizePlanTier, resolvePlanLimit } from "./plan-limits.mjs";
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
  buildCourseSetupReplyPrompt,
  createGeneratedCourseSkeletonFromOutline,
  extractGeneratedModuleFromResponse,
  normalizeAssessmentPlan,
  normalizeAssessmentQuestion,
  normalizeGeneratedCourseContent,
  mergeGeneratedChapter,
  stabilizeAssessmentQuestion
} from "./course-generation.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  hasBlockingGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "./course-generation-quality.mjs";
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
  buildProgressionSummary,
  getDateKeyInTimezone,
  gradeDeterministicExercise,
  normalizeBadgeRows,
  parseChatGrade,
  resolveExerciseDefinition
} from "./progression.mjs";

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

    if (request.url?.startsWith("/api/subscription")) {
      await handleSubscriptionRequest(request, response);
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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

async function handleCourseGenerationPreview({ admin, user }, body, response) {
  const objective = typeof body?.objective === "string" ? body.objective : "";
  const level = typeof body?.level === "string" ? body.level : "";
  const outcome = typeof body?.outcome === "string" ? body.outcome : "";
  const amendments = Array.isArray(body?.amendments) ? body.amendments.filter((item) => typeof item === "string") : [];

  if (!objective.trim() || !level.trim() || !outcome.trim()) {
    sendJson(response, 400, { error: "Course generation needs objective, level, and outcome." });
    return;
  }

  const providerConfig = resolveTutorProviderConfig(process.env);
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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
    review = {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item) => typeof item === "string" && item.trim()).slice(0, 6) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((item) => typeof item === "string" && item.trim()).slice(0, 6) : [],
      suggestedModules: Array.isArray(parsed.suggestedModules) ? parsed.suggestedModules.filter((item) => typeof item === "string" && item.trim()).slice(0, 8) : []
    };
    if (!review.strengths.length || !review.gaps.length || !review.suggestedModules.length) {
      throw new Error("Assessment review requires strengths, gaps, and suggestedModules.");
    }
  } catch (error) {
    console.error("Assessment review validation failed", error instanceof Error ? error.message : error);
    sendJson(response, 502, { error: "AI assessment review returned invalid content." });
    return;
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

  const providerConfig = resolveTutorProviderConfig(process.env);
  let content;
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
      try {
        const skeleton = createGeneratedCourseSkeletonFromOutline(courseOutline, {
          subject,
          assessmentReview,
          courseBlueprint,
          ragSources: retrievedContext
        });
        for (let moduleIndex = 0; moduleIndex < Math.min(1, skeleton.modules.length); moduleIndex += 1) {
          const modulePrompt = buildAssessmentModuleContentPrompt({ subject, answers, assessmentReview, courseOutline, courseBlueprint, retrievedContext, moduleIndex });
          const moduleResult = await requestCourseGenerationJson({ config: providerConfig, prompt: modulePrompt, maxTokens: 6500 });
          if (!moduleResult.ok) throw new Error(moduleResult.error ?? `Module ${moduleIndex + 1} generation failed.`);
          skeleton.modules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(moduleResult.text), skeleton.modules[moduleIndex], moduleIndex);
        }
        content = normalizeGeneratedCourseContent(skeleton);
      } catch (error) {
        console.error("Assessment module content generation failed", error instanceof Error ? error.message : error);
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
      if (qualityWarnings.length) {
        console.warn("Assessment course generation quality warnings", qualityWarnings.slice(0, 8));
      }
      if (hasBlockingGeneratedCourseQualityWarnings(qualityWarnings)) {
        try {
          const repairedModules = [...(content.modules ?? [])];
          for (const [moduleIndex, moduleWarnings] of groupGeneratedCourseWarningsByModule(qualityWarnings).entries()) {
            const module = repairedModules[moduleIndex];
            if (!module) continue;
            const repairPrompt = buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex, qualityWarnings: moduleWarnings });
            const repairResult = await requestCourseGenerationJson({ config: providerConfig, prompt: repairPrompt, maxTokens: 6500 });
            if (!repairResult.ok) throw new Error(repairResult.error ?? `Module ${moduleIndex + 1} repair failed.`);
            repairedModules[moduleIndex] = extractGeneratedModuleFromResponse(parseJsonObject(repairResult.text), module, moduleIndex);
          }
          const repairedContent = normalizeGeneratedCourseContent({ ...content, modules: repairedModules });
          const repairedWarnings = validateGeneratedCourseQuality(repairedContent);
          if (repairedWarnings.length) {
            console.warn("Assessment course repair quality warnings", repairedWarnings.slice(0, 8));
          }
          content = hasBlockingGeneratedCourseQualityWarnings(repairedWarnings) ? null : repairedContent;
          qualityWarnings = repairedWarnings;
        } catch (error) {
          console.error("Assessment course repair failed", error instanceof Error ? error.message : error);
          content = null;
        }
      }
    }
  }

  if (!content) {
    sendJson(response, 502, { error: "AI course generation failed." });
    return;
  }
  await recordUsageEvent(admin, {
    userId: user.id,
    courseId: null,
    model: providerConfig.model,
    status: "success"
  });
  await persistAssessmentAndLearnerProfile(admin, user.id, { subject, answers, assessmentReview, content });
  sendJson(response, 200, { content, source: "ai" });
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

  const providerConfig = resolveTutorProviderConfig(process.env);
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

  const { data, error } = await admin
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { subscription: formatSubscriptionState(data) });
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
    admin.from("xp_ledger").select("id,language,xp,difficulty,earned_on,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    admin.from("user_badges").select("badge_key,earned_at").eq("user_id", user.id).order("earned_at", { ascending: true }),
    admin.from("courses").select("id,required_section_count").eq("user_id", user.id),
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
  const timezone = profileResult.data?.timezone ?? "UTC";
  const nowDateKey = getDateKeyInTimezone(timezone);
  const { data: dailyState } = await admin.from("exercise_daily_state")
    .select("completed_count,skip_used")
    .eq("user_id", user.id)
    .eq("activity_date", nowDateKey)
    .maybeSingle();
  const badges = normalizeBadgeRows(badgesResult.data ?? []);

  sendJson(response, 200, {
    progression: {
      ...buildProgressionSummary({
        activity: activityResult.data ?? [],
        badges,
        equippedBadgeId: profileResult.data?.equipped_badge_id ?? null,
        completedCourses,
        nowDateKey
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

  const definition = await resolveProgressionExerciseDefinition(admin, source, exerciseKey, courseId);
  if (!definition) {
    sendJson(response, 400, { error: "Invalid exercise action." });
    return;
  }

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
      language: definition.language,
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
    const providerConfig = resolveTutorProviderConfig(process.env);
    if (providerConfig.error) {
      sendJson(response, 503, { error: providerConfig.error });
      return;
    }
    const gradeResponse = await requestChatExerciseGrade({
      config: providerConfig,
      answer: String(body?.submission?.answer ?? "").slice(0, 4000),
      prompt: body?.submission?.prompt || definition.prompt,
      rubric: body?.submission?.rubric || definition.rubric
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
    passed = action === "complete" && gradeGeneratedCodeExercise(body?.submission?.code, definition);
    feedback = passed ? "Editor exercise verified." : "Not enough yet. Update the active IDE file and try again.";
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
      language: definition.language,
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
  const plan = source === "independent" ? await readUserPlan(admin, user.id) : "pro";
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
    dailyLimit
  });
  if (awardResult.error) {
    sendJson(response, awardResult.status, { error: awardResult.error });
    return;
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
    return source === "course-chat"
      ? {
          ...staticDefinition,
          kind: "chat",
          prompt: "What should a function that returns the first array element return for an empty array, and why?",
          rubric: "Pass only when the learner identifies a deliberate empty-array result and gives coherent reasoning."
        }
      : staticDefinition;
  }
  if (!courseId || (source !== "course-mcq" && source !== "course-chat")) return null;

  const { data, error } = await admin.from("courses").select("course_content,languages").eq("id", courseId).maybeSingle();
  if (error || !data?.course_content) return null;

  const fallbackLanguage = Array.isArray(data.languages) && data.languages[0] ? data.languages[0] : "JavaScript";
  const exercises = flattenGeneratedExercises(data.course_content);
  for (const exercise of exercises) {
    if (source === "course-mcq" && exercise.type === "mcq" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "mcq")) {
      return {
        kind: "mcq",
        source,
        key: exerciseKey,
        language: fallbackLanguage,
        difficulty: "Beginner",
        xp: 10,
        correctAnswerIndex: exercise.correctOptionIndex,
        explanation: exercise.explanation
      };
    }
    if (source === "course-chat" && exercise.type === "chat" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "chat")) {
      return {
        kind: "chat",
        source,
        key: exerciseKey,
        language: fallbackLanguage,
        difficulty: "Beginner",
        xp: 10,
        prompt: exercise.prompt,
        rubric: exercise.rubric
      };
    }
    if (source === "course-chat" && exercise.type === "code" && matchesGeneratedExerciseKey(exerciseKey, exercise.keyBase, exercise.legacyKeyBase, "code")) {
      return {
        kind: "code",
        source,
        key: exerciseKey,
        language: exercise.language || fallbackLanguage,
        difficulty: "Beginner",
        xp: 20,
        prompt: exercise.prompt,
        acceptanceCriteria: exercise.acceptanceCriteria
      };
    }
  }
  return null;
}

function flattenGeneratedExercises(content) {
  if (content?.schemaVersion === "course-content/v2") {
    return (content.modules ?? []).flatMap((module) =>
      (module.topics ?? []).flatMap((topic) =>
        (topic.blocks ?? []).flatMap((block) =>
          (block.steps ?? []).map((step, stepIndex) => {
            const keyBase = `${block.id}:${stepIndex}`;
            if (step?.type === "mcq") return { type: "mcq", keyBase, legacyKeyBase: block.id, correctOptionIndex: step.correctOptionIndex, explanation: step.explanation };
            if (step?.type === "reflection") return { type: "chat", keyBase, legacyKeyBase: block.id, prompt: step.prompt, rubric: step.rubric };
            if (step?.type === "workshop" || step?.type === "lab" || step?.type === "project") {
              return {
                type: "code",
                keyBase,
                legacyKeyBase: block.id,
                prompt: step.prompt,
                language: step.language,
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
  if (normalizedCode.length < 24) return false;
  if (!/[=;{}()]|\b(console|return|def|function|const|let|class|static|void|func|fn)\b/i.test(normalizedCode)) return false;
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
  return (code.match(/console\.(log|write|writeline)\s*\(|print\s*\(|system\.out\.println|std::cout|printf\s*\(|fmt\.println|println!|puts\s+|echo\s+/gi) ?? []).length;
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
  dailyLimit
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
  if (source === "independent") {
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
    language: definition.language,
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
      language: definition.language,
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
    }, { onConflict: "user_id,badge_key" }),
    admin.from("profiles").update({
      equipped_badge_id: "first-steps",
      updated_at: now
    }).eq("id", userId).is("equipped_badge_id", null)
  ];
  if (source === "independent") {
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

async function handleEquipProgressionTitle({ admin, user }, request, response) {
  const body = await readJsonBody(request);
  const badgeId = body?.badgeId;
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
  sendJson(response, 200, { completed: true });
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
    console.warn("Learner profile read failed", error.message);
    return null;
  }
  return data ?? null;
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
  const { count, error: countError } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (countError) {
    sendJson(response, 500, { error: countError.message });
    return;
  }

  const activeCourseCount = count ?? 0;
  const limit = resolvePlanLimit(plan);
  if (!canCreateActiveCourse(plan, activeCourseCount)) {
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
    required_section_count: draft.syllabus.length
  };
  const generatedPayload = draft.courseContent
    ? {
        course_content: draft.courseContent,
        languages: Array.isArray(draft.languages) ? draft.languages : [],
        tags: Array.isArray(draft.tags) ? draft.tags : [],
        content_generation_state: draft.courseContent.schemaVersion === "course-content/v2" ? "full_course" : "first_chapter"
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
    activeCourseCount: activeCourseCount + 1,
    activeCourseLimit: limit.activeCourseLimit
  });
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
  const plan = normalizePlanTier(body?.plan ?? "basic");
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
  return error;
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
    normalizeGeneratedCourseContent(draft.courseContent);
    return true;
  } catch {
    return false;
  }
}

function formatGeneratedContentSchemaError(error) {
  const message = error?.message ?? "Course persistence failed.";
  if (/course_content|languages|tags|content_generation_state|required_section_count|schema cache/i.test(message)) {
    return "Generated course persistence migration is missing. Apply the pending Supabase generated-course-content migration, then retry.";
  }
  return message;
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
