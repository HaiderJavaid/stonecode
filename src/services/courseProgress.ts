import { Course } from "@/data/courses";

export function getCourseProgress(course: Course, lessonIndex: number) {
  const savedProgress = clampProgress(course.progress);
  if (!course.syllabus.length) return savedProgress;

  const completedSections = course.syllabus.filter((section) => section.lessonIndex < lessonIndex).length;
  const lessonProgress = Math.round((completedSections / course.syllabus.length) * 100);
  return Math.max(savedProgress, clampProgress(lessonProgress));
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}
