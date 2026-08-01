import { authenticatedJson } from "@/services/authenticatedApi";

export type ProgressionBadge = {
  id: string;
  title: string;
  description: string;
  earnedAt?: string;
};

export type ProgressionHeatmapDay = {
  date: string;
  xp: number;
  band: number;
  languages: Record<string, number>;
};

export type ProgressionAttempt = {
  source: "independent" | "course-mcq" | "course-chat";
  exercise_key: string;
  attempts: number;
  hint_used: boolean;
  hint_used_on?: string | null;
  status: "started" | "failed" | "completed" | "skipped";
  completed_at: string | null;
};

export type ProgressionSummary = {
  totalXp: number;
  solvedExercises: number;
  byDifficulty: Record<"Beginner" | "Intermediate" | "Advanced", number>;
  languageXp: Array<{ language: string; xp: number }>;
  skillBreakdown: Array<{
    skill: string;
    parentLanguage: string | null;
    solvedCount: number;
    xp: number;
    percentage: number;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    currentXp: number;
    requiredXp: number;
    qualifyingCompletions: number;
    requiredCompletions: number;
    languageXp: number;
    requiredLanguageXp: number;
    earned: boolean;
  }>;
  heatmap: ProgressionHeatmapDay[];
  currentStreak: number;
  longestStreak: number;
  completedCourses: number;
  badges: ProgressionBadge[];
  equippedBadgeId: string | null;
  equippedTitle: string | null;
  latestActivityAt: string | null;
  timezone: string;
  attempts: ProgressionAttempt[];
  dailyState: {
    completedCount: number;
    skipUsed: boolean;
  };
};

export const emptyProgression: ProgressionSummary = {
  totalXp: 0,
  solvedExercises: 0,
  byDifficulty: { Beginner: 0, Intermediate: 0, Advanced: 0 },
  languageXp: [],
  skillBreakdown: [],
  achievements: [],
  heatmap: [],
  currentStreak: 0,
  longestStreak: 0,
  completedCourses: 0,
  badges: [],
  equippedBadgeId: null,
  equippedTitle: null,
  latestActivityAt: null,
  timezone: "UTC",
  attempts: [],
  dailyState: { completedCount: 0, skipUsed: false }
};

export async function loadProgression(): Promise<ProgressionSummary> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const payload = await progressionRequest(`/api/progression?timezone=${encodeURIComponent(timezone)}`);
  return payload.progression as ProgressionSummary;
}

export async function mutateExerciseProgression(input: {
  action: "attempt" | "hint" | "skip" | "complete";
  source: ProgressionAttempt["source"];
  exerciseKey: string;
  courseId?: string;
  usesPracticeAllowance?: boolean;
  submission?: { code?: string; answerIndex?: number; answer?: string; prompt?: string; rubric?: string };
}) {
  const payload = await progressionRequest("/api/progression/exercise", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.exercise as {
    passed?: boolean;
    awarded?: boolean;
    xp?: number;
    feedback?: string;
    hintUsed?: boolean;
    skipped?: boolean;
  };
}

export async function completeCourseSection(courseId: string, sectionId: string) {
  await progressionRequest("/api/progression/section", {
    method: "POST",
    body: JSON.stringify({ courseId, sectionId })
  });
}

export async function equipProgressionTitle(badgeId: string | null) {
  return progressionRequest("/api/progression/title", {
    method: "POST",
    body: JSON.stringify({ badgeId })
  });
}

export async function resetProgression() {
  await progressionRequest("/api/progression/reset", { method: "DELETE" });
}

async function progressionRequest(path: string, init: RequestInit = {}) {
  return authenticatedJson<Record<string, unknown>>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  }, "update learning progress");
}
