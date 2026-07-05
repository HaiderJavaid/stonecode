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
  buildLearnerGenerationContext,
  buildCourseBlueprintPrompt,
  buildCourseSyllabusFromContent,
  createFallbackAssessmentReview,
  createFallbackAssessmentQuestion,
  createFallbackGeneratedCourse,
  createFallbackGeneratedCourseFromAssessment,
  createFallbackGeneratedChapter,
  createGeneratedCourseSkeletonFromOutline,
  extractGeneratedModuleFromResponse,
  normalizeAssessmentPlan,
  normalizeGeneratedCourseContent,
  resolveAssessmentPlan,
  retrieveStaticCourseGenerationContext,
  stabilizeAssessmentQuestion
} from "../server/course-generation.mjs";
import {
  groupGeneratedCourseWarningsByModule,
  hasBlockingGeneratedCourseQualityWarnings,
  validateGeneratedCourseQuality
} from "../server/course-generation-quality.mjs";

const assessmentPrompt = buildAssessmentQuestionPrompt({
  subject: "Machine Learning",
  step: 2,
  answers: [{ questionId: "q1", type: "mcq", skipped: true }]
});
const assessmentPlanPrompt = buildAssessmentPlanPrompt({ subject: "Next.js" });
assert.ok(assessmentPlanPrompt.includes("Return JSON only"), "assessment plan prompt must require JSON");
assert.ok(assessmentPlanPrompt.includes("prerequisiteAreas"), "assessment plan prompt must ask for prerequisite areas");
assert.ok(assessmentPlanPrompt.includes("Non-code subjects"), "assessment plan prompt must reject non-code subjects");
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
const cookingAssessmentPlan = resolveAssessmentPlan("Italian cooking");
assert.equal(cookingAssessmentPlan.supported, false);
assert.equal(cookingAssessmentPlan.requiresAssessment, false);
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
assert.equal(assessmentCourse.generationDepth, "full_course");
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
assert.ok(fallbackWorkshop.steps.every((step, index) => step.prompt.includes(`Step ${index + 1}`)), "fallback workshop prompts should be numbered");
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

const outlinePrompt = buildAssessmentCourseOutlinePrompt({
  subject: "Machine Learning",
  answers: [],
  assessmentReview: review,
  courseBlueprint: { finalProject: { title: "Classifier", description: "Build a tiny classifier", capabilities: ["load data"] } }
});
assert.ok(outlinePrompt.includes("Course outline phase"), "outline prompt should identify outline phase");
assert.ok(outlinePrompt.includes("Do not write full lesson markdown"), "outline prompt should not generate loaded teaching content");
assert.ok(outlinePrompt.includes("Modules 1 and 2"), "outline prompt should plan loaded modules");
assert.ok(outlinePrompt.includes("Do not target a fixed module count"), "outline prompt should avoid fixed module counts");
assert.ok(outlinePrompt.includes("kind"), "outline prompt should still plan block kinds");
assert.ok(outlinePrompt.includes("Course blueprint"), "outline prompt must receive hidden course blueprint context");

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

const repairPrompt = buildGeneratedCourseRepairPrompt({
  subject: "Machine Learning",
  content: assessmentCourse,
  qualityWarnings: [{ code: "workshop_too_short", message: "modules[0].topics[0].blocks[1] workshop has fewer than 4 steps." }]
});
assert.ok(repairPrompt.includes("Repair only the invalid generated blocks"), "repair prompt should be block-scoped");
assert.ok(repairPrompt.includes("workshop_too_short"), "repair prompt should include quality warning codes");
assert.ok(repairPrompt.includes("Return the full corrected course JSON"), "repair prompt should return full course JSON for existing normalizer");

const moduleRepairPrompt = buildGeneratedModuleRepairPrompt({
  subject: "Machine Learning",
  module: assessmentCourse.modules[0],
  moduleIndex: 0,
  qualityWarnings: [{ code: "topic_missing_interactive_block", message: "modules[0].topics[0] has no quiz, workshop, lab, or project block." }]
});
assert.ok(moduleRepairPrompt.includes("Repair only this generated module"), "module repair prompt should be module-scoped");
assert.ok(moduleRepairPrompt.includes('"moduleIndex":0'), "module repair prompt should preserve module index");
assert.ok(moduleRepairPrompt.includes("Return strict JSON only"), "module repair prompt should return JSON");
assert.ok(!moduleRepairPrompt.includes("full corrected course JSON"), "module repair prompt should not ask for full-course repair");

const groupedWarnings = groupGeneratedCourseWarningsByModule([
  { code: "workshop_too_short", message: "modules[0].topics[0].blocks[1] workshop has fewer than 4 steps." },
  { code: "quiz_too_short", message: "modules[1].topics[0].blocks[1] quiz has fewer than 4 MCQs." },
  { code: "block_empty", message: "course has an empty generated block." }
]);
assert.equal(groupedWarnings.get(0).length, 2, "unscoped warnings should default to module 0 repair");
assert.equal(groupedWarnings.get(1).length, 1, "module 1 warnings should group together");

assert.ok(coursePrompt.includes("Learner generation context"));
assert.ok(coursePrompt.includes("Retrieved course-generation context"));
assert.ok(coursePrompt.includes('Every block must include a "kind" field'));
assert.ok(coursePrompt.includes("Fully load modules 1 and 2"));
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
assert.ok(coursePrompt.includes('A "lab" block must be independent'));
assert.ok(coursePrompt.includes("Labs should usually be the same project pattern as the preceding workshop"));
assert.ok(coursePrompt.includes("Every workshop/lab/project step needs detailed context"));
assert.ok(coursePrompt.includes("Workshop prompts must teach by tutorial"));
assert.ok(coursePrompt.includes("Each workshop step should read like a FreeCodeCamp-style step screen"));
assert.ok(coursePrompt.includes("Step 1, Step 2"));
assert.ok(coursePrompt.includes("remind the learner what they already learned"));
assert.ok(coursePrompt.includes("explain every new token"));
assert.ok(coursePrompt.includes("Never include hidden planning"));
assert.ok(!coursePrompt.includes("internally design"));
assert.ok(coursePrompt.includes("Use requiresPreview:true"));
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
assert.equal(normalizedLanguageCourse.modules[1].unlocked, true);
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

console.log("generated course content checks passed");
