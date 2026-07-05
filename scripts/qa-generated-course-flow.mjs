import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCourseBlueprintPrompt,
  buildAssessmentCourseOutlinePrompt,
  buildAssessmentModuleContentPrompt,
  buildAssessmentQuestionPrompt,
  buildAssessmentReviewPrompt,
  buildGeneratedModuleRepairPrompt,
  createGeneratedCourseSkeletonFromOutline,
  extractGeneratedModuleFromResponse,
  createFallbackAssessmentReview,
  normalizeAssessmentQuestion,
  normalizeGeneratedCourseContent,
  retrieveStaticCourseGenerationContext,
  buildLearnerGenerationContext,
  stabilizeAssessmentQuestion
} from "../server/course-generation.mjs";
import { requestCourseGenerationJson, resolveTutorProviderConfig } from "../server/llm-providers.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  hasBlockingGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "../server/course-generation-quality.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const subject = args.subject ?? "JavaScript fundamentals";
const profile = args.profile ?? "struggling";
const assessmentSteps = Number(args.steps ?? 5);
const outDir = resolve(root, args.outDir ?? "output/qa/generated-course-flow");
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(subject)}-${profile}`;
const artifactDir = join(outDir, runId);
mkdirSync(artifactDir, { recursive: true });

const providerConfig = resolveTutorProviderConfig(process.env);
if (providerConfig.error) {
  throw new Error(providerConfig.error);
}

const report = {
  runId,
  subject,
  profile,
  model: providerConfig.model,
  phases: [],
  answers: [],
  review: null,
  metrics: null,
  qualityWarnings: [],
  blockingWarnings: [],
  artifacts: {}
};

try {
  const questions = [];
  for (let step = 0; step < assessmentSteps; step += 1) {
    const prompt = buildAssessmentQuestionPrompt({ subject, step, answers: report.answers });
    const result = await requestCourseGenerationJson({ config: providerConfig, prompt, maxTokens: 450 });
    const question = stabilizeAssessmentQuestion({
      question: normalizeAssessmentQuestion(parseJsonObjectOrThrow(result, `assessment question ${step + 1}`), subject, step),
      subject,
      step,
      answers: report.answers
    });
    const answer = simulateAssessmentAnswer(question, profile, step);
    questions.push(question);
    report.answers.push(answer);
    report.phases.push({ phase: `assessment-question-${step + 1}`, ok: true, source: "ai" });
  }
  writeArtifact("assessment-questions.json", questions);
  writeArtifact("assessment-answers.json", report.answers);

  const reviewPrompt = buildAssessmentReviewPrompt({ subject, answers: report.answers });
  const reviewResult = await requestCourseGenerationJson({ config: providerConfig, prompt: reviewPrompt, maxTokens: 900 });
  report.review = normalizeAssessmentReview(parseJsonObjectOrThrow(reviewResult, "assessment review"), subject, report.answers);
  report.phases.push({ phase: "assessment-review", ok: true, source: "ai" });
  writeArtifact("assessment-review.json", report.review);

  const learnerContext = buildLearnerGenerationContext({ subject, answers: report.answers, assessmentReview: report.review });
  const retrievedContext = retrieveStaticCourseGenerationContext({ subject, learnerContext });
  writeArtifact("retrieved-context.json", retrievedContext);

  const blueprintPrompt = buildCourseBlueprintPrompt({ subject, answers: report.answers, assessmentReview: report.review, learnerContext, retrievedContext });
  const blueprintResult = await requestCourseGenerationJson({ config: providerConfig, prompt: blueprintPrompt, maxTokens: 1600 });
  const rawBlueprint = parseJsonObjectOrThrow(blueprintResult, "course blueprint");
  const courseBlueprint = rawBlueprint.courseBlueprint ?? rawBlueprint;
  report.phases.push({ phase: "course-blueprint", ok: true, source: "ai" });
  writeArtifact("course-blueprint.raw.json", rawBlueprint);

  const outlinePrompt = buildAssessmentCourseOutlinePrompt({ subject, answers: report.answers, assessmentReview: report.review, courseBlueprint, retrievedContext });
  const outlineResult = await requestCourseGenerationJson({ config: providerConfig, prompt: outlinePrompt, maxTokens: 2600 });
  const outline = parseJsonObjectOrThrow(outlineResult, "course outline");
  report.phases.push({ phase: "course-outline", ok: true, source: "ai" });
  writeArtifact("course-outline.raw.json", outline);

  const skeleton = createGeneratedCourseSkeletonFromOutline(outline, { subject, assessmentReview: report.review, courseBlueprint, ragSources: retrievedContext });
  for (let moduleIndex = 0; moduleIndex < Math.min(2, skeleton.modules.length); moduleIndex += 1) {
    const modulePrompt = buildAssessmentModuleContentPrompt({
      subject,
      answers: report.answers,
      assessmentReview: report.review,
      courseOutline: outline,
      courseBlueprint,
      retrievedContext,
      moduleIndex
    });
    const moduleResult = await requestCourseGenerationJson({ config: providerConfig, prompt: modulePrompt, maxTokens: 6500 });
    const rawModuleResponse = parseJsonObjectOrThrow(moduleResult, `loaded module ${moduleIndex + 1}`);
    writeArtifact(`loaded-module-${moduleIndex + 1}.raw.json`, rawModuleResponse);
    skeleton.modules[moduleIndex] = extractGeneratedModuleFromResponse(
      rawModuleResponse,
      skeleton.modules[moduleIndex],
      moduleIndex
    );
    report.phases.push({ phase: `loaded-module-${moduleIndex + 1}`, ok: true, source: "ai" });
  }
  let content = normalizeGeneratedCourseContent(skeleton);
  report.phases.push({ phase: "loaded-course-assembly", ok: true, source: "local" });

  let qualityWarnings = validateGeneratedCourseQuality(content);
  report.qualityWarnings = qualityWarnings;
  report.blockingWarnings = qualityWarnings.filter((warning) =>
    hasBlockingGeneratedCourseQualityWarnings([warning])
  );
  report.metrics = collectCourseMetrics(content);
  writeArtifact("generated-course.pre-repair.json", content);
  writeArtifact("quality-warnings.pre-repair.json", qualityWarnings);
  if (hasBlockingGeneratedCourseQualityWarnings(qualityWarnings)) {
    report.phases.push({ phase: "quality-check-before-repair", ok: false, warningCount: qualityWarnings.length });
    const repairedModules = [...(content.modules ?? [])];
    for (const [moduleIndex, moduleWarnings] of groupGeneratedCourseWarningsByModule(qualityWarnings).entries()) {
      const module = repairedModules[moduleIndex];
      if (!module) continue;
      const repairPrompt = buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex, qualityWarnings: moduleWarnings });
      const repairResult = await requestCourseGenerationJson({ config: providerConfig, prompt: repairPrompt, maxTokens: 6500 });
      const rawRepair = parseJsonObjectOrThrow(repairResult, `module ${moduleIndex + 1} repair`);
      writeArtifact(`repair-module-${moduleIndex + 1}.raw.json`, rawRepair);
      repairedModules[moduleIndex] = extractGeneratedModuleFromResponse(rawRepair, module, moduleIndex);
      report.phases.push({
        phase: `repair-module-${moduleIndex + 1}`,
        ok: true,
        source: "ai",
        warningCount: moduleWarnings.length
      });
    }
    content = normalizeGeneratedCourseContent({ ...content, modules: repairedModules });
    qualityWarnings = validateGeneratedCourseQuality(content);
    report.phases.push({
      phase: "quality-check-after-repair",
      ok: !hasBlockingGeneratedCourseQualityWarnings(qualityWarnings),
      warningCount: qualityWarnings.length,
      source: "local"
    });
  } else {
    report.phases.push({ phase: "quality-check-before-repair", ok: true, warningCount: qualityWarnings.length });
  }

  report.qualityWarnings = qualityWarnings;
  report.blockingWarnings = qualityWarnings.filter((warning) =>
    hasBlockingGeneratedCourseQualityWarnings([warning])
  );
  report.metrics = collectCourseMetrics(content);
  writeArtifact("generated-course.final.json", content);
  writeArtifact("quality-warnings.json", qualityWarnings);
  writeArtifact("qa-report.json", report);
  writeArtifact("qa-report.md", renderMarkdownReport(report));
  printConsoleSummary(report);
} catch (error) {
  report.phases.push({ phase: "failed", ok: false, error: error instanceof Error ? error.message : String(error) });
  writeArtifact("qa-report.json", report);
  writeArtifact("qa-report.md", renderMarkdownReport(report));
  throw error;
}

function simulateAssessmentAnswer(question, selectedProfile, step) {
  if (question.questionKind === "course_shaping") {
    const preferredIndex = findPreferredOption(question.options);
    return createAnswer(question, preferredIndex, false);
  }

  if (selectedProfile === "ready") return createAnswer(question, question.correctOptionIndex, false);
  if (selectedProfile === "mixed") {
    if (step === 1) return createAnswer(question, null, true);
    return createAnswer(question, step % 3 === 0 ? firstWrongIndex(question) : question.correctOptionIndex, false);
  }
  if (step === 0) return createAnswer(question, null, true);
  if (step === 1 || step === 2) return createAnswer(question, firstWrongIndex(question), false);
  return createAnswer(question, question.correctOptionIndex, false);
}

function createAnswer(question, answer, skipped) {
  const isCourseShaping = question.questionKind === "course_shaping";
  return {
    questionId: question.id,
    type: question.type,
    questionKind: question.questionKind ?? "prerequisite",
    answer,
    prompt: question.prompt,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    isCorrect: isCourseShaping || skipped ? undefined : answer === question.correctOptionIndex,
    skipped
  };
}

function firstWrongIndex(question) {
  return question.options.findIndex((_, index) => index !== question.correctOptionIndex);
}

function findPreferredOption(options) {
  const preferred = options.findIndex((option) => /python|javascript|beginner|fundamental/i.test(option));
  return preferred >= 0 ? preferred : 0;
}

function normalizeAssessmentReview(input, fallbackSubject, answers) {
  const fallback = createFallbackAssessmentReview({ subject: fallbackSubject, answers });
  return {
    strengths: normalizeStringArray(input?.strengths, fallback.strengths, 6),
    gaps: normalizeStringArray(input?.gaps, fallback.gaps, 6),
    suggestedModules: normalizeStringArray(input?.suggestedModules, fallback.suggestedModules, 8)
  };
}

function collectCourseMetrics(content) {
  const topics = content.modules.flatMap((module) => module.topics);
  const blocks = topics.flatMap((topic) => topic.blocks);
  const steps = blocks.flatMap((block) => block.steps);
  const blockKinds = countBy(blocks, (block) => block.kind);
  const stepTypes = countBy(steps, (step) => step.type);
  const workshopStepCounts = blocks.filter((block) => block.kind === "workshop").map((block) => block.steps.length);
  return {
    modules: content.modules.length,
    unlockedModules: content.modules.filter((module) => module.unlocked).length,
    topics: topics.length,
    blocks: blocks.length,
    steps: steps.length,
    blockKinds,
    stepTypes,
    workshopStepCounts,
    minWorkshopSteps: workshopStepCounts.length ? Math.min(...workshopStepCounts) : null,
    maxWorkshopSteps: workshopStepCounts.length ? Math.max(...workshopStepCounts) : null
  };
}

function renderMarkdownReport(input) {
  const lines = [
    `# Generated Course QA`,
    ``,
    `- Run: ${input.runId}`,
    `- Subject: ${input.subject}`,
    `- Profile: ${input.profile}`,
    `- Model: ${input.model}`,
    `- Blocking warnings: ${input.blockingWarnings.length}`,
    `- Total warnings: ${input.qualityWarnings.length}`,
    ``,
    `## Phases`,
    ...input.phases.map((phase) => `- ${phase.ok ? "PASS" : "FAIL"} ${phase.phase}${phase.warningCount !== undefined ? ` (${phase.warningCount} warnings)` : ""}${phase.error ? `: ${phase.error}` : ""}`),
    ``,
    `## Metrics`,
    "```json",
    JSON.stringify(input.metrics, null, 2),
    "```",
    ``,
    `## Quality Warnings`,
    ...(input.qualityWarnings.length
      ? input.qualityWarnings.map((warning) => `- ${warning.code}: ${warning.message}`)
      : ["- none"])
  ];
  return `${lines.join("\n")}\n`;
}

function printConsoleSummary(input) {
  console.log(`Generated course QA saved to ${artifactDir}`);
  console.log(`Subject: ${input.subject}`);
  console.log(`Profile: ${input.profile}`);
  console.log(`Modules: ${input.metrics.modules}, topics: ${input.metrics.topics}, blocks: ${input.metrics.blocks}, steps: ${input.metrics.steps}`);
  console.log(`Block kinds: ${JSON.stringify(input.metrics.blockKinds)}`);
  console.log(`Warnings: ${input.qualityWarnings.length}, blocking: ${input.blockingWarnings.length}`);
  console.log(input.blockingWarnings.length ? "QA result: FAIL" : "QA result: PASS");
}

function parseJsonObjectOrThrow(result, label) {
  if (!result.ok) throw new Error(`${label} request failed: ${result.error ?? "unknown error"}`);
  const text = result.text;
  if (typeof text !== "string" || !text.trim()) throw new Error(`${label} returned empty output`);
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  throw new Error(`${label} did not include a JSON object`);
}

function writeArtifact(name, data) {
  const path = join(artifactDir, name);
  writeFileSync(path, typeof data === "string" ? data : `${JSON.stringify(data, null, 2)}\n`);
  report.artifacts[name] = path;
}

function normalizeStringArray(value, fallback, limit) {
  const items = Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
  return (items.length ? items : fallback).slice(0, limit);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--subject") parsed.subject = rawArgs[++index];
    else if (arg === "--profile") parsed.profile = rawArgs[++index];
    else if (arg === "--steps") parsed.steps = rawArgs[++index];
    else if (arg === "--out-dir") parsed.outDir = rawArgs[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run qa:generated-course-flow -- --subject "JavaScript fundamentals" --profile struggling

Options:
  --subject   Course subject to generate. Default: JavaScript fundamentals
  --profile   Simulated learner profile: struggling, mixed, ready. Default: struggling
  --steps     Assessment question count. Default: 5
  --out-dir   Artifact directory. Default: output/qa/generated-course-flow`);
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "course";
}
