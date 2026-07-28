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
import {
  achievementCatalog,
  evaluateAchievementProgress,
  exerciseXp,
  resolveSkillMetadata
} from "../server/skill-taxonomy.mjs";

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
const skillSummary = buildProgressionSummary({
  activity: [
    { id: "react", language: "JavaScript", primary_skill: "React", parent_language: "JavaScript", xp: 35, difficulty: "Intermediate", earned_on: "2026-06-26", created_at: "2026-06-26T03:00:00Z" },
    { id: "python", language: "Python", primary_skill: "Python", parent_language: "Python", xp: 20, difficulty: "Beginner", earned_on: "2026-06-26", created_at: "2026-06-26T02:00:00Z" }
  ],
  badges: [],
  equippedBadgeId: null,
  completedCourses: 0,
  nowDateKey: "2026-06-26"
});
assert.deepEqual(skillSummary.skillBreakdown.map((item) => [item.skill, item.solvedCount]), [["React", 1], ["Python", 1]]);
assert.deepEqual(skillSummary.languageXp, [{ language: "JavaScript", xp: 35 }, { language: "Python", xp: 20 }]);
assert.equal(skillSummary.totalXp, 55);
assert.equal(summary.currentStreak, 3);
assert.equal(summary.longestStreak, 3);
assert.equal(summary.completedCourses, 1);
assert.equal(summary.equippedTitle, "First Steps");
const unequippedSummary = buildProgressionSummary({
  activity,
  badges: [resolveFirstStepsBadge(activity)],
  equippedBadgeId: null,
  completedCourses: 1,
  nowDateKey: "2026-06-26"
});
assert.equal(unequippedSummary.equippedBadgeId, null);
assert.equal(unequippedSummary.equippedTitle, null);
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

assert.deepEqual(resolveSkillMetadata({ framework: "React", language: "JavaScript" }), {
  primarySkill: "React",
  parentLanguage: "JavaScript",
  domainIds: ["frontend"]
});
assert.equal(exerciseXp("mcq", "Beginner"), 5);
assert.equal(exerciseXp("mcq", "Advanced"), 15);
assert.equal(exerciseXp("code", "Beginner"), 20);
assert.equal(exerciseXp("code", "Advanced"), 50);

const frontendEligible = evaluateAchievementProgress({
  activity: [{ id: "frontend-xp", parent_language: "JavaScript", domain_ids: ["frontend"], xp: 300 }],
  completedPrograms: [{ domain_ids: ["frontend"] }],
  earnedBadgeKeys: ["first-steps"]
});
assert.ok(frontendEligible.newlyEarnedBadgeKeys.includes("frontend-developer"));
const frontendBelowXp = evaluateAchievementProgress({
  activity: [{ id: "frontend-xp", parent_language: "JavaScript", domain_ids: ["frontend"], xp: 299 }],
  completedPrograms: [{ domain_ids: ["frontend"] }],
  earnedBadgeKeys: []
});
assert.equal(frontendBelowXp.progress.find((item) => item.id === "frontend-developer")?.earned, false);
for (const definition of achievementCatalog.slice(0, 4)) {
  const language = definition.languages[0];
  const domain = definition.domains[0];
  const below = evaluateAchievementProgress({
    activity: [{ id: `${definition.id}-below`, parent_language: language, domain_ids: [domain], xp: definition.requiredXp - 1 }],
    completedPrograms: [{ domain_ids: [domain] }],
    earnedBadgeKeys: []
  });
  assert.equal(below.progress.find((item) => item.id === definition.id)?.earned, false);
  const atThreshold = evaluateAchievementProgress({
    activity: [{ id: `${definition.id}-at`, parent_language: language, domain_ids: [domain], xp: definition.requiredXp }],
    completedPrograms: [{ domain_ids: [domain] }],
    earnedBadgeKeys: []
  });
  assert.ok(atThreshold.earnedBadgeKeys.includes(definition.id));
  const withoutProgram = evaluateAchievementProgress({
    activity: [{ id: `${definition.id}-over`, parent_language: language, domain_ids: [domain], xp: definition.requiredXp + 100 }],
    completedPrograms: [],
    earnedBadgeKeys: []
  });
  assert.equal(withoutProgram.progress.find((item) => item.id === definition.id)?.earned, false);
}
const fullStackEligible = evaluateAchievementProgress({
  activity: [
    { id: "front", parent_language: "JavaScript", domain_ids: ["frontend"], xp: 500 },
    { id: "back", parent_language: "Python", domain_ids: ["backend"], xp: 500 }
  ],
  completedPrograms: [{ domain_ids: ["frontend"] }, { domain_ids: ["backend"] }],
  earnedBadgeKeys: []
});
assert.ok(fullStackEligible.earnedBadgeKeys.includes("frontend-developer"));
assert.ok(fullStackEligible.earnedBadgeKeys.includes("backend-engineer"));
assert.ok(fullStackEligible.earnedBadgeKeys.includes("full-stack-developer"));
assert.equal(normalizeBadgeRows([{ badge_key: "game-developer", earned_at: null }])[0].title, "Game Developer");

console.log("progression checks passed");
