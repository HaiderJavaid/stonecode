import { Course } from "@/data/courses";

export function CourseHome({
  course,
  isProjectStarted,
  lessonIndex,
  onExercises,
  onStartOrResume
}: {
  course: Course;
  isProjectStarted: boolean;
  lessonIndex: number;
  onExercises: () => void;
  onStartOrResume: () => void;
}) {
  const completedSections = course.syllabus.filter((section) => section.lessonIndex < lessonIndex).length;
  const progress = course.syllabus.length
    ? Math.max(course.progress, Math.round((completedSections / course.syllabus.length) * 100))
    : Math.max(course.progress, 0);
  const currentSection = course.syllabus[Math.min(lessonIndex, course.syllabus.length - 1)];

  return (
    <section className="course-home" aria-label={`${course.title} course home`}>
      <div className="course-home-copy">
        <span>Course overview</span>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
      </div>
      <div className="course-home-progress">
        <div><span>Overall progress</span><strong>{progress}%</strong></div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <small>Current: {currentSection?.title ?? "Course setup"}</small>
      </div>
      <div className="course-home-tags" aria-label="Course languages and tags">
        {[...course.languages, ...course.tags].map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="course-home-actions">
        <button onClick={onStartOrResume} type="button">
          {isProjectStarted ? "Resume learning" : "Start project"}
        </button>
        <button onClick={onExercises} type="button">Exercises</button>
      </div>
    </section>
  );
}
