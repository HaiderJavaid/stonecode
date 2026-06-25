import { User } from "@supabase/supabase-js";
import { Course, createDefaultCourseMetadata, starterCourseFiles } from "@/data/courses";
import {
  ChatMessageRecord,
  CourseProgressRecord,
  CourseRecord,
  WorkspaceFileRecord,
  WorkspaceFolderRecord
} from "@/lib/database.types";
import { supabase } from "@/lib/supabaseClient";
import { StoredCourseState } from "@/services/courseStorage";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";

type SupabaseCourseDraft = Pick<Course, "title" | "subject" | "mode" | "checkpoint" | "description" | "progress">;

export async function loadSupabaseCourseState(user: User): Promise<StoredCourseState> {
  const client = requireSupabase();
  await ensureUserProfile(user);

  const { data: courseRows, error: coursesError } = await client
    .from("courses")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (coursesError) throw coursesError;

  const courses = (courseRows ?? []) as CourseRecord[];
  const courseIds = courses.map((course) => course.id);
  const [fileRows, folderRows, messageRows, progressRows] = courseIds.length
    ? await Promise.all([
        selectByCourseIds<WorkspaceFileRecord>("workspace_files", courseIds),
        selectByCourseIds<WorkspaceFolderRecord>("workspace_folders", courseIds),
        selectByCourseIds<ChatMessageRecord>("chat_messages", courseIds, "created_at"),
        selectProgressByCourseIds(courseIds)
      ])
    : [[], [], [], []];

  const state: StoredCourseState = {
    activeCourseId: null,
    coursesById: Object.fromEntries(courses.map((course) => [course.id, courseRecordToCourse(course)])),
    courseOrder: courseIds,
    selectedFilesByCourse: {},
    chatByCourse: {},
    fileOverridesByCourse: {},
    workspaceFilesByCourse: {},
    workspaceFoldersByCourse: {},
    lessonViewByCourse: {},
    lessonStepByCourse: {}
  };

  fileRows.forEach((file) => {
    state.workspaceFilesByCourse[file.course_id] = [
      ...(state.workspaceFilesByCourse[file.course_id] ?? []),
      { path: file.path, content: file.content }
    ];
  });

  folderRows.forEach((folder) => {
    state.workspaceFoldersByCourse[folder.course_id] = [
      ...(state.workspaceFoldersByCourse[folder.course_id] ?? []),
      { path: folder.path }
    ];
  });

  messageRows.forEach((message) => {
    state.chatByCourse[message.course_id] = [
      ...(state.chatByCourse[message.course_id] ?? []),
      {
        id: message.id,
        role: message.role,
        content: message.content,
        lessonIndex: message.lesson_index ?? undefined
      }
    ];
  });

  progressRows.forEach((progress) => {
    state.lessonStepByCourse[progress.course_id] = progress.lesson_index;
    state.lessonViewByCourse[progress.course_id] = progress.lesson_view;
    const files = state.workspaceFilesByCourse[progress.course_id] ?? [];
    const selectedIndex = files.findIndex((file) => file.path === progress.selected_file_path);
    state.selectedFilesByCourse[progress.course_id] = Math.max(selectedIndex, 0);
  });

  return state;
}

export async function createSupabaseCourse(_user: User, draft: SupabaseCourseDraft): Promise<Course> {
  const token = await readAccessToken("create a course");

  const response = await fetch("/api/courses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ course: draft })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to create course.");
  }

  return courseRecordToCourse(payload.course as CourseRecord);
}

export async function resetSupabaseCourses(_user: User): Promise<void> {
  const token = await readAccessToken("reset courses");

  const response = await fetch("/api/courses", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to reset courses.");
  }
}

export async function saveSupabaseWorkspaceState(state: StoredCourseState): Promise<void> {
  const courseIds = state.courseOrder;
  await Promise.all(
    courseIds.flatMap((courseId) => [
      syncWorkspaceFiles(courseId, state.workspaceFilesByCourse[courseId] ?? []),
      syncWorkspaceFolders(courseId, state.workspaceFoldersByCourse[courseId] ?? []),
      upsertCourseProgress(courseId, {
        lessonIndex: state.lessonStepByCourse[courseId] ?? 0,
        lessonView: state.lessonViewByCourse[courseId] ?? null,
        selectedFilePath: (state.workspaceFilesByCourse[courseId] ?? [])[state.selectedFilesByCourse[courseId] ?? 0]?.path ?? null
      })
    ])
  );
}

export async function createSupabaseChatMessage({
  courseId,
  role,
  content,
  lessonIndex
}: {
  courseId: string;
  role: ChatMessageRecord["role"];
  content: string;
  lessonIndex?: number;
}): Promise<ChatMessageRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("chat_messages")
    .insert({
      course_id: courseId,
      role,
      content,
      lesson_index: lessonIndex ?? null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatMessageRecord;
}

export async function syncWorkspaceFiles(courseId: string, files: WorkspaceFile[]): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.from("workspace_files").select("path").eq("course_id", courseId);
  if (error) throw error;

  const nextPaths = new Set(files.map((file) => file.path));
  const removedPaths = ((data ?? []) as Pick<WorkspaceFileRecord, "path">[])
    .map((file) => file.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length) {
    const { error: deleteError } = await client.from("workspace_files").delete().eq("course_id", courseId).in("path", removedPaths);
    if (deleteError) throw deleteError;
  }

  if (!files.length) return;
  const { error: upsertError } = await client.from("workspace_files").upsert(
    files.map((file) => ({
      course_id: courseId,
      path: file.path,
      content: file.content,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "course_id,path" }
  );
  if (upsertError) throw upsertError;
}

export async function syncWorkspaceFolders(courseId: string, folders: WorkspaceFolder[]): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.from("workspace_folders").select("path").eq("course_id", courseId);
  if (error) throw error;

  const nextPaths = new Set(folders.map((folder) => folder.path));
  const removedPaths = ((data ?? []) as Pick<WorkspaceFolderRecord, "path">[])
    .map((folder) => folder.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length) {
    const { error: deleteError } = await client.from("workspace_folders").delete().eq("course_id", courseId).in("path", removedPaths);
    if (deleteError) throw deleteError;
  }

  if (!folders.length) return;
  const { error: upsertError } = await client.from("workspace_folders").upsert(
    folders.map((folder) => ({
      course_id: courseId,
      path: folder.path,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "course_id,path" }
  );
  if (upsertError) throw upsertError;
}

export async function upsertCourseProgress(
  courseId: string,
  progress: {
    lessonIndex: number;
    lessonView: CourseProgressRecord["lesson_view"];
    selectedFilePath: string | null;
  }
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("course_progress").upsert({
    course_id: courseId,
    lesson_index: progress.lessonIndex,
    lesson_view: progress.lessonView,
    selected_file_path: progress.selectedFilePath,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function ensureUserProfile(user: User): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

async function selectByCourseIds<T>(table: string, courseIds: string[], orderColumn = "path"): Promise<T[]> {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select("*").in("course_id", courseIds).order(orderColumn, { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function selectProgressByCourseIds(courseIds: string[]): Promise<CourseProgressRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client.from("course_progress").select("*").in("course_id", courseIds);
  if (error) throw error;
  return (data ?? []) as CourseProgressRecord[];
}

function courseRecordToCourse(record: CourseRecord): Course {
  const metadata = createDefaultCourseMetadata(record.subject);
  return {
    id: record.id,
    title: record.title,
    subject: record.subject,
    mode: record.mode,
    checkpoint: record.checkpoint,
    description: record.description ?? "",
    progress: record.progress,
    light: 1,
    files: starterCourseFiles,
    lastMessage: "Resume your learning workspace.",
    updatedAt: formatUpdatedAt(record.updated_at),
    ...metadata
  };
}

function formatUpdatedAt(value: string): string {
  const updated = new Date(value);
  if (Number.isNaN(updated.getTime())) return "Recently";
  return updated.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function readAccessToken(action: string): Promise<string> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) {
    throw new Error(sessionError?.message ?? `Authentication is required to ${action}.`);
  }

  return token;
}
