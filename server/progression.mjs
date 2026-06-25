const independentLimits = {
  free: 2,
  basic: 10,
  pro: 30
};

export const badgeCatalog = [
  {
    key: "first-steps",
    name: "First Steps",
    title: "First Steps",
    description: "Complete your first challenge."
  },
  {
    key: "problem-solver",
    name: "Problem Solver",
    title: "Problem Solver",
    description: "Complete 10 challenges."
  },
  {
    key: "consistent-coder",
    name: "Consistent Coder",
    title: "Consistent Coder",
    description: "Code on 7 different days."
  },
  {
    key: "course-finisher",
    name: "Course Finisher",
    title: "Course Finisher",
    description: "Complete your first course."
  },
  {
    key: "web-developer",
    name: "Web Developer",
    title: "Web Developer",
    description: "Finish Web Development with 300 XP in HTML, CSS, JavaScript, and Node.js."
  }
];

const challengeCatalog = {
  "course-empty-array": {
    source: "course",
    language: "JavaScript",
    topic: "Edge cases",
    difficulty: "Beginner",
    xp: 10,
    validator: {
      type: "concepts",
      groups: [["undefined", "null", "no value"], ["empty", "no first", "length"]]
    }
  },
  "course-array-mutation": {
    source: "course",
    language: "JavaScript",
    topic: "Arrays",
    difficulty: "Beginner",
    xp: 15,
    validator: {
      type: "exact",
      answer: "array.push(nextItem)"
    }
  },
  "course-queue-terminal": {
    source: "course",
    language: "JavaScript",
    topic: "Queues",
    difficulty: "Intermediate",
    xp: 25,
    validator: {
      type: "code",
      required: ["enqueue", "dequeue"],
      requiresRun: true
    }
  },
  "js-order-summary": independentChallenge("JavaScript", "Arrays", "Beginner", 20, ["return", "reduce"]),
  "js-api-normalizer": independentChallenge("JavaScript", "Data transformation", "Intermediate", 35, ["return", "map"]),
  "css-card-overflow": independentChallenge("CSS", "Responsive layout", "Intermediate", 30, ["max-width", "min-width"]),
  "python-log-summary": independentChallenge("Python", "Dictionaries", "Beginner", 25, ["return", "for"]),
  "python-inventory-alerts": independentChallenge("Python", "Lists and dictionaries", "Intermediate", 35, ["return", "for", "append"])
};

export function getChallengeDefinition(key) {
  return challengeCatalog[key] ?? null;
}

export function evaluateChallengeAttempt(key, submission) {
  const challenge = getChallengeDefinition(key);
  if (!challenge) return { accepted: false, reason: "Unknown challenge." };

  const validator = challenge.validator;
  if (validator.type === "exact") {
    const accepted = normalizeText(submission?.answer) === normalizeText(validator.answer);
    return { accepted, reason: accepted ? null : "That answer is not correct." };
  }

  if (validator.type === "concepts") {
    const answer = normalizeText(submission?.answer);
    const accepted = validator.groups.every((group) => group.some((concept) => answer.includes(normalizeText(concept))));
    return { accepted, reason: accepted ? null : "The answer is missing a required concept." };
  }

  const code = normalizeText(submission?.code);
  const hasRequiredCode = validator.required.every((snippet) => code.includes(normalizeText(snippet)));
  const runAccepted = !validator.requiresRun || submission?.runPassed === true;
  const accepted = hasRequiredCode && runAccepted;
  return {
    accepted,
    reason: accepted
      ? null
      : !hasRequiredCode
        ? "The submitted code does not meet the required rules."
        : "Run the code successfully before submitting."
  };
}

export function calculateXpAward(existing, accepted, xp) {
  if (!accepted || existing?.completed) return 0;
  return Math.max(Number(xp) || 0, 0);
}

export function getIndependentDailyLimit(plan) {
  return independentLimits[plan] ?? independentLimits.free;
}

export function toDateKey(value, timezone = "UTC") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid progression timestamp.");
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }
}

export function formatProgressionSummary({
  timezone = "UTC",
  now = new Date().toISOString(),
  days = 365,
  language = null,
  challenges = [],
  courseCompletions = [],
  badges = [],
  equippedBadgeKey = null
}) {
  const completed = challenges.filter((challenge) => challenge.completed_at);
  const filtered = language
    ? completed.filter((challenge) => normalizeText(challenge.language) === normalizeText(language))
    : completed;
  const heatmapByDate = new Map();
  const languageXpMap = new Map();

  for (const challenge of filtered) {
    const dateKey = toDateKey(challenge.completed_at, timezone);
    const xp = Math.max(Number(challenge.xp_awarded) || 0, 0);
    heatmapByDate.set(dateKey, (heatmapByDate.get(dateKey) ?? 0) + xp);
  }

  for (const challenge of completed) {
    const name = challenge.language || "Other";
    languageXpMap.set(name, (languageXpMap.get(name) ?? 0) + Math.max(Number(challenge.xp_awarded) || 0, 0));
  }

  const today = toDateKey(now, timezone);
  const heatmap = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addUtcDays(today, -offset);
    heatmap.push({ date, xp: heatmapByDate.get(date) ?? 0 });
  }

  const activeDates = new Set(completed.map((challenge) => toDateKey(challenge.completed_at, timezone)));
  let streakCursor = activeDates.has(today) ? today : addUtcDays(today, -1);
  let currentStreak = 0;
  while (activeDates.has(streakCursor)) {
    currentStreak += 1;
    streakCursor = addUtcDays(streakCursor, -1);
  }

  const badgeKeys = new Set(badges.map((badge) => badge.badge_key));

  return {
    totalXp: completed.reduce((sum, challenge) => sum + Math.max(Number(challenge.xp_awarded) || 0, 0), 0),
    currentStreak,
    activeDays: activeDates.size,
    solvedChallenges: completed.length,
    completedCourses: courseCompletions.length,
    lastActiveAt: completed
      .map((challenge) => challenge.completed_at)
      .sort()
      .at(-1) ?? null,
    heatmap,
    languageXp: [...languageXpMap.entries()]
      .map(([entryLanguage, xp]) => ({ language: entryLanguage, xp }))
      .sort((a, b) => b.xp - a.xp || a.language.localeCompare(b.language)),
    badges: badgeCatalog.map((badge) => ({
      ...badge,
      earned: badgeKeys.has(badge.key),
      earnedAt: badges.find((entry) => entry.badge_key === badge.key)?.earned_at ?? null,
      equipped: equippedBadgeKey === badge.key
    })),
    equippedBadgeKey,
    timezone
  };
}

export function earnedBadgeKeys({
  completedChallenges,
  activeDays,
  completedCourseCount,
  completedCourseSubjects,
  languageXp
}) {
  const keys = [];
  if (completedChallenges >= 1) keys.push("first-steps");
  if (completedChallenges >= 10) keys.push("problem-solver");
  if (activeDays >= 7) keys.push("consistent-coder");
  if (completedCourseCount >= 1) keys.push("course-finisher");

  const hasWebCourse = completedCourseSubjects.some((subject) => normalizeText(subject).includes("web development"));
  const hasWebLanguageXp = ["HTML", "CSS", "JavaScript", "Node.js"].every((language) => (languageXp[language] ?? 0) >= 300);
  if (hasWebCourse && hasWebLanguageXp) keys.push("web-developer");
  return keys;
}

export function canEquipTitle(key, earnedKeys) {
  return key === null || earnedKeys.has(key);
}

export function canCompleteCourse({
  lessonIndex,
  finalLessonIndex,
  requiredChallengeKeys,
  completedChallengeKeys
}) {
  return lessonIndex >= finalLessonIndex && requiredChallengeKeys.every((key) => completedChallengeKeys.has(key));
}

function independentChallenge(language, topic, difficulty, xp, required) {
  return {
    source: "independent",
    language,
    topic,
    difficulty,
    xp,
    validator: {
      type: "code",
      required,
      requiresRun: false
    }
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function addUtcDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
