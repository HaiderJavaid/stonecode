import assert from "node:assert/strict";
import { validateGeneratedCourseQuality } from "../server/course-generation-quality.mjs";
import {
  buildLearningDiscoveryPrompt,
  initialLearningGreeting,
  initialLearningSuggestions,
  maxLearningDiscoveryQuestions,
  missingLearningBriefFields,
  normalizeLearningBrief,
  normalizeLearningDiscoveryTurn,
  resolveExerciseMixCounts,
  resolveLearningPolicy
} from "../server/learning-orchestrator/contracts.mjs";
import { buildExerciseKindSequence, canRetryGenerationJob, repairMechanicalWorkshopIssues, resolveCourseGenerationServiceTier } from "../server/learning-orchestrator/generation-worker.mjs";
import {
  assertCourseDeliveryScope,
  buildApprovedCourseOutlineContract,
  minimumCourseModuleSteps
} from "../server/learning-orchestrator/course-delivery.mjs";
import { normalizeLearningProposal } from "../server/learning-orchestrator/proposals.mjs";
import { resolveRagTechnologyId } from "../server/rag/technology-corpora.mjs";
import {
  buildExerciseProblemBatchPrompt,
  buildLearningExperienceRepairPrompt,
  normalizeExerciseProblemBatch,
  normalizeGeneratedLearningContent
} from "../server/learning-orchestrator/generation.mjs";

const firstTurn = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Good to see you, Mina. Want to continue with Python or build something new today?",
  questionField: "learning_intent",
  suggestions: ["Continue Python", "Build a small project", "Start something new"]
}, {
  turn: 0,
  learnerContext: { displayName: "Mina", recentLearning: [{ title: "Python foundations", subject: "Python", type: "course" }] }
});
assert.match(firstTurn.reply, /Good to see you, Mina/);
assert.deepEqual(firstTurn.suggestions, ["Continue Python", "Build a small project", "Start something new"]);
assert.ok(firstTurn.suggestions.some((suggestion) => /build/i.test(suggestion)));
assert.equal(maxLearningDiscoveryQuestions, 8);
assert.deepEqual(buildExerciseKindSequence(7, 3), ["mcq", "mcq", "code", "mcq", "code", "code", "code", "code", "code", "code"]);
const contextualFallback = normalizeLearningDiscoveryTurn({ reply: "Hello" }, {
  turn: 0,
  learnerContext: { displayName: "Mina", recentLearning: [{ title: "Python foundations", subject: "Python", type: "course" }] }
});
assert.notEqual(contextualFallback.reply, initialLearningGreeting);
assert.match(contextualFallback.reply, /Mina.*Python foundations/i);
assert.match(buildLearningDiscoveryPrompt({ turn: 1, learnerContext: { displayName: "Mina" } }), /Learner context/);
assert.equal(resolveRagTechnologyId("Learn Type script"), "typescript");

const broadTypeScriptRequest = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "I can plan that course.",
  brief: { type: "course", goal: "Learn TypeScript", subject: "TypeScript", language: "TypeScript" }
}, { turn: 1, messages: [{ role: "user", content: "Learn Type script" }], availableTechnologyIds: ["typescript", "javascript"] });
assert.equal(broadTypeScriptRequest.status, "clarifying");
assert.equal(broadTypeScriptRequest.questionField, "type");
assert.deepEqual(broadTypeScriptRequest.suggestions.slice(0, 3), ["Course", "Guided project", "Exercise pack"]);

const persistedTypeScriptRequest = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "What experience do you have?",
  questionField: "prior_knowledge",
  brief: { type: "course", priorKnowledge: "Complete beginner" }
}, {
  turn: 3,
  draftBrief: broadTypeScriptRequest.draftBrief,
  messages: [
    { role: "user", content: "Learn Type script" },
    { role: "assistant", content: "Course, guided project, or exercise pack?" },
    { role: "user", content: "Course" },
    { role: "assistant", content: "What experience do you have?" },
    { role: "user", content: "I’m completely new" }
  ],
  availableTechnologyIds: ["typescript", "javascript"]
});
assert.equal(persistedTypeScriptRequest.questionField, "focus_areas", "answered fields must survive later AI turns instead of repeating");
assert.equal(persistedTypeScriptRequest.draftBrief.subject, "TypeScript");
assert.ok(persistedTypeScriptRequest.suggestions.includes("Types and inference"));

const reactPrerequisiteQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Ready.",
  brief: { type: "course", goal: "Learn React", subject: "React", framework: "React", priorKnowledge: "Complete beginner" }
}, {
  turn: 2,
  messages: [{ role: "user", content: "I want a React course" }, { role: "user", content: "I’m completely new" }],
  availableTechnologyIds: ["javascript"]
});
assert.equal(reactPrerequisiteQuestion.questionField, "prerequisite_route");
assert.match(reactPrerequisiteQuestion.reply, /HTML, CSS and JavaScript fundamentals/i);
assert.ok(reactPrerequisiteQuestion.suggestions[0].includes("Recommended"));

const explicitReactFoundationPlan = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: { type: "course", goal: "Learn React from scratch", subject: "React", framework: "React", priorKnowledge: "Complete beginner" }
}, {
  turn: 1,
  messages: [{ role: "user", content: "I want a React course from scratch, starting with HTML, CSS and JavaScript" }],
  availableTechnologyIds: ["javascript"]
});
assert.notEqual(explicitReactFoundationPlan.questionField, "prerequisite_route");

const capabilityQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "What specific programming subject or concept should we focus on?",
  questionField: "subject",
  suggestions: ["JavaScript fundamentals", "Python fundamentals", "SQL basics"],
  brief: { type: "course", goal: "List supported languages" }
}, {
  turn: 1,
  messages: [{ role: "user", content: "List down all programming languages you can teach" }],
  availableTechnologyIds: ["javascript", "typescript", "python", "html", "css"]
});
assert.equal(capabilityQuestion.questionField, "learning_intent");
assert.match(capabilityQuestion.reply, /- JavaScript\n- TypeScript\n- Python\n- HTML\n- CSS/);
assert.match(capabilityQuestion.reply, /Computer & IT Fundamentals/);
assert.deepEqual(capabilityQuestion.suggestions, ["JavaScript", "TypeScript", "Python", "HTML", "CSS"]);
assert.equal(capabilityQuestion.draftBrief, null, "a capability question must not become a course goal");

const terseCapabilityQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "What result do you want to achieve?",
  questionField: "goal",
  brief: { type: "course", goal: "List down all the languages" }
}, {
  turn: 1,
  messages: [{ role: "user", content: "list down all the languages" }],
  availableTechnologyIds: ["javascript", "typescript", "python", "cpp", "html", "css"]
});
assert.equal(terseCapabilityQuestion.questionField, "learning_intent");
assert.match(terseCapabilityQuestion.reply, /- C\+\+/);
assert.equal(terseCapabilityQuestion.draftBrief, null);

const repeatedCapabilityQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "What subject should we focus on?",
  questionField: "subject",
  brief: { type: "course", goal: "List languages" }
}, {
  turn: 2,
  messages: [
    { role: "user", content: "list down all the languages" },
    { role: "assistant", content: "What result do you want to achieve?" },
    { role: "user", content: "list down all languages you can teach" }
  ],
  availableTechnologyIds: ["javascript", "typescript", "python", "cpp", "html", "css"]
});
assert.equal(repeatedCapabilityQuestion.questionField, "learning_intent");
assert.match(repeatedCapabilityQuestion.reply, /- C\+\+/);
assert.equal(repeatedCapabilityQuestion.draftBrief, null);

const midConversationCapabilityQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "What result do you want to achieve?",
  questionField: "goal",
  brief: { type: "course", goal: "Build a portfolio" }
}, {
  turn: 2,
  messages: [
    { role: "user", content: "I want to build something" },
    { role: "assistant", content: "What would you like to build?" },
    { role: "user", content: "show me all available languages" }
  ],
  availableTechnologyIds: ["javascript", "python", "cpp"]
});
assert.equal(midConversationCapabilityQuestion.questionField, "learning_intent");
assert.match(midConversationCapabilityQuestion.reply, /- C\+\+/);
assert.equal(midConversationCapabilityQuestion.draftBrief, null);

const alignedDynamicQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Python is a great fit for that goal. What have you already tried or built with Python?",
  questionField: "prior_knowledge",
  suggestions: ["I’m completely new", "I know basic syntax", "I’ve built a small script"],
  brief: { type: "course", goal: "Learn Python", subject: "Python", language: "Python" }
}, { turn: 2, messages: [{ role: "user", content: "I want a Python course" }] });
assert.match(alignedDynamicQuestion.reply, /Python is a great fit/i);
assert.deepEqual(alignedDynamicQuestion.suggestions, [
  "I’m completely new",
  "I know basic syntax",
  "I’ve built a small script",
  "I know this already—give me exercises"
]);

const misalignedDynamicQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "How much guidance would help?",
  questionField: "guidance",
  suggestions: ["Step by step", "Balanced"],
  brief: { type: "course", goal: "Learn Python", subject: "Python", language: "Python" }
}, { turn: 2, messages: [{ role: "user", content: "I want a Python course" }] });
assert.equal(misalignedDynamicQuestion.questionField, "prior_knowledge");
assert.match(misalignedDynamicQuestion.reply, /experience/i);
assert.ok(misalignedDynamicQuestion.suggestions.includes("I’m completely new"));
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 1 }, { code: "generation_validation_failed" }),
  true,
  "quality-validation failures should receive a bounded worker retry"
);
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 2 }, { code: "generation_validation_failed" }),
  false,
  "quality-validation retries must stop after focused recovery plus one fresh job attempt"
);
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 3 }, { code: "generation_validation_failed" }),
  false,
  "worker retries must stop after three attempts"
);
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 1 }, { code: "generation_scope_mismatch" }),
  false,
  "a module scope mismatch must not restart every completed module"
);
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 2 }, { code: "generation_scope_mismatch" }),
  false,
  "scope retries must stop before repeatedly regenerating a complete course"
);
assert.equal(
  canRetryGenerationJob({ heartbeat_at: null, attempt_count: 2, launch_ready_at: "2026-08-02T00:00:00.000Z" }, { code: "generation_scope_mismatch" }),
  true,
  "a launched checkpointed course may retry only its first missing module"
);
assert.equal(resolveCourseGenerationServiceTier({}), "fast");
assert.equal(resolveCourseGenerationServiceTier({ OPENAI_COURSE_GENERATION_SERVICE_TIER: "default" }), null);

const deliveryBrief = {
  type: "course",
  goal: "Learn Python fundamentals",
  subject: "Python",
  language: "Python",
  priorKnowledge: "Complete beginner",
  supportMode: "teaching_heavy"
};
const deliveryProposal = normalizeLearningProposal({
  type: "course",
  title: "Python foundations",
  summary: "Learn Python from first output through a small practical program.",
  technology: "Python",
  outcomes: ["Write small Python programs"],
  items: Array.from({ length: 8 }, (_, index) => ({
    title: `Python module ${index + 1}`,
    summary: `Learn and practise Python capability ${index + 1}.`,
    stepCount: 2
  })),
  totalSteps: 16
}, deliveryBrief);
assert.equal(deliveryProposal.totals.modules, 8);
assert.equal(deliveryProposal.totals.steps, 8 * minimumCourseModuleSteps);
assert.equal(deliveryProposal.creditQuote.credits, 15);
assert.match(buildApprovedCourseOutlineContract(deliveryProposal), /exactly 8 modules/i);

const guidedProjectProposal = normalizeLearningProposal({
  type: "project",
  title: "Browser dashboard",
  summary: "Build a focused interactive dashboard.",
  technology: "JavaScript",
  outcomes: ["Build and explain a browser dashboard"],
  items: Array.from({ length: 4 }, (_, index) => ({
    title: `Dashboard capability ${index + 1}`,
    summary: `Build one connected dashboard capability ${index + 1}.`,
    stepCount: 4,
    fileCount: 3
  })),
  totalSteps: 16,
  totalFiles: 3
}, {
  type: "guided_project",
  goal: "Build a browser dashboard",
  desiredOutcome: "A working interactive dashboard",
  subject: "JavaScript",
  language: "JavaScript",
  platform: "web",
  priorKnowledge: "JavaScript basics",
  projectDifficulty: "basic"
});
assert.equal(guidedProjectProposal.items.length, 4, "valid 2-6 feature proposals must reach project generation");
assert.equal(guidedProjectProposal.totals.steps, 16);

for (const language of ["JavaScript", "TypeScript", "Python", "HTML", "CSS"]) {
  const proposal = normalizeLearningProposal({
    type: "course",
    title: `${language} foundations`,
    summary: `Learn practical ${language} foundations.`,
    technology: language,
    outcomes: [`Use ${language}`],
    items: [
      { title: `${language} basics`, summary: "Learn the core syntax.", stepCount: 6 },
      { title: `${language} practice`, summary: "Apply the core syntax.", stepCount: 6 }
    ],
    totalSteps: 12
  }, { ...deliveryBrief, goal: `Learn ${language}`, subject: language, language });
  const content = {
    schemaVersion: "course-content/v2",
    title: proposal.title,
    subject: language,
    description: proposal.summary,
    languages: [language],
    tags: ["QA"],
    generationDepth: "full_course",
    modules: proposal.items.map((item, moduleIndex) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      order: moduleIndex,
      unlocked: true,
      topics: [{
        id: `${item.id}-topic`,
        title: item.title,
        summary: item.summary,
        order: 0,
        unlocked: true,
        blocks: [{
          id: `${item.id}-block`,
          kind: "workshop",
          title: item.title,
          summary: item.summary,
          order: 0,
          steps: Array.from({ length: 6 }, (_, stepIndex) => ({
            id: `${item.id}-step-${stepIndex + 1}`,
            type: "workshop",
            language,
            filePath: language === "HTML" ? "index.html" : language === "CSS" ? "styles.css" : language === "Python" ? "main.py" : "main.js",
            context: `Continue the same ${language} practice with one small edit.`,
            prompt: `Apply ${language} practice edit ${stepIndex + 1}.`,
            starterCode: `step ${stepIndex}`,
            resultCode: `step ${stepIndex + 1}`,
            expectedChange: `Advance to step ${stepIndex + 1}.`,
            acceptanceCriteria: [`Completes step ${stepIndex + 1}`]
          }))
        }]
      }]
    }))
  };
  const delivered = assertCourseDeliveryScope(proposal, content);
  assert.equal(delivered.modules, 2);
  assert.ok(delivered.steps >= 12 && delivered.steps <= 20);
  assert.equal(delivered.approvedCredits, 5);
  assert.equal(delivered.deliveredBandCredits, 5);
  assert.equal(delivered.exceedsApprovedBand, false);
  const expandedContent = structuredClone(content);
  expandedContent.modules[0].topics[0].blocks[0].steps.push(
    ...Array.from({ length: 9 }, (_, index) => ({
      ...expandedContent.modules[0].topics[0].blocks[0].steps.at(-1),
      id: `${proposal.items[0].id}-bonus-step-${index + 1}`
    }))
  );
  const expandedDelivery = assertCourseDeliveryScope(proposal, expandedContent);
  assert.equal(expandedDelivery.steps, delivered.steps + 9, "valid generated teaching steps must not be trimmed to the approved estimate");
  assert.equal(expandedDelivery.deliveredBandCredits, 10);
  assert.equal(expandedDelivery.exceedsApprovedBand, true);
  assert.throws(
    () => assertCourseDeliveryScope(proposal, { ...content, modules: content.modules.slice(0, 1) }),
    /requires 2 modules/i
  );
}

const mechanicallyRepaired = repairMechanicalWorkshopIssues({
  modules: [{ topics: [{ blocks: [{
    kind: "workshop",
    steps: [
      { id: "step-1", type: "workshop", prompt: "Continue.", expectedChange: "Set score to 1", starterCode: "score = 0", resultCode: "score = 1" },
      { id: "step-2", type: "workshop", prompt: "Inspect it.", expectedChange: "No edit", starterCode: "score = 1", resultCode: "score = 1" },
      { type: "summary", markdown: "## Recap" }
    ]
  }] }] }]
});
const repairedMechanicalSteps = mechanicallyRepaired.modules[0].topics[0].blocks[0].steps;
assert.equal(repairedMechanicalSteps.filter((step) => step.type === "workshop").length, 1);
assert.match(repairedMechanicalSteps[0].prompt, /Change the code/i);
assert.equal(repairedMechanicalSteps[0].buildsOnStepId, null);
assert.equal(repairedMechanicalSteps.at(-1).type, "summary");

const finalDiscoveryQuestion = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: { type: "course", goal: "Learn JavaScript", subject: "JavaScript" }
}, { turn: maxLearningDiscoveryQuestions - 1, messages: [{ role: "user", content: "I want to learn JavaScript" }] });
assert.equal(finalDiscoveryQuestion.status, "clarifying");
assert.match(finalDiscoveryQuestion.reply, /Last choice/i);
assert.ok(finalDiscoveryQuestion.suggestions.includes("Course"));

const projectChipOnly = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  suggestions: initialLearningSuggestions,
  brief: { type: "project", goal: "Build a project", framework: "Build a project" }
}, { turn: 1, messages: [{ role: "user", content: "Build a project" }] });
assert.equal(projectChipOnly.status, "clarifying");
assert.equal(projectChipOnly.nextAction, "clarify");
assert.ok(projectChipOnly.missingFields.includes("desiredOutcome"));
assert.ok(projectChipOnly.missingFields.includes("supported_technology"));
assert.ok(projectChipOnly.suggestions.includes("Personal website"));
assert.ok(!projectChipOnly.suggestions.includes("Build a project"));
assert.equal(projectChipOnly.questionField, "desiredOutcome");
assert.equal(projectChipOnly.responseTurn, 1);

const projectChipWithHallucinatedFramework = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Hi! You can start from a project, language, feature, end goal, course, guided project, or exercise pack. What would you like to build today?",
  suggestions: ["JavaScript", "Python", "Java", "Choose for me"],
  brief: { type: "project", goal: "Build a project", framework: "Project-based learning" }
}, { turn: 1, messages: [{ role: "user", content: "Build a project" }] });
assert.equal(projectChipWithHallucinatedFramework.status, "clarifying");
assert.equal(projectChipWithHallucinatedFramework.nextAction, "clarify");
assert.ok(projectChipWithHallucinatedFramework.missingFields.includes("supported_technology"));
assert.equal(projectChipWithHallucinatedFramework.reply, "What kind of project or end result should we build?");
assert.ok(projectChipWithHallucinatedFramework.suggestions.includes("Personal website"));

const ignoredGuidanceQuestion = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "How much guidance would help—step by step, balanced, or faster?",
  suggestions: ["I’m completely new", "I know the basics", "I’ve built something small"],
  brief: { type: "course", goal: "Learn Vue", subject: "Vue", framework: "Vue", priorKnowledge: "Complete beginner" }
}, { turn: 2, messages: [
  { role: "user", content: "Teach me Vue" },
  { role: "user", content: "I’m completely new" }
] });
assert.equal(ignoredGuidanceQuestion.status, "clarifying");
assert.equal(ignoredGuidanceQuestion.questionField, "type");
assert.doesNotMatch(ignoredGuidanceQuestion.reply, /guidance|hand-holding/i);
assert.ok(ignoredGuidanceQuestion.suggestions.includes("Course"));

const completeDespiteClarifyingModel = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Would you like anything else?",
  suggestions: ["More theory", "More projects"],
  brief: {
    type: "course",
    goal: "Learn Python from scratch step by step",
    subject: "Python",
    language: "Python",
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  }
}, { turn: 1, messages: [{ role: "user", content: "Teach me Python from scratch step by step" }] });
assert.equal(completeDespiteClarifyingModel.status, "clarifying");
assert.equal(completeDespiteClarifyingModel.questionField, "type");
assert.ok(completeDespiteClarifyingModel.suggestions.includes("Exercise pack"));

const completeExercise = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready to practice.",
  brief: {
    type: "exercise",
    goal: "Five intermediate Python loop exercises for interviews",
    subject: "loops",
    language: "Python",
    motivation: "Prepare for interviews",
    practiceScope: "topics",
    topics: ["loops"],
    difficulty: "intermediate",
    exerciseCount: 5
  }
}, { turn: 1, messages: [{ role: "user", content: "Give me five intermediate Python loop exercises for interview preparation" }] });
assert.equal(completeExercise.status, "ready");
assert.equal(completeExercise.nextAction, "confirm");
assert.deepEqual(completeExercise.suggestions, []);
assert.deepEqual(resolveExerciseMixCounts({ exerciseCount: 10, codingPercent: 70 }), { codingCount: 7, mcqCount: 3 });

const broadExercise = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: { type: "exercise", goal: "JavaScript exercises", language: "JavaScript" }
}, { turn: 1, messages: [{ role: "user", content: "Give me JavaScript exercises" }] });
assert.equal(broadExercise.status, "clarifying");
assert.ok(broadExercise.missingFields.includes("practice_scope"));
assert.ok(broadExercise.missingFields.includes("motivation"));

const vagueProject = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: { type: "guided_project", goal: "Build something" }
}, { turn: 1, messages: [{ role: "user", content: "Build something" }] });
assert.equal(vagueProject.status, "clarifying");
assert.deepEqual(vagueProject.missingFields, ["desiredOutcome", "project_difficulty", "supported_technology", "prior_knowledge"]);
assert.ok(vagueProject.suggestions.length >= 2);

const projectDifficultyTurn = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Would you like a basic or advanced build?",
  questionField: "project_difficulty",
  suggestions: ["Basic", "Advanced"],
  brief: {
    type: "project",
    goal: "Build a Python task tracker",
    desiredOutcome: "A terminal task tracker",
    language: "Python",
    priorKnowledge: "Complete beginner"
  }
}, { turn: 2, messages: [{ role: "user", content: "I am completely new and want to build a Python terminal task tracker" }] });
assert.equal(projectDifficultyTurn.questionField, "project_difficulty");
assert.deepEqual(projectDifficultyTurn.suggestions, ["Basic", "Advanced"]);

const rejectedEngine = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Let's build it.",
  brief: { type: "guided_project", goal: "Build a platformer", subject: "Game development", language: "C#", framework: "Unity", desiredOutcome: "Playable platformer", priorKnowledge: "I know Python basics" }
}, { turn: 1, messages: [{ role: "user", content: "Build a Unity platformer. I know C# basics." }] });
assert.equal(rejectedEngine.status, "unsupported");
assert.equal(rejectedEngine.nextAction, "unsupported");
assert.match(rejectedEngine.reply, /plain code|unavailable/i);

const weaknessPractice = { type: "exercise", goal: "Practice my Python weaknesses", language: "Python", motivation: "Improve my fundamentals", practiceScope: "weaknesses", difficulty: "adaptive", exerciseCount: 10 };
assert.deepEqual(missingLearningBriefFields(weaknessPractice), []);
assert.equal(resolveLearningPolicy(weaknessPractice).nextAction, "confirm");
assert.equal(resolveLearningPolicy({ type: "course", goal: "Learn React", subject: "React", priorKnowledge: "JavaScript basics", supportMode: "standard" }).nextAction, "confirm");
assert.equal(resolveLearningPolicy({ type: "guided_project", goal: "Build a platformer", desiredOutcome: "Pygame platformer", language: "Python", priorKnowledge: "Python basics" }).nextAction, "unsupported");
assert.equal(resolveLearningPolicy({ type: "course", goal: "Learn React", subject: "React", priorKnowledge: "JavaScript basics", supportMode: "standard" }).requiresAssessment, false);

const completeCourse = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: {
    type: "course",
    goal: "Learn Python by building a budgeting CLI",
    subject: "Python",
    language: "Python",
    desiredOutcome: "A budgeting CLI project",
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  }
}, { turn: 1, messages: [{ role: "user", content: "I’m completely new. Teach me Python step by step through a budgeting CLI project." }] });
assert.equal(completeCourse.status, "clarifying");
assert.equal(completeCourse.questionField, "type");
assert.ok(completeCourse.suggestions.includes("Guided project"));

const rejectedLaunchTechnology = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: {
    type: "course",
    goal: "Learn Julia",
    subject: "Julia",
    language: "Julia",
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  }
}, { turn: 1, messages: [{ role: "user", content: "I am new. Teach me Julia step by step." }] });
assert.equal(rejectedLaunchTechnology.status, "clarifying");
assert.deepEqual(rejectedLaunchTechnology.missingFields, ["available_technology"]);
assert.match(rejectedLaunchTechnology.reply, /not enabled/i);
assert.ok(rejectedLaunchTechnology.suggestions.includes("Python"));
assert.ok(!rejectedLaunchTechnology.suggestions.includes("Julia"));

const conceptualInternetCourse = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Ready.",
  brief: {
    type: "course",
    domainId: "internet_web",
    goal: "Understand how the internet and web work",
    subject: "Internet and web fundamentals",
    focusAreas: ["DNS", "HTTP and HTTPS"],
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  }
}, { turn: 2, messages: [{ role: "user", content: "Teach me how the internet works, especially DNS and HTTP and HTTPS. I am new and want step-by-step guidance." }] });
assert.equal(conceptualInternetCourse.status, "ready");
assert.equal(conceptualInternetCourse.brief.domainId, "internet_web");
assert.equal(conceptualInternetCourse.brief.technologyId, undefined);

const conceptualQualityFixture = {
  schemaVersion: "course-content/v2",
  modules: [{
    topics: [{
      title: "How DNS connects names to servers",
      summary: "Learn the resolver path and verify understanding.",
      blocks: [
        {
          kind: "theory",
          steps: [{
            type: "theory",
            markdown: "DNS resolvers translate human-readable domain names into IP addresses by consulting cached records and authoritative name servers before a browser connects to the destination server."
          }]
        },
        {
          kind: "quiz",
          steps: Array.from({ length: 4 }, (_, index) => ({
            type: "mcq",
            prompt: `Which DNS component is responsible for resolver check ${index + 1}?`,
            options: ["Resolver", "Renderer", "Compiler", "Database table"],
            correctOptionIndex: 0,
            explanation: "The DNS resolver looks up and caches the address information needed to reach the destination server."
          }))
        }
      ]
    }]
  }]
};
const practicalQualityCodes = validateGeneratedCourseQuality(conceptualQualityFixture).map((warning) => warning.code);
const conceptualQualityCodes = validateGeneratedCourseQuality(conceptualQualityFixture, { conceptual: true }).map((warning) => warning.code);
assert.ok(practicalQualityCodes.includes("loaded_module_missing_practical_block"));
assert.ok(!conceptualQualityCodes.includes("loaded_module_missing_practical_block"));
const repeatedCadenceFixture = structuredClone(conceptualQualityFixture);
repeatedCadenceFixture.modules[0].topics = Array.from({ length: 3 }, (_, index) => ({
  ...structuredClone(conceptualQualityFixture.modules[0].topics[0]),
  title: `DNS concept ${index + 1}`
}));
assert.ok(
  validateGeneratedCourseQuality(repeatedCadenceFixture, { conceptual: true }).some((warning) => warning.code === "repetitive_topic_cadence"),
  "three identical topic practice signatures must trigger cadence repair"
);

const algorithmNeedsRuntime = normalizeLearningBrief({
  type: "course",
  domainId: "algorithms_data_structures",
  goal: "Learn algorithms and data structures",
  subject: "Algorithms and data structures",
  priorKnowledge: "Complete beginner",
  supportMode: "teaching_heavy"
});
assert.ok(missingLearningBriefFields(algorithmNeedsRuntime).includes("supported_technology"));

const focusTurn = normalizeLearningDiscoveryTurn({
  status: "clarifying",
  reply: "Which areas are you most interested in?",
  questionField: "focus_areas",
  selectionMode: "multi",
  suggestions: ["How the internet works", "URLs and DNS", "HTTP and HTTPS", "Web standards"],
  brief: {
    type: "course",
    domainId: "internet_web",
    goal: "Learn internet and web fundamentals",
    subject: "Internet and web fundamentals"
  }
}, { turn: 2, messages: [{ role: "user", content: "I want an internet fundamentals course" }] });
assert.equal(focusTurn.selectionMode, "multi");
assert.deepEqual(focusTurn.suggestions, ["How the internet works", "URLs and DNS", "HTTP and HTTPS", "Web standards"]);

const review = { strengths: ["Ready"], gaps: [], suggestedModules: ["Core"] };
assert.equal(normalizeLearningBrief({ type: "short_course", goal: "Understand closures", subject: "JavaScript closures", language: "JavaScript" }).type, "course");

const practiceProblems = Array.from({ length: 10 }, (_, index) => index < 7
  ? {
      id: `code-${index + 1}`,
      title: `Coding problem ${index + 1}`,
      summary: "Write a small loop.",
      kind: "code",
      difficulty: index < 3 ? "Beginner" : "Intermediate",
      primarySkill: "Python",
      parentLanguage: "Python",
      topicIds: ["loops"],
      blocks: [{
        id: `code-block-${index + 1}`,
        kind: "lab",
        title: "Loop lab",
        summary: "Independent loop practice.",
        steps: [{
          type: "lab",
          language: "Python",
          filePath: "main.py",
          context: "You are helping a tiny delivery shop prepare its package list before the driver leaves. The list already contains three package numbers, but the display is blank because nobody has written the loop that visits each package yet. The driver needs every number shown so no delivery is forgotten.",
          prompt: "Complete the delivery-list program by writing a loop that prints every package number. Keep the starter list intact, make the output include all three values, and do not print extra labels that would confuse the driver.",
          starterCode: "items = [1, 2, 3]\n",
          acceptanceCriteria: ["Uses a loop", "Prints every item"],
          workspaceView: "terminal",
          requiresPreview: false,
          requiresTerminal: true,
          workspaceFiles: [{ path: "main.py", content: "items = [1, 2, 3]\n" }]
        }]
      }]
    }
  : {
      id: `mcq-${index + 1}`,
      title: `Loop question ${index + 1}`,
      summary: "Recognize loop behavior.",
      kind: "mcq",
      difficulty: "Intermediate",
      primarySkill: "Python",
      parentLanguage: "Python",
      topicIds: ["loops"],
      blocks: [{
        id: `mcq-block-${index + 1}`,
        kind: "quiz",
        title: "Loop check",
        summary: "Check loop tracing.",
        steps: [{ type: "mcq", prompt: "How many values are printed?", options: ["One", "Two", "Three", "Four"], correctOptionIndex: 2, explanation: "The loop visits three values." }]
      }]
    });
const exerciseBrief = {
  type: "exercise",
  goal: "Practice Python loops for interviews",
  subject: "loops",
  language: "Python",
  motivation: "Prepare for interviews",
  practiceScope: "topics",
  topics: ["loops"],
  exerciseCount: 10,
  codingPercent: 70,
  difficulty: "adaptive"
};
const exercises = normalizeGeneratedLearningContent({
  title: "Loop practice",
  subject: "Python loops",
  description: "Ten loop problems.",
  languages: ["Python"],
  strategy: "adaptive",
  problems: practiceProblems
}, { brief: exerciseBrief });
assert.equal(exercises.schemaVersion, "exercise-session/v1");
assert.equal(exercises.problems.length, 10);
assert.equal(exercises.problems.filter((problem) => problem.kind === "code").length, 7);
assert.equal(exercises.problems.filter((problem) => problem.kind === "mcq").length, 3);
assert.equal(exercises.problems[0].primarySkill, "Python");
assert.throws(() => normalizeGeneratedLearningContent({ ...exercises, problems: [] }, { brief: exercises.learningBrief }), /module|problem count/i);
assert.throws(() => normalizeGeneratedLearningContent({ ...exercises, problems: practiceProblems.map((problem, index) => index < 7 ? problem : practiceProblems[0]) }, { brief: exercises.learningBrief }), /coding|MCQ/i);
const exerciseBatchPrompt = buildExerciseProblemBatchPrompt({
  brief: exerciseBrief,
  proposal: { items: [{ title: "Loop practice", summary: "Trace and write Python loops." }] },
  kind: "code",
  count: 4,
  batchIndex: 0,
  existingTitles: [],
  retrievedContext: [{ id: "python-loops", title: "Python loops", content: "A for statement iterates over items from an iterable." }]
});
assert.match(exerciseBatchPrompt, /exactly 4 coding problems/i);
assert.match(exerciseBatchPrompt, /exactly one block and exactly one step/i);
assert.match(exerciseBatchPrompt, /python-loops/i);
assert.match(exerciseBatchPrompt, /2-5 relevant files/i);
const normalizedCodeBatch = normalizeExerciseProblemBatch({ problems: practiceProblems.slice(0, 4) }, {
  brief: exerciseBrief,
  kind: "code",
  count: 4
});
assert.equal(normalizedCodeBatch.length, 4);
assert.ok(normalizedCodeBatch.every((problem) => problem.kind === "code" && problem.blocks[0].kind === "lab"));

const typescriptProblem = structuredClone(practiceProblems[0]);
typescriptProblem.parentLanguage = "TypeScript";
typescriptProblem.blocks[0].steps[0] = {
  ...typescriptProblem.blocks[0].steps[0],
  language: "TypeScript",
  filePath: "main.ts",
  starterCode: "const count: number = 0;",
  requiresPreview: true,
  requiresTerminal: false,
  workspaceFiles: [{ path: "main.ts", content: "const count: number = 0;", editable: true }]
};
const normalizedTypeScript = normalizeExerciseProblemBatch({ problems: [typescriptProblem] }, {
  brief: { ...exerciseBrief, language: "TypeScript", subject: "TypeScript loops", exerciseCount: 5 },
  kind: "code",
  count: 1
})[0].blocks[0].steps[0];
assert.equal(normalizedTypeScript.requiresPreview, false);
assert.equal(normalizedTypeScript.requiresTerminal, true);

const cssProblem = structuredClone(practiceProblems[0]);
cssProblem.parentLanguage = "CSS";
cssProblem.blocks[0].steps[0] = {
  ...cssProblem.blocks[0].steps[0],
  language: "CSS",
  filePath: "styles.css",
  starterCode: ".card { color: red; }",
  requiresPreview: true,
  requiresTerminal: false,
  workspaceFiles: [{ path: "styles.css", content: ".card { color: red; }", editable: true }]
};
const normalizedCss = normalizeExerciseProblemBatch({ problems: [cssProblem] }, {
  brief: { ...exerciseBrief, language: "CSS", subject: "CSS selectors", exerciseCount: 5 },
  kind: "code",
  count: 1
})[0].blocks[0].steps[0];
assert.equal(normalizedCss.requiresPreview, true);
assert.ok(normalizedCss.workspaceFiles.some((file) => file.path === "index.html" && file.content.includes("styles.css")));

const reactExerciseBrief = {
  type: "exercise",
  goal: "Practise React UI basics",
  subject: "React",
  language: "JavaScript",
  framework: "React",
  motivation: "Build interactive web interfaces",
  practiceScope: "topics",
  topics: ["components", "events"],
  exerciseCount: 10,
  codingPercent: 70,
  difficulty: "adaptive",
  priorKnowledge: "JavaScript basics"
};
const reactBatchPrompt = buildExerciseProblemBatchPrompt({
  brief: reactExerciseBrief,
  proposal: { items: [{ title: "React UI warm-ups", summary: "Practise focused component behaviors." }] },
  kind: "code",
  count: 1,
  positions: [0]
});
assert.match(reactBatchPrompt, /Problem 1: Beginner/);
assert.match(reactBatchPrompt, /real working Output preview/i);
const reactSource = 'const root = ReactDOM.createRoot(document.getElementById("app"));\nroot.render(React.createElement("button", null, "Add"));';
const reactProblem = structuredClone(practiceProblems[0]);
reactProblem.parentLanguage = "JavaScript";
reactProblem.difficulty = "Advanced";
reactProblem.blocks[0].steps[0] = {
  ...reactProblem.blocks[0].steps[0],
  language: "JavaScript",
  filePath: "App.jsx",
  starterCode: reactSource,
  acceptanceCriteria: ["A button is visible", "The button can receive a click"],
  requiresPreview: false,
  requiresTerminal: true,
  workspaceFiles: [
    { path: "index.html", content: '<!doctype html><html><head></head><body><main id="app"></main><script src="App.jsx"></script></body></html>', editable: false },
    { path: "styles.css", content: "button { padding: 0.75rem; }", editable: false },
    { path: "App.jsx", content: reactSource, editable: true }
  ]
};
const normalizedReactProblem = normalizeExerciseProblemBatch({ problems: [reactProblem] }, {
  brief: reactExerciseBrief,
  kind: "code",
  count: 1,
  positions: [0]
})[0];
const normalizedReactStep = normalizedReactProblem.blocks[0].steps[0];
assert.equal(normalizedReactProblem.difficulty, "Beginner", "exercise difficulty must follow the approved progressive position");
assert.equal(normalizedReactStep.filePath, "src/App.js");
assert.equal(normalizedReactStep.requiresPreview, true);
assert.equal(normalizedReactStep.requiresTerminal, false);
assert.ok(normalizedReactStep.workspaceFiles.length <= 5);
assert.ok(normalizedReactStep.workspaceFiles.some((file) => file.path === "styles.css"));
assert.ok(normalizedReactStep.workspaceFiles.some((file) => file.path === "src/App.js"));
assert.match(normalizedReactStep.workspaceFiles.find((file) => file.path === "index.html").content, /react(?:-dom)?\.production\.min\.js/i);
assert.match(normalizedReactStep.workspaceFiles.find((file) => file.path === "index.html").content, /src\/App\.js/);
assert.equal(normalizeExerciseProblemBatch({ problems: practiceProblems.slice(0, 5) }, {
  brief: exerciseBrief,
  kind: "code",
  count: 4
}).length, 4, "valid model overfill should be truncated to the approved batch count");
const normalizedMcqBatch = normalizeExerciseProblemBatch({ problems: practiceProblems.slice(7) }, {
  brief: exerciseBrief,
  kind: "mcq",
  count: 3,
  offset: 7
});
assert.equal(normalizedMcqBatch.length, 3);
assert.ok(normalizedMcqBatch.every((problem) => problem.kind === "mcq" && problem.blocks[0].kind === "quiz"));
assert.equal(
  normalizeExerciseProblemBatch({ problems: practiceProblems.slice(0, 3) }, { brief: exerciseBrief, kind: "code", count: 4 }).length,
  3,
  "valid partial model batches should be retained so the worker can request the remainder"
);
assert.throws(
  () => normalizeExerciseProblemBatch({ problems: [] }, { brief: exerciseBrief, kind: "code", count: 4 }),
  /no problems/i
);

const projectBrief = { type: "guided_project", goal: "Build a browser counter", desiredOutcome: "Interactive counter page", language: "JavaScript", platform: "web", priorKnowledge: "JavaScript basics", projectDifficulty: "basic" };
const browserStates = Array.from({ length: 10 }, (_, index) => `<!doctype html>\n<button id="counter">Count ${index + 1}</button>\n<script>\n  const buildStep = ${index + 1};\n<\/script>\n`);
const guidedSteps = browserStates.map((resultCode, index) => ({
  id: `project-step-${index + 1}`,
  type: "workshop",
  language: "HTML",
  filePath: "index.html",
  context: "Build one small part of the same browser counter.",
  prompt: `Add browser code unit ${index + 1}.`,
  edit: index === 0
    ? { operation: "create", replace: resultCode }
    : { find: browserStates[index - 1], replace: resultCode },
  expectedChange: `Browser code unit ${index + 1} is present.`,
  codeExplanation: "This explains only the code introduced in this step.",
  suggestedQuestions: ["Why this line?", "What changes visually?"],
  acceptanceCriteria: [`Completes micro-step ${index + 1}`, "Keeps earlier code"],
  workspaceView: "code",
  requiresPreview: true,
  requiresTerminal: false
}));
const project = normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Browser counter",
  subject: "JavaScript",
  description: "Build an interactive browser counter.",
  languages: ["JavaScript", "HTML"],
  architecture: { deliverable: "Interactive counter", stack: ["HTML", "JavaScript"], capabilities: ["events", "state"] },
  module: {
    id: "guided-project",
    title: "Build the counter",
    summary: "Understand, build, and review one interactive counter.",
    blocks: [
      { id: "project-introduction", kind: "theory", title: "Understand the project", summary: "Learn the architecture first.", steps: Array.from({ length: 6 }, (_, index) => ({ type: "theory", markdown: `## Orientation ${index + 1}\n\nProject purpose and relevant refresher ${index + 1}.` })) },
      { id: "project-foundation-theory", kind: "theory", title: "Understand the counter foundation", summary: "Learn the document and state model.", steps: [{ type: "theory", markdown: "## Counter structure\n\nThe button is the visible control, while the stored count is the source of truth that future interaction will update." }, { type: "example", markdown: "## Data flow\n\nA click enters through the event handler, changes the stored count, and then updates the button text." }] },
      { id: "project-foundation", kind: "workshop", title: "Build the counter foundation", summary: "Create the visible counter in micro-steps.", steps: guidedSteps.slice(0, 5) },
      { id: "project-interaction-theory", kind: "theory", title: "Understand counter interaction", summary: "Learn events and updates before editing.", steps: [{ type: "theory", markdown: "## Event handling\n\nA click listener connects the browser event to one function responsible for changing project state." }, { type: "example", markdown: "## Update path\n\nAfter state changes, the display reads the new value so the interface and data stay synchronized." }] },
      { id: "project-interaction", kind: "workshop", title: "Add counter interaction", summary: "Add the interactive behavior in micro-steps.", steps: guidedSteps.slice(5) },
      { id: "project-recap", kind: "theory", title: "How it works", summary: "Connect the completed code.", steps: Array.from({ length: 5 }, (_, index) => ({ type: "summary", markdown: `## Recap ${index + 1}\n\nFinished-project connection ${index + 1}.` })) }
    ]
  }
}, { brief: projectBrief, assessmentReview: review });
assert.equal(project.schemaVersion, "guided-project-content/v2");
assert.equal(project.module.blocks.length, 6);
assert.equal(project.module.blocks[0].kind, "theory");
assert.ok(project.module.blocks[0].steps.length >= 1 && project.module.blocks[0].steps.length <= 4);
assert.equal(project.module.blocks[1].kind, "theory");
assert.equal(project.module.blocks[2].kind, "workshop");
assert.equal(project.module.blocks[2].steps.filter((step) => step.type === "workshop").length, 5);
assert.equal(project.module.blocks[3].kind, "theory");
assert.equal(project.module.blocks[4].kind, "workshop");
assert.equal(project.module.blocks[4].steps.filter((step) => step.type === "workshop").length, 5);
assert.equal(project.module.blocks[5].kind, "theory");
assert.ok(project.module.blocks[5].steps.length >= 1 && project.module.blocks[5].steps.length <= 2);
const normalizedBrowserSteps = project.module.blocks.slice(1, -1).flatMap((block) => block.steps.filter((step) => step.type === "workshop"));
assert.equal(normalizedBrowserSteps[0].starterCode, "");
assert.equal(project.module.blocks[4].steps.find((step) => step.type === "workshop").starterCode, project.module.blocks[2].steps.filter((step) => step.type === "workshop").at(-1).resultCode);
assert.ok(normalizedBrowserSteps.every((step) => step.starterCode.trim() !== step.resultCode.trim()));
assert.ok(normalizedBrowserSteps.every((step) => step.requiresPreview && !step.requiresTerminal));
assert.ok(normalizedBrowserSteps.every((step) => !step.workspaceFiles.some((file) => file.path === "preview/index.html")));
const coercedProject = normalizeGeneratedLearningContent({
  ...project,
  module: {
    ...project.module,
    blocks: project.module.blocks.map((block, index) => index === 2
      ? { ...block, kind: "guided_workshop", steps: block.steps.filter((step) => step.type === "workshop").map((step) => ({ ...step, type: "code" })) }
      : block)
  }
}, { brief: projectBrief, assessmentReview: review });
assert.equal(coercedProject.module.blocks[2].steps.filter((step) => step.type === "workshop").length, 5);
const compactSteps = Array.from({ length: 10 }, (_, index) => ({
  id: `compact-${index + 1}`,
  type: "workshop",
  language: "Python",
  filePath: "main.py",
  context: "Continue the same small project with one exact and explainable code edit.",
  prompt: `Change the project marker from ${index} to ${index + 1} and inspect the new state.`,
  edit: { find: `step = ${index}`, replace: `step = ${index + 1}` },
  expectedChange: `The project marker becomes ${index + 1}.`,
  codeExplanation: "This changes only the current project marker.",
  suggestedQuestions: ["Why this edit?", "What changes next?"],
  acceptanceCriteria: [`Uses step = ${index + 1}`, "Keeps the file runnable"],
  workspaceView: "terminal",
  requiresPreview: false,
  requiresTerminal: true
}));
const compactProject = normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Compact project",
  subject: "Python",
  description: "Verify compact project edits.",
  languages: ["Python"],
  workspaceFiles: [{ path: "main.py", content: "step = 0\n" }],
  module: {
    id: "guided-project",
    title: "Compact project",
    summary: "One continuous build.",
    blocks: [
      project.module.blocks[0],
      project.module.blocks[1],
      { id: "compact-foundation", kind: "workshop", title: "Build the foundation", summary: "Build it.", steps: compactSteps.slice(0, 5) },
      project.module.blocks[3],
      { id: "compact-feature", kind: "workshop", title: "Add the feature", summary: "Finish it.", steps: compactSteps.slice(5) },
      project.module.blocks.at(-1)
    ]
  }
}, { brief: { ...projectBrief, goal: "Fix an existing Python project marker", language: "Python", platform: "terminal", desiredOutcome: "Repair the existing marker" }, assessmentReview: review });
assert.match(compactProject.module.blocks[4].steps.filter((step) => step.type === "workshop").at(-1).resultCode, /step = 10/);
const expandedCompactSteps = Array.from({ length: 36 }, (_, index) => ({
  id: `expanded-${index + 1}`,
  type: "workshop",
  language: "Python",
  filePath: "main.py",
  context: "Continue the same complete terminal project with one explainable edit.",
  prompt: `Advance the project marker from ${index} to ${index + 1}.`,
  edit: { find: `step = ${index}`, replace: `step = ${index + 1}` },
  expectedChange: `The project marker becomes ${index + 1}.`,
  codeExplanation: "This advances the current project state.",
  suggestedQuestions: ["Why this edit?", "What comes next?"],
  acceptanceCriteria: [`Uses step = ${index + 1}`],
  workspaceView: "terminal",
  requiresPreview: false,
  requiresTerminal: true
}));
const expandedProject = normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Expanded project",
  subject: "Python",
  description: "Preserve a larger valid guided project.",
  languages: ["Python"],
  workspaceFiles: [{ path: "main.py", content: "step = 0\n" }],
  module: {
    id: "guided-project",
    title: "Expanded project",
    summary: "One continuous larger build.",
    blocks: [
      project.module.blocks[0],
      ...Array.from({ length: 6 }, (_, index) => ([
        {
          id: `expanded-feature-${index + 1}-theory`,
          kind: "theory",
          title: `Understand feature ${index + 1}`,
          summary: `Learn how feature ${index + 1} connects to the project.`,
          steps: [{ type: "theory", markdown: `## Feature ${index + 1}\n\nUnderstand the state and control flow used by this capability before editing it.` }]
        },
        {
          id: `expanded-feature-${index + 1}`,
          kind: "workshop",
          title: `Feature ${index + 1}`,
          summary: `Build feature ${index + 1}.`,
          steps: expandedCompactSteps.slice(index * 6, index * 6 + 6)
        }
      ])).flat(),
      project.module.blocks.at(-1)
    ]
  }
}, { brief: { ...projectBrief, goal: "Build a larger Python terminal project", language: "Python", platform: "terminal", desiredOutcome: "A complete larger terminal project", projectDifficulty: "advanced" }, assessmentReview: review });
assert.equal(
  expandedProject.module.blocks.slice(1, -1).flatMap((block) => block.steps.filter((step) => step.type === "workshop")).length,
  36,
  "larger valid guided projects must not fail or lose teaching steps"
);
assert.throws(() => normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Incomplete Pygame platformer",
  subject: "Pygame",
  description: "The recap is missing.",
  languages: ["Python"],
  module: { id: "guided-project", title: "Incomplete", blocks: project.module.blocks.slice(0, 2) }
}, { brief: projectBrief, assessmentReview: review }), /taught feature workshops/i);
const rebalancedProject = normalizeGeneratedLearningContent({
  ...project,
  module: { ...project.module, blocks: [project.module.blocks[0], project.module.blocks[1], { ...project.module.blocks[2], steps: project.module.blocks[2].steps.filter((step) => step.type === "workshop").slice(0, 3) }, project.module.blocks[3], project.module.blocks[4], project.module.blocks[5]] }
}, { brief: projectBrief, assessmentReview: review });
assert.ok(
  rebalancedProject.module.blocks.slice(1, -1).filter((block) => block.kind === "workshop").every((block) => block.steps.filter((step) => step.type === "workshop").length === 4),
  "undersized model feature blocks should rebalance without losing ordered microsteps"
);
assert.throws(() => normalizeGeneratedLearningContent({
  ...project,
  module: { ...project.module, blocks: [project.module.blocks[0], project.module.blocks[1], { ...project.module.blocks[2], steps: project.module.blocks[2].steps.filter((step) => step.type === "workshop").slice(0, 2) }, project.module.blocks[3], project.module.blocks[4], project.module.blocks[5]] }
}, { brief: projectBrief, assessmentReview: review }), /at least 8 guided coding steps/i);
const repairPrompt = buildLearningExperienceRepairPrompt({
  originalPrompt: "Generate a guided project.",
  invalidOutput: '{"module":{"blocks":[]}}',
  validationError: "Guided project needs feature blocks."
});
assert.match(repairPrompt, /complete replacement JSON/i);
assert.match(repairPrompt, /one project module/i);
assert.match(repairPrompt, /feature-theory \+ feature-workshop pairs/i);

console.log("Learning orchestrator verification passed.");
