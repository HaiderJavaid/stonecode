import { GeneratedCourseContent, GeneratedGuidedProjectContentV1, GeneratedLearningContent, LearningBrief } from "@/data/courses";
import { authenticatedJson } from "@/services/authenticatedApi";

export const pendingGenerationJobStorageKey = "stonecode.pendingGenerationJob.v1";

export function rememberPendingGenerationJob(jobId: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(pendingGenerationJobStorageKey, jobId);
}

export function readPendingGenerationJob() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(pendingGenerationJobStorageKey);
}

export function clearPendingGenerationJob(jobId?: string) {
  if (typeof window === "undefined") return;
  if (jobId && window.localStorage.getItem(pendingGenerationJobStorageKey) !== jobId) return;
  window.localStorage.removeItem(pendingGenerationJobStorageKey);
}

export type CourseDiscoveryTurn = {
  status: "clarifying" | "ready" | "unsupported";
  reply: string;
  suggestions: string[];
  resolvedSubject: string;
};

export type LearningDiscoveryTurn = {
  status: "clarifying" | "ready" | "unsupported";
  reply: string;
  suggestions: string[];
  selectionMode?: "single" | "multi";
  brief: LearningBrief | null;
  draftBrief: Partial<LearningBrief> | null;
  missingFields: string[];
  questionField: string | null;
  responseTurn: number;
  nextAction: "clarify" | "confirm" | "assessment_offer" | "assessment_plan";
};

export type LearningProposalItem = {
  id: string;
  title: string;
  summary: string;
  stepCount: number;
  fileCount: number;
};

export type LearningProposal = {
  id: string;
  schemaVersion: "learning-proposal/v1";
  status: "draft" | "finalized" | "cancelled" | "expired";
  type: "course" | "project" | "exercise";
  domainId: LearningBrief["domainId"];
  technologyId: string | null;
  focusAreas: string[];
  title: string;
  summary: string;
  technology: string;
  outcomes: string[];
  items: LearningProposalItem[];
  totals: { modules: number; steps: number; files: number; exercises: number };
  creditQuote: { version: "credit-quote/v1"; credits: number; currency: "stonecode_credit" };
  quoteId: string;
  brief: LearningBrief;
};

export type GenerationJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  result_course_id: string | null;
  error_code: string | null;
  error_message: string | null;
};

export function generationJobFailureMessage(job: GenerationJob) {
  const reference = job.id ? ` Reference: ${job.id.slice(0, 8)}.` : "";
  if (job.error_code === "generation_validation_failed") {
    return `Stonecode could not finish this course safely after automatic repair. Reserved Stones were returned.${reference}`;
  }
  if (job.error_code === "generation_scope_mismatch") {
    return `Stonecode could not deliver every module promised in the approved outline. Nothing partial was saved and reserved Stones were returned.${reference}`;
  }
  if (job.error_code === "generation_job_stale") {
    return `Course generation stopped responding. Reserved Stones were returned.${reference}`;
  }
  return job.error_message || `Learning-path generation failed. Reserved Stones were returned.${reference}`;
}

export async function requestProductFeatures(): Promise<{ features: Record<string, boolean> }> {
  const response = await fetch("/api/features");
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to load product features.");
  return payload;
}

export async function requestLearningProposal(input: { brief: LearningBrief; idempotencyKey: string }): Promise<{ proposal: LearningProposal }> {
  return requestLearningJson("/api/learning/proposals", input, "create a learning proposal");
}

export async function patchLearningProposal(input: { proposalId: string; proposal: Partial<LearningProposal>; idempotencyKey: string }): Promise<{ proposal: LearningProposal }> {
  return requestLearningJson(`/api/learning/proposals/${encodeURIComponent(input.proposalId)}`, {
    proposal: input.proposal,
    idempotencyKey: input.idempotencyKey
  }, "update the learning proposal", "PATCH");
}

export async function finalizeLearningProposal(input: { proposalId: string; idempotencyKey: string }): Promise<{ job: GenerationJob }> {
  return requestLearningJson(`/api/learning/proposals/${encodeURIComponent(input.proposalId)}/finalize`, {
    idempotencyKey: input.idempotencyKey
  }, "finalize the learning proposal");
}

export async function requestGenerationJob(jobId: string): Promise<{ job: GenerationJob }> {
  return authenticatedJson(`/api/generation-jobs/${encodeURIComponent(jobId)}`, {}, "check generation progress");
}

export async function requestLearningDiscoveryTurn(input: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  turn: number;
}): Promise<{ discovery: LearningDiscoveryTurn; source: "ai" }> {
  return requestLearningJson("/api/learning/discovery-turn", input, "continue learning discovery");
}

export async function requestCourseDiscoveryTurn(input: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  turn: number;
}): Promise<{ discovery: CourseDiscoveryTurn; source: "ai" }> {
  return authenticatedJson("/api/course-generation/discovery-turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "discover a course goal");
}

export async function requestCourseSetupReply(input: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  answerCount: number;
}): Promise<{ reply: string; source: "ai" }> {
  return authenticatedJson("/api/course-generation/setup-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "continue course setup");
}

export async function requestGeneratedCoursePreview(input: {
  objective: string;
  level: string;
  outcome: string;
  amendments: string[];
}): Promise<{ content: GeneratedCourseContent; source: "ai" }> {
  return authenticatedJson("/api/course-generation/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "generate a course preview");
}

export type AssessmentAnswer = {
  questionId: string;
  type: "mcq" | "writing" | "code";
  questionKind?: "prerequisite" | "course_shaping";
  assessmentArea?: string;
  difficulty?: "entry" | "basic" | "mid";
  answer: string | number | null;
  prompt?: string;
  options?: string[];
  correctOptionIndex?: number;
  isCorrect?: boolean;
  skipped?: boolean;
};

export type AssessmentQuestion =
  | { id: string; type: "mcq"; questionKind?: "prerequisite" | "course_shaping"; assessmentArea?: string; difficulty?: "entry" | "basic" | "mid"; prompt: string; options: string[]; correctOptionIndex?: number }
  | { id: string; type: "writing"; prompt: string }
  | { id: string; type: "code"; prompt: string; language: string; starterCode: string };

export type AssessmentReview = {
  strengths: string[];
  gaps: string[];
  suggestedModules: string[];
};

export type AssessmentPlan = {
  supported: boolean;
  reason: string;
  targetSubject: string;
  courseCategory: "fundamentals" | "framework" | "library" | "game-dev" | "web-dev" | "backend" | "fullstack" | "data" | "automation" | "other-code";
  requiresAssessment: boolean;
  prerequisiteAreas: Array<{
    id: string;
    title: string;
    reason: string;
    startingDifficulty: "entry" | "basic" | "mid";
  }>;
};

export async function requestAssessmentPlan(input: {
  subject: string;
}): Promise<{ plan: AssessmentPlan; source: "ai" }> {
  return authenticatedJson("/api/course-generation/assessment-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "plan an assessment");
}

export async function requestLearningAssessmentPlan(input: { brief: LearningBrief }): Promise<{ plan: AssessmentPlan; source: "ai" }> {
  return requestLearningJson("/api/learning/assessment-plan", input, "plan prerequisite assessment");
}

export async function requestAssessmentQuestion(input: {
  subject: string;
  step: number;
  answers: AssessmentAnswer[];
}): Promise<{ question: AssessmentQuestion; source: "ai" }> {
  return authenticatedJson("/api/course-generation/assessment-question", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "generate an assessment question");
}

export async function requestLearningAssessmentQuestion(input: {
  brief: LearningBrief;
  step: number;
  answers: AssessmentAnswer[];
}): Promise<{ question: AssessmentQuestion; source: "ai" }> {
  return requestLearningJson("/api/learning/assessment-question", input, "generate an assessment question");
}

export async function requestAssessmentReview(input: {
  subject: string;
  answers: AssessmentAnswer[];
}): Promise<{ review: AssessmentReview; source: "ai" }> {
  return authenticatedJson("/api/course-generation/assessment-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "review an assessment");
}

export async function requestLearningAssessmentReview(input: {
  brief: LearningBrief;
  answers: AssessmentAnswer[];
}): Promise<{ review: AssessmentReview; source: "ai" }> {
  return requestLearningJson("/api/learning/assessment-review", input, "review prerequisite assessment");
}

export async function requestGeneratedLearningExperience(input: {
  brief: LearningBrief;
  answers: AssessmentAnswer[];
  assessmentReview: AssessmentReview;
}): Promise<{ content: GeneratedLearningContent; source: "ai"; warnings?: Array<{ code: string; message: string }> }> {
  return requestLearningJson("/api/learning/generate", input, "generate a learning experience");
}

export async function requestGeneratedProjectMilestone(input: {
  courseId: string;
  content: GeneratedGuidedProjectContentV1;
  milestoneIndex: number;
}): Promise<{ content: GeneratedGuidedProjectContentV1; source: "ai" }> {
  return requestLearningJson("/api/learning/project/milestone", input, "generate the next project milestone");
}

export async function requestGeneratedCourseFromAssessment(input: {
  subject: string;
  answers: AssessmentAnswer[];
  assessmentReview: AssessmentReview;
}): Promise<{ content: GeneratedCourseContent; source: "ai"; warnings?: Array<{ code: string; message: string }> }> {
  return authenticatedJson("/api/course-generation/from-assessment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "generate a course from assessment");
}

export async function requestGeneratedChapter(input: {
  courseId: string;
  content: GeneratedCourseContent;
  chapterIndex: number;
}): Promise<{ content: GeneratedCourseContent; source: "ai" }> {
  return authenticatedJson("/api/course-generation/chapter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "generate a chapter");
}

async function requestLearningJson<T>(path: string, input: unknown, action: string, method = "POST"): Promise<T> {
  return authenticatedJson<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, action);
}
