import { selectCuratedRagChunks } from "../rag/curriculum-sources.mjs";

function trimText(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => trimText(value, "")).filter(Boolean))];
}

function formatAssessmentAnswer(answer) {
  if (answer?.skipped) return "I don't know / skipped";
  if (typeof answer?.answer === "number" && Array.isArray(answer.options)) {
    return trimText(answer.options[answer.answer], String(answer.answer));
  }
  if (answer?.answer === null || answer?.answer === undefined) return "";
  return trimText(String(answer.answer), "");
}

export function buildLearnerGenerationContext({ subject, answers = [], assessmentReview }) {
  const prerequisiteAnswers = answers.filter((answer) => answer?.questionKind !== "course_shaping");
  const shapingAnswers = answers.filter((answer) => answer?.questionKind === "course_shaping");
  const weakSignals = prerequisiteAnswers
    .filter((answer) => answer?.skipped || answer?.isCorrect === false)
    .map((answer) => ({
      questionId: trimText(answer.questionId, "unknown"),
      prompt: trimText(answer.prompt, ""),
      answer: formatAssessmentAnswer(answer),
      skipped: Boolean(answer.skipped)
    }))
    .filter((signal) => signal.prompt)
    .slice(0, 6);
  const strongSignals = prerequisiteAnswers
    .filter((answer) => answer?.isCorrect === true)
    .map((answer) => trimText(answer.prompt, ""))
    .filter(Boolean)
    .slice(0, 5);
  const preferences = shapingAnswers
    .map((answer) => ({
      questionId: trimText(answer.questionId, "preference"),
      prompt: trimText(answer.prompt, ""),
      answer: formatAssessmentAnswer(answer)
    }))
    .filter((preference) => preference.prompt && preference.answer)
    .slice(0, 5);
  const readiness = weakSignals.length >= 2
    ? "missing_prereqs"
    : weakSignals.length === 1
      ? "needs_bridging"
      : strongSignals.length
        ? "ready"
        : "unknown";
  const refresher = weakSignals.length
    ? {
        needed: true,
        scope: "Only prerequisites directly required by the requested advanced/applied subject.",
        evidence: weakSignals.map((signal) => signal.prompt).slice(0, 4)
      }
    : {
        needed: false,
        scope: "Do not add a generic refresher when prerequisite evidence is strong.",
        evidence: []
      };

  return {
    subject: trimText(subject, "Programming"),
    readiness,
    refresher,
    strengths: uniqueStrings(assessmentReview?.strengths).slice(0, 6),
    gaps: uniqueStrings(assessmentReview?.gaps).slice(0, 6),
    suggestedModules: uniqueStrings(assessmentReview?.suggestedModules).slice(0, 8),
    weakSignals,
    strongSignals,
    preferences
  };
}

export function retrieveStaticCourseGenerationContext({ subject, learnerContext }) {
  const normalizedSubject = trimText(subject, "Programming");
  const needsBridge = learnerContext?.readiness === "missing_prereqs" || learnerContext?.readiness === "needs_bridging";
  const chunks = selectCuratedRagChunks({ subject: normalizedSubject, task: "course-generation", limit: 9 });

  if (needsBridge) {
    chunks.push({
      id: "prerequisite-bridge",
      sourceType: "stonecode-curriculum",
      kind: "curriculum-pattern",
      title: "Prerequisite bridge pattern",
      content: `For ${normalizedSubject}, start with the smallest missing prerequisite before target-topic depth. Use tiny input-rule-output examples, syntax recognition, and feedback-loop practice before harder workshops.`
    });
  }

  return chunks;
}

export function formatStaticCourseGenerationContext(chunks) {
  return chunks
    .map((chunk) => `- ${chunk.kind}${chunk.blockKind ? `/${chunk.blockKind}` : ""}: ${chunk.title} — ${chunk.content}`)
    .join("\n");
}
