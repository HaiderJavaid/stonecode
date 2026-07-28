import { Course, learningExperienceLabel } from "@/data/courses";

export function CourseHome({
  course,
  isProjectStarted,
  lessonIndex,
  onStartOrResume
}: {
  course: Course;
  isProjectStarted: boolean;
  lessonIndex: number;
  onStartOrResume: () => void;
}) {
  const completedSections = course.syllabus.filter((section) => section.lessonIndex < lessonIndex).length;
  const progress = course.syllabus.length
    ? Math.max(course.progress, Math.round((completedSections / course.syllabus.length) * 100))
    : Math.max(course.progress, 0);
  const currentSection = course.syllabus[Math.min(lessonIndex, course.syllabus.length - 1)];

  return (
    <section className="course-home" aria-label={`${course.title} ${learningExperienceLabel(course.experienceType).toLowerCase()} home`}>
      <div className="course-home-copy">
        <span>{learningExperienceLabel(course.experienceType)} overview</span>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
      </div>
      <div className="course-home-progress">
        <div><span>Overall progress</span><strong>{progress}%</strong></div>
        <i><b style={{ width: `${progress}%` }} /></i>
        <small>Current: {currentSection?.title ?? `${learningExperienceLabel(course.experienceType)} setup`}</small>
      </div>
      <div className="course-home-tags" aria-label="Course languages and tags">
        {[...course.languages, ...course.tags].map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="course-home-actions">
        <button onClick={onStartOrResume} type="button">
          {isProjectStarted ? "Resume learning" : startLabel(course)}
        </button>
      </div>
    </section>
  );
}

function startLabel(course: Course) {
  if (course.experienceType === "exercise") return "Start practice";
  if (course.experienceType === "guided_project") return "Start project";
  if (course.experienceType === "short_course") return "Start short course";
  return "Start course";
}
