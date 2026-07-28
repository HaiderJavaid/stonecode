import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AiFileEdit, applyAiFileEdits } from "@/ai/fileEditCommands";
import { Course, GeneratedExerciseWorkspaceFile, GeneratedLearningContent, buildSyllabusFromGeneratedContent } from "@/data/courses";
import { requestGeneratedChapter, requestGeneratedProjectMilestone } from "@/services/courseGeneration";
import {
  clearCourseState,
  defaultStoredCourseState,
  loadCourseState,
  saveCourseState,
  StoredCourseState
} from "@/services/courseStorage";
import {
  createUntitledFolderPath,
  createUntitledPath,
  normalizeWorkspacePath,
  WorkspaceFile,
  WorkspaceFolder
} from "@/services/workspaceFiles";
import {
  createSupabaseCourse,
  loadSupabaseCourseState,
  resetSupabaseCourses,
  saveSupabaseWorkspaceState
} from "@/services/supabaseCourseStorage";
import { ActiveState } from "@/components/stonecode/types";
import { defaultFilePath } from "@/services/editorLanguages";

const lastOpenCourseStorageKey = "stonecode.lastOpenCourseId.v1";

export function useCourseWorkspace() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured, user } = useAuth();
  const initialStateRef = useRef<StoredCourseState | null>(null);
  if (!initialStateRef.current) initialStateRef.current = loadCourseState();
  const [storedState, setStoredState] = useState<StoredCourseState>(() => initialStateRef.current ?? defaultStoredCourseState);
  const [active, setActive] = useState<ActiveState | null>(() =>
    resolveInitialActiveState(initialStateRef.current ?? defaultStoredCourseState, courseId, location.pathname)
  );
  const [lastAiEditSnapshot, setLastAiEditSnapshot] = useState<{
    courseId: string;
    files: WorkspaceFile[];
    selectedIndex: number;
  } | null>(null);
  const [isRemoteLoaded, setIsRemoteLoaded] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const syncErrorRef = useRef<string | null>(null);
  const isSupabaseBacked = isConfigured && Boolean(user);
  const userCourses = useMemo(
    () => storedState.courseOrder.map((id) => storedState.coursesById[id]).filter(Boolean),
    [storedState.courseOrder, storedState.coursesById]
  );
  const activeCourse = useMemo(
    () => userCourses.find((course) => course.id === active?.courseId) ?? null,
    [active, userCourses]
  );
  const activeFiles = activeCourse ? storedState.workspaceFilesByCourse[activeCourse.id] ?? [] : [];
  const activeFolders = activeCourse ? storedState.workspaceFoldersByCourse[activeCourse.id] ?? [] : [];
  const selectedFile = activeFiles[active?.fileIndex ?? 0] ?? null;
  const activeCourseCount = userCourses.filter((course) => course.experienceType !== "exercise").length;

  function getCourseFiles(course: Course, state = storedState) {
    return state.workspaceFilesByCourse[course.id] ?? [];
  }

  function getCourseFolders(course: Course, state = storedState) {
    return state.workspaceFoldersByCourse[course.id] ?? [];
  }

  function withCourseFiles(
    course: Course,
    update: (files: WorkspaceFile[]) => { files: WorkspaceFile[]; selectedIndex?: number }
  ) {
    setStoredState((current) => {
      const currentFiles = getCourseFiles(course, current);
      const result = update(currentFiles);

      return {
        ...current,
        workspaceFilesByCourse: {
          ...current.workspaceFilesByCourse,
          [course.id]: result.files
        },
        selectedFilesByCourse: {
          ...current.selectedFilesByCourse,
          [course.id]: result.selectedIndex ?? current.selectedFilesByCourse[course.id] ?? 0
        }
      };
    });
  }

  function withCourseFolders(
    course: Course,
    update: (folders: WorkspaceFolder[]) => WorkspaceFolder[]
  ) {
    setStoredState((current) => {
      const currentFolders = getCourseFolders(course, current);

      return {
        ...current,
        workspaceFoldersByCourse: {
          ...current.workspaceFoldersByCourse,
          [course.id]: update(currentFolders)
        }
      };
    });
  }

  useEffect(() => {
    if (!isSupabaseBacked || !user) {
      setIsRemoteLoaded(false);
      return;
    }

    let isCancelled = false;
    setIsRemoteLoaded(false);

    loadSupabaseCourseState(user)
      .then((remoteState) => {
        if (isCancelled) return;
        setStoredState(remoteState);
        setIsRemoteLoaded(true);
      })
      .catch((error) => {
        syncErrorRef.current = error instanceof Error ? error.message : "Failed to load Supabase course state.";
        setIsRemoteLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [isSupabaseBacked, user]);

  useEffect(() => {
    if (isSupabaseBacked && !isRemoteLoaded) return;
    const fallbackCourseId = location.pathname.startsWith("/settings")
      ? storedState.activeCourseId ?? readLastOpenCourseId()
      : null;
    const targetCourseId = courseId ?? fallbackCourseId;
    const course = isRemoteLoaded || !isSupabaseBacked ? (targetCourseId ? storedState.coursesById[targetCourseId] : null) : null;
    if (course) {
      const files = storedState.workspaceFilesByCourse[course.id] ?? [];
      const fileIndex = Math.min(storedState.selectedFilesByCourse[course.id] ?? 0, Math.max(files.length - 1, 0));
      setActive({ courseId: course.id, fileIndex });
      writeLastOpenCourseId(course.id);
      setStoredState((current) =>
        current.activeCourseId === course.id
          ? current
          : {
              ...current,
              activeCourseId: course.id
            }
      );
      return;
    }

    setActive(null);
    if (!location.pathname.startsWith("/settings")) writeLastOpenCourseId(null);
    setStoredState((current) =>
      current.activeCourseId === null
        ? current
        : {
            ...current,
            activeCourseId: null
          }
    );
  }, [
    courseId,
    isRemoteLoaded,
    isSupabaseBacked,
    location.pathname,
    storedState.activeCourseId,
    storedState.coursesById,
    storedState.selectedFilesByCourse,
    storedState.workspaceFilesByCourse
  ]);

  useEffect(() => {
    if (isSupabaseBacked) return;
    saveCourseState(storedState);
  }, [isSupabaseBacked, storedState]);

  useEffect(() => {
    if (!isSupabaseBacked || !isRemoteLoaded) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);

    syncTimerRef.current = window.setTimeout(() => {
      saveSupabaseWorkspaceState(storedState).catch((error) => {
        syncErrorRef.current = error instanceof Error ? error.message : "Failed to sync Supabase course state.";
      });
    }, 600);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [isRemoteLoaded, isSupabaseBacked, storedState]);

  function openCourse(course: Course) {
    const files = getCourseFiles(course);
    const fileIndex = Math.min(storedState.selectedFilesByCourse[course.id] ?? 0, Math.max(files.length - 1, 0));
    navigate(`/courses/${course.id}`);
    writeLastOpenCourseId(course.id);
    setActive({ courseId: course.id, fileIndex });
    setStoredState((current) => ({
      ...current,
      activeCourseId: course.id,
      selectedFilesByCourse: {
        ...current.selectedFilesByCourse,
        [course.id]: fileIndex
      }
    }));
  }

  async function addLearningCourse(course: Course) {
    const nextCourse = isSupabaseBacked && user ? await createSupabaseCourse(user, course) : course;
    setStoredState((current) => ({
      ...current,
      coursesById: {
        ...current.coursesById,
        [nextCourse.id]: nextCourse
      },
      courseOrder: [...current.courseOrder.filter((id) => id !== nextCourse.id), nextCourse.id],
      selectedFilesByCourse: {
        ...current.selectedFilesByCourse,
        [nextCourse.id]: 0
      }
    }));
    navigate(`/courses/${nextCourse.id}`);
    writeLastOpenCourseId(nextCourse.id);
    setActive({ courseId: nextCourse.id, fileIndex: 0 });
  }

  function startProject(course: Course) {
    setStoredState((current) => ({
      ...current,
      workspaceFilesByCourse: {
        ...current.workspaceFilesByCourse,
        [course.id]: current.workspaceFilesByCourse[course.id]?.length
          ? current.workspaceFilesByCourse[course.id]
          : [{ path: defaultWhiteboardPath(course), content: "" }]
      },
      workspaceFoldersByCourse: {
        ...current.workspaceFoldersByCourse,
        [course.id]: current.workspaceFoldersByCourse[course.id] ?? []
      },
      selectedFilesByCourse: {
        ...current.selectedFilesByCourse,
        [course.id]: 0
      },
      lessonViewByCourse: {
        ...current.lessonViewByCourse,
        [course.id]: "resume"
      }
    }));
    setActive({ courseId: course.id, fileIndex: 0 });
    writeLastOpenCourseId(course.id);
  }

  function closeCourse() {
    navigate("/dashboard");
    writeLastOpenCourseId(null);
    setActive(null);
    setStoredState((current) => ({
      ...current,
      activeCourseId: null
    }));
  }

  function selectFile(index: number) {
    if (!active) return;
    setActive({ ...active, fileIndex: index });
    setStoredState((current) => ({
      ...current,
      selectedFilesByCourse: {
        ...current.selectedFilesByCourse,
        [active.courseId]: index
      }
    }));
  }

  function updateFileContent(nextValue: string) {
    if (!activeCourse || !active || !selectedFile) return;
    withCourseFiles(activeCourse, (files) => ({
      files: files.map((file, index) => (index === active.fileIndex ? { ...file, content: nextValue } : file))
    }));
  }

  function loadExerciseFile(course: Course, path: string, content: string, replaceExisting = true) {
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedPath) return;
    let selectedIndex = 0;
    withCourseFiles(course, (files) => {
      const dedupedFiles = dedupeWorkspaceFiles(files);
      const existingIndex = dedupedFiles.findIndex((file) => file.path === normalizedPath);
      const activeIndex = active?.courseId === course.id ? active.fileIndex : storedState.selectedFilesByCourse[course.id] ?? 0;
      selectedIndex = existingIndex >= 0 ? existingIndex : Math.min(Math.max(activeIndex, 0), Math.max(dedupedFiles.length - 1, 0));
      return {
        files: existingIndex >= 0
          ? dedupedFiles.map((file, index) => (index === existingIndex && replaceExisting ? { ...file, content } : file))
          : dedupedFiles.length
            ? dedupedFiles.map((file, index) => (index === selectedIndex ? { path: normalizedPath, content } : file))
            : [{ path: normalizedPath, content }],
        selectedIndex
      };
    });
    setActive({ courseId: course.id, fileIndex: selectedIndex });
  }

  function loadExerciseWorkspace(
    course: Course,
    workspaceFiles: GeneratedExerciseWorkspaceFile[],
    activeFilePath: string,
    replaceExisting = true
  ) {
    const normalizedFiles = workspaceFiles
      .map((file) => ({ path: normalizeWorkspacePath(file.path), content: file.content }))
      .filter((file) => file.path);
    const normalizedActivePath = normalizeWorkspacePath(activeFilePath);
    if (!normalizedFiles.length || !normalizedActivePath) return;

    let selectedIndex = 0;
    setStoredState((current) => {
      const merged = dedupeWorkspaceFiles(current.workspaceFilesByCourse[course.id] ?? []);
      for (const incoming of normalizedFiles) {
        const index = merged.findIndex((file) => file.path === incoming.path);
        if (index < 0) merged.push(incoming);
        else if (replaceExisting) merged[index] = incoming;
      }
      selectedIndex = Math.max(merged.findIndex((file) => file.path === normalizedActivePath), 0);
      const derivedFolders = normalizedFiles.flatMap((file) => workspaceFolderPaths(file.path));
      const currentFolders = current.workspaceFoldersByCourse[course.id] ?? [];
      const folders = [...new Set([...currentFolders.map((folder) => folder.path), ...derivedFolders])]
        .map((path) => ({ path }));
      return {
        ...current,
        workspaceFilesByCourse: { ...current.workspaceFilesByCourse, [course.id]: merged },
        workspaceFoldersByCourse: { ...current.workspaceFoldersByCourse, [course.id]: folders },
        selectedFilesByCourse: { ...current.selectedFilesByCourse, [course.id]: selectedIndex }
      };
    });
    setActive({ courseId: course.id, fileIndex: selectedIndex });
  }

  async function generateCourseChapter(course: Course, chapterIndex: number) {
    if (course.courseContent?.schemaVersion === "guided-project-content/v1") {
      const result = await requestGeneratedProjectMilestone({
        courseId: course.id,
        content: course.courseContent,
        milestoneIndex: chapterIndex
      });
      updateGeneratedCourseContent(course.id, result.content);
      return;
    }
    if (!course.courseContent || (course.courseContent.schemaVersion !== "course-content/v1" && course.courseContent.schemaVersion !== "course-content/v2")) return;
    const result = await requestGeneratedChapter({
      courseId: course.id,
      content: course.courseContent,
      chapterIndex
    });
    updateGeneratedCourseContent(course.id, result.content);
  }

  function updateGeneratedCourseContent(courseId: string, content: GeneratedLearningContent) {
    setStoredState((current) => {
      const course = current.coursesById[courseId];
      if (!course) return current;
      return {
        ...current,
        coursesById: {
          ...current.coursesById,
          [courseId]: {
            ...course,
            courseContent: content,
            languages: content.languages,
            tags: content.tags,
            syllabus: buildSyllabusFromGeneratedContent(content)
          }
        }
      };
    });
  }

  function createWorkspaceFile() {
    if (!activeCourse) return;
    const currentFiles = getCourseFiles(activeCourse);
    const suggestedPath = createUntitledPath(currentFiles);
    const enteredPath = window.prompt("New file path", suggestedPath);
    const path = normalizeWorkspacePath(enteredPath ?? "");
    if (!path || currentFiles.some((file) => file.path === path)) return;

    withCourseFiles(activeCourse, (files) => ({
      files: [...files, { path, content: "" }],
      selectedIndex: files.length
    }));
    setActive({ courseId: activeCourse.id, fileIndex: currentFiles.length });
  }

  function createWorkspaceFolder() {
    if (!activeCourse) return;
    const currentFolders = getCourseFolders(activeCourse);
    const suggestedPath = createUntitledFolderPath(currentFolders);
    const enteredPath = window.prompt("New folder path", suggestedPath);
    const path = normalizeWorkspacePath(enteredPath ?? "");
    if (!path || currentFolders.some((folder) => folder.path === path)) return;

    withCourseFolders(activeCourse, (folders) => [...folders, { path }]);
  }

  function renameWorkspaceFile() {
    if (!activeCourse || !active || !selectedFile) return;
    const enteredPath = window.prompt("Rename file", selectedFile.path);
    const path = normalizeWorkspacePath(enteredPath ?? "");
    const currentFiles = getCourseFiles(activeCourse);
    if (!path || path === selectedFile.path || currentFiles.some((file) => file.path === path)) return;

    withCourseFiles(activeCourse, (files) => ({
      files: files.map((file, index) => (index === active.fileIndex ? { ...file, path } : file))
    }));
  }

  function moveWorkspaceFile(fileIndex: number, folderPath: string) {
    if (!activeCourse || !active) return;
    const targetFolder = normalizeWorkspacePath(folderPath);
    withCourseFiles(activeCourse, (files) => {
      const file = files[fileIndex];
      if (!file) return { files };

      const nextPath = targetFolder ? `${targetFolder}/${getBaseName(file.path)}` : getBaseName(file.path);
      if (nextPath === file.path || files.some((item, index) => index !== fileIndex && item.path === nextPath)) {
        return { files };
      }

      return {
        files: files.map((item, index) => (index === fileIndex ? { ...item, path: nextPath } : item)),
        selectedIndex: fileIndex
      };
    });
    setActive({ courseId: activeCourse.id, fileIndex });
  }

  function moveWorkspaceFolder(folderPath: string, targetFolderPath: string) {
    if (!activeCourse) return;
    const source = normalizeWorkspacePath(folderPath);
    const target = normalizeWorkspacePath(targetFolderPath);
    if (!source || source === target || target.startsWith(`${source}/`)) return;

    const nextFolderPath = target ? `${target}/${getBaseName(source)}` : getBaseName(source);
    if (nextFolderPath === source) return;

    setStoredState((current) => {
      const folders = getCourseFolders(activeCourse, current);
      const files = getCourseFiles(activeCourse, current);
      const folderConflict = folders.some((folder) => folder.path === nextFolderPath && folder.path !== source);
      if (folderConflict) return current;

      return {
        ...current,
        workspaceFoldersByCourse: {
          ...current.workspaceFoldersByCourse,
          [activeCourse.id]: folders.map((folder) =>
            folder.path === source || folder.path.startsWith(`${source}/`)
              ? { ...folder, path: folder.path.replace(source, nextFolderPath) }
              : folder
          )
        },
        workspaceFilesByCourse: {
          ...current.workspaceFilesByCourse,
          [activeCourse.id]: files.map((file) =>
            file.path.startsWith(`${source}/`)
              ? { ...file, path: file.path.replace(source, nextFolderPath) }
              : file
          )
        }
      };
    });
  }

  function deleteWorkspaceFile() {
    if (!activeCourse || !active || !selectedFile) return;
    if (activeFiles.length <= 1) return;
    if (!window.confirm(`Delete ${selectedFile.path}?`)) return;

    const selectedIndex = Math.max(0, active.fileIndex - 1);
    withCourseFiles(activeCourse, (files) => ({
      files: files.filter((_, index) => index !== active.fileIndex),
      selectedIndex
    }));
    setActive({ courseId: activeCourse.id, fileIndex: selectedIndex });
  }

  function applyAiEdits(course: Course, edits: AiFileEdit[]) {
    if (!edits.length) return { appliedCount: 0 };

    let selectedIndex: number | undefined;
    let appliedCount = 0;

    setStoredState((current) => {
      setLastAiEditSnapshot({
        courseId: course.id,
        files: getCourseFiles(course, current),
        selectedIndex: current.selectedFilesByCourse[course.id] ?? 0
      });
      const result = applyAiFileEdits(getCourseFiles(course, current), edits, current.selectedFilesByCourse[course.id] ?? 0);
      selectedIndex = result.selectedIndex;
      appliedCount = result.appliedCount;

      return {
        ...current,
        workspaceFilesByCourse: {
          ...current.workspaceFilesByCourse,
          [course.id]: result.files
        },
        selectedFilesByCourse: {
          ...current.selectedFilesByCourse,
          [course.id]: result.selectedIndex ?? current.selectedFilesByCourse[course.id] ?? 0
        }
      };
    });

    if (active?.courseId === course.id && typeof selectedIndex === "number") {
      setActive({ courseId: course.id, fileIndex: selectedIndex });
    }

    return { appliedCount };
  }

  function undoLastAiEdit() {
    if (!lastAiEditSnapshot) return false;
    setStoredState((current) => ({
      ...current,
      workspaceFilesByCourse: {
        ...current.workspaceFilesByCourse,
        [lastAiEditSnapshot.courseId]: lastAiEditSnapshot.files
      },
      selectedFilesByCourse: {
        ...current.selectedFilesByCourse,
        [lastAiEditSnapshot.courseId]: lastAiEditSnapshot.selectedIndex
      }
    }));
    if (active?.courseId === lastAiEditSnapshot.courseId) {
      setActive({ courseId: lastAiEditSnapshot.courseId, fileIndex: lastAiEditSnapshot.selectedIndex });
    }
    setLastAiEditSnapshot(null);
    return true;
  }

  async function resetDemoState() {
    if (isSupabaseBacked && user) {
      await resetSupabaseCourses(user);
    }

    clearCourseState();
    writeLastOpenCourseId(null);
    setStoredState(defaultStoredCourseState);
    navigate("/dashboard");
    setActive(null);
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, course: Course) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (active?.courseId !== course.id) openCourse(course);
  }

  return {
    active,
    activeCourse,
    userCourses,
    activeFiles,
    activeFolders,
    selectedFile,
    activeCourseCount,
    isWorkspaceReady: !isSupabaseBacked || isRemoteLoaded,
    storedState,
    setStoredState,
    getCourseFiles,
    openCourse,
    addLearningCourse,
    startProject,
    closeCourse,
    selectFile,
    updateFileContent,
    loadExerciseFile,
    loadExerciseWorkspace,
    generateCourseChapter,
    createWorkspaceFile,
    createWorkspaceFolder,
    renameWorkspaceFile,
    moveWorkspaceFile,
    moveWorkspaceFolder,
    deleteWorkspaceFile,
    applyAiEdits,
    undoLastAiEdit,
    canUndoAiEdit: Boolean(lastAiEditSnapshot),
    resetDemoState,
    handleCardKey
  };
}

function workspaceFolderPaths(filePath: string) {
  const parts = filePath.split("/").slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function dedupeWorkspaceFiles(files: WorkspaceFile[]) {
  const byPath = new Map<string, WorkspaceFile>();
  for (const file of files) {
    if (!byPath.has(file.path)) byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

function resolveInitialActiveState(state: StoredCourseState, routeCourseId: string | undefined, pathname: string): ActiveState | null {
  const fallbackCourseId = pathname.startsWith("/settings")
    ? state.activeCourseId ?? readLastOpenCourseId()
    : null;
  const targetCourseId = routeCourseId ?? fallbackCourseId;
  if (!targetCourseId || !state.coursesById[targetCourseId]) return null;
  const files = state.workspaceFilesByCourse[targetCourseId] ?? [];
  const fileIndex = Math.min(state.selectedFilesByCourse[targetCourseId] ?? 0, Math.max(files.length - 1, 0));
  return { courseId: targetCourseId, fileIndex };
}

function readLastOpenCourseId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(lastOpenCourseStorageKey);
}

function writeLastOpenCourseId(courseId: string | null) {
  if (typeof window === "undefined") return;
  if (courseId) {
    window.sessionStorage.setItem(lastOpenCourseStorageKey, courseId);
  } else {
    window.sessionStorage.removeItem(lastOpenCourseStorageKey);
  }
}

function getBaseName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function defaultWhiteboardPath(course: Course) {
  const language = course.languages[0] ?? course.subject;
  const path = defaultFilePath(language);
  return path.startsWith("main.") ? path.replace("main.", "whiteboard.") : path;
}
