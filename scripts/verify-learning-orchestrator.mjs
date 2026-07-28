import assert from "node:assert/strict";
import { createFallbackGeneratedCourseFromAssessment } from "../server/course-generation.mjs";
import {
  initialLearningSuggestions,
  missingLearningBriefFields,
  normalizeLearningDiscoveryTurn,
  resolveExerciseMixCounts,
  resolveLearningPolicy
} from "../server/learning-orchestrator/contracts.mjs";
import {
  buildLearningExperienceRepairPrompt,
  normalizeGeneratedLearningContent
} from "../server/learning-orchestrator/generation.mjs";

const firstTurn = normalizeLearningDiscoveryTurn({ reply: "Hello" }, { turn: 0 });
assert.match(firstTurn.reply, /hello|what are we working on today/i);
assert.deepEqual(firstTurn.suggestions, initialLearningSuggestions);

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
}, { turn: 1 });
assert.equal(vagueProject.status, "clarifying");
assert.deepEqual(vagueProject.missingFields, ["technology_or_platform", "prior_knowledge"]);
assert.ok(vagueProject.suggestions.length >= 2);

const groundedPygame = normalizeLearningDiscoveryTurn({
  status: "ready",
  reply: "Let's build it.",
  brief: { type: "guided_project", goal: "Build a platformer", subject: "Game development", language: "C#", framework: "Unity", desiredOutcome: "Playable platformer", priorKnowledge: "I know Python basics" }
}, { turn: 1, messages: [{ role: "user", content: "Build a Pygame platformer. I know Python basics." }] });
assert.equal(groundedPygame.brief.language, "Python");
assert.equal(groundedPygame.brief.framework, "Pygame");

const weaknessPractice = { type: "exercise", goal: "Practice my weaknesses", motivation: "Improve my fundamentals", practiceScope: "weaknesses", difficulty: "adaptive", exerciseCount: 10 };
assert.deepEqual(missingLearningBriefFields(weaknessPractice), []);
assert.equal(resolveLearningPolicy(weaknessPractice).nextAction, "confirm");
assert.equal(resolveLearningPolicy({ type: "course", goal: "Learn React", subject: "React", priorKnowledge: "JavaScript basics" }).nextAction, "assessment_offer");
assert.equal(resolveLearningPolicy({ type: "guided_project", goal: "Build a platformer", desiredOutcome: "Pygame platformer", language: "Python", priorKnowledge: "Python basics" }).nextAction, "assessment_offer");

const review = { strengths: ["Ready"], gaps: [], suggestedModules: ["Core"] };
const base = createFallbackGeneratedCourseFromAssessment({ subject: "Python", assessmentReview: review });
const shortCourse = normalizeGeneratedLearningContent({
  title: "Closures",
  subject: "JavaScript closures",
  description: "A focused closure lesson.",
  languages: ["JavaScript"],
  sections: base.modules[0].topics
}, { brief: { type: "short_course", goal: "Understand closures", subject: "JavaScript closures", language: "JavaScript" } });
assert.equal(shortCourse.schemaVersion, "short-course-content/v1");

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
          context: "Practise loops for interview-style data processing.",
          prompt: "Write a loop that prints every item.",
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

const projectBrief = { type: "guided_project", goal: "Build a Pygame platformer", desiredOutcome: "Playable platformer", language: "Python", framework: "Pygame", platform: "desktop", priorKnowledge: "Python basics" };
const pygameStates = [
  "import pygame\n",
  "import pygame\n\npygame.init()\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\nPLAYER = pygame.Rect(80, 330, 40, 40)\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\nPLAYER = pygame.Rect(80, 330, 40, 40)\nSPEED = 5\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\nPLAYER = pygame.Rect(80, 330, 40, 40)\nSPEED = 5\nrunning = True\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\nPLAYER = pygame.Rect(80, 330, 40, 40)\nSPEED = 5\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n",
  "import pygame\n\npygame.init()\n\nWIDTH = 800\nHEIGHT = 450\nSCREEN = pygame.display.set_mode((WIDTH, HEIGHT))\nCLOCK = pygame.time.Clock()\nPLAYER = pygame.Rect(80, 330, 40, 40)\nSPEED = 5\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    SCREEN.fill('#101722')\n    pygame.draw.rect(SCREEN, '#77d2a6', PLAYER)\n    pygame.display.flip()\n    CLOCK.tick(60)\n"
];
const guidedSteps = pygameStates.map((resultCode, index) => ({
  id: `project-step-${index + 1}`,
  type: "workshop",
  language: "Python",
  filePath: "main.py",
  context: "Build one small part of the same Pygame platformer.",
  prompt: `Add platformer code unit ${index + 1}.`,
  edit: index === 0
    ? { operation: "create", replace: resultCode }
    : { find: pygameStates[index - 1], replace: resultCode },
  expectedChange: `Platformer code unit ${index + 1} is present.`,
  codeExplanation: "This explains only the code introduced in this step.",
  suggestedQuestions: ["Why this line?", "What changes visually?"],
  acceptanceCriteria: [`Completes micro-step ${index + 1}`, "Keeps earlier code"],
  workspaceView: "code",
  requiresPreview: true,
  requiresTerminal: true,
  visualState: {
    title: "Pygame platformer",
    status: `Visual state after code unit ${index + 1}`,
    viewport: { width: 800, height: 450, background: "#101722" },
    objects: index >= 5 ? [{ kind: "rectangle", x: 80, y: 330, width: 40, height: 40, color: "#77d2a6", label: "Player" }] : []
  }
}));
const project = normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Pygame platformer",
  subject: "Pygame",
  description: "Build a playable platformer.",
  languages: ["Python"],
  architecture: { deliverable: "Playable platformer", stack: ["Python", "Pygame"], capabilities: ["movement", "collision"] },
  module: {
    id: "guided-project",
    title: "Build the platformer",
    summary: "Understand, build, and review one playable platformer.",
    blocks: [
      { id: "project-introduction", kind: "theory", title: "Understand the project", summary: "Learn the architecture first.", steps: Array.from({ length: 6 }, (_, index) => ({ type: "theory", markdown: `## Orientation ${index + 1}\n\nProject purpose and relevant refresher ${index + 1}.` })) },
      { id: "project-build", kind: "workshop", title: "Build the project", summary: "Finish the playable project in micro-steps.", steps: guidedSteps },
      { id: "project-recap", kind: "theory", title: "How it works", summary: "Connect the completed code.", steps: Array.from({ length: 5 }, (_, index) => ({ type: "summary", markdown: `## Recap ${index + 1}\n\nFinished-project connection ${index + 1}.` })) }
    ]
  }
}, { brief: projectBrief, assessmentReview: review });
assert.equal(project.schemaVersion, "guided-project-content/v2");
assert.equal(project.module.blocks.length, 3);
assert.equal(project.module.blocks[0].kind, "theory");
assert.ok(project.module.blocks[0].steps.length >= 1 && project.module.blocks[0].steps.length <= 3);
assert.equal(project.module.blocks[1].kind, "workshop");
assert.equal(project.module.blocks[1].steps.filter((step) => step.type === "workshop").length, 10);
assert.equal(project.module.blocks[2].kind, "theory");
assert.ok(project.module.blocks[2].steps.length >= 1 && project.module.blocks[2].steps.length <= 2);
const normalizedPygameSteps = project.module.blocks[1].steps.filter((step) => step.type === "workshop");
assert.equal(normalizedPygameSteps[0].starterCode, "");
assert.match(normalizedPygameSteps[0].resultCode, /import pygame/);
assert.doesNotMatch(normalizedPygameSteps[0].resultCode, /pygame\.init/);
assert.match(normalizedPygameSteps[1].resultCode, /pygame\.init\(\)/);
assert.match(normalizedPygameSteps[2].resultCode, /WIDTH\s*=.*[\s\S]*HEIGHT\s*=/);
assert.ok(normalizedPygameSteps.every((step) => step.starterCode.trim() !== step.resultCode.trim()));
assert.ok(normalizedPygameSteps.every((step) => step.requiresPreview && step.requiresTerminal));
assert.ok(normalizedPygameSteps.every((step) => step.workspaceFiles.some((file) => file.path === "preview/index.html" && /stonecode-source/.test(file.content))));
const coercedProject = normalizeGeneratedLearningContent({
  ...project,
  module: {
    ...project.module,
    blocks: project.module.blocks.map((block, index) => index === 1
      ? { ...block, kind: "guided_workshop", steps: block.steps.filter((step) => step.type === "workshop").map((step) => ({ ...step, type: "code" })) }
      : block)
  }
}, { brief: projectBrief, assessmentReview: review });
assert.equal(coercedProject.module.blocks[1].steps.filter((step) => step.type === "workshop").length, 10);
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
    blocks: [project.module.blocks[0], { id: "compact-build", kind: "workshop", title: "Build", summary: "Build it.", steps: compactSteps }, project.module.blocks[2]]
  }
}, { brief: { ...projectBrief, goal: "Fix an existing Python project marker", framework: undefined, desiredOutcome: "Repair the existing marker" }, assessmentReview: review });
assert.match(compactProject.module.blocks[1].steps.filter((step) => step.type === "workshop").at(-1).resultCode, /step = 10/);
const unityStates = Array.from({ length: 10 }, (_, index) => `${Array.from({ length: index + 1 }, (__, line) => `// Unity code micro-step ${line + 1}`).join("\n")}\n`);
const unityProject = normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Unity platformer",
  subject: "Unity",
  description: "Build a platformer controller for Unity.",
  languages: ["C#"],
  workspaceFiles: [{ path: "PlayerController.cs", content: "" }],
  module: {
    id: "guided-project",
    title: "Unity platformer",
    summary: "Build the controller in code.",
    blocks: [
      project.module.blocks[0],
      {
        id: "unity-build",
        kind: "workshop",
        title: "Build the controller",
        summary: "Use Code without pretending to render the Unity scene.",
        steps: unityStates.map((resultCode, index) => ({
          id: `unity-step-${index + 1}`,
          type: "workshop",
          language: "C#",
          filePath: "PlayerController.cs",
          context: "Continue one Unity controller file.",
          prompt: `Add Unity code micro-step ${index + 1}.`,
          edit: index === 0 ? { operation: "create", replace: resultCode } : { find: unityStates[index - 1], replace: resultCode },
          expectedChange: `Unity code micro-step ${index + 1} is present.`,
          codeExplanation: "This is one controller edit.",
          suggestedQuestions: ["Why this edit?", "Where is this used in Unity?"],
          acceptanceCriteria: [`Includes micro-step ${index + 1}`, "Keeps prior code"],
          workspaceView: "preview",
          requiresPreview: true,
          requiresTerminal: true,
          visualState: { title: "Unity scene", status: "Do not render this", objects: [] }
        }))
      },
      project.module.blocks[2]
    ]
  }
}, {
  brief: { type: "guided_project", goal: "Build a Unity platformer", framework: "Unity", language: "C#", desiredOutcome: "Playable Unity platformer", priorKnowledge: "C# basics" },
  assessmentReview: review
});
const normalizedUnitySteps = unityProject.module.blocks[1].steps.filter((step) => step.type === "workshop");
assert.ok(normalizedUnitySteps.every((step) => !step.requiresPreview && !step.requiresTerminal && step.workspaceView === "code"));
assert.ok(normalizedUnitySteps.every((step) => !step.workspaceFiles.some((file) => file.path.endsWith(".html"))));
assert.throws(() => normalizeGeneratedLearningContent({
  schemaVersion: "guided-project-content/v2",
  title: "Incomplete Pygame platformer",
  subject: "Pygame",
  description: "The recap is missing.",
  languages: ["Python"],
  module: { id: "guided-project", title: "Incomplete", blocks: project.module.blocks.slice(0, 2) }
}, { brief: projectBrief, assessmentReview: review }), /three blocks/i);
assert.throws(() => normalizeGeneratedLearningContent({
  ...project,
  module: { ...project.module, blocks: [project.module.blocks[0], { ...project.module.blocks[1], steps: project.module.blocks[1].steps.filter((step) => step.type === "workshop").slice(0, 9) }, project.module.blocks[2]] }
}, { brief: projectBrief, assessmentReview: review }), /10 to 20 guided coding steps/i);
const repairPrompt = buildLearningExperienceRepairPrompt({
  originalPrompt: "Generate a guided project.",
  invalidOutput: '{"module":{"blocks":[]}}',
  validationError: "Guided project requires exactly one module with three blocks."
});
assert.match(repairPrompt, /complete replacement JSON/i);
assert.match(repairPrompt, /one project module/i);
assert.match(repairPrompt, /10-20 step workshop/i);

console.log("Learning orchestrator verification passed.");
