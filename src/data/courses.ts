import { topics, TopicFile } from "@/data/topics";

export type Course = {
  id: string;
  experienceType: LearningExperienceType;
  learningBrief?: LearningBrief | null;
  title: string;
  subject: string;
  mode: "fundamentals" | "project" | "leetcode" | "mixed";
  checkpoint: string;
  description: string;
  progress: number;
  light: number;
  files: TopicFile[];
  lastMessage: string;
  createdAt?: string;
  updatedAt: string;
  languages: string[];
  tags: string[];
  syllabus: CourseSyllabusSection[];
  courseContent?: GeneratedLearningContent | null;
};

export type LearningExperienceType = "course" | "short_course" | "exercise" | "guided_project";
export type LearningDomainId = "programming" | "computer_fundamentals" | "internet_web" | "algorithms_data_structures" | "math_for_programmers";

export type LearningBrief = {
  type: LearningExperienceType;
  goal: string;
  domainId?: LearningDomainId;
  technologyId?: string;
  focusAreas?: string[];
  subject?: string;
  language?: string;
  framework?: string;
  platform?: string;
  desiredOutcome?: string;
  motivation?: string;
  priorKnowledge?: string;
  prerequisiteDecision?: "foundation_first" | "continue_target";
  projectDifficulty?: "basic" | "advanced";
  practiceScope?: "all" | "topics" | "weaknesses" | "random";
  topics?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced" | "adaptive" | "random";
  exerciseCount?: number;
  exerciseMixPreference?: "ai" | "custom";
  codingPercent?: number;
  codingCount?: number;
  mcqCount?: number;
  supportMode?: "standard" | "teaching_heavy";
};

export type CourseSyllabusSection = {
  id: string;
  title: string;
  summary: string;
  lessonIndex: number;
  hasChallenge: boolean;
  challengeKey?: string;
};

export type GeneratedCourseContent = GeneratedCourseContentV1 | GeneratedCourseContentV2;

export type GeneratedLearningContent =
  | GeneratedCourseContent
  | GeneratedShortCourseContent
  | GeneratedExerciseSessionContent
  | GeneratedGuidedProjectContent;

type GeneratedLearningContentBase = {
  title: string;
  subject: string;
  description: string;
  languages: string[];
  tags: string[];
  learningBrief: LearningBrief;
};

export type GeneratedShortCourseContent = GeneratedLearningContentBase & {
  schemaVersion: "short-course-content/v1";
  generationDepth: "full_short_course";
  sections: GeneratedCourseTopic[];
};

export type GeneratedExerciseSessionContent = GeneratedLearningContentBase & {
  schemaVersion: "exercise-session/v1";
  generationDepth: "full_exercise_session";
  strategy: "topic" | "random" | "weakness" | "adaptive";
  diagnosticCount: number;
  problems: GeneratedPracticeProblem[];
};

export type GeneratedPracticeProblem = GeneratedCourseTopic & {
  kind: "mcq" | "code";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  primarySkill: string;
  parentLanguage?: string | null;
  topicIds: string[];
  domainIds: string[];
};

export type GeneratedGuidedProjectContentV1 = GeneratedLearningContentBase & {
  schemaVersion: "guided-project-content/v1";
  generationDepth: "project_outline_first_milestone" | "full_project";
  assessmentReview: GeneratedAssessmentReview;
  architecture: {
    deliverable: string;
    stack: string[];
    capabilities: string[];
  };
  milestones: GeneratedCourseModule[];
};

export type GeneratedGuidedProjectContentV2 = GeneratedLearningContentBase & {
  schemaVersion: "guided-project-content/v2";
  generationDepth: "full_project";
  assessmentReview: GeneratedAssessmentReview;
  architecture: {
    deliverable: string;
    stack: string[];
    capabilities: string[];
  };
  module: {
    id: string;
    title: string;
    summary: string;
    blocks: GeneratedCourseLearningBlock[];
  };
};

export type GeneratedGuidedProjectContent = GeneratedGuidedProjectContentV1 | GeneratedGuidedProjectContentV2;

export type GeneratedCourseContentV1 = {
  schemaVersion: "course-content/v1";
  title: string;
  subject: string;
  description: string;
  languages: string[];
  tags: string[];
  generationDepth: "roadmap_first_chapter" | "full_course";
  chapters: GeneratedCourseChapter[];
};

export type GeneratedCourseContentV2 = {
  schemaVersion: "course-content/v2";
  title: string;
  subject: string;
  description: string;
  languages: string[];
  tags: string[];
  learningBrief?: LearningBrief;
  generationDepth: "full_structure_first_module" | "full_course";
  assessmentReview: GeneratedAssessmentReview;
  courseBlueprint?: GeneratedCourseBlueprint;
  ragSources?: GeneratedCourseRagSource[];
  progressiveGeneration?: ProgressiveCourseGeneration;
  modules: GeneratedCourseModule[];
};

export type ProgressiveCourseGeneration = {
  version: "progressive-course-generation/v1";
  jobId: string;
  launchModuleCount: number;
  totalModules: number;
  readyModuleCount: number;
  status: "background" | "complete";
  modules: Array<{
    index: number;
    id: string;
    title: string;
    summary: string;
    status: "queued" | "generating" | "ready" | "paused";
  }>;
};

export type GeneratedAssessmentReview = {
  strengths: string[];
  gaps: string[];
  suggestedModules: string[];
};

export type GeneratedCourseBlueprint = {
  finalProject: {
    title: string;
    description: string;
    capabilities: string[];
  };
  miniProjects: Array<{
    title: string;
    moduleId?: string;
    topicId?: string;
    blockKind?: string;
    connectsTo: string;
  }>;
  conceptSequence: string[];
  prerequisiteBridges: string[];
  moduleGoals: Array<{
    moduleId?: string;
    goal: string;
  }>;
};

export type GeneratedCourseRagSource = {
  id: string;
  title: string;
  sourceType: string;
  url?: string;
};

export type GeneratedCourseModule = {
  id: string;
  title: string;
  summary: string;
  order: number;
  unlocked: boolean;
  topics: GeneratedCourseTopic[];
};

export type GeneratedCourseTopic = {
  id: string;
  title: string;
  summary: string;
  order: number;
  unlocked: boolean;
  blocks: GeneratedCourseLearningBlock[];
};

export type GeneratedCourseLearningBlock = {
  id: string;
  kind: "theory" | "quiz" | "workshop" | "lab" | "project" | "review";
  title: string;
  summary: string;
  order: number;
  steps: GeneratedCourseStep[];
};

export type TutorVisualCueV1 = {
  version: "tutor-visual-cue/v1";
  id: string;
  kind: "diagram" | "illustration";
  title: string;
  description: string;
  caption: string;
  altText: string;
  labels?: string[];
  preferredRenderer?: "auto" | "svg" | "image";
};

export type GeneratedCourseStep = (
  | { type: "theory" | "analogy" | "example" | "summary"; markdown: string }
  | { type: "mcq"; prompt: string; options: string[]; correctOptionIndex: number; explanation: string }
  | { type: "reflection"; prompt: string; rubric: string }
  | {
      type: "workshop" | "lab" | "project";
      id?: string;
      language: string;
      filePath: string;
      prompt: string;
      starterCode: string;
      resultCode?: string;
      expectedChange?: string;
      codeExplanation?: string;
      suggestedQuestions?: string[];
      buildsOnStepId?: string | null;
      conceptIds?: string[];
      acceptanceCriteria: string[];
      context?: string;
      requiresPreview?: boolean;
      requiresTerminal?: boolean;
      workspaceView?: "code" | "preview" | "terminal";
      workspaceFiles?: GeneratedExerciseWorkspaceFile[];
    }) & { visualCue?: TutorVisualCueV1 };

export type GeneratedExerciseWorkspaceFile = {
  path: string;
  content: string;
  purpose?: string;
  editable?: boolean;
};

export type GeneratedCourseChapter = {
  id: string;
  title: string;
  summary: string;
  order: number;
  sections: GeneratedCourseSection[];
};

export type GeneratedCourseSection = {
  id: string;
  title: string;
  summary: string;
  order: number;
  blocks: GeneratedCourseBlock[];
};

export type GeneratedCourseBlock =
  | { type: "theory" | "extra_explanation"; markdown: string }
  | { type: "mcq"; prompt: string; options: string[]; correctOptionIndex: number; explanation: string }
  | { type: "chat_exercise"; prompt: string; rubric: string }
  | { type: "code_exercise"; language: string; filePath: string; prompt: string; starterCode: string; acceptanceCriteria: string[] }
  | { type: "canvas" | "code_showcase"; language?: string; markdown: string };

export const starterCourseFiles: TopicFile[] = [
  {
    name: "README.md",
    codeHtml: "01 # Your learning workspace<br>02 <br>03 Tell Stonecode what you want to learn, then finalize the course setup."
  }
];

export function createLearningCourse({
  experienceType = "course",
  learningBrief = null,
  title,
  subject,
  description,
  languages,
  tags,
  syllabus,
  courseContent,
  files = starterCourseFiles
}: {
  experienceType?: LearningExperienceType;
  learningBrief?: LearningBrief | null;
  title: string;
  subject: string;
  description: string;
  languages?: string[];
  tags?: string[];
  syllabus?: CourseSyllabusSection[];
  courseContent?: GeneratedLearningContent | null;
  files?: TopicFile[];
}): Course {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  const metadata = createDefaultCourseMetadata(subject);

  const createdAt = new Date().toISOString();

  return {
    id: `${slug || "course"}-${Date.now().toString(36)}`,
    experienceType,
    learningBrief: learningBrief ?? (courseContent && "learningBrief" in courseContent ? courseContent.learningBrief : null),
    title,
    subject,
    mode: "mixed",
    checkpoint: "course-setup",
    description,
    progress: 0,
    light: 1,
    files,
    lastMessage: "Start with your generated learning plan.",
    createdAt,
    updatedAt: "Today",
    languages: courseContent?.languages ?? languages ?? metadata.languages,
    tags: courseContent?.tags ?? tags ?? metadata.tags,
    syllabus: courseContent ? buildSyllabusFromGeneratedContent(courseContent) : syllabus ?? metadata.syllabus,
    courseContent: courseContent ?? null
  };
}

export function buildSyllabusFromGeneratedContent(content: GeneratedLearningContent): CourseSyllabusSection[] {
  if (content.schemaVersion !== "course-content/v1") return buildSyllabusFromGeneratedContentV2(toGeneratedCourseContentV2(content));

  let lessonIndex = 0;
  return content.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.flatMap((section) => {
      const blocks = section.blocks.length ? section.blocks : [null];
      return blocks.map((block, blockIndex) => ({
        id: block ? `${section.id}:${blockIndex}` : section.id,
        title: `${chapterIndex + 1}.${lessonIndex + 1} ${block ? blockTitle(section.title, block.type) : section.title}`,
        summary: block ? blockSummary(section.summary, block.type) : section.summary,
        lessonIndex: lessonIndex++,
        hasChallenge: Boolean(block && (block.type === "mcq" || block.type === "chat_exercise" || block.type === "code_exercise"))
      }));
    })
  );
}

export function toGeneratedCourseContentV2(content: Exclude<GeneratedLearningContent, GeneratedCourseContentV1>): GeneratedCourseContentV2 {
  if (content.schemaVersion === "course-content/v2") return content;
  if (content.schemaVersion === "short-course-content/v1") {
    return {
      schemaVersion: "course-content/v2",
      title: content.title,
      subject: content.subject,
      description: content.description,
      languages: content.languages,
      tags: content.tags,
      generationDepth: "full_course",
      assessmentReview: { strengths: ["Focused concept path"], gaps: [], suggestedModules: content.sections.map((section) => section.title) },
      modules: [{ id: "short-course", title: "Short course", summary: content.description, order: 0, unlocked: true, topics: content.sections }]
    };
  }
  if (content.schemaVersion === "exercise-session/v1") {
    return {
      schemaVersion: "course-content/v2",
      title: content.title,
      subject: content.subject,
      description: content.description,
      languages: content.languages,
      tags: content.tags,
      generationDepth: "full_course",
      assessmentReview: { strengths: [], gaps: [], suggestedModules: content.problems.map((problem) => problem.title) },
      modules: [{ id: "practice-session", title: "Problems", summary: content.description, order: 0, unlocked: true, topics: content.problems }]
    };
  }
  if (content.schemaVersion === "guided-project-content/v2") {
    return {
      schemaVersion: "course-content/v2",
      title: content.title,
      subject: content.subject,
      description: content.description,
      languages: content.languages,
      tags: content.tags,
      generationDepth: "full_course",
      assessmentReview: content.assessmentReview,
      modules: [{
        id: content.module.id,
        title: content.module.title,
        summary: content.module.summary,
        order: 0,
        unlocked: true,
        topics: [{
          id: `${content.module.id}-build`,
          title: content.module.title,
          summary: content.module.summary,
          order: 0,
          unlocked: true,
          blocks: content.module.blocks
        }]
      }]
    };
  }
  return {
    schemaVersion: "course-content/v2",
    title: content.title,
    subject: content.subject,
    description: content.description,
    languages: content.languages,
    tags: content.tags,
    generationDepth: content.generationDepth === "full_project" ? "full_course" : "full_structure_first_module",
    assessmentReview: content.assessmentReview,
    modules: content.milestones
  };
}

export function experienceTypeFromContent(content: GeneratedLearningContent | null | undefined): LearningExperienceType {
  if (!content || content.schemaVersion === "course-content/v1" || content.schemaVersion === "course-content/v2") return "course";
  if (content.schemaVersion === "short-course-content/v1") return "short_course";
  if (content.schemaVersion === "exercise-session/v1") return "exercise";
  return "guided_project";
}

export function learningNavigationLabel(type: LearningExperienceType) {
  if (type === "short_course") return "Sections";
  if (type === "exercise") return "Problems";
  if (type === "guided_project") return "Project";
  return "Modules";
}

export function learningExperienceLabel(type: LearningExperienceType) {
  if (type === "short_course") return "Short course";
  if (type === "exercise") return "Practice";
  if (type === "guided_project") return "Guided project";
  return "Course";
}

function buildSyllabusFromGeneratedContentV2(content: GeneratedCourseContentV2): CourseSyllabusSection[] {
  let lessonIndex = 0;
  return content.modules.flatMap((module, moduleIndex) =>
    module.topics.flatMap((topic, topicIndex) =>
      topic.blocks.flatMap((block) =>
        syllabusStepsForBlock(block).map((step, stepIndex) => ({
          id: `${module.id}:${topic.id}:${block.id}:${stepIndex}`,
          title: `${moduleIndex + 1}.${topicIndex + 1} ${stepTitle(block.title, step.type)}`,
          summary: stepSummary(block.summary, step.type),
          lessonIndex: lessonIndex++,
          hasChallenge: step.type === "mcq" || step.type === "reflection" || step.type === "workshop" || step.type === "lab" || step.type === "project"
        }))
      )
    )
  );
}

function syllabusStepsForBlock(block: GeneratedCourseLearningBlock): GeneratedCourseStep[] {
  if (block.kind !== "workshop" || block.steps.at(-1)?.type === "summary") return block.steps;
  return [...block.steps, { type: "summary", markdown: "## Workshop complete\n\nReview the finished code before continuing." }];
}

function stepTitle(blockTitleText: string, type: GeneratedCourseStep["type"]) {
  if (type === "mcq") return `${blockTitleText} practice`;
  if (type === "reflection") return `${blockTitleText} written practice`;
  if (type === "workshop" || type === "lab" || type === "project") return `${blockTitleText} editor exercise`;
  return blockTitleText;
}

function stepSummary(blockSummaryText: string, type: GeneratedCourseStep["type"]) {
  if (type === "mcq") return "Answer a quick multiple-choice check before continuing.";
  if (type === "reflection") return "Explain the idea in your own words for tutor review.";
  if (type === "workshop" || type === "lab" || type === "project") return "Use the active IDE file as a focused scratch file and submit runnable code.";
  return blockSummaryText;
}

function blockTitle(sectionTitle: string, type: GeneratedCourseBlock["type"]) {
  if (type === "mcq") return `${sectionTitle} practice`;
  if (type === "chat_exercise") return `${sectionTitle} written practice`;
  if (type === "code_exercise") return `${sectionTitle} editor exercise`;
  return sectionTitle;
}

function blockSummary(sectionSummary: string, type: GeneratedCourseBlock["type"]) {
  if (type === "mcq") return "Answer a quick multiple-choice check before continuing.";
  if (type === "chat_exercise") return "Explain the idea in your own words for tutor review.";
  if (type === "code_exercise") return "Use the active IDE file as a focused scratch file and submit runnable code.";
  return sectionSummary;
}

export function createDefaultCourseMetadata(subject: string): Pick<Course, "languages" | "tags" | "syllabus"> {
  const normalized = subject.toLowerCase();
  const languages = normalized.includes("python")
    ? ["Python"]
    : normalized.includes("computer")
      ? ["JavaScript", "Python"]
      : ["JavaScript", "HTML", "CSS"];

  return {
    languages,
    tags: normalized.includes("computer")
      ? ["Problem solving", "Data structures", "Complexity"]
      : ["Fundamentals", "Projects", "Debugging"],
    syllabus: [
      {
        id: "read-code",
        title: "Read the current code",
        summary: "Trace inputs, outputs, and state before making changes.",
        lessonIndex: 0,
        hasChallenge: false
      },
      {
        id: "explain-edge-cases",
        title: "Reason about edge cases",
        summary: "Explain behavior clearly before implementing a fix.",
        lessonIndex: 1,
        hasChallenge: true,
        challengeKey: "course-empty-array"
      },
      {
        id: "choose-an-operation",
        title: "Choose the right operation",
        summary: "Compare alternatives and identify their side effects.",
        lessonIndex: 2,
        hasChallenge: true,
        challengeKey: "course-array-mutation"
      },
      {
        id: "build-and-run",
        title: "Build and run a solution",
        summary: "Implement a focused feature and verify it in the terminal.",
        lessonIndex: 3,
        hasChallenge: true,
        challengeKey: "course-queue-terminal"
      },
      {
        id: "visual-review",
        title: "Review the system visually",
        summary: "Connect the implementation to a reusable mental model.",
        lessonIndex: 4,
        hasChallenge: false
      }
    ]
  };
}

export const courses: Course[] = [
  {
    id: "javascript-rendering",
    experienceType: "course",
    title: "JavaScript Rendering",
    subject: "JavaScript",
    mode: "project",
    checkpoint: "render-loop-review",
    description: topics[0].description,
    progress: topics[0].progress,
    light: topics[0].light,
    files: topics[0].files,
    lastMessage: "Resume from render loops and texture cost.",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "Today",
    ...createDefaultCourseMetadata("JavaScript")
  },
  {
    id: "data-structures",
    experienceType: "course",
    title: "Data Structures",
    subject: "Computer Science",
    mode: "fundamentals",
    checkpoint: "queues-and-graphs",
    description: topics[1].description,
    progress: topics[1].progress,
    light: topics[1].light,
    files: topics[1].files,
    lastMessage: "Continue queues, graphs, and cache tradeoffs.",
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "Yesterday",
    ...createDefaultCourseMetadata("Computer Science")
  }
];

export const defaultCourseCodeHtml = courses[0].files[0].codeHtml;
