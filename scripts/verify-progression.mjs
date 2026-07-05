import assert from "node:assert/strict";
import {
  buildProgressionSummary,
  normalizeBadgeRows,
  parseChatGrade,
  gradeDeterministicExercise,
  resolveExerciseDefinition,
  resolveFirstStepsBadge,
  resolveXpBand
} from "../server/progression.mjs";

const activity = [
  { id: "a", language: "JavaScript", xp: 20, difficulty: "Beginner", earned_on: "2026-06-24", created_at: "2026-06-24T02:00:00Z" },
  { id: "b", language: "Python", xp: 35, difficulty: "Intermediate", earned_on: "2026-06-25", created_at: "2026-06-25T02:00:00Z" },
  { id: "c", language: "JavaScript", xp: 15, difficulty: "Beginner", earned_on: "2026-06-26", created_at: "2026-06-26T02:00:00Z" }
];

const summary = buildProgressionSummary({
  activity,
  badges: [resolveFirstStepsBadge(activity)],
  equippedBadgeId: "first-steps",
  completedCourses: 1,
  nowDateKey: "2026-06-26"
});

assert.equal(summary.totalXp, 70);
assert.equal(summary.solvedExercises, 3);
assert.deepEqual(summary.byDifficulty, { Beginner: 2, Intermediate: 1, Advanced: 0 });
assert.deepEqual(summary.languageXp, [
  { language: "JavaScript", xp: 35 },
  { language: "Python", xp: 35 }
]);
assert.equal(summary.currentStreak, 3);
assert.equal(summary.longestStreak, 3);
assert.equal(summary.completedCourses, 1);
assert.equal(summary.equippedTitle, "First Steps");
assert.equal(summary.heatmap.find((day) => day.date === "2026-06-26")?.xp, 15);
assert.equal(summary.heatmap.find((day) => day.date === "2026-06-26")?.languages.JavaScript, 15);

assert.equal(resolveXpBand(0), 0);
assert.equal(resolveXpBand(1), 1);
assert.equal(resolveXpBand(24), 2);
assert.equal(resolveXpBand(50), 3);
assert.equal(resolveXpBand(100), 4);
assert.equal(resolveFirstStepsBadge([]), null);
assert.equal(resolveFirstStepsBadge(activity)?.id, "first-steps");
assert.deepEqual(resolveExerciseDefinition("independent", "js-order-summary"), {
  source: "independent",
  key: "js-order-summary",
  language: "JavaScript",
  difficulty: "Beginner",
  xp: 20
});
assert.equal(resolveExerciseDefinition("course-mcq", "choose-an-operation")?.xp, 15);
assert.equal(resolveExerciseDefinition("course-chat", "explain-edge-cases")?.xp, 10);
assert.equal(resolveExerciseDefinition("course-terminal", "build-and-run"), null);
assert.equal(gradeDeterministicExercise("independent", "js-order-summary", { code: "return items.reduce(() => 0, 0)" }), true);
assert.equal(gradeDeterministicExercise("independent", "js-order-summary", { code: "return 0" }), false);
assert.equal(gradeDeterministicExercise("course-mcq", "choose-an-operation", { answerIndex: 2 }), true);
assert.equal(gradeDeterministicExercise("course-mcq", "choose-an-operation", { answerIndex: 1 }), false);
assert.deepEqual(parseChatGrade('{"passed":true,"feedback":"Clear edge-case reasoning."}'), {
  passed: true,
  feedback: "Clear edge-case reasoning."
});
assert.deepEqual(parseChatGrade("not json"), { passed: false, feedback: "The grader returned an invalid response." });
assert.deepEqual(normalizeBadgeRows([{ badge_key: "first-steps", earned_at: "2026-06-25T00:00:00Z" }]), [{
  id: "first-steps",
  title: "First Steps",
  description: "Complete your first verified Stonecode exercise.",
  earnedAt: "2026-06-25T00:00:00Z"
}]);

console.log("progression checks passed");
