import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Course } from "@/data/courses";
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
  saveSupabaseWorkspaceState
} from "@/services/supabaseCourseStorage";
import { ActiveState } from "@/components/stonecode/types";

export function useCourseWorkspace() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isConfigured, user } = useAuth();
  const [active, setActive] = useState<ActiveState | null>(null);
  const [storedState, setStoredState] = useState<StoredCourseState>(() => loadCourseState());
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
  const activeCourseCount = userCourses.length;

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
    const course = isRemoteLoaded || !isSupabaseBacked ? (courseId ? storedState.coursesById[courseId] : null) : null;
    if (course) {
      const files = storedState.workspaceFilesByCourse[course.id] ?? [];
      const fileIndex = Math.min(storedState.selectedFilesByCourse[course.id] ?? 0, Math.max(files.length - 1, 0));
      setActive({ courseId: course.id, fileIndex });
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
    setActive({ courseId: nextCourse.id, fileIndex: 0 });
  }

  function startProject(course: Course) {
    const readme = createReadme(course);
    setStoredState((current) => ({
      ...current,
      workspaceFilesByCourse: {
        ...current.workspaceFilesByCourse,
        [course.id]: [{ path: "README.md", content: readme }]
      },
      workspaceFoldersByCourse: {
        ...current.workspaceFoldersByCourse,
        [course.id]: [{ path: "lessons" }, { path: "practice" }]
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
  }

  function closeCourse() {
    navigate("/dashboard");
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

  function resetDemoState() {
    clearCourseState();
    setStoredState(defaultStoredCourseState);
    navigate("/dashboard");
    setActive(null);
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, course: Course) {
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
    storedState,
    setStoredState,
    getCourseFiles,
    openCourse,
    addLearningCourse,
    startProject,
    closeCourse,
    selectFile,
    updateFileContent,
    createWorkspaceFile,
    createWorkspaceFolder,
    renameWorkspaceFile,
    moveWorkspaceFile,
    moveWorkspaceFolder,
    deleteWorkspaceFile,
    resetDemoState,
    handleCardKey
  };
}

function getBaseName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function createReadme(course: Course) {
  return `# ${course.title}

## Course Rules

- Learn in small steps.
- Ask for hints before full answers.
- Generate files only when they serve the current lesson.
- Keep notes in this README as the course evolves.

## Goal

${course.description}
`;
}
