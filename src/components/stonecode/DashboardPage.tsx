import { KeyboardEvent, useMemo } from "react";
import { Course } from "@/data/courses";
import { CourseCard } from "@/components/stonecode/CourseCard";
import { ActiveState, CardView } from "@/components/stonecode/types";
import { StoredCourseState } from "@/services/courseStorage";
import { SubscriptionState } from "@/services/subscriptionState";
import { WorkspaceFile } from "@/services/workspaceFiles";

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

        return (
          <CourseCard
            active={active?.courseId === course.id}
            cardIndex={index}
            chatMessages={storedState.chatByCourse[course.id] ?? []}
            course={course}
            fileCount={getCourseFiles(course).length}
            hidden={isSetupOpen || (active !== null && active.courseId !== course.id)}
            hiddenDirection={hiddenDirection}
            key={course.id}
            lessonIndex={storedState.lessonStepByCourse[course.id] ?? 0}
            onBack={onCloseCourse}
            onChat={(message, activeLessonIndex) => onChat(course, message, activeLessonIndex)}
            onKeyDown={(event) => onCardKeyDown(event, course)}
            onLessonIndexChange={(lessonIndex) => onLessonIndexChange(course.id, lessonIndex)}
            onOpen={() => onOpenCourse(course)}
            onStartProject={onStartProject}
            onTypingComplete={onTypingComplete}
            onViewChange={(view) => onViewChange(course.id, view)}
            plan={subscription.plan}
            typingMessageId={typingMessageId}
            view={storedState.lessonViewByCourse[course.id] ?? null}
          />
        );
      })}
    </section>
  );
}
