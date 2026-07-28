import { Course, toGeneratedCourseContentV2 } from "@/data/courses";
import { StoredChatMessage } from "@/services/courseStorage";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";

export type TutorContextInput = {
  course: Course;
  files: WorkspaceFile[];
  folders?: WorkspaceFolder[];
  currentFile: WorkspaceFile | null;
  recentMessages: StoredChatMessage[];
  userMessage: string;
  requestKind?: "chat" | "lesson_intro" | "exercise_hint" | "exercise_template";
  lesson?: {
    index: number;
    title: string;
    label: string;
    kind: string;
    sectionId?: string;
    moduleId?: string;
    topicId?: string;
    blockId?: string;
    blockKind?: string;
    blockStepIndex?: number;
    blockStepCount?: number;
  };
  exercise?: {
    id: string;
    title: string;
    scenario: string;
    acceptanceCriteria: string[];
    language: string;
    topic: string;
    difficulty: string;
    xp: number;
    currentCode?: string;
  };
};

export type TutorContext = {
  courseId: string;
  experienceType: Course["experienceType"];
  learningBrief: Course["learningBrief"];
  courseTitle: string;
  courseSubject: string;
  courseMode: Course["mode"];
  courseDescription: string;
  courseLanguages: string[];
  courseTags: string[];
  courseSyllabus: Array<{
    id: string;
    title: string;
    summary: string;
    lessonIndex: number;
    hasChallenge: boolean;
  }>;
  courseContent: Course["courseContent"] | null;
  checkpoint: string;
  currentFilePath: string | null;
  currentFileContent: string | null;
  fileTree: string[];
  workspaceFolders: string[];
  workspaceFiles: Array<{
    path: string;
    content: string;
  }>;
  recentMessages: Array<{
    role: StoredChatMessage["role"];
    content: string;
  }>;
  userMessage: string;
  requestKind: NonNullable<TutorContextInput["requestKind"]>;
  lesson?: TutorContextInput["lesson"];
  currentCourseStep?: {
    schemaVersion: "course-content/v2";
    moduleId: string;
    moduleTitle: string;
    topicId: string;
    topicTitle: string;
    blockId: string;
    blockKind: string;
    blockTitle: string;
    blockSummary: string;
    stepIndex: number;
    stepType: string;
    step: unknown;
    previousStepSummary: string | null;
    nextStepSummary: string | null;
  } | null;
  ragContext?: Array<{
    id: string;
    sourceType?: string;
    kind?: string;
    blockKind?: string;
    title: string;
    url?: string;
    content: string;
  }>;
  exercise?: TutorContextInput["exercise"];
};

export function buildTutorContext(input: TutorContextInput): TutorContext {
  return {
    courseId: input.course.id,
    experienceType: input.course.experienceType,
    learningBrief: input.course.learningBrief ?? null,
    courseTitle: input.course.title,
    courseSubject: input.course.subject,
    courseMode: input.course.mode,
    courseDescription: input.course.description,
    courseLanguages: input.course.languages,
    courseTags: input.course.tags,
    courseSyllabus: input.course.syllabus.map((section) => ({
      id: section.id,
      title: section.title,
      summary: section.summary,
      lessonIndex: section.lessonIndex,
      hasChallenge: section.hasChallenge
    })),
    courseContent: input.course.courseContent ?? null,
    checkpoint: input.course.checkpoint,
    currentFilePath: input.currentFile?.path ?? null,
    currentFileContent: input.currentFile?.content ?? null,
    fileTree: [
      ...(input.folders ?? []).map((folder) => `${folder.path}/`),
      ...input.files.map((file) => file.path)
    ],
    workspaceFolders: (input.folders ?? []).map((folder) => folder.path),
    workspaceFiles: input.files.map((file) => ({
      path: file.path,
      content: file.content
    })),
    recentMessages: input.recentMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content
    })),
    userMessage: input.userMessage,
    requestKind: input.requestKind ?? "chat",
    lesson: input.lesson,
    currentCourseStep: resolveCurrentCourseStepContext(input.course.courseContent ?? null, input.lesson),
    exercise: input.exercise
  };
}

function resolveCurrentCourseStepContext(
  courseContent: Course["courseContent"] | null,
  lesson: TutorContextInput["lesson"] | undefined
): TutorContext["currentCourseStep"] {
  if (!courseContent || courseContent.schemaVersion === "course-content/v1" || !lesson) return null;
  const navigableContent = toGeneratedCourseContentV2(courseContent);
  const ids = resolveStepIds(lesson);
  if (!ids) return null;

  const module = navigableContent.modules.find((item) => item.id === ids.moduleId);
  const topic = module?.topics.find((item) => item.id === ids.topicId);
  const block = topic?.blocks.find((item) => item.id === ids.blockId);
  const stepIndex = ids.stepIndex;
  const step = block?.steps[stepIndex];
  if (!module || !topic || !block || !step) return null;

  return {
    schemaVersion: "course-content/v2",
    moduleId: module.id,
    moduleTitle: module.title,
    topicId: topic.id,
    topicTitle: topic.title,
    blockId: block.id,
    blockKind: block.kind,
    blockTitle: block.title,
    blockSummary: block.summary,
    stepIndex,
    stepType: step.type,
    step,
    previousStepSummary: summarizeGeneratedStep(block.steps[stepIndex - 1] ?? null),
    nextStepSummary: summarizeGeneratedStep(block.steps[stepIndex + 1] ?? null)
  };
}

function resolveStepIds(lesson: NonNullable<TutorContextInput["lesson"]>): {
  moduleId: string;
  topicId: string;
  blockId: string;
  stepIndex: number;
} | null {
  if (lesson.sectionId) {
    const [moduleId, topicId, blockId, stepIndexText] = lesson.sectionId.split(":");
    const stepIndex = Number(stepIndexText);
    if (moduleId && topicId && blockId && Number.isInteger(stepIndex)) {
      return { moduleId, topicId, blockId, stepIndex };
    }
  }
  if (
    lesson.moduleId &&
    lesson.topicId &&
    lesson.blockId &&
    typeof lesson.blockStepIndex === "number" &&
    Number.isInteger(lesson.blockStepIndex)
  ) {
    return {
      moduleId: lesson.moduleId,
      topicId: lesson.topicId,
      blockId: lesson.blockId,
      stepIndex: lesson.blockStepIndex
    };
  }
  return null;
}

function summarizeGeneratedStep(step: unknown) {
  if (!step || typeof step !== "object") return null;
  const typedStep = step as { type?: unknown; markdown?: unknown; prompt?: unknown };
  const text = typeof typedStep.markdown === "string"
    ? typedStep.markdown
    : typeof typedStep.prompt === "string"
      ? typedStep.prompt
      : "";
  return `${String(typedStep.type ?? "step")}: ${text.replace(/\s+/g, " ").trim().slice(0, 220)}`.trim();
}
