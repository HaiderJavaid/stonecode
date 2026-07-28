import assert from "node:assert/strict";
import {
  buildAssessmentPlanPrompt,
  buildAssessmentCourseContentPrompt,
  buildAssessmentCourseGenerationPrompt,
  buildAssessmentModuleContentPrompt,
  buildAssessmentCourseOutlinePrompt,
  buildAssessmentQuestionPrompt,
  buildBlockGenerationPrompt,
  buildGeneratedCourseRepairPrompt,
  buildGeneratedModuleRepairPrompt,
  buildGeneratedTopicRepairPrompt,
  buildLearnerGenerationContext,
  buildCourseBlueprintPrompt,
  buildCourseDiscoveryPrompt,
  buildCourseSyllabusFromContent,
  createFallbackAssessmentReview,
  createFallbackAssessmentQuestion,
  createFallbackGeneratedCourse,
  createFallbackGeneratedCourseFromAssessment,
  createFallbackGeneratedChapter,
  createGeneratedCourseSkeletonFromOutline,
  extractGeneratedModuleFromResponse,
  extractGeneratedTopicFromResponse,
  normalizeAssessmentPlan,
  normalizeCourseDiscoveryTurn,
  normalizeGeneratedCourseContent,
  readEditableCourseGenerationRules,
  resolveAssessmentPlan,
  retrieveStaticCourseGenerationContext,
  stabilizeAssessmentQuestion
} from "../server/course-generation.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  groupGeneratedCourseWarningsByTopic,
  hasBlockingGeneratedCourseQualityWarnings,
  hasRepairableGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "../server/course-generation-quality.mjs";
import {
  classifyCourseIntent,
  isSupportedProgrammingSubject,
  resolveCourseLanguageCapability
} from "../server/course-generation/language-capabilities.mjs";
import { requestCourseGenerationJson, resolveProviderConfig } from "../server/llm-providers.mjs";

const editableRules = readEditableCourseGenerationRules();
assert.ok(editableRules.includes("# AI Course Generation Rules"), "editable course-generation rulebook should exist");
assert.ok(editableRules.includes("Initial Generation Rule"), "rulebook should explain module 1 upfront generation");
assert.ok(editableRules.includes("Workshop Blocks"), "rulebook should expose workshop behavior");
assert.ok(editableRules.includes("Hidden Course Blueprint"), "rulebook should expose project-spine behavior");
assert.ok(editableRules.includes("Practice Progression Rule"), "rulebook should expose workshop-first practice progression");
assert.ok(editableRules.includes("RAG Rules"), "rulebook should expose retrieval behavior");

const initialDiscoveryPrompt = buildCourseDiscoveryPrompt({ messages: [], turn: 0 });
assert.ok(initialDiscoveryPrompt.includes("5 to 6 varied recommended programming starting points"), "initial discovery should request AI-generated starting suggestions");
assert.ok(initialDiscoveryPrompt.includes("Ask only one main clarification question"), "discovery should ask one question at a time");
assert.ok(initialDiscoveryPrompt.includes("does not need to know a language/framework") || initialDiscoveryPrompt.includes("does not know a language/framework"), "discovery should support outcome-first beginners");
assert.ok(initialDiscoveryPrompt.includes("Do not fabricate live popularity"), "discovery must not fake user-trend data");
const vagueDiscoveryPrompt = buildCourseDiscoveryPrompt({
  messages: [
    { role: "assistant", content: "What would you like to build?" },
    { role: "user", content: "I want to make a game." }
  ],
  turn: 1
});
assert.ok(vagueDiscoveryPrompt.includes("I want to make a game."), "discovery prompt should include learner conversation context");
const normalizedDiscovery = normalizeCourseDiscoveryTurn({
  status: "clarifying",
  reply: "What kind of game would you enjoy making first?",
  suggestions: ["A 2D desktop game", "A browser game", "A mobile game", "I am not sure yet"],
  resolvedSubject: "should be cleared"
});
assert.equal(normalizedDiscovery.resolvedSubject, "");
assert.equal(normalizedDiscovery.suggestions.length, 4);
const readyDiscovery = normalizeCourseDiscoveryTurn({
  status: "ready",
  reply: "Great, I have enough to plan your course.",
  suggestions: ["ignored"],
  resolvedSubject: "2D desktop games with Python and Pygame"
});
assert.equal(readyDiscovery.resolvedSubject, "2D desktop games with Python and Pygame");
assert.deepEqual(readyDiscovery.suggestions, []);
assert.throws(() => normalizeCourseDiscoveryTurn({ status: "clarifying", reply: "Choose one", suggestions: ["Only one"] }), /at least two/);

const assessmentPrompt = buildAssessmentQuestionPrompt({
  subject: "Machine Learning",
  step: 2,
  answers: [{ questionId: "q1", type: "mcq", skipped: true }]
});
const assessmentPlanPrompt = buildAssessmentPlanPrompt({ subject: "Next.js" });
assert.ok(assessmentPlanPrompt.includes("Return JSON only"), "assessment plan prompt must require JSON");
assert.ok(assessmentPlanPrompt.includes("prerequisiteAreas"), "assessment plan prompt must ask for prerequisite areas");
assert.ok(assessmentPlanPrompt.includes("Non-code subjects"), "assessment plan prompt must reject non-code subjects");
assert.ok(assessmentPlanPrompt.includes("Editable course-generation rules"), "assessment plan prompt should include editable rulebook");
const normalizedNextPlan = normalizeAssessmentPlan({
  supported: true,
  targetSubject: "Next.js",
  courseCategory: "framework",
  requiresAssessment: true,
  prerequisiteAreas: [
    { id: "javascript", title: "JavaScript basics", reason: "Next.js uses JS.", startingDifficulty: "mid" },
    { id: "react", title: "React fundamentals", reason: "Next.js builds on React.", startingDifficulty: "mid" },
    { id: "http", title: "Request/response", reason: "Next.js uses routing.", startingDifficulty: "basic" }
  ]
}, "Next.js");
assert.equal(normalizedNextPlan.supported, true);
assert.equal(normalizedNextPlan.requiresAssessment, true);
assert.deepEqual(normalizedNextPlan.prerequisiteAreas.map((area) => area.id), ["javascript", "react", "http"]);
const normalizedCookingPlan = normalizeAssessmentPlan({ supported: false, reason: "Cooking is unavailable." }, "Italian cooking");
assert.equal(normalizedCookingPlan.supported, false);
assert.equal(normalizedCookingPlan.requiresAssessment, false);
assert.ok(assessmentPrompt.includes("plausible misconception"));
assert.ok(assessmentPrompt.includes("similar length"));
assert.ok(assessmentPrompt.includes("drop one difficulty level"));
assert.ok(assessmentPrompt.includes("Do not keep asking hard questions after a wrong or skipped answer"));
assert.ok(assessmentPrompt.includes("readiness signals"));
assert.ok(assessmentPrompt.includes("Pick exactly one assessment intent"));
assert.ok(assessmentPrompt.includes("must not mention your assessment intent"));
assert.ok(assessmentPrompt.includes("Never ask more than one consecutive question about the same concept"));
assert.ok(!assessmentPrompt.includes("internally decide"));
assert.ok(assessmentPrompt.includes('The product UI has an "I don\'t know" button'));
assert.ok(assessmentPrompt.includes("do not make the correct option longer"));
assert.ok(!assessmentPrompt.includes('"questionKind":"course_shaping"'));
assert.ok(assessmentPrompt.includes("prerequisite knowledge"));
assert.ok(assessmentPrompt.includes("Do not default to A or B"));
assert.ok(assessmentPrompt.includes("Editable course-generation rules"), "assessment question prompt should include editable rulebook");

const fallbackAssessment = createFallbackAssessmentQuestion({ subject: "Machine Learning", step: 0 });
assert.equal(fallbackAssessment.type, "mcq");
assert.equal(fallbackAssessment.options.length, 4);
assert.equal(fallbackAssessment.questionKind, "prerequisite");
assert.ok(fallbackAssessment.assessmentArea, "fallback assessment should include a prerequisite area");
const reactAssessmentPlan = resolveAssessmentPlan("React apps");
assert.ok(reactAssessmentPlan.requiresAssessment);
assert.deepEqual(reactAssessmentPlan.areas.map((area) => area.id), ["javascript", "html", "css"]);
const nextAssessmentPlan = resolveAssessmentPlan("Next.js");
assert.ok(nextAssessmentPlan.requiresAssessment);
assert.deepEqual(nextAssessmentPlan.areas.map((area) => area.id), ["javascript", "react", "http"]);
const cppGameAssessmentPlan = resolveAssessmentPlan("C++ game development");
assert.ok(cppGameAssessmentPlan.requiresAssessment);
assert.deepEqual(cppGameAssessmentPlan.areas.map((area) => area.id), ["cpp-syntax", "variables", "functions"]);
const cppFundamentalsPlan = resolveAssessmentPlan("C++ fundamentals");
assert.equal(cppFundamentalsPlan.requiresAssessment, false);
assert.equal(cppFundamentalsPlan.supported, true);
const pygamePlan = normalizeAssessmentPlan({
  supported: true,
  targetSubject: "Unity with C#",
  requiresAssessment: true,
  prerequisiteAreas: [{ id: "csharp", title: "C# basics", reason: "Wrong stack", startingDifficulty: "mid" }]
}, "Pygame");
assert.equal(pygamePlan.targetSubject, "Pygame", "assessment target must remain grounded in the confirmed brief");
assert.deepEqual(pygamePlan.prerequisiteAreas.map((area) => area.id), ["python-syntax", "variables", "functions"]);
const cookingAssessmentPlan = resolveAssessmentPlan("Italian cooking");
assert.equal(cookingAssessmentPlan.supported, false);
assert.equal(cookingAssessmentPlan.requiresAssessment, false);
for (const language of ["Python", "Java", "C++", "C#", "Kotlin", "Swift", "Dart", "Go", "Rust", "Ruby", "PHP", "R programming", "Julia", "Fortran", "COBOL", "BASIC"]) {
  assert.equal(resolveAssessmentPlan(language).requiresAssessment, false, `${language} fundamentals should start without assessment`);
  assert.equal(isSupportedProgrammingSubject(language), true, `${language} should be an allowed programming subject`);
}
for (const target of ["React", "Next.js", "Flutter", "Unity", "Node.js", "Rust concurrency", "Python automation", "Java game development"]) {
  assert.equal(resolveAssessmentPlan(target).requiresAssessment, true, `${target} should assess prerequisites`);
}
assert.equal(classifyCourseIntent("Python").kind, "language-fundamentals");
assert.equal(classifyCourseIntent("Django").kind, "framework");
assert.equal(normalizeAssessmentPlan({ supported: true, targetSubject: "Python", requiresAssessment: true, prerequisiteAreas: [{ title: "Wrong" }] }, "Python").requiresAssessment, false, "server policy should override AI assessment drift for language fundamentals");
assert.equal(normalizeAssessmentPlan({ supported: true, targetSubject: "React", requiresAssessment: false, prerequisiteAreas: [{ id: "javascript", title: "JavaScript", reason: "Required", startingDifficulty: "mid" }] }, "React").requiresAssessment, true, "server policy should require framework assessment");

const routedConfig = resolveProviderConfig({ OPENAI_API_KEY: "test", OPENAI_MODEL: "fallback", OPENAI_MODEL_REASONING: "reasoning-model", OPENAI_MODEL_LOW: "low-model" }, "course_structure");
assert.equal(routedConfig.model, "reasoning-model");
assert.equal(resolveProviderConfig({ OPENAI_API_KEY: "test", OPENAI_MODEL: "fallback", OPENAI_MODEL_LOW: "low-model" }, "tutor_chat").model, "low-model");
const fallbackPrereqIndexes = [0, 1, 2, 3, 5, 6].map((step) =>
  createFallbackAssessmentQuestion({ subject: "Machine Learning", step }).correctOptionIndex
);
assert.ok(new Set(fallbackPrereqIndexes).size > 1);
assert.ok(fallbackPrereqIndexes.some((index) => index === 2 || index === 3));
const cplusplusPreferenceAssessment = createFallbackAssessmentQuestion({ subject: "C++", step: 3 });
assert.ok(!cplusplusPreferenceAssessment.options.some((option) => /javascript|python/i.test(option)), "C++ fallback assessment should not offer unrelated language examples");
const stabilizedAfterSkip = stabilizeAssessmentQuestion({
  subject: "Java Game Development",
  step: 1,
  answers: [{ questionId: "q1", type: "mcq", questionKind: "prerequisite", assessmentArea: "java-syntax", difficulty: "mid", skipped: true, prompt: "What does public class Main do?" }],
  question: createFallbackAssessmentQuestion({ subject: "Java Game Development", step: 1 })
});
assert.equal(stabilizedAfterSkip.questionKind, "prerequisite");
assert.equal(stabilizedAfterSkip.assessmentArea, "java-syntax");
assert.equal(stabilizedAfterSkip.difficulty, "basic");
const stabilizedAfterBridgeSkip = stabilizeAssessmentQuestion({
  subject: "Java Game Development",
  step: 2,
  answers: [
    { questionId: "q1", type: "mcq", questionKind: "prerequisite", assessmentArea: "java-syntax", difficulty: "mid", skipped: true, prompt: "What does public class Main do?" },
    { questionId: stabilizedAfterSkip.id, type: "mcq", questionKind: "prerequisite", assessmentArea: "java-syntax", difficulty: "basic", skipped: true, prompt: stabilizedAfterSkip.prompt }
  ],
  question: createFallbackAssessmentQuestion({ subject: "Java Game Development", step: 2 })
});
assert.equal(stabilizedAfterBridgeSkip.assessmentArea, "java-syntax");
assert.equal(stabilizedAfterBridgeSkip.difficulty, "entry", "assessment should drop one level after I don't know");
const skippedReview = createFallbackAssessmentReview({
  subject: "C++",
  answers: [
    { questionId: "q1", type: "mcq", skipped: true, questionKind: "prerequisite" },
    { questionId: "q2", type: "mcq", skipped: true, questionKind: "course_shaping" }
  ]
});
assert.ok(skippedReview.gaps.some((gap) => /complete beginner|tiny runnable examples/i.test(gap)), "skipped assessment review should assume beginner bridges");
const pygameSkippedReview = createFallbackAssessmentReview({
  subject: "2D desktop games with Python and Pygame",
  answers: [{ questionId: "python-functions", type: "mcq", skipped: true, questionKind: "prerequisite" }]
});
assert.match(pygameSkippedReview.suggestedModules[0], /Targeted Python refresher.*Pygame/i, "applied-course gaps should create a target-specific refresher");

const preview = createFallbackGeneratedCourse({
  objective: "Learn JavaScript arrays",
  level: "Complete beginner",
  outcome: "Build small practical exercises"
});

assert.equal(preview.schemaVersion, "course-content/v1");
assert.ok(preview.chapters.length >= 2);
assert.ok(preview.chapters[0].sections.length >= 2);
assert.ok(preview.chapters[0].sections.some((section) => section.blocks.some((block) => block.type === "mcq")));
assert.ok(preview.chapters[0].sections.some((section) => section.blocks.some((block) => block.type === "code_exercise")));

const syllabus = buildCourseSyllabusFromContent(preview);
assert.equal(
  syllabus.length,
  preview.chapters.flatMap((chapter) =>
    chapter.sections.flatMap((section) => section.blocks.length ? section.blocks : [null])
  ).length
);
assert.equal(syllabus[0].lessonIndex, 0);
assert.equal(syllabus.at(-1).lessonIndex, syllabus.length - 1);
assert.ok(syllabus.some((section) => section.title.includes("check")));
assert.ok(syllabus.some((section) => section.title.includes("editor exercise")));

const normalized = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v1",
  title: "  Arrays  ",
  subject: " JavaScript ",
  description: "  Learn arrays with practice. ",
  languages: [" JavaScript ", "", "JavaScript"],
  tags: [" arrays ", "beginner"],
  chapters: [
    {
      id: "chapter 1",
      title: " Basics ",
      summary: " First ideas ",
      sections: [
        {
          id: "section 1",
          title: " Read arrays ",
          summary: " Indexes ",
          blocks: [
            { type: "theory", markdown: "## Arrays" },
            {
              type: "mcq",
              prompt: "Which index is first?",
              options: ["0", "1"],
              correctOptionIndex: 0,
              explanation: "Arrays start at zero."
            }
          ]
        }
      ]
    }
  ]
});

assert.equal(normalized.title, "Arrays");
assert.deepEqual(normalized.languages, ["JavaScript"]);
assert.equal(normalized.chapters[0].id, "chapter-1");
assert.equal(normalized.chapters[0].sections[0].id, "section-1");
assert.notEqual(normalized.chapters[0].sections[0].blocks[1].correctOptionIndex, undefined);

const nextChapter = createFallbackGeneratedChapter(preview, 1);
assert.equal(nextChapter.chapterIndex, 1);
assert.ok(nextChapter.chapter.sections.every((section) => section.blocks.length > 0));

const review = createFallbackAssessmentReview({
  subject: "Machine Learning",
  answers: [{ questionId: "q1", skipped: true }]
});
const assessmentCourse = createFallbackGeneratedCourseFromAssessment({
  subject: "Machine Learning",
  assessmentReview: review
});
assert.equal(assessmentCourse.schemaVersion, "course-content/v2");
assert.equal(assessmentCourse.generationDepth, "full_structure_first_module");
assert.ok(assessmentCourse.modules.length >= 6);
assert.ok(assessmentCourse.modules[0].unlocked);
assert.ok(assessmentCourse.modules[0].topics.length >= 3);
assert.equal(assessmentCourse.modules[0].topics[0].blocks[0].kind, "theory");
assert.ok(assessmentCourse.modules[0].topics[0].blocks[0].steps.slice(0, 3).every((step) => ["theory", "analogy", "example"].includes(step.type)));
assert.ok(assessmentCourse.modules[0].topics[0].blocks[0].steps.some((step) => step.type === "mcq"), "quick MCQ checks should live inside theory blocks");
assert.ok(assessmentCourse.modules[0].topics[0].blocks.some((block) => block.kind === "quiz"), "loaded topics should have a real quiz checkpoint");
assert.ok(assessmentCourse.modules[0].topics[2].blocks.some((block) => block.kind === "workshop"));
const fallbackWorkshop = assessmentCourse.modules[0].topics[2].blocks.find((block) => block.kind === "workshop");
assert.ok(fallbackWorkshop.steps.length >= 5, "fallback workshop should be several tiny guided steps");
const fallbackWorkshopCodeSteps = fallbackWorkshop.steps.filter((step) => step.type === "workshop");
assert.ok(fallbackWorkshopCodeSteps.every((step, index) => step.prompt.includes(`Step ${index + 1}`)), "fallback workshop prompts should be numbered");
assert.ok(fallbackWorkshopCodeSteps.every((step) => step.id && step.expectedChange && step.conceptIds.length), "workshops should have explicit micro-edit contracts");
assert.equal(fallbackWorkshop.steps.at(-1).type, "summary", "workshops should end with a non-coding recap");
assert.match(fallbackWorkshop.steps.at(-1).markdown, /What the code now does/, "workshop recap should explain the finished code");
for (let index = 1; index < fallbackWorkshopCodeSteps.length; index += 1) {
  assert.equal(fallbackWorkshopCodeSteps[index].buildsOnStepId, fallbackWorkshopCodeSteps[index - 1].id, "workshop steps should reference the previous step");
  assert.equal(fallbackWorkshopCodeSteps[index].starterCode, fallbackWorkshopCodeSteps[index - 1].resultCode, "workshop code should carry forward exactly");
}
const fallbackQuizBlocks = assessmentCourse.modules.flatMap((module) => module.topics).flatMap((topic) => topic.blocks).filter((block) => block.kind === "quiz");
assert.ok(fallbackQuizBlocks.every((block) => block.steps.length >= 4), "quiz blocks should be multi-question exam checkpoints");
assert.ok(assessmentCourse.modules[0].topics[2].blocks.some((block) => block.kind === "lab" && block.steps.length === 1));
assert.ok(assessmentCourse.modules.some((module) => !module.unlocked));

const csharpAssessmentCourse = createFallbackGeneratedCourseFromAssessment({
  subject: "C#",
  assessmentReview: review
});
const csharpExercises = csharpAssessmentCourse.modules
  .flatMap((module) => module.topics)
  .flatMap((topic) => topic.blocks)
  .flatMap((block) => block.steps)
  .filter((step) => step.type === "workshop" || step.type === "lab" || step.type === "project");
assert.ok(csharpExercises.length > 0, "C# fallback course should include practical steps");
assert.ok(csharpExercises.every((step) => step.language === "C#"), "C# fallback course must not normalize to C");
assert.ok(csharpExercises.every((step) => step.filePath === "Program.cs"), "C# fallback exercises should use Program.cs");
assert.ok(csharpExercises.every((step) => /Console\.WriteLine/.test(step.starterCode)), "C# starter code must use Console.WriteLine, not printf");
assert.ok(!csharpExercises.some((step) => /printf/.test(`${step.prompt} ${step.starterCode} ${step.acceptanceCriteria.join(" ")}`)), "C# fallback workshop text must not mention printf");

for (const [language, filePath] of [["Kotlin", "Main.kt"], ["Dart", "main.dart"], ["R programming", "main.R"], ["Julia", "main.jl"], ["Fortran", "main.f90"], ["COBOL", "main.cob"], ["BASIC", "main.bas"]]) {
  const capability = resolveCourseLanguageCapability(language);
  assert.equal(capability.filePath, filePath, `${language} should have a language-safe workshop file`);
  assert.ok(capability.starterCode.length > 20, `${language} should have a language-safe starter`);
}

const coursePrompt = buildAssessmentCourseGenerationPrompt({
  subject: "Machine Learning",
  answers: [
    { questionId: "syntax", type: "mcq", questionKind: "prerequisite", prompt: "What does a variable do?", answer: 2, isCorrect: false },
    { questionId: "tool", type: "mcq", questionKind: "course_shaping", prompt: "Which language?", answer: 1, options: ["Default", "Python", "JavaScript", "Java"] }
  ],
  assessmentReview: review
});
const learnerContext = buildLearnerGenerationContext({
  subject: "Machine Learning",
  answers: [
    { questionId: "syntax", type: "mcq", questionKind: "prerequisite", prompt: "What does a variable do?", answer: 2, isCorrect: false },
    { questionId: "tool", type: "mcq", questionKind: "course_shaping", prompt: "Which language?", answer: 1, options: ["Default", "Python", "JavaScript", "Java"] }
  ],
  assessmentReview: review
});
assert.ok(learnerContext.readiness !== "unknown", "learner generation context should classify readiness");
assert.equal(learnerContext.refresher.needed, true, "weak prerequisites should request a targeted refresher");
assert.ok(learnerContext.weakSignals.some((signal) => signal.prompt.includes("variable")), "learner context should preserve weak assessment signals");
assert.ok(learnerContext.preferences.some((preference) => preference.answer.includes("Python")), "learner context should preserve course-shaping preferences");
const staticContext = retrieveStaticCourseGenerationContext({ subject: "Machine Learning", learnerContext });
assert.ok(staticContext.some((chunk) => chunk.kind === "block-pattern" && chunk.blockKind === "workshop"), "static retrieval should include workshop block patterns");
assert.ok(staticContext.some((chunk) => chunk.kind === "quality-rubric"), "static retrieval should include quality rubrics");
assert.ok(staticContext.some((chunk) => chunk.kind === "project-spine"), "static retrieval should include project-spine curriculum guidance");
assert.ok(staticContext.some((chunk) => chunk.sourceType === "official-docs"), "static retrieval should include selected official-doc source records");

const blueprintPrompt = buildCourseBlueprintPrompt({ subject: "Machine Learning", answers: [], assessmentReview: review, learnerContext, retrievedContext: staticContext });
assert.ok(blueprintPrompt.includes("courseBlueprint"), "blueprint prompt must produce courseBlueprint");
assert.ok(blueprintPrompt.includes("finalProject"), "blueprint prompt must include final project spine");
assert.ok(blueprintPrompt.includes("miniProjects"), "blueprint prompt must include mini-project path");
assert.ok(blueprintPrompt.includes("Editable course-generation rules"), "blueprint prompt should include editable rulebook");

const outlinePrompt = buildAssessmentCourseOutlinePrompt({
  subject: "Machine Learning",
  answers: [],
  assessmentReview: review,
  courseBlueprint: { finalProject: { title: "Classifier", description: "Build a tiny classifier", capabilities: ["load data"] } }
});
assert.ok(outlinePrompt.includes("Course outline phase"), "outline prompt should identify outline phase");
assert.ok(outlinePrompt.includes("Do not write full lesson markdown"), "outline prompt should not generate loaded teaching content");
assert.ok(outlinePrompt.includes("Module 1"), "outline prompt should plan only the first loaded module");
assert.ok(outlinePrompt.includes("targeted refresher"), "outline prompt should gate target-specific refresher modules from assessment evidence");
assert.ok(outlinePrompt.includes("Do not target a fixed module count"), "outline prompt should avoid fixed module counts");
assert.ok(outlinePrompt.includes("kind"), "outline prompt should still plan block kinds");
assert.ok(outlinePrompt.includes("Course blueprint"), "outline prompt must receive hidden course blueprint context");
assert.ok(outlinePrompt.includes("Editable course-generation rules"), "outline prompt should include editable rulebook");

const blockPrompt = buildBlockGenerationPrompt({
  blockKind: "workshop",
  subject: "Machine Learning",
  moduleTitle: "Foundations",
  topicTitle: "Variables",
  learnerContext
});
assert.ok(blockPrompt.includes("Workshop block contract"), "block prompt should include workshop-specific contract");
assert.ok(blockPrompt.includes("First decide the concrete deliverable"), "workshop prompt should be deliverable-driven");
assert.ok(blockPrompt.includes("Do not target a fixed count"), "workshop prompt should avoid fixed step counts");
assert.ok(blockPrompt.includes("non-coding summary step"), "workshop prompt should require a final recap");
assert.ok(blockPrompt.includes("suggestedQuestions"), "workshop prompt should request relevant learner questions");
assert.ok(blockPrompt.includes("Do not repeat generic language syntax"), "workshop prompt should avoid repeated syntax dumps");
assert.ok(blockPrompt.includes("HTML is the preview entrypoint"), "visual web workshops must explicitly connect HTML, CSS, and JavaScript files");
assert.ok(!blockPrompt.includes("Quiz block contract"), "workshop prompt should not mix quiz rules");

const contentPrompt = buildAssessmentCourseContentPrompt({
  subject: "Machine Learning",
  answers: [],
  assessmentReview: review,
  courseOutline: assessmentCourse
});
assert.ok(contentPrompt.includes("Loaded content phase"), "content prompt should identify loaded content phase");
assert.ok(contentPrompt.includes("Use the course outline as the fixed plan"), "content prompt should preserve outline");
assert.ok(contentPrompt.includes("Block-specific generation contracts"), "content prompt should include block-specific contracts");
assert.ok(contentPrompt.includes("Workshop block contract"), "content prompt should include workshop block rules");
assert.ok(contentPrompt.includes("Lab block contract"), "content prompt should include lab block rules");
assert.ok(contentPrompt.includes("Editable course-generation rules"), "content prompt should include editable rulebook");

const modulePrompt = buildAssessmentModuleContentPrompt({
  subject: "Machine Learning",
  answers: [],
  assessmentReview: review,
  courseBlueprint: { finalProject: { title: "Classifier", description: "Build a tiny classifier", capabilities: ["load data"] } },
  courseOutline: assessmentCourse,
  moduleIndex: 0
});
assert.ok(modulePrompt.includes("Loaded module content phase"), "module prompt should identify module content phase");
assert.ok(modulePrompt.includes('"moduleIndex":0'), "module prompt should ask for module-indexed JSON");
assert.ok(modulePrompt.includes("Generate full block steps only for this module"), "module prompt should be scoped to one module");
assert.ok(modulePrompt.includes("Block-specific generation contracts"), "module prompt should include block contracts");
assert.ok(modulePrompt.includes("Course blueprint"), "module prompt must keep practical content tied to the project spine");
assert.ok(modulePrompt.includes("Editable course-generation rules"), "module prompt should include editable rulebook");

const outlineSkeleton = createGeneratedCourseSkeletonFromOutline({
  course: {
    title: "Outline Course",
    subject: "JavaScript",
    summary: "Outline summary",
    modules: [
      {
        id: "m1",
        title: "One",
        summary: "One",
        locked: false,
        topics: [{ id: "t1", title: "Topic", summary: "Topic", blocks: [{ kind: "theory", summary: "Teach" }] }]
      },
      {
        id: "m2",
        title: "Two",
        summary: "Two",
        locked: true,
        topics: [{ id: "t2", title: "Later", summary: "Later", blocks: [{ kind: "review", summary: "Later" }] }]
      }
    ]
  }
}, { subject: "JavaScript", assessmentReview: review });
assert.equal(outlineSkeleton.schemaVersion, "course-content/v2");
assert.equal(outlineSkeleton.modules.length, 2);
assert.equal(outlineSkeleton.modules[0].topics[0].blocks[0].steps[0].type, "summary");
assert.equal(outlineSkeleton.modules[1].unlocked, false);
const normalizedWithBlueprint = normalizeGeneratedCourseContent({
  ...outlineSkeleton,
  courseBlueprint: {
    finalProject: { title: "Automation helper", description: "Build a tiny automation helper.", capabilities: ["read input"] },
    miniProjects: [{ title: "Print helper", moduleId: "m1", blockId: "t1-theory" }],
    conceptSequence: ["syntax", "variables"],
    prerequisiteBridges: ["Python syntax"],
    moduleGoals: [{ moduleId: "m1", goal: "Read tiny Python programs" }]
  }
});
assert.equal(normalizedWithBlueprint.courseBlueprint.finalProject.title, "Automation helper");
assert.ok(normalizedWithBlueprint.courseBlueprint.miniProjects.length, "courseBlueprint mini-projects should survive normalization");

const extractedModule = extractGeneratedModuleFromResponse({
  moduleIndex: 0,
  module: assessmentCourse.modules[0]
}, outlineSkeleton.modules[0], 0);
assert.equal(extractedModule.id, assessmentCourse.modules[0].id);
const malformedExtractedModule = extractGeneratedModuleFromResponse({ moduleIndex: 0 }, outlineSkeleton.modules[0], 0);
assert.equal(malformedExtractedModule.id, outlineSkeleton.modules[0].id, "malformed repair wrappers must preserve the existing module");

const repairPrompt = buildGeneratedCourseRepairPrompt({
  subject: "Machine Learning",
  content: assessmentCourse,
  qualityWarnings: [{ code: "workshop_too_short", message: "modules[0].topics[0].blocks[1] workshop has fewer than 4 steps." }]
});
assert.ok(repairPrompt.includes("Repair only the invalid generated blocks"), "repair prompt should be block-scoped");
assert.ok(repairPrompt.includes("workshop_too_short"), "repair prompt should include quality warning codes");
assert.ok(repairPrompt.includes("Return the full corrected course JSON"), "repair prompt should return full course JSON for existing normalizer");
assert.ok(repairPrompt.includes("Editable course-generation rules"), "repair prompt should include editable rulebook");

const moduleRepairPrompt = buildGeneratedModuleRepairPrompt({
  subject: "Machine Learning",
  module: assessmentCourse.modules[0],
  moduleIndex: 0,
  qualityWarnings: [{ code: "topic_missing_interactive_block", message: "modules[0].topics[0] has no quiz, workshop, lab, or project block." }]
});
assert.ok(moduleRepairPrompt.includes("Repair only this generated module"), "module repair prompt should be module-scoped");
assert.ok(moduleRepairPrompt.includes('"moduleIndex":0'), "module repair prompt should preserve module index");
assert.ok(moduleRepairPrompt.includes("Return strict JSON only"), "module repair prompt should return JSON");
assert.ok(moduleRepairPrompt.includes('"topics":[]'), "module repair prompt should use the v2 topics schema");
assert.ok(!moduleRepairPrompt.includes('"chapters":[]'), "module repair prompt should not advertise the obsolete chapters shape");
assert.ok(!moduleRepairPrompt.includes("full corrected course JSON"), "module repair prompt should not ask for full-course repair");
assert.ok(moduleRepairPrompt.includes("Editable course-generation rules"), "module repair prompt should include editable rulebook");

const topicRepairPrompt = buildGeneratedTopicRepairPrompt({
  subject: "Machine Learning",
  topic: assessmentCourse.modules[0].topics[0],
  moduleIndex: 0,
  topicIndex: 0,
  qualityWarnings: [{ code: "workshop_prompt_missing_action", message: "modules[0].topics[0].blocks[1].steps[0] needs an action." }]
});
assert.ok(topicRepairPrompt.includes("Repair only this generated Stonecode topic"), "topic repair should stay smaller than a whole module repair");
assert.ok(topicRepairPrompt.includes('"topicIndex":0'), "topic repair prompt should preserve its index");
assert.equal(
  extractGeneratedTopicFromResponse({ topicIndex: 0 }, assessmentCourse.modules[0].topics[0], 0).id,
  assessmentCourse.modules[0].topics[0].id,
  "malformed topic repair wrappers must preserve the existing topic"
);
const protectedTopic = {
  id: "protected-topic",
  title: "Protected topic",
  blocks: [
    { id: "valid-theory", kind: "theory", steps: [{ type: "theory", markdown: "Keep this valid theory unchanged." }] },
    { id: "broken-workshop", kind: "workshop", steps: [{ type: "workshop", prompt: "Old" }] }
  ]
};
const selectivelyRepairedTopic = extractGeneratedTopicFromResponse({
  topic: {
    ...protectedTopic,
    blocks: [
      { id: "valid-theory", kind: "theory", steps: [{ type: "mcq", prompt: "Regressed unrelated block" }] },
      { id: "broken-workshop", kind: "workshop", steps: [{ type: "workshop", prompt: "Add one concrete line." }] }
    ]
  }
}, protectedTopic, 0, [{
  code: "workshop_prompt_missing_action",
  message: "modules[0].topics[0].blocks[1].steps[0] needs a concrete action."
}]);
assert.deepEqual(selectivelyRepairedTopic.blocks[0], protectedTopic.blocks[0], "topic repair must not rewrite an unrelated valid block");
assert.equal(selectivelyRepairedTopic.blocks[1].steps[0].prompt, "Add one concrete line.");

const groupedWarnings = groupGeneratedCourseWarningsByModule([
  { code: "workshop_too_short", message: "modules[0].topics[0].blocks[1] workshop has fewer than 4 steps." },
  { code: "quiz_too_short", message: "modules[1].topics[0].blocks[1] quiz has fewer than 4 MCQs." },
  { code: "block_empty", message: "course has an empty generated block." }
]);
assert.equal(groupedWarnings.get(0).length, 2, "unscoped warnings should default to module 0 repair");
assert.equal(groupedWarnings.get(1).length, 1, "module 1 warnings should group together");
const groupedTopicWarnings = groupGeneratedCourseWarningsByTopic(groupedWarnings.get(0), 0);
assert.equal(groupedTopicWarnings.get(0).length, 1, "topic-scoped warnings should be isolated for smaller repairs");
const contextOnlyWarnings = [{
  code: "workshop_context_missing_purpose",
  message: "modules[0].topics[0].blocks[1].steps[0] workshop context does not explain why this step matters."
}];
assert.equal(hasRepairableGeneratedCourseQualityWarnings(contextOnlyWarnings), true, "weak workshop context should still trigger repair");
assert.equal(hasBlockingGeneratedCourseQualityWarnings(contextOnlyWarnings), false, "one wording-only context warning should not reject an otherwise valid course");

const originalFetch = globalThis.fetch;
const generationRequests = [];
globalThis.fetch = async (_url, options) => {
  generationRequests.push(JSON.parse(options.body));
  if (generationRequests.length === 1) {
    return new Response(JSON.stringify({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: '{"partial":true'
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ status: "completed", output_text: '{"complete":true}' }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
try {
  const retriedGeneration = await requestCourseGenerationJson({
    config: { apiKey: "test", model: "test-model" },
    prompt: "Return a small JSON object.",
    maxTokens: 100
  });
  assert.equal(retriedGeneration.ok, true, "incomplete OpenAI output should retry");
  assert.equal(generationRequests.length, 2, "incomplete OpenAI output should make a second request");
  assert.ok(generationRequests[1].max_output_tokens > generationRequests[0].max_output_tokens, "incomplete output retry should receive a larger token budget");
} finally {
  globalThis.fetch = originalFetch;
}

assert.ok(coursePrompt.includes("Learner generation context"));
assert.ok(coursePrompt.includes("Retrieved course-generation context"));
assert.ok(coursePrompt.includes("Editable course-generation rules"));
assert.ok(coursePrompt.includes("Initial Generation Rule"));
assert.ok(coursePrompt.includes('Every block must include a "kind" field'));
assert.ok(coursePrompt.includes("Fully load module 1"));
assert.ok(coursePrompt.includes("Keep modules 2 and later as locked outline shells"));
assert.ok(coursePrompt.includes("friendly course introduction"), "course prompt should require an introductory first step");
assert.ok(coursePrompt.includes("Do not make it only a tutor greeting"), "course introduction must contain course-specific orientation");
assert.ok(coursePrompt.includes("problem this topic solves"), "each topic opening must explain its purpose and course connection");
assert.ok(coursePrompt.includes("map it back to code"), "theory must connect analogies back to programming behavior");
assert.ok(coursePrompt.includes('A "theory" block may contain only theory, analogy, example, summary, and optional mcq steps.'));
assert.ok(coursePrompt.includes('A "quiz" block must contain only mcq steps and should have 4 to 10 MCQ steps'));
assert.ok(coursePrompt.includes("Single MCQ checks belong inside theory blocks"));
assert.ok(coursePrompt.includes("Quiz blocks are exam-style checkpoints"));
assert.ok(coursePrompt.includes('A "workshop" block must be guided practical continuity'));
assert.ok(coursePrompt.includes("Do not use fixed counts like exactly 4 theory steps or exactly 2 workshop steps"));
assert.ok(coursePrompt.includes("Assume the learner has no programming, coding, or syntax knowledge"));
assert.ok(coursePrompt.includes("Workshop length is variable"));
assert.ok(coursePrompt.includes("Never make a one-step or two-step workshop"));
assert.ok(coursePrompt.includes("The step count must follow the idea size"));
assert.ok(coursePrompt.includes('A "lab" block is a small checkpoint exam'));
assert.ok(coursePrompt.includes("Labs should reuse the project pattern of an earlier relevant workshop"));
assert.ok(coursePrompt.includes("A workshop must be the first practical code experience"), "course prompt should require workshop-first practice");
assert.ok(coursePrompt.includes("Every workshop/lab/project step needs detailed context"));
assert.ok(coursePrompt.includes("Workshop context should briefly explain what the learner is learning"), "workshop context should explain purpose");
assert.ok(coursePrompt.includes("Workshop prompts must teach by tutorial"));
assert.ok(coursePrompt.includes("Workshop prompts should move quickly"), "workshop prompts should stay atomic");
assert.ok(coursePrompt.includes("Each workshop step should read like a FreeCodeCamp-style step screen"));
assert.ok(coursePrompt.includes("Introduce the workshop deliverable only on Step 1"));
assert.ok(coursePrompt.includes("Every coding step includes codeExplanation"));
assert.ok(coursePrompt.includes("End every workshop with one non-coding summary step"));
assert.ok(coursePrompt.includes("Step 1, Step 2"));
assert.ok(coursePrompt.includes("remind the learner what they already learned"));
assert.ok(coursePrompt.includes("explain every new token"));
assert.ok(coursePrompt.includes("Do not force exactly one theory step or exactly one MCQ"), "theory blocks must stay flexible");
assert.ok(coursePrompt.includes("Never include hidden planning"));
assert.ok(!coursePrompt.includes("internally design"));
assert.ok(coursePrompt.includes("Use requiresPreview:true"));
assert.ok(coursePrompt.includes('workspaceView:"preview"'), "visual exercises should open the Visual tab from generated metadata");
assert.ok(coursePrompt.includes('workspaceView:"terminal"'), "execution exercises should open the Terminal tab from generated metadata");
assert.ok(coursePrompt.includes("workspaceFiles"), "generated exercises should include their project file manifest");
assert.ok(coursePrompt.includes("may create multiple small connected files"));
assert.ok(coursePrompt.includes("Use language-appropriate simple file paths"));
assert.ok(coursePrompt.includes('Reflection/"Answer in chat" prompts must include a short recap or clue'));
assert.ok(coursePrompt.includes("Course-shaping assessment answers are learner preferences."));
assert.ok(coursePrompt.includes("Do not generate every topic as the same template."));
assert.ok(coursePrompt.includes("Assessment review suggestedModules are planning inputs."));
assert.ok(coursePrompt.includes("Only the first course step may introduce Stonecode."));
assert.ok(coursePrompt.includes("Distribute correctOptionIndex across 0, 1, 2, and 3"));
const theorySample = coursePrompt.slice(coursePrompt.indexOf('"kind":"theory"'), coursePrompt.indexOf('"id":"workshop-block-slug"'));
assert.ok(!theorySample.includes('"type":"reflection"'));
assert.ok(!theorySample.includes('"type":"lab"'));

const normalizedV2 = normalizeGeneratedCourseContent(assessmentCourse);
assert.equal(normalizedV2.schemaVersion, "course-content/v2");
assert.ok(normalizedV2.assessmentReview.suggestedModules.length > 0);
assert.equal(normalizedV2.modules[0].unlocked, true, "module 1 should be unlocked");
assert.equal(normalizedV2.modules[1].unlocked, false, "module 2 should stay locked until generated later");

const visualWorkspaceFixture = structuredClone(assessmentCourse);
const visualStep = visualWorkspaceFixture.modules
  .flatMap((module) => module.topics)
  .flatMap((topic) => topic.blocks)
  .flatMap((block) => block.steps)
  .find((step) => step.type === "workshop");
Object.assign(visualStep, {
  language: "Python",
  filePath: "game/main.py",
  starterCode: "player_x = 40\n",
  requiresPreview: true,
  workspaceView: "preview",
  workspaceFiles: [
    { path: "game/main.py", content: "player_x = 40\n", purpose: "Pygame source", editable: true },
    { path: "preview/index.html", content: "<main>Player scene</main>", purpose: "Browser-renderable scene reference", editable: false }
  ]
});
const normalizedVisualWorkspace = normalizeGeneratedCourseContent(visualWorkspaceFixture);
const normalizedVisualStep = normalizedVisualWorkspace.modules
  .flatMap((module) => module.topics)
  .flatMap((topic) => topic.blocks)
  .flatMap((block) => block.steps)
  .find((step) => step.type === "workshop" && step.filePath === "game/main.py");
assert.equal(normalizedVisualStep.workspaceView, "preview");
assert.equal(normalizedVisualStep.workspaceFiles.length, 2);
assert.ok(normalizedVisualStep.workspaceFiles.some((file) => file.path === "preview/index.html"), "visual scene reference should survive normalization");

const qualityWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Weak Content",
  subject: "JavaScript",
  description: "Weak content fixture.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [{ type: "theory", markdown: "## Variables\n\nVariables are important." }]
            },
            {
              id: "l1",
              kind: "lab",
              title: "Lab",
              summary: "Lab",
              steps: [{ type: "lab", language: "JavaScript", filePath: "main.js", context: "Do it.", prompt: "Build it.", starterCode: "console.log('x');", acceptanceCriteria: ["Works", "Runs"] }]
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(qualityWarnings.some((warning) => warning.code === "theory_too_thin"), "quality validation should flag shallow theory");
assert.ok(qualityWarnings.some((warning) => warning.code === "exercise_context_too_thin"), "quality validation should flag weak exercise context");

const quizOnlyTheoryWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Quiz Only Theory",
  subject: "JavaScript",
  description: "Theory block is actually a quiz.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [
                { type: "mcq", prompt: "What is a variable?", options: ["A name for a value", "A style rule", "A database", "A browser"], correctOptionIndex: 0, explanation: "A variable stores a value under a name." },
                { type: "mcq", prompt: "What does const do?", options: ["Creates a named value", "Deletes a file", "Runs CSS", "Starts a server"], correctOptionIndex: 0, explanation: "const creates a binding." },
                { type: "mcq", prompt: "What do quotes mark?", options: ["String text", "A loop", "A folder", "A test"], correctOptionIndex: 0, explanation: "Quotes mark literal text." },
                { type: "mcq", prompt: "What does console.log show?", options: ["Console output", "A route", "A color", "A component"], correctOptionIndex: 0, explanation: "It prints visible output." }
              ]
            },
            {
              id: "w1",
              kind: "workshop",
              title: "Workshop",
              summary: "Workshop",
              steps: Array.from({ length: 4 }, (_, index) => ({
                type: "workshop",
                language: "JavaScript",
                filePath: "main.js",
                context: "This workshop uses the variable syntax taught above and changes one line at a time.",
                prompt: `Step ${index + 1}: write one small line and explain the syntax before editing.`,
                starterCode: "const message = 'hello';\nconsole.log(message);",
                acceptanceCriteria: ["Uses a named value", "Shows output"]
              }))
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(quizOnlyTheoryWarnings.some((warning) => warning.code === "theory_block_missing_teaching"), "quality validation should reject theory blocks made only of MCQs");
assert.ok(quizOnlyTheoryWarnings.some((warning) => warning.code === "topic_missing_theory_teaching"), "topics should need real theory teaching, not just theory-labeled quizzes");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(quizOnlyTheoryWarnings), "quiz-only theory should block save without repair");

const missingInteractiveWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Missing Practice",
  subject: "JavaScript",
  description: "Missing practice fixture.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [{ type: "theory", markdown: "## Variables\n\nA variable is a name attached to a value. Use it to read the same value later in another line of code." }]
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(missingInteractiveWarnings.some((warning) => warning.code === "topic_missing_interactive_block"), "quality validation should flag missing interactive blocks in loaded modules");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(missingInteractiveWarnings), "missing interactive block warnings should block save without repair");

const missingSyntaxTeachingWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Syntax Missing",
  subject: "JavaScript",
  description: "Code appears without syntax teaching.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [{ type: "theory", markdown: "## Variables\n\nThis topic introduces a small idea before practice. The lesson says why values matter and keeps the explanation general before practice." }]
            },
            {
              id: "w1",
              kind: "workshop",
              title: "Workshop",
              summary: "Workshop",
              steps: Array.from({ length: 4 }, (_, index) => ({
                type: "workshop",
                language: "JavaScript",
                filePath: "main.js",
                context: "Build a tiny output.",
                prompt: `Step ${index + 1}: add the next edit.`,
                starterCode: "const message = 'hello';\nconsole.log(message);",
                acceptanceCriteria: ["Uses message", "Shows output"]
              }))
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(missingSyntaxTeachingWarnings.some((warning) => warning.code === "syntax_teaching_missing"), "quality validation should reject code exercises without syntax teaching");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(missingSyntaxTeachingWarnings), "missing syntax teaching should block save without repair");

const vagueWorkshopWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Vague Workshop",
  subject: "JavaScript",
  description: "Workshop lacks purpose and action.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [{ type: "theory", markdown: "## Variables\n\nA variable stores a value under a name, such as `const score = 10`. The word `const` creates the name, `score` is the name, and `10` is the stored value." }]
            },
            {
              id: "w1",
              kind: "workshop",
              title: "Workshop",
              summary: "Workshop",
              steps: Array.from({ length: 4 }, () => ({
                type: "workshop",
                language: "JavaScript",
                filePath: "main.js",
                context: "This is fine.",
                prompt: "Continue carefully.",
                starterCode: "const score = 10;\nconsole.log(score);",
                acceptanceCriteria: ["Uses score", "Shows score"]
              }))
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(vagueWorkshopWarnings.some((warning) => warning.code === "workshop_context_missing_purpose"), "quality validation should reject workshop context without learning purpose");
assert.ok(vagueWorkshopWarnings.some((warning) => warning.code === "workshop_prompt_missing_action"), "quality validation should reject workshop prompts without a concrete edit action");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(vagueWorkshopWarnings), "vague workshop warnings should block save without repair");

const missingPracticalWarnings = validateGeneratedCourseQuality({
  schemaVersion: "course-content/v2",
  title: "Missing Practical",
  subject: "JavaScript",
  description: "Missing practical fixture.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Variables",
          summary: "Variables",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Variables",
              summary: "Variables",
              steps: [{ type: "theory", markdown: "## Variables\n\nA variable is a name attached to a value. Use it to read the same value later in another line of code." }]
            },
            {
              id: "q1",
              kind: "quiz",
              title: "Variables quiz",
              summary: "Variables quiz",
              steps: [0, 1, 2, 3].map((index) => ({
                type: "mcq",
                prompt: `Question ${index + 1}`,
                options: ["A", "B", "C", "D"],
                correctOptionIndex: index,
                explanation: "Because this answer matches the current topic."
              }))
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(missingPracticalWarnings.some((warning) => warning.code === "loaded_module_missing_practical_block"), "quality validation should flag loaded modules without practical work");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(missingPracticalWarnings), "missing practical block warnings should block save without repair");

const sanitizedV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Mixed Block Test",
  subject: "JavaScript",
  description: "Validate block-kind sanitation.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Mixed theory",
              summary: "Mixed",
              steps: [
                { type: "theory", markdown: "## Teach" },
                { type: "reflection", prompt: "Should be removed from theory.", rubric: "Nope" },
                { type: "lab", language: "JavaScript", filePath: "main.js", prompt: "Should be removed.", starterCode: "", acceptanceCriteria: ["Run"] }
              ]
            },
            {
              id: "b2",
              kind: "quiz",
              title: "Mixed quiz",
              summary: "Mixed",
              steps: [
                { type: "theory", markdown: "## Should be removed" },
                { type: "mcq", prompt: "Pick one", options: ["One", "Two", "Three", "Four"], correctOptionIndex: 0, explanation: "One" }
              ]
            }
          ]
        }
      ]
    }
  ]
});
assert.deepEqual(sanitizedV2.modules[0].topics[0].blocks[0].steps.map((step) => step.type), ["theory"]);
assert.equal(sanitizedV2.modules[0].topics[0].blocks[1].kind, "theory");
assert.deepEqual(sanitizedV2.modules[0].topics[0].blocks[1].steps.map((step) => step.type), ["theory", "mcq"]);

const coercedV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Coerce Block Steps",
  subject: "JavaScript",
  description: "Validate block-specific step coercion.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "l1",
              kind: "lab",
              title: "Lab",
              summary: "Lab",
              steps: [{ type: "workshop", language: "JavaScript", filePath: "main.js", context: "Practice the same pattern independently after the workshop.", prompt: "Use a different value and show the result.", starterCode: "console.log('x');", acceptanceCriteria: ["Uses a different value", "Shows the result"] }]
            },
            {
              id: "r1",
              kind: "review",
              title: "Review",
              summary: "Review",
              steps: [{ type: "theory", markdown: "## Review\n\nThis topic introduced values, output, and a tiny practice loop." }]
            }
          ]
        }
      ]
    }
  ]
});
assert.equal(coercedV2.modules[0].topics[0].blocks[0].kind, "lab");
assert.equal(coercedV2.modules[0].topics[0].blocks[0].steps[0].type, "lab");
assert.equal(coercedV2.modules[0].topics[0].blocks[1].kind, "review");
assert.equal(coercedV2.modules[0].topics[0].blocks[1].steps[0].type, "summary");

const quizTypedMcqV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Quiz Step Coercion",
  subject: "JavaScript",
  description: "Validate quiz step coercion.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "q1",
              kind: "quiz",
              title: "Quiz",
              summary: "Quiz",
              steps: [0, 1, 2, 3].map((index) => ({
                type: "quiz",
                prompt: `Question ${index + 1}`,
                options: ["A", "B", "C", "D"],
                correctOptionIndex: index,
                explanation: "Because this is the selected answer."
              }))
            }
          ]
        }
      ]
    }
  ]
});
assert.equal(quizTypedMcqV2.modules[0].topics[0].blocks[0].kind, "quiz");
assert.deepEqual(quizTypedMcqV2.modules[0].topics[0].blocks[0].steps.map((step) => step.type), ["mcq", "mcq", "mcq", "mcq"]);

const promotedInlineQuizV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Inline Quiz Promotion",
  subject: "JavaScript",
  description: "Validate inline MCQ promotion.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Theory with quiz",
              summary: "Theory",
              steps: [
                { type: "theory", markdown: "## Explain\n\nVariables store values so later statements can read them by name." },
                ...[0, 1, 2, 3].map((index) => ({
                  type: "quiz",
                  prompt: `Question ${index + 1}`,
                  options: ["A", "B", "C", "D"],
                  correctOptionIndex: index,
                  explanation: "Because this is the selected answer."
                }))
              ]
            }
          ]
        }
      ]
    }
  ]
});
assert.equal(promotedInlineQuizV2.modules[0].topics[0].blocks[0].kind, "theory");
assert.equal(promotedInlineQuizV2.modules[0].topics[0].blocks[1].kind, "quiz");
assert.deepEqual(promotedInlineQuizV2.modules[0].topics[0].blocks[1].steps.map((step) => step.type), ["mcq", "mcq", "mcq", "mcq"]);

const loadedTopicFallbackQuizV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Loaded Topic Fallback Quiz",
  subject: "JavaScript",
  description: "Validate loaded topics always keep interactive practice.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Statements",
          summary: "Read tiny JavaScript statements line by line.",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Statements",
              summary: "Statements",
              steps: [{ type: "theory", markdown: "## Statements\n\nA statement is a complete instruction JavaScript can run from top to bottom." }]
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(loadedTopicFallbackQuizV2.modules[0].topics[0].blocks.some((block) => block.kind === "quiz"));
assert.equal(loadedTopicFallbackQuizV2.modules[0].topics[0].blocks.find((block) => block.kind === "quiz").steps.length, 4);

const loadedModuleFallbackWorkshopV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Loaded Module Fallback Workshop",
  subject: "JavaScript",
  description: "Validate loaded modules always keep practical work.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Statements",
          summary: "Read tiny JavaScript statements line by line.",
          unlocked: true,
          blocks: [
            {
              id: "b1",
              kind: "theory",
              title: "Statements",
              summary: "Statements",
              steps: [{ type: "theory", markdown: "## Statements\n\nA statement is a complete instruction JavaScript can run from top to bottom." }]
            },
            {
              id: "q1",
              kind: "quiz",
              title: "Statements quiz",
              summary: "Quiz",
              steps: [0, 1, 2, 3].map((index) => ({
                type: "mcq",
                prompt: `Question ${index + 1}`,
                options: ["A", "B", "C", "D"],
                correctOptionIndex: index,
                explanation: "Because this answer matches the current topic."
              }))
            }
          ]
        }
      ]
    }
  ]
});
const loadedModulePracticalBlocks = loadedModuleFallbackWorkshopV2.modules[0].topics.flatMap((topic) => topic.blocks).filter((block) => ["workshop", "lab", "project"].includes(block.kind));
assert.equal(loadedModulePracticalBlocks.length, 1, "loaded modules should get a practical fallback block when missing one");
assert.ok(loadedModulePracticalBlocks[0].steps.length > 4, "fallback practical work should not imply exactly four workshop steps");

const enrichedWeakStepV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Weak Step Enrichment",
  subject: "JavaScript",
  description: "Validate thin exercise and reflection fields are enriched.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      topics: [
        {
          id: "t1",
          title: "Practice",
          summary: "Practice",
          unlocked: true,
          blocks: [
            {
              id: "w1",
              kind: "workshop",
              title: "Workshop",
              summary: "Workshop",
              steps: [0, 1, 2, 3].map((index) => ({
                type: "workshop",
                language: "JavaScript",
                filePath: "main.js",
                context: "Do it.",
                prompt: "Build it.",
                starterCode: "console.log('x');",
                acceptanceCriteria: ["Runs", "Shows output"],
                requiresPreview: false
              }))
            },
            {
              id: "r1",
              kind: "review",
              title: "Review",
              summary: "Review",
              steps: [{ type: "reflection", prompt: "Explain it.", rubric: "Clear answer." }]
            }
          ]
        }
      ]
    }
  ]
});
const enrichedWarnings = validateGeneratedCourseQuality(enrichedWeakStepV2);
assert.ok(!enrichedWarnings.some((warning) => warning.code === "exercise_context_too_thin"), "normalization should enrich thin exercise context");
assert.ok(!enrichedWarnings.some((warning) => warning.code === "exercise_prompt_too_thin"), "normalization should enrich thin exercise prompt");
assert.ok(!enrichedWarnings.some((warning) => warning.code === "reflection_prompt_too_thin"), "normalization should enrich thin reflection prompts");

const shortWorkshopV2 = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "Short Workshop Test",
  subject: "JavaScript",
  description: "Validate weak workshop removal.",
  languages: ["JavaScript"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module",
      summary: "Module",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "w1",
              kind: "workshop",
              title: "Too short workshop",
              summary: "Weak",
              steps: [
                { type: "workshop", language: "JavaScript", filePath: "main.js", prompt: "Step 1", starterCode: "console.log('a');", acceptanceCriteria: ["A", "B"] },
                { type: "workshop", language: "JavaScript", filePath: "main.js", prompt: "Step 2", starterCode: "console.log('b');", acceptanceCriteria: ["A", "B"] }
              ]
            },
            {
              id: "r1",
              kind: "review",
              title: "Fallback review",
              summary: "Review",
              steps: [{ type: "summary", markdown: "## Review" }]
            }
          ]
        }
      ]
    }
  ]
});
assert.ok(!shortWorkshopV2.modules[0].topics[0].blocks.some((block) => block.id === "w1"), "two-step workshops should not survive normalization");
assert.ok(shortWorkshopV2.modules[0].topics[0].blocks.some((block) => block.kind === "workshop" && block.steps.length >= 4), "loaded modules should replace missing practical work with a valid workshop");

const normalizedLanguageCourse = normalizeGeneratedCourseContent({
  schemaVersion: "course-content/v2",
  title: "C++ Basics",
  subject: "C++",
  description: "Validate language-aware exercises.",
  languages: ["C++"],
  tags: ["test"],
  generationDepth: "full_course",
  assessmentReview: review,
  modules: [
    {
      id: "m1",
      title: "Module 1",
      summary: "Module 1",
      unlocked: true,
      chapters: [
        {
          id: "t1",
          title: "Topic",
          summary: "Topic",
          unlocked: true,
          blocks: [
            {
              id: "w1",
              kind: "workshop",
              title: "C++ workshop",
              summary: "Workshop",
              steps: [
                ...Array.from({ length: 4 }, (_, index) => ({
                  type: "workshop",
                  filePath: "main.js",
                  prompt: `Step ${index + 1}: print one value.`,
                  starterCode: "function describe(value) {\n  return `Value: ${value}`;\n}\n\nconsole.log(describe('stone'));\n",
                  acceptanceCriteria: ["Program prints one readable line"]
                }))
              ]
            }
          ]
        }
      ]
    },
    {
      id: "m2",
      title: "Module 2",
      summary: "Module 2",
      unlocked: false,
      chapters: [
        {
          id: "t2",
          title: "Topic 2",
          summary: "Topic 2",
          unlocked: false,
          blocks: [
            {
              id: "b2",
              kind: "review",
              title: "Outline",
              summary: "Outline",
              steps: [{ type: "summary", markdown: "## Outline" }]
            }
          ]
        }
      ]
    },
    {
      id: "m3",
      title: "Module 3",
      summary: "Module 3",
      unlocked: true,
      chapters: [
        {
          id: "t3",
          title: "Topic 3",
          summary: "Topic 3",
          unlocked: true,
          blocks: [
            {
              id: "b3",
              kind: "review",
              title: "Outline",
              summary: "Outline",
              steps: [{ type: "summary", markdown: "## Outline" }]
            }
          ]
        }
      ]
    }
  ]
});
const normalizedCppStep = normalizedLanguageCourse.modules[0].topics[0].blocks[0].steps[0];
assert.equal(normalizedCppStep.language, "C++");
assert.equal(normalizedCppStep.filePath, "main.cpp");
assert.ok(normalizedCppStep.starterCode.includes("#include <iostream>"));
assert.ok(!normalizedCppStep.starterCode.includes("console.log"));
assert.ok(normalizedCppStep.context.length > 20);
assert.ok(normalizedCppStep.acceptanceCriteria.length >= 2);
assert.equal(normalizedLanguageCourse.modules[0].unlocked, true);
assert.equal(normalizedLanguageCourse.modules[1].unlocked, false);
assert.equal(normalizedLanguageCourse.modules[2].unlocked, false);

const javaCourse = createFallbackGeneratedCourseFromAssessment({
  subject: "Java",
  assessmentReview: review
});
const javaWorkshop = javaCourse.modules[0].topics.flatMap((topic) => topic.blocks).find((block) => block.kind === "workshop");
assert.ok(javaWorkshop);
assert.equal(javaWorkshop.steps[0].language, "Java");
assert.equal(javaWorkshop.steps[0].filePath, "Main.java");
assert.ok(javaWorkshop.steps[0].starterCode.includes("public class Main"));

const progressionCourse = (blocks) => ({
  schemaVersion: "course-content/v2",
  modules: [{
    id: "module-1",
    title: "Practice progression",
    unlocked: true,
    topics: [{
      id: "topic-1",
      title: "Values",
      summary: "Learn and practice values",
      blocks
    }]
  }]
});
const teachingBlock = {
  id: "theory-1",
  kind: "theory",
  steps: [{ type: "theory", markdown: "Values give programs useful information. A named value stores information so later code can read it, change behavior, and display a meaningful result." }]
};
const practicalBlock = (kind, id) => ({
  id,
  kind,
  steps: [{
    type: kind,
    language: "JavaScript",
    filePath: "main.js",
    context: "Practice values from the current topic by building one visible variation after learning the syntax.",
    prompt: "Change the named value and print the result so the behavior is visible in the console.",
    starterCode: "const value = 'stone';\nconsole.log(value);",
    acceptanceCriteria: ["Uses a named value", "Prints the result"]
  }]
});
const labFirstWarnings = validateGeneratedCourseQuality(progressionCourse([
  teachingBlock,
  practicalBlock("lab", "lab-1")
]));
assert.ok(labFirstWarnings.some((warning) => warning.code === "lab_before_workshop"), "a lab before guided practice must be rejected");
assert.ok(hasBlockingGeneratedCourseQualityWarnings(labFirstWarnings), "lab-before-workshop must block generated content");

const earlyProjectWarnings = validateGeneratedCourseQuality(progressionCourse([
  teachingBlock,
  practicalBlock("workshop", "workshop-1"),
  practicalBlock("project", "project-1")
]));
assert.ok(earlyProjectWarnings.some((warning) => warning.code === "project_before_practice_readiness"), "an early project must be rejected");

const readyProjectWarnings = validateGeneratedCourseQuality(progressionCourse([
  teachingBlock,
  practicalBlock("workshop", "workshop-1"),
  {
    id: "review-1",
    kind: "review",
    steps: [{ type: "summary", markdown: "Review the named-value pattern, why it stores information, and how output makes the current result visible before attempting independent practice." }]
  },
  practicalBlock("lab", "lab-1"),
  practicalBlock("workshop", "workshop-2"),
  practicalBlock("project", "project-1"),
  practicalBlock("lab", "lab-2"),
  practicalBlock("project", "project-2")
]));
assert.ok(!readyProjectWarnings.some((warning) => warning.code === "lab_before_workshop"), "labs may follow guided practice after intervening review blocks");
assert.ok(!readyProjectWarnings.some((warning) => warning.code === "project_before_practice_readiness"), "AI may place multiple projects after practice readiness is established");

console.log("generated course content checks passed");
