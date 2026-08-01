import { Fragment, KeyboardEvent, useMemo, useState } from "react";
import { Course } from "@/data/courses";
import { GeneratedExerciseWorkspaceFile } from "@/data/courses";
import { CourseCard } from "@/components/stonecode/CourseCard";
import { ActiveState, CardView, CourseCardProps, EditorDiagnostic } from "@/components/stonecode/types";
import { StoredCourseState } from "@/services/courseStorage";
import { SubscriptionState } from "@/services/subscriptionState";
import { WorkspaceFile } from "@/services/workspaceFiles";
import { Link } from "react-router-dom";
import { getCourseProgress } from "@/services/courseProgress";
import type { CreditSummary } from "@/services/credits";
import { StoneStackMark } from "@/components/stonecode/StonecodeBrand";

export function DashboardPage({
  active,
  activeCourseCount,
  courses,
  subscription,
  subscriptionError,
  isSubscriptionLoading,
  credits,
  isCreditsLoading,
  isWorkspaceLoading,
  creditsError,
  isSetupOpen,
  storedState,
  typingMessageId,
  getCourseFiles,
  onOpenCourse,
  onCloseCourse,
  onChat,
  onApplyTutorPatch,
  onRejectTutorPatch,
  onUndoTutorPatch,
  requestLessonIntro,
  onExerciseHint,
  onExerciseTemplate,
  onLoadExerciseFile,
  onLoadExerciseWorkspace,
  onEditorDiagnosticsChange,
  onGenerateChapter,
  onLessonIndexChange,
  onViewChange,
  onStartProject,
  onTypingComplete,
  onCardKeyDown,
  onDeleteCourse,
  onOpenSetup
}: {
  active: ActiveState | null;
  activeCourseCount: number;
  courses: Course[];
  subscription: SubscriptionState;
  subscriptionError: string | null;
  isSubscriptionLoading: boolean;
  credits: CreditSummary | null;
  isCreditsLoading: boolean;
  isWorkspaceLoading: boolean;
  creditsError: string | null;
  isSetupOpen: boolean;
  storedState: StoredCourseState;
  typingMessageId: string | null;
  getCourseFiles: (course: Course) => WorkspaceFile[];
  onOpenCourse: (course: Course) => void;
  onCloseCourse: () => void;
  onChat: (course: Course, message: string, lessonIndex: number) => void;
  onApplyTutorPatch: (course: Course, messageId: string, toolCallId: string) => void;
  onRejectTutorPatch: (course: Course, messageId: string, toolCallId: string) => void;
  onUndoTutorPatch: (course: Course, messageId: string, toolCallId: string) => void;
  requestLessonIntro: (course: Course, lessonIndex: number, lesson: Parameters<CourseCardProps["requestLessonIntro"]>[1]) => void;
  onExerciseHint: (course: Course, exercise: Parameters<CourseCardProps["onExerciseHint"]>[0], question: string, code: string) => Promise<string>;
  onExerciseTemplate: (course: Course, exercise: Parameters<CourseCardProps["onExerciseTemplate"]>[0], code: string) => Promise<string>;
  onLoadExerciseFile: (course: Course, path: string, content: string, replaceExisting?: boolean) => void;
  onLoadExerciseWorkspace: (course: Course, files: GeneratedExerciseWorkspaceFile[], activeFilePath: string, replaceExisting?: boolean) => void;
  onEditorDiagnosticsChange: (diagnostics: EditorDiagnostic[]) => void;
  onGenerateChapter: (course: Course, chapterIndex: number) => Promise<void>;
  onLessonIndexChange: (courseId: string, lessonIndex: number) => void;
  onViewChange: (courseId: string, view: CardView | null) => void;
  onStartProject: (course: Course) => void;
  onTypingComplete: () => void;
  onCardKeyDown: (event: KeyboardEvent<HTMLElement>, course: Course) => void;
  onDeleteCourse: (course: Course) => Promise<void>;
  onOpenSetup: () => void;
}) {
  const [coursePendingDeletion, setCoursePendingDeletion] = useState<Course | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const displayCourses = useMemo(() => {
    const newestFirst = (left: Course, right: Course) => {
      const leftTime = Date.parse(left.createdAt ?? "");
      const rightTime = Date.parse(right.createdAt ?? "");
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return courses.indexOf(left) - courses.indexOf(right);
      return rightTime - leftTime;
    };
    return [
      ...courses.filter((course) => course.experienceType !== "exercise").sort(newestFirst),
      ...courses.filter((course) => course.experienceType === "exercise").sort(newestFirst)
    ];
  }, [courses]);
  const activeIndex = useMemo(
    () => (active ? displayCourses.findIndex((item) => item.id === active.courseId) : -1),
    [active, displayCourses]
  );
  const firstPracticeIndex = displayCourses.findIndex((item) => item.experienceType === "exercise");

  return (
    <section className={`cards${active || isSetupOpen ? " has-open" : ""}`} aria-label="Learning conversations">
      {!isSetupOpen && (
        <Link
          aria-hidden={Boolean(active)}
          aria-label={credits ? `${credits.available} Stones left` : "View Stone balance"}
          className="dashboard-credit-widget"
          tabIndex={active ? -1 : undefined}
          title={creditsError ?? "Open billing and Stone details"}
          to="/settings/billing"
        >
          <StoneStackMark />
          <span>
            <strong>{credits ? credits.available : isCreditsLoading ? "…" : "—"}</strong>
            <small>Stones left</small>
          </span>
          {credits?.reserved ? <em>{credits.reserved} reserved</em> : null}
        </Link>
      )}
      {!isSetupOpen && (
        <div aria-hidden={Boolean(active)} className="course-launcher" aria-label="Learning launcher">
          <button className="new-course" disabled={Boolean(active)} onClick={onOpenSetup} type="button">
            Start learning
          </button>
          <span>
            {isSubscriptionLoading ? "Loading plan…" : `${subscription.planName}: ${activeCourseCount}/${subscription.activeCourseLimit} active`}
            {subscriptionError ? " sync issue" : ""}
          </span>
        </div>
      )}
      <div className="dashboard-course-list">
        {!active && isWorkspaceLoading && !isSetupOpen && (
          <div className="empty-courses" aria-live="polite">
            <div className="empty-courses-content"><span>Loading your workspace…</span><p>Restoring courses, files, and progress.</p></div>
          </div>
        )}
        {!active && !isWorkspaceLoading && courses.length === 0 && !isSetupOpen && (
          <div className="empty-courses">
            <div className="empty-courses-content">
              <span>No learning conversations yet</span>
            <p>Your workspace is empty. Start a course, exercise pack, or guided project.</p>
              <button className="empty-courses-action" onClick={onOpenSetup} type="button">
                Start learning
              </button>
            </div>
          </div>
        )}
        {displayCourses.map((course, index) => {
        const hiddenDirection = isSetupOpen || activeIndex < 0 || index > activeIndex ? "after" : "before";
        const files = getCourseFiles(course);
        const selectedFile = files[storedState.selectedFilesByCourse[course.id] ?? 0] ?? null;

        return (
          <Fragment key={course.id}>
          {!isSetupOpen && index === 0 && course.experienceType !== "exercise" && <div aria-hidden={Boolean(active)} className="dashboard-group-label is-before">Learning programs</div>}
          {!isSetupOpen && index === firstPracticeIndex && <div aria-hidden={Boolean(active)} className={`dashboard-group-label ${index > activeIndex ? "is-after" : "is-before"}`}>Recent practice</div>}
          <div className="dashboard-course-slot">
            <CourseCard
            active={active?.courseId === course.id}
            activeFileContent={selectedFile?.content ?? ""}
            workspaceFiles={files}
            cardIndex={index}
            chatMessages={storedState.chatByCourse[course.id] ?? []}
            course={course}
            fileCount={files.length}
            hidden={isSetupOpen || (active !== null && active.courseId !== course.id)}
            hiddenDirection={hiddenDirection}
            lessonIndex={storedState.lessonStepByCourse[course.id] ?? 0}
            progress={getCourseProgress(course, storedState.lessonStepByCourse[course.id] ?? 0)}
            onBack={onCloseCourse}
            onDelete={() => {
              setDeleteError(null);
              setCoursePendingDeletion(course);
            }}
            onChat={(message, activeLessonIndex) => onChat(course, message, activeLessonIndex)}
            onApplyTutorPatch={(messageId, toolCallId) => onApplyTutorPatch(course, messageId, toolCallId)}
            onRejectTutorPatch={(messageId, toolCallId) => onRejectTutorPatch(course, messageId, toolCallId)}
            onUndoTutorPatch={(messageId, toolCallId) => onUndoTutorPatch(course, messageId, toolCallId)}
            onExerciseHint={(exercise, question, code) => onExerciseHint(course, exercise, question, code)}
            onExerciseTemplate={(exercise, code) => onExerciseTemplate(course, exercise, code)}
            onGenerateChapter={(chapterIndex) => onGenerateChapter(course, chapterIndex)}
            onKeyDown={(event) => onCardKeyDown(event, course)}
            onLessonIndexChange={(lessonIndex) => onLessonIndexChange(course.id, lessonIndex)}
            onLoadExerciseFile={(path, content, replaceExisting) => onLoadExerciseFile(course, path, content, replaceExisting)}
            onLoadExerciseWorkspace={(workspaceFiles, activeFilePath, replaceExisting) => onLoadExerciseWorkspace(course, workspaceFiles, activeFilePath, replaceExisting)}
            onEditorDiagnosticsChange={onEditorDiagnosticsChange}
            requestLessonIntro={(activeLessonIndex, activeLesson) => requestLessonIntro(course, activeLessonIndex, activeLesson)}
            onOpen={() => onOpenCourse(course)}
            onStartProject={onStartProject}
            onTypingComplete={onTypingComplete}
            onViewChange={(view) => onViewChange(course.id, view)}
            plan={subscription.plan}
            typingMessageId={typingMessageId}
            view={normalizeCardView(storedState.lessonViewByCourse[course.id] ?? null)}
            />
          </div>
          </Fragment>
        );
        })}
      </div>
      {!isSetupOpen && (
        <Link aria-hidden={Boolean(active)} className="dashboard-settings-button" tabIndex={active ? -1 : undefined} to="/settings/overview">
          <span>{isSubscriptionLoading ? "…" : subscription.planName[0]?.toUpperCase() ?? "S"}</span>
          <div>
            <strong>Settings</strong>
            <small>{isSubscriptionLoading ? "Loading plan" : subscription.planName}</small>
          </div>
        </Link>
      )}
      {coursePendingDeletion && (
        <CourseDeleteDialog
          course={coursePendingDeletion}
          error={deleteError}
          isPending={isDeletingCourse}
          onCancel={() => {
            if (isDeletingCourse) return;
            setCoursePendingDeletion(null);
            setDeleteError(null);
          }}
          onConfirm={async () => {
            setIsDeletingCourse(true);
            setDeleteError(null);
            try {
              await onDeleteCourse(coursePendingDeletion);
              setCoursePendingDeletion(null);
            } catch (error) {
              setDeleteError(error instanceof Error ? error.message : "Failed to delete learning path.");
            } finally {
              setIsDeletingCourse(false);
            }
          }}
        />
      )}
    </section>
  );
}

function CourseDeleteDialog({
  course,
  error,
  isPending,
  onCancel,
  onConfirm
}: {
  course: Course;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="course-delete-modal" role="presentation" onKeyDown={(event) => event.key === "Escape" && onCancel()} onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div aria-describedby="course-delete-copy" aria-labelledby="course-delete-title" aria-modal="true" className="stone-surface course-delete-dialog" role="dialog">
        <span>Permanent deletion</span>
        <h2 id="course-delete-title">Delete {course.title}?</h2>
        <p id="course-delete-copy">Files, tutor chat, and course progress will be removed. Your earned XP stays.</p>
        {error && <p className="plain-error">{error}</p>}
        <div>
          <button disabled={isPending} onClick={onCancel} type="button">Cancel</button>
          <button autoFocus className="is-danger" disabled={isPending} onClick={() => void onConfirm()} type="button">
            {isPending ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeCardView(view: CardView | "progress" | null): CardView | null {
  return view === "resume" || view === "exercises" ? view : null;
}
