import { KeyboardEvent, useMemo } from "react";
import { Course } from "@/data/courses";
import { CourseCard } from "@/components/stonecode/CourseCard";
import { ActiveState, CardView, CourseCardProps } from "@/components/stonecode/types";
import { StoredCourseState } from "@/services/courseStorage";
import { SubscriptionState } from "@/services/subscriptionState";
import { WorkspaceFile } from "@/services/workspaceFiles";
import { Link } from "react-router-dom";

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
  onLoadExerciseFile: (course: Course, path: string, content: string) => void;
  onGenerateChapter: (course: Course, chapterIndex: number) => Promise<void>;
  onLessonIndexChange: (courseId: string, lessonIndex: number) => void;
  onViewChange: (courseId: string, view: CardView | null) => void;
  onStartProject: (course: Course) => void;
  onTypingComplete: () => void;
  onCardKeyDown: (event: KeyboardEvent<HTMLElement>, course: Course) => void;
  onResetDemoState: () => void;
  onOpenSetup: () => void;
}) {
  const activeIndex = useMemo(
    () => (active ? courses.findIndex((item) => item.id === active.courseId) : -1),
    [active, courses]
  );

  return (
    <section className={`cards${active || isSetupOpen ? " has-open" : ""}`} aria-label="Course folders">
      {!active && !isSetupOpen && (
        <div className="course-launcher" aria-label="Course launcher">
          <button className="new-course" disabled={activeCourseCount >= subscription.activeCourseLimit} onClick={onOpenSetup} type="button">
            Add learning course
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
      {!active && activeCourseCount === 0 && !isSetupOpen && (
        <div className="empty-courses">
          <span>No courses yet</span>
          <p>Your learning workspace is empty. Use the top action when you are ready to add what you want to learn.</p>
        </div>
      )}
      {courses.map((course, index) => {
        const hiddenDirection = isSetupOpen || activeIndex < 0 || index > activeIndex ? "after" : "before";
        const files = getCourseFiles(course);
        const selectedFile = files[storedState.selectedFilesByCourse[course.id] ?? 0] ?? null;

        return (
          <CourseCard
            active={active?.courseId === course.id}
            activeFileContent={selectedFile?.content ?? ""}
            cardIndex={index}
            chatMessages={storedState.chatByCourse[course.id] ?? []}
            course={course}
            fileCount={files.length}
            hidden={isSetupOpen || (active !== null && active.courseId !== course.id)}
            hiddenDirection={hiddenDirection}
            key={course.id}
            lessonIndex={storedState.lessonStepByCourse[course.id] ?? 0}
            progress={getCourseProgress(course, storedState.lessonStepByCourse[course.id] ?? 0, getCourseFiles(course).length)}
            onBack={onCloseCourse}
            onChat={(message, activeLessonIndex) => onChat(course, message, activeLessonIndex)}
            onExerciseHint={(exercise, question, code) => onExerciseHint(course, exercise, question, code)}
            onExerciseTemplate={(exercise, code) => onExerciseTemplate(course, exercise, code)}
            onGenerateChapter={(chapterIndex) => onGenerateChapter(course, chapterIndex)}
            onKeyDown={(event) => onCardKeyDown(event, course)}
            onLessonIndexChange={(lessonIndex) => onLessonIndexChange(course.id, lessonIndex)}
            onLoadExerciseFile={(path, content) => onLoadExerciseFile(course, path, content)}
            requestLessonIntro={(activeLessonIndex, activeLesson) => requestLessonIntro(course, activeLessonIndex, activeLesson)}
            onOpen={() => onOpenCourse(course)}
            onStartProject={onStartProject}
            onTypingComplete={onTypingComplete}
            onViewChange={(view) => onViewChange(course.id, view)}
            plan={subscription.plan}
            typingMessageId={typingMessageId}
            view={normalizeCardView(storedState.lessonViewByCourse[course.id] ?? null)}
          />
        );
      })}
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

function getCourseProgress(course: Course, lessonIndex: number, fileCount: number) {
  if (!fileCount) return 0;
  if (!course.syllabus.length) return Math.max(course.progress, 0);
  const completedSections = course.syllabus.filter((section) => section.lessonIndex < lessonIndex).length;
  return Math.max(course.progress, Math.round((completedSections / course.syllabus.length) * 100));
}
