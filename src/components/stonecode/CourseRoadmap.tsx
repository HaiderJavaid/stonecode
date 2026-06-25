import { Course } from "@/data/courses";
import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { completeProgressionCourse } from "@/services/progression";

export function CourseRoadmap({
  course,
  lessonIndex,
  onSelectSection
}: {
  course: Course;
  lessonIndex: number;
  onSelectSection: (lessonIndex: number) => void;
}) {
  const auth = useAuth();
  const [completionStatus, setCompletionStatus] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const finalLessonIndex = Math.max(...course.syllabus.map((section) => section.lessonIndex), 0);

  async function completeCourse() {
    const token = auth.session?.access_token;
    if (!token) return;
    setIsCompleting(true);
    try {
      await completeProgressionCourse(token, course.id);
      setCompletionStatus("Course completed. Course Finisher progression updated.");
    } catch (error) {
      setCompletionStatus(error instanceof Error ? error.message : "Course cannot be completed yet.");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="progress-panel course-roadmap">
      <span>Course roadmap</span>
      <p>Open any section. Returning to earlier material never resets progress.</p>
      <ol>
        {course.syllabus.map((section, index) => {
          const state = index < lessonIndex ? "complete" : index === lessonIndex ? "current" : "upcoming";
          return (
            <li className={`is-${state}`} key={section.id}>
              <button onClick={() => onSelectSection(section.lessonIndex)} type="button">
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.summary}</small>
                </span>
                <em>{section.hasChallenge ? "Challenge" : state}</em>
              </button>
            </li>
          );
        })}
      </ol>
      {lessonIndex >= finalLessonIndex && (
        <div className="course-completion-action">
          <button disabled={isCompleting} onClick={() => void completeCourse()} type="button">
            {isCompleting ? "Checking..." : "Complete course"}
          </button>
          {completionStatus && <p>{completionStatus}</p>}
        </div>
      )}
    </div>
  );
}
