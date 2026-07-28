import { Fragment, KeyboardEvent, useMemo } from "react";
import { Course } from "@/data/courses";
import { GeneratedExerciseWorkspaceFile } from "@/data/courses";
import { CourseCard } from "@/components/stonecode/CourseCard";
import { ActiveState, CardView, CourseCardProps, EditorDiagnostic } from "@/components/stonecode/types";
import { StoredCourseState } from "@/services/courseStorage";
import { SubscriptionState } from "@/services/subscriptionState";
import { WorkspaceFile } from "@/services/workspaceFiles";
import { Link } from "react-router-dom";
import { getCourseProgress } from "@/services/courseProgress";

export function DashboardPage({
  active,
  activeCourseCount,
  courses,
  subscription,
  subscriptionError,
  isSubscriptionLoading,
  isSetupOpen,
  storedState,
  typingMessageId,
  getCourseFiles,
  onOpenCourse,
  onCloseCourse,
  onChat,
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
  onResetDemoState,
  onOpenSetup
}: {
  active: ActiveState | null;
  activeCourseCount: number;
  courses: Course[];
  subscription: SubscriptionState;
  subscriptionError: string | null;
  isSubscriptionLoading: boolean;
  isSetupOpen: boolean;
  storedState: StoredCourseState;
  typingMessageId: string | null;
  getCourseFiles: (course: Course) => WorkspaceFile[];
  onOpenCourse: (course: Course) => void;
  onCloseCourse: () => void;
  onChat: (course: Course, message: string, lessonIndex: number) => void;
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
  onResetDemoState: () => void;
  onOpenSetup: () => void;
}) {
  const displayCourses = useMemo(() => [
    ...courses.filter((course) => course.experienceType !== "exercise"),
    ...courses.filter((course) => course.experienceType === "exercise")
  ], [courses]);
  const activeIndex = useMemo(
    () => (active ? displayCourses.findIndex((item) => item.id === active.courseId) : -1),
    [active, displayCourses]
  );

  return (
    <section className={`cards${active || isSetupOpen ? " has-open" : ""}`} aria-label="Learning conversations">
      {!active && !isSetupOpen && (
        <div className="course-launcher" aria-label="Learning launcher">
          <button className="new-course" onClick={onOpenSetup} type="button">
            Start learning
          </button>
          <span>
            {subscription.planName}: {activeCourseCount}/{subscription.activeCourseLimit} active
            {isSubscriptionLoading ? " loading" : ""}
            {subscriptionError ? " sync issue" : ""}
          </span>
          <button className="reset-demo" onClick={onResetDemoState} type="button">
            Reset demo
          </button>
        </div>
      )}
      <div className="dashboard-course-list">
        {!active && courses.length === 0 && !isSetupOpen && (
          <div className="empty-courses">
            <div className="empty-courses-content">
              <span>No learning conversations yet</span>
              <p>Your workspace is empty. Start a course, short lesson, practice session, or guided project.</p>
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

        const firstPracticeIndex = displayCourses.findIndex((item) => item.experienceType === "exercise");
        return (
          <Fragment key={course.id}>
          {!active && !isSetupOpen && index === 0 && course.experienceType !== "exercise" && <div className="dashboard-group-label">Learning programs</div>}
          {!active && !isSetupOpen && index === firstPracticeIndex && <div className="dashboard-group-label">Recent practice</div>}
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
            onChat={(message, activeLessonIndex) => onChat(course, message, activeLessonIndex)}
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
          </Fragment>
        );
        })}
      </div>
      {!active && !isSetupOpen && (
        <Link className="dashboard-settings-button" to="/settings/overview">
          <span>{subscription.planName[0]?.toUpperCase() ?? "S"}</span>
          <div>
            <strong>Settings</strong>
            <small>{subscription.planName}</small>
          </div>
        </Link>
      )}
    </section>
  );
}

function normalizeCardView(view: CardView | "progress" | null): CardView | null {
  return view === "resume" || view === "exercises" ? view : null;
}
