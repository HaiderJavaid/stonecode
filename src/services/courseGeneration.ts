import { GeneratedCourseContent, GeneratedGuidedProjectContentV1, GeneratedLearningContent, LearningBrief } from "@/data/courses";
import { supabase } from "@/lib/supabaseClient";

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
  brief: LearningBrief | null;
  draftBrief: Partial<LearningBrief> | null;
  missingFields: string[];
  nextAction: "clarify" | "confirm" | "assessment_offer" | "assessment_plan";
};

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
  const token = await readAccessToken("discover a course goal");
  const response = await fetch("/api/course-generation/discovery-turn", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to continue course discovery.");
  return payload;
}

export async function requestCourseSetupReply(input: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  answerCount: number;
}): Promise<{ reply: string; source: "ai" }> {
  const token = await readAccessToken("continue course setup");
  const response = await fetch("/api/course-generation/setup-reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to continue course setup.");
  return payload;
}

export async function requestGeneratedCoursePreview(input: {
  objective: string;
  level: string;
  outcome: string;
  amendments: string[];
}): Promise<{ content: GeneratedCourseContent; source: "ai" }> {
  const token = await readAccessToken("generate a course");
  const response = await fetch("/api/course-generation/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to generate course preview.");
  return payload;
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
  const token = await readAccessToken("plan an assessment");
  const response = await fetch("/api/course-generation/assessment-plan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to plan assessment.");
  return payload;
}

export async function requestLearningAssessmentPlan(input: { brief: LearningBrief }): Promise<{ plan: AssessmentPlan; source: "ai" }> {
  return requestLearningJson("/api/learning/assessment-plan", input, "plan prerequisite assessment");
}

export async function requestAssessmentQuestion(input: {
  subject: string;
  step: number;
  answers: AssessmentAnswer[];
}): Promise<{ question: AssessmentQuestion; source: "ai" }> {
  const token = await readAccessToken("generate an assessment question");
  const response = await fetch("/api/course-generation/assessment-question", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to generate assessment question.");
  return payload;
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
  const token = await readAccessToken("review assessment");
  const response = await fetch("/api/course-generation/assessment-review", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to review assessment.");
  return payload;
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
  const token = await readAccessToken("generate a course from assessment");
  const response = await fetch("/api/course-generation/from-assessment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to generate course.");
  return payload;
}

export async function requestGeneratedChapter(input: {
  courseId: string;
  content: GeneratedCourseContent;
  chapterIndex: number;
}): Promise<{ content: GeneratedCourseContent; source: "ai" }> {
  const token = await readAccessToken("generate a chapter");
  const response = await fetch("/api/course-generation/chapter", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to generate chapter.");
  return payload;
}

async function readAccessToken(action: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error(error?.message ?? `Authentication is required to ${action}.`);
  return token;
}

async function requestLearningJson<T>(path: string, input: unknown, action: string): Promise<T> {
  const token = await readAccessToken(action);
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `Failed to ${action}.`);
  return payload as T;
}
