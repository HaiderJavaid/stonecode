import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canCompleteCourse,
  canEquipTitle,
  calculateXpAward,
  earnedBadgeKeys,
  evaluateChallengeAttempt,
  formatProgressionSummary,
  getIndependentDailyLimit,
  toDateKey
} from "../server/progression.mjs";

assert.equal(calculateXpAward({ completed: false }, true, 20), 20);
assert.equal(calculateXpAward({ completed: true }, true, 20), 0);
assert.equal(calculateXpAward({ completed: false }, false, 20), 0);

assert.equal(getIndependentDailyLimit("free"), 2);
assert.equal(getIndependentDailyLimit("basic"), 10);
assert.equal(getIndependentDailyLimit("pro"), 30);

assert.equal(
  evaluateChallengeAttempt("course-array-mutation", { answer: "array.push(nextItem)" }).accepted,
  true
);
assert.equal(
  evaluateChallengeAttempt("course-array-mutation", { answer: "array.map(item => item)" }).accepted,
  false
);
assert.equal(
  evaluateChallengeAttempt("course-empty-array", { answer: "Return undefined because the array has no first element." }).accepted,
  true
);
assert.equal(
  evaluateChallengeAttempt("course-queue-terminal", {
    code: "class Queue { enqueue(value) {} dequeue() {} }",
    runPassed: true
  }).accepted,
  true
);
assert.equal(
  evaluateChallengeAttempt("course-queue-terminal", {
    code: "class Queue { enqueue(value) {} dequeue() {} }",
    runPassed: false
  }).accepted,
  false
);
assert.equal(
  evaluateChallengeAttempt("js-order-summary", {
    code: "function orderTotal(items) { return items.reduce((sum, item) => sum + item.price * item.quantity, 0); }"
  }).accepted,
  true
);

assert.equal(toDateKey("2026-06-25T16:30:00.000Z", "Asia/Kuala_Lumpur"), "2026-06-26");
assert.equal(toDateKey("2026-06-25T06:30:00.000Z", "America/Los_Angeles"), "2026-06-24");

const summary = formatProgressionSummary({
  timezone: "UTC",
  now: "2026-06-25T12:00:00.000Z",
  days: 365,
  language: null,
  challenges: [
    { completed_at: "2026-06-25T09:00:00.000Z", xp_awarded: 20, language: "JavaScript" },
    { completed_at: "2026-06-24T09:00:00.000Z", xp_awarded: 30, language: "JavaScript" },
    { completed_at: "2026-06-22T09:00:00.000Z", xp_awarded: 25, language: "Python" }
  ],
  courseCompletions: [{ course_id: "course-a" }],
  badges: [{ badge_key: "first-steps", earned_at: "2026-06-25T09:00:00.000Z" }],
  equippedBadgeKey: "first-steps"
});

assert.equal(summary.totalXp, 75);
assert.equal(summary.currentStreak, 2);
assert.equal(summary.activeDays, 3);
assert.equal(summary.solvedChallenges, 3);
assert.deepEqual(summary.languageXp, [
  { language: "JavaScript", xp: 50 },
  { language: "Python", xp: 25 }
]);
assert.equal(summary.heatmap.find((day) => day.date === "2026-06-25")?.xp, 20);

assert.deepEqual(
  earnedBadgeKeys({
    completedChallenges: 10,
    activeDays: 7,
    completedCourseCount: 1,
    completedCourseSubjects: [],
    languageXp: {}
  }),
  ["first-steps", "problem-solver", "consistent-coder", "course-finisher"]
);
assert.equal(
  earnedBadgeKeys({
    completedChallenges: 4,
    activeDays: 4,
    completedCourseCount: 1,
    completedCourseSubjects: ["Web Development"],
    languageXp: { HTML: 300, CSS: 300, JavaScript: 300, "Node.js": 300 }
  }).includes("web-developer"),
  true
);

assert.equal(canEquipTitle("first-steps", new Set(["first-steps"])), true);
assert.equal(canEquipTitle("problem-solver", new Set(["first-steps"])), false);
assert.equal(canEquipTitle(null, new Set()), true);

assert.equal(
  canCompleteCourse({
    lessonIndex: 4,
    finalLessonIndex: 4,
    requiredChallengeKeys: ["a", "b"],
    completedChallengeKeys: new Set(["a", "b"])
  }),
  true
);
assert.equal(
  canCompleteCourse({
    lessonIndex: 4,
    finalLessonIndex: 4,
    requiredChallengeKeys: ["a", "b"],
    completedChallengeKeys: new Set(["a"])
  }),
  false
);

const migration = readFileSync(
  new URL("../supabase/migrations/2026-06-25-add-progression.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /record_challenge_attempt/);
assert.match(migration, /record_challenge_hint/);
assert.match(migration, /record_challenge_skip/);
assert.match(migration, /unique \(user_id, scope_key\)/);

const serverSource = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
for (const route of [
  "/api/progression",
  "/api/challenges/attempt",
  "/api/challenges/hint",
  "/api/challenges/skip",
  "/complete",
  "/api/progression/equipped-title"
]) {
  assert.ok(serverSource.includes(route), `server must expose ${route}`);
}

const progressionService = readFileSync(new URL("../src/services/progression.ts", import.meta.url), "utf8");
assert.ok(progressionService.includes("/api/progression?"));
assert.ok(progressionService.includes("/api/challenges/attempt"));
assert.ok(progressionService.includes("/api/challenges/hint"));
assert.ok(progressionService.includes("/api/challenges/skip"));
assert.ok(progressionService.includes("/api/progression/equipped-title"));

const independentPanel = readFileSync(
  new URL("../src/components/stonecode/IndependentExercisePanel.tsx", import.meta.url),
  "utf8"
);
assert.ok(independentPanel.includes("submitChallengeAttempt"));
assert.ok(independentPanel.includes("requestChallengeHint"));
assert.ok(independentPanel.includes("skipChallenge"));
assert.ok(!independentPanel.includes("localStorage"));

const courseCard = readFileSync(new URL("../src/components/stonecode/CourseCard.tsx", import.meta.url), "utf8");
assert.ok(courseCard.includes("course-empty-array"));
assert.ok(courseCard.includes("course-array-mutation"));

const prototype = readFileSync(
  new URL("../src/components/stonecode/StonecodePrototype.tsx", import.meta.url),
  "utf8"
);
assert.ok(prototype.includes("course-queue-terminal"));
assert.ok(prototype.includes("runPassed"));

const roadmap = readFileSync(new URL("../src/components/stonecode/CourseRoadmap.tsx", import.meta.url), "utf8");
assert.ok(roadmap.includes("completeProgressionCourse"));

const settingsScene = readFileSync(new URL("../src/components/stonecode/SettingsScene.tsx", import.meta.url), "utf8");
assert.ok(settingsScene.includes("Preferences"));
assert.ok(settingsScene.includes("ProgressionOverview"));
assert.ok(settingsScene.includes("lucide-react"));
assert.ok(!settingsScene.includes('id: "usage"'));
assert.ok(!settingsScene.includes('id: "support"'));

console.log("progression checks passed");
