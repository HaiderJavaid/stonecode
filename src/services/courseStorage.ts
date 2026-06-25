import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { Course } from "@/data/courses";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  lessonIndex?: number;
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
  lessonStepByCourse: {}
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
      coursesById: parsed.coursesById ?? {},
      courseOrder: parsed.courseOrder ?? [],
      selectedFilesByCourse: parsed.selectedFilesByCourse ?? {},
      chatByCourse: parsed.chatByCourse ?? {},
      fileOverridesByCourse: parsed.fileOverridesByCourse ?? {},
      workspaceFilesByCourse: parsed.workspaceFilesByCourse ?? {},
      workspaceFoldersByCourse: parsed.workspaceFoldersByCourse ?? {},
      lessonViewByCourse: parsed.lessonViewByCourse ?? {},
      lessonStepByCourse: parsed.lessonStepByCourse ?? {}
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
  lessonIndex?: number
): StoredChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    lessonIndex
  };
}
