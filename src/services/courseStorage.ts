import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { Course, experienceTypeFromContent } from "@/data/courses";
import type { TutorToolPayload } from "@/ai/tutorTools";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  lessonIndex?: number;
  messageKind?: "chat" | "lesson-intro" | "exercise-hint";
  generatedKey?: string | null;
  toolPayload?: TutorToolPayload | null;
};

export type StoredCourseState = {
  activeCourseId: string | null;
  coursesById: Record<string, Course>;
  courseOrder: string[];
  selectedFilesByCourse: Record<string, number>;
  chatByCourse: Record<string, StoredChatMessage[]>;
  fileOverridesByCourse: Record<string, Record<string, string>>;
  workspaceFilesByCourse: Record<string, WorkspaceFile[]>;
  workspaceFoldersByCourse: Record<string, WorkspaceFolder[]>;
  lessonViewByCourse: Record<string, "resume" | "progress" | "exercises" | null>;
  lessonStepByCourse: Record<string, number>;
  highestLessonStepByCourse: Record<string, number>;
};

export const defaultStoredCourseState: StoredCourseState = {
  activeCourseId: null,
  coursesById: {},
  courseOrder: [],
  selectedFilesByCourse: {},
  chatByCourse: {},
  fileOverridesByCourse: {},
  workspaceFilesByCourse: {},
  workspaceFoldersByCourse: {},
  lessonViewByCourse: {},
  lessonStepByCourse: {},
  highestLessonStepByCourse: {}
};

const STORAGE_KEY = "stonecode.courseState.v1";

export function loadCourseState(): StoredCourseState {
  if (typeof window === "undefined") return defaultStoredCourseState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStoredCourseState;

    const parsed = JSON.parse(raw) as Partial<StoredCourseState>;

    return {
      activeCourseId: parsed.activeCourseId ?? null,
      coursesById: Object.fromEntries(Object.entries(parsed.coursesById ?? {}).map(([id, course]) => [id, {
        ...course,
        experienceType: course.experienceType ?? experienceTypeFromContent(course.courseContent),
        learningBrief: course.learningBrief ?? (course.courseContent && "learningBrief" in course.courseContent ? course.courseContent.learningBrief : null)
      }])),
      courseOrder: parsed.courseOrder ?? [],
      selectedFilesByCourse: parsed.selectedFilesByCourse ?? {},
      chatByCourse: parsed.chatByCourse ?? {},
      fileOverridesByCourse: parsed.fileOverridesByCourse ?? {},
      workspaceFilesByCourse: parsed.workspaceFilesByCourse ?? {},
      workspaceFoldersByCourse: parsed.workspaceFoldersByCourse ?? {},
      lessonViewByCourse: parsed.lessonViewByCourse ?? {},
      lessonStepByCourse: parsed.lessonStepByCourse ?? {},
      highestLessonStepByCourse: parsed.highestLessonStepByCourse ?? parsed.lessonStepByCourse ?? {}
    };
  } catch {
    return defaultStoredCourseState;
  }
}

export function saveCourseState(state: StoredCourseState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearCourseState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function createStoredMessage(
  role: StoredChatMessage["role"],
  content: string,
  lessonIndex?: number,
  options: Pick<StoredChatMessage, "messageKind" | "generatedKey" | "toolPayload"> = {}
): StoredChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    lessonIndex,
    messageKind: options.messageKind ?? "chat",
    generatedKey: options.generatedKey ?? null,
    toolPayload: options.toolPayload ?? null
  };
}
