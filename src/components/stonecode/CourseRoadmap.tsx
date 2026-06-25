import { Course } from "@/data/courses";

export function CourseRoadmap({
  course,
  lessonIndex,
  onSelectSection
}: {
  course: Course;
  lessonIndex: number;
  onSelectSection: (lessonIndex: number) => void;
}) {
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
    </div>
  );
}
