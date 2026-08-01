import { findLearningDomain, findTechnology, normalizeProductExperienceType, quoteCreationCredits } from "../../shared/stonecode-product.mjs";
import {
  normalizeLearningBrief,
  resolveLearningBriefDomainId,
  resolveLearningBriefTechnologyId,
  subjectForLearningBrief
} from "./contracts.mjs";

export function buildLearningProposalPrompt(briefValue) {
  const brief = normalizeLearningBrief(briefValue);
  const type = normalizeProductExperienceType(brief.type);
  const domain = findLearningDomain(resolveLearningBriefDomainId(brief));
  const technology = findTechnology(resolveLearningBriefTechnologyId(brief));
  return `You are Stonecode's learning-path planner. Produce the exact editable proposal the learner will approve before credits are reserved.

Return strict JSON only:
{
  "title":"specific learning path title",
  "summary":"one concise outcome-focused paragraph",
  "type":"course|project|exercise",
  "domainId":"approved learning domain id",
  "technologyId":"selected runnable technology id or null for an approved conceptual Course",
  "technology":"display name of selected technology, or learning domain for a conceptual Course",
  "focusAreas":["confirmed learning area"],
  "outcomes":["concrete learner outcome"],
  "items":[{"title":"module, project step, or exercise group title","summary":"what is learned or built","stepCount":1,"fileCount":0}],
  "totalSteps":10,
  "totalFiles":0,
  "exerciseCount":0
}

Confirmed brief:
${JSON.stringify(brief)}

Rules:
- This is planning, not a knowledge test. Do not ask questions or include assessment exercises.
- Keep every explicit goal, technology, topic, preference, and prior-knowledge statement from the brief.
- type must be ${type}.
- Domain must remain ${domain?.displayName ?? "Programming"} (${domain?.id ?? "programming"}). ${technology ? `The selected runnable technology is ${technology.displayName} (${technology.id}).` : "This is an approved conceptual Course with no fake runtime."}
- Course: return 1-12 module items. Give every module 6-20 meaningful learner steps, keep the sum within 180, and make totalSteps equal the sum of item stepCount values. A compact concept still uses type course.
- Project: return 6-30 ordered build-step items and no more than 10 files.
- Exercise: return topic-group items and exactly 5-25 exercises matching the requested count.
- Use only plain code, approved browser frameworks/libraries, or headless language runtimes. No external engines, native GUI tools, or arbitrary packages.
- Conceptual Computer/IT or Internet/Web Courses may use theory, examples, quizzes, reviews, and tutor-diagram cues without code execution. Algorithms, data structures, math coding paths, projects, and coding exercises must use the selected runnable technology.
- Items must be concrete enough that the learner can judge the syllabus before spending credits.
- Do not generate visuals here. Curriculum generation later decides optional chat visual cues step by step.
- Do not include duration, schedule, study hours, dates, prices, or credit values.`;
}

export function normalizeLearningProposal(value, briefValue) {
  const brief = normalizeLearningBrief(briefValue);
  const type = normalizeProductExperienceType(brief.type);
  const domainId = resolveLearningBriefDomainId(brief);
  const domain = findLearningDomain(domainId);
  const technologyId = resolveLearningBriefTechnologyId(brief);
  const technology = findTechnology(technologyId);
  const rawItems = Array.isArray(value?.items) ? value.items : [];
  const courseItemStepMaximum = type === "course"
    ? Math.max(6, Math.min(20, Math.floor(180 / Math.max(rawItems.length, 1))))
    : 180;
  const items = rawItems.map((item, index) => ({
    id: cleanId(item?.id, `${type}-${index + 1}`),
    title: text(item?.title, `${type === "course" ? "Module" : type === "project" ? "Step" : "Exercise group"} ${index + 1}`, 120),
    summary: text(item?.summary, "Focused learning objective.", 320),
    stepCount: type === "course"
      ? integerRange(item?.stepCount, 8, 6, courseItemStepMaximum)
      : integer(item?.stepCount, type === "project" ? 1 : 0, 180),
    fileCount: integer(item?.fileCount, 0, 10)
  }));
  validateItemCount(type, items.length);

  const inferredSteps = items.reduce((total, item) => total + item.stepCount, 0);
  const totalSteps = type === "course"
    ? inferredSteps
    : integer(value?.totalSteps, inferredSteps || defaultSteps(type, items.length), 180);
  const totalFiles = integer(value?.totalFiles, Math.max(0, ...items.map((item) => item.fileCount)), 10);
  const exerciseCount = type === "exercise"
    ? integer(value?.exerciseCount, brief.exerciseCount ?? totalSteps, 25)
    : 0;
  const quote = quoteCreationCredits({
    type,
    domainId,
    technologyId: technologyId ?? null,
    focusAreas: uniqueStrings(brief.focusAreas).slice(0, 12),
    moduleCount: type === "course" ? items.length : undefined,
    stepCount: type === "exercise" ? undefined : totalSteps,
    fileCount: type === "project" ? totalFiles : undefined,
    exerciseCount: type === "exercise" ? exerciseCount : undefined
  });

  return {
    schemaVersion: "learning-proposal/v1",
    type,
    title: text(value?.title, subjectForLearningBrief(brief), 140),
    summary: text(value?.summary, brief.desiredOutcome || brief.goal, 600),
    technology: text(value?.technology, technology?.displayName || domain?.displayName || brief.subject || "Programming", 80),
    outcomes: uniqueStrings(value?.outcomes).slice(0, 8),
    items,
    totals: {
      modules: type === "course" ? items.length : 0,
      steps: totalSteps,
      files: totalFiles,
      exercises: exerciseCount
    },
    creditQuote: quote
  };
}

function validateItemCount(type, count) {
  const valid = type === "course" ? count >= 1 && count <= 12 : type === "project" ? count >= 6 && count <= 30 : count >= 1 && count <= 12;
  if (!valid) throw proposalError(`Invalid ${type} proposal item count.`);
}

function defaultSteps(type, itemCount) {
  if (type === "project") return itemCount;
  if (type === "course") return Math.min(180, Math.max(itemCount * 8, 8));
  return itemCount;
}

function integer(value, fallback, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= maximum ? number : fallback;
}

function integerRange(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number)) return Math.min(Math.max(fallback, minimum), maximum);
  return Math.min(Math.max(number, minimum), maximum);
}

function text(value, fallback, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback || "").slice(0, maximum);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value, "", 180)).filter(Boolean))];
}

function cleanId(value, fallback) {
  const id = text(value, fallback, 100).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return id || fallback;
}

function proposalError(message) {
  const error = new Error(message);
  error.code = "invalid_learning_proposal";
  return error;
}
