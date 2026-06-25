export type ProgressionHeatmapDay = {
  date: string;
  xp: number;
};

export type ProgressionBadge = {
  key: string;
  name: string;
  title: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
  equipped: boolean;
};

export type ProgressionSummary = {
  totalXp: number;
  currentStreak: number;
  activeDays: number;
  solvedChallenges: number;
  completedCourses: number;
  lastActiveAt: string | null;
  heatmap: ProgressionHeatmapDay[];
  languageXp: Array<{ language: string; xp: number }>;
  badges: ProgressionBadge[];
  equippedBadgeKey: string | null;
  timezone: string;
  displayName: string | null;
  courses: Array<{ id: string; title: string; subject: string; status: string }>;
  latestDailyUsage: {
    activity_date: string;
    independent_completions: number;
    independent_skips: number;
  } | null;
  challenges: Array<{
    key: string;
    source: "course" | "independent";
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    completed: boolean;
    hintUsed: boolean;
    attempts: number;
    xpAwarded: number;
  }>;
};

export const defaultProgressionSummary: ProgressionSummary = {
  totalXp: 0,
  currentStreak: 0,
  activeDays: 0,
  solvedChallenges: 0,
  completedCourses: 0,
  lastActiveAt: null,
  heatmap: [],
  languageXp: [],
  badges: [],
  equippedBadgeKey: null,
  timezone: "UTC",
  displayName: null,
  courses: [],
  latestDailyUsage: null,
  challenges: []
};

export async function loadProgression(
  token: string,
  {
    language,
    days = 365,
    timezone
  }: { language?: string | null; days?: number; timezone?: string | null } = {}
): Promise<ProgressionSummary> {
  const params = new URLSearchParams({ days: String(days) });
  if (language) params.set("language", language);
  if (timezone) params.set("timezone", timezone);
  const payload = await requestJson(`/api/progression?${params.toString()}`, token);
  if (!payload?.progression) throw new Error("Progression data is unavailable until the database migration is applied.");
  return payload.progression as ProgressionSummary;
}

export async function submitChallengeAttempt(
  token: string,
  input: {
    challengeKey: string;
    courseId?: string | null;
    sectionId?: string | null;
    submission: { answer?: string; code?: string; runPassed?: boolean };
  }
) {
  const payload = await requestJson("/api/challenges/attempt", token, input);
  return payload.result as {
    accepted: boolean;
    completed: boolean;
    xpAwarded: number;
    attempts: number;
    reason: string | null;
  };
}

export async function requestChallengeHint(
  token: string,
  input: { challengeKey: string; courseId?: string | null; sectionId?: string | null }
) {
  const payload = await requestJson("/api/challenges/hint", token, input);
  return payload.result as { hintUsed: boolean };
}

export async function skipChallenge(token: string) {
  const payload = await requestJson("/api/challenges/skip", token, {});
  return payload.result as { skipUsed: boolean; activityDate: string };
}

export async function equipProgressionTitle(token: string, badgeKey: string | null) {
  const payload = await requestJson("/api/progression/equipped-title", token, { badgeKey });
  return payload.result as { equippedBadgeKey: string | null };
}

export async function completeProgressionCourse(token: string, courseId: string) {
  const payload = await requestJson(`/api/courses/${encodeURIComponent(courseId)}/complete`, token, {});
  return payload.completion as { course_id: string; completed_at?: string };
}

async function requestJson(path: string, token: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? payload?.result?.reason ?? "Progression request failed.");
  }
  return payload;
}
