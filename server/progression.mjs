import { normalizeBadgeDefinition } from "./skill-taxonomy.mjs";

const DAY_MS = 86_400_000;

export const FIRST_STEPS_BADGE = {
  id: "first-steps",
  title: "First Steps",
  description: "Complete your first verified Stonecode exercise."
};

const EXERCISE_DEFINITIONS = new Map([
  ["independent:js-order-summary", definition("independent", "js-order-summary", "JavaScript", "Beginner", 20, ["return", "reduce"])],
  ["independent:js-api-normalizer", definition("independent", "js-api-normalizer", "JavaScript", "Intermediate", 35, ["return", "map"])],
  ["independent:css-card-overflow", definition("independent", "css-card-overflow", "CSS", "Intermediate", 30, ["max-width", "min-width"])],
  ["independent:python-log-summary", definition("independent", "python-log-summary", "Python", "Beginner", 25, ["return", "for"])],
  ["independent:python-inventory-alerts", definition("independent", "python-inventory-alerts", "Python", "Intermediate", 35, ["return", "for", "append"])],
  ["course-mcq:choose-an-operation", definition("course-mcq", "choose-an-operation", "JavaScript", "Beginner", 15, [], 2)],
  ["course-chat:explain-edge-cases", definition("course-chat", "explain-edge-cases", "JavaScript", "Beginner", 10)]
]);

export function resolveExerciseDefinition(source, key) {
  const item = EXERCISE_DEFINITIONS.get(`${source}:${key}`);
  if (!item) return null;
  const { requiredSnippets: _requiredSnippets, correctAnswerIndex: _correctAnswerIndex, ...publicDefinition } = item;
  return publicDefinition;
}

export function gradeDeterministicExercise(source, key, submission) {
  const item = EXERCISE_DEFINITIONS.get(`${source}:${key}`);
  if (!item) return false;
  if (source === "course-mcq") return submission?.answerIndex === item.correctAnswerIndex;
  if (source !== "independent" || typeof submission?.code !== "string") return false;
  const normalizedCode = submission.code.toLowerCase();
  return item.requiredSnippets.every((snippet) => normalizedCode.includes(snippet));
}

export function parseChatGrade(value) {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed?.passed !== "boolean" || typeof parsed?.feedback !== "string") throw new Error("Invalid grade");
    return { passed: parsed.passed, feedback: parsed.feedback.slice(0, 400) };
  } catch {
    return { passed: false, feedback: "The grader returned an invalid response." };
  }
}

export function getDateKeyInTimezone(timezone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function resolveFirstStepsBadge(activity) {
  return activity.length > 0 ? FIRST_STEPS_BADGE : null;
}

export function normalizeBadgeRows(rows) {
  return rows.map((row) => normalizeBadgeDefinition(row.badge_key ?? row.badge_id, row.earned_at));
}

export function resolveXpBand(xp) {
  if (xp <= 0) return 0;
  if (xp < 20) return 1;
  if (xp < 50) return 2;
  if (xp < 100) return 3;
  return 4;
}

export function buildProgressionSummary({
  activity,
  badges,
  equippedBadgeId,
  completedCourses,
  nowDateKey,
  achievements = []
}) {
  const byDifficulty = { Beginner: 0, Intermediate: 0, Advanced: 0 };
  const languageTotals = new Map();
  const skillTotals = new Map();
  const dailyTotals = new Map();

  for (const item of activity) {
    if (item.difficulty in byDifficulty) byDifficulty[item.difficulty] += 1;
    const language = item.parent_language || item.language;
    const skill = item.primary_skill || item.language;
    languageTotals.set(language, (languageTotals.get(language) ?? 0) + item.xp);
    const currentSkill = skillTotals.get(skill) ?? { solvedCount: 0, xp: 0, parentLanguage: language };
    currentSkill.solvedCount += 1;
    currentSkill.xp += item.xp;
    skillTotals.set(skill, currentSkill);
    const day = dailyTotals.get(item.earned_on) ?? { xp: 0, languages: {} };
    day.xp += item.xp;
    day.languages[item.language] = (day.languages[item.language] ?? 0) + item.xp;
    dailyTotals.set(item.earned_on, day);
  }

  const activeDates = [...dailyTotals.keys()].sort();
  const { currentStreak, longestStreak } = calculateStreaks(activeDates, nowDateKey);
  const equippedBadge = badges.find((badge) => badge?.id === equippedBadgeId) ?? null;

  return {
    totalXp: activity.reduce((total, item) => total + item.xp, 0),
    solvedExercises: activity.length,
    byDifficulty,
    languageXp: [...languageTotals.entries()]
      .map(([language, xp]) => ({ language, xp }))
      .sort((a, b) => b.xp - a.xp || a.language.localeCompare(b.language)),
    skillBreakdown: buildSkillBreakdown(skillTotals, activity.length),
    heatmap: buildHeatmap(dailyTotals, nowDateKey),
    currentStreak,
    longestStreak,
    completedCourses,
    badges: badges.filter(Boolean),
    equippedBadgeId: equippedBadge?.id ?? null,
    equippedTitle: equippedBadge?.title ?? null,
    latestActivityAt: activity[0]?.created_at ?? null,
    achievements
  };
}

function buildSkillBreakdown(skillTotals, solvedExercises) {
  return [...skillTotals.entries()]
    .map(([skill, values]) => ({
      skill,
      parentLanguage: values.parentLanguage || null,
      solvedCount: values.solvedCount,
      xp: values.xp,
      percentage: solvedExercises ? Math.round(values.solvedCount / solvedExercises * 1000) / 10 : 0
    }))
    .sort((a, b) => b.solvedCount - a.solvedCount || b.xp - a.xp || a.skill.localeCompare(b.skill));
}

function buildHeatmap(dailyTotals, nowDateKey) {
  const end = dateKeyToUtc(nowDateKey);
  const days = [];
  for (let offset = 364; offset >= 0; offset -= 1) {
    const date = utcToDateKey(new Date(end.getTime() - offset * DAY_MS));
    const values = dailyTotals.get(date) ?? { xp: 0, languages: {} };
    days.push({
      date,
      xp: values.xp,
      band: resolveXpBand(values.xp),
      languages: values.languages
    });
  }
  return days;
}

function calculateStreaks(dateKeys, nowDateKey) {
  if (dateKeys.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let running = 1;
  for (let index = 1; index < dateKeys.length; index += 1) {
    const previous = dateKeyToUtc(dateKeys[index - 1]);
    const current = dateKeyToUtc(dateKeys[index]);
    if (current.getTime() - previous.getTime() === DAY_MS) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 1;
    }
  }

  const latest = dateKeyToUtc(dateKeys.at(-1));
  const now = dateKeyToUtc(nowDateKey);
  const latestAge = (now.getTime() - latest.getTime()) / DAY_MS;
  return {
    currentStreak: latestAge >= 0 && latestAge <= 1 ? running : 0,
    longestStreak
  };
}

function dateKeyToUtc(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function utcToDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function definition(source, key, language, difficulty, xp, requiredSnippets = [], correctAnswerIndex = null) {
  return { source, key, language, difficulty, xp, requiredSnippets, correctAnswerIndex };
}
