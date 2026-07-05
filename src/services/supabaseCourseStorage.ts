import { User } from "@supabase/supabase-js";
import { Course, GeneratedCourseContent, buildSyllabusFromGeneratedContent, createDefaultCourseMetadata, starterCourseFiles } from "@/data/courses";
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
import { resetProgression } from "@/services/progression";

type SupabaseCourseDraft = Pick<Course, "title" | "subject" | "mode" | "checkpoint" | "description" | "progress" | "syllabus" | "languages" | "tags"> & {
  courseContent?: GeneratedCourseContent | null;
};

let chatMessageMetadataSupported: boolean | null = null;

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
        lessonIndex: message.lesson_index ?? undefined,
        messageKind: message.message_kind ?? "chat",
        generatedKey: message.generated_key ?? null
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

  const createdCourse = courseRecordToCourse(payload.course as CourseRecord);
  if (draft.courseContent && !createdCourse.courseContent) {
    return {
      ...createdCourse,
      languages: draft.languages,
      tags: draft.tags,
      syllabus: draft.syllabus,
      courseContent: draft.courseContent
    };
  }
  return createdCourse;
}

export async function resetSupabaseCourses(_user: User): Promise<void> {
  const token = await readAccessToken("reset courses");

  const [response] = await Promise.all([
    fetch("/api/courses", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }),
    resetProgression()
  ]);

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
        lessonView: normalizePersistedLessonView(state.lessonViewByCourse[courseId] ?? null),
        selectedFilePath: (state.workspaceFilesByCourse[courseId] ?? [])[state.selectedFilesByCourse[courseId] ?? 0]?.path ?? null
      })
    ])
  );
}

function normalizePersistedLessonView(
  view: StoredCourseState["lessonViewByCourse"][string]
): CourseProgressRecord["lesson_view"] {
  return view === "exercises" ? null : view;
}

export async function createSupabaseChatMessage({
  courseId,
  role,
  content,
  lessonIndex,
  messageKind = "chat",
  generatedKey = null
}: {
  courseId: string;
  role: ChatMessageRecord["role"];
  content: string;
  lessonIndex?: number;
  messageKind?: ChatMessageRecord["message_kind"];
  generatedKey?: string | null;
}): Promise<ChatMessageRecord> {
  const client = requireSupabase();
  const payload = {
    course_id: courseId,
    role,
    content,
    lesson_index: lessonIndex ?? null,
    message_kind: messageKind,
    generated_key: generatedKey
  };
  if (chatMessageMetadataSupported === false) {
    return insertBaseChatMessage({ courseId, role, content, lessonIndex, messageKind, generatedKey });
  }

  const { data, error } = await client
    .from("chat_messages")
    .insert(payload)
    .select("*")
    .single();

  if (error && generatedKey && /duplicate|unique|23505/i.test(`${error.message} ${error.code ?? ""}`)) {
    return {
      id: generatedKey,
      course_id: courseId,
      role,
      content,
      lesson_index: lessonIndex ?? null,
      message_kind: messageKind,
      generated_key: generatedKey,
      created_at: new Date().toISOString()
    };
  }

  if (error && /message_kind|generated_key|schema cache|PGRST204/i.test(`${error.message} ${error.code ?? ""}`)) {
    chatMessageMetadataSupported = false;
    return insertBaseChatMessage({ courseId, role, content, lessonIndex, messageKind, generatedKey });
  }

  if (error) throw error;
  chatMessageMetadataSupported = true;
  return data as ChatMessageRecord;
}

async function insertBaseChatMessage({
  courseId,
  role,
  content,
  lessonIndex,
  messageKind,
  generatedKey
}: {
  courseId: string;
  role: ChatMessageRecord["role"];
  content: string;
  lessonIndex?: number;
  messageKind: ChatMessageRecord["message_kind"];
  generatedKey: string | null;
}): Promise<ChatMessageRecord> {
  const client = requireSupabase();
  const fallback = await client
    .from("chat_messages")
    .insert({
      course_id: courseId,
      role,
      content,
      lesson_index: lessonIndex ?? null
    })
    .select("*")
    .single();
  if (fallback.error && generatedKey && /duplicate|unique|23505/i.test(`${fallback.error.message} ${fallback.error.code ?? ""}`)) {
    return {
      id: generatedKey,
      course_id: courseId,
      role,
      content,
      lesson_index: lessonIndex ?? null,
      message_kind: messageKind,
      generated_key: generatedKey,
      created_at: new Date().toISOString()
    };
  }
  if (fallback.error) throw fallback.error;
  return {
    ...(fallback.data as ChatMessageRecord),
    message_kind: messageKind,
    generated_key: generatedKey
  };
}

export async function syncWorkspaceFiles(courseId: string, files: WorkspaceFile[]): Promise<void> {
  const client = requireSupabase();
  const uniqueFiles = dedupeByPath(files);
  const { data, error } = await client.from("workspace_files").select("path").eq("course_id", courseId);
  if (error) throw error;

  const nextPaths = new Set(uniqueFiles.map((file) => file.path));
  const removedPaths = ((data ?? []) as Pick<WorkspaceFileRecord, "path">[])
    .map((file) => file.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length) {
    const { error: deleteError } = await client.from("workspace_files").delete().eq("course_id", courseId).in("path", removedPaths);
    if (deleteError) throw deleteError;
  }

  if (!uniqueFiles.length) return;
  const { error: upsertError } = await client.from("workspace_files").upsert(
    uniqueFiles.map((file) => ({
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
  const uniqueFolders = dedupeByPath(folders);
  const { data, error } = await client.from("workspace_folders").select("path").eq("course_id", courseId);
  if (error) throw error;

  const nextPaths = new Set(uniqueFolders.map((folder) => folder.path));
  const removedPaths = ((data ?? []) as Pick<WorkspaceFolderRecord, "path">[])
    .map((folder) => folder.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length) {
    const { error: deleteError } = await client.from("workspace_folders").delete().eq("course_id", courseId).in("path", removedPaths);
    if (deleteError) throw deleteError;
  }

  if (!uniqueFolders.length) return;
  const { error: upsertError } = await client.from("workspace_folders").upsert(
    uniqueFolders.map((folder) => ({
      course_id: courseId,
      path: folder.path,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "course_id,path" }
  );
  if (upsertError) throw upsertError;
}

function dedupeByPath<T extends { path: string }>(items: T[]): T[] {
  const byPath = new Map<string, T>();
  for (const item of items) {
    if (!byPath.has(item.path)) byPath.set(item.path, item);
  }
  return [...byPath.values()];
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
  const courseContent = isGeneratedCourseContent(record.course_content) ? record.course_content : null;
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
    languages: courseContent?.languages ?? record.languages ?? metadata.languages,
    tags: courseContent?.tags ?? record.tags ?? metadata.tags,
    syllabus: courseContent ? buildSyllabusFromGeneratedContent(courseContent) : metadata.syllabus,
    courseContent
  };
}

function isGeneratedCourseContent(value: unknown): value is GeneratedCourseContent {
  if (!value || typeof value !== "object") return false;
  const content = value as GeneratedCourseContent;
  if (content.schemaVersion === "course-content/v1") return Array.isArray(content.chapters);
  if (content.schemaVersion === "course-content/v2") return Array.isArray(content.modules);
  return false;
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
