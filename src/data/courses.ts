import { topics, TopicFile } from "@/data/topics";

export type Course = {
  id: string;
  title: string;
  subject: string;
  mode: "fundamentals" | "project" | "leetcode" | "mixed";
  checkpoint: string;
  description: string;
  progress: number;
  light: number;
  files: TopicFile[];
  lastMessage: string;
  updatedAt: string;
  languages: string[];
  tags: string[];
  syllabus: CourseSyllabusSection[];
};

export type CourseSyllabusSection = {
  id: string;
  title: string;
  summary: string;
  lessonIndex: number;
  hasChallenge: boolean;
};

export const starterCourseFiles: TopicFile[] = [
  {
    name: "README.md",
    codeHtml: "01 # Your learning workspace<br>02 <br>03 Tell Stonecode what you want to learn, then finalize the course setup."
  }
];

export function createLearningCourse({
  title,
  subject,
  description,
  languages,
  tags,
  syllabus,
  files = starterCourseFiles
}: {
  title: string;
  subject: string;
  description: string;
  languages?: string[];
  tags?: string[];
  syllabus?: CourseSyllabusSection[];
  files?: TopicFile[];
}): Course {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  const metadata = createDefaultCourseMetadata(subject);

  return {
    id: `${slug || "course"}-${Date.now().toString(36)}`,
    title,
    subject,
    mode: "mixed",
    checkpoint: "course-setup",
    description,
    progress: 0,
    light: 1,
    files,
    lastMessage: "Start with your generated learning plan.",
    updatedAt: "Today",
    languages: languages ?? metadata.languages,
    tags: tags ?? metadata.tags,
    syllabus: syllabus ?? metadata.syllabus
  };
}

export function createDefaultCourseMetadata(subject: string): Pick<Course, "languages" | "tags" | "syllabus"> {
  const normalized = subject.toLowerCase();
  const languages = normalized.includes("python")
    ? ["Python"]
    : normalized.includes("computer")
      ? ["JavaScript", "Python"]
      : ["JavaScript", "HTML", "CSS"];

  return {
    languages,
    tags: normalized.includes("computer")
      ? ["Problem solving", "Data structures", "Complexity"]
      : ["Fundamentals", "Projects", "Debugging"],
    syllabus: [
      {
        id: "read-code",
        title: "Read the current code",
        summary: "Trace inputs, outputs, and state before making changes.",
        lessonIndex: 0,
        hasChallenge: false
      },
      {
        id: "explain-edge-cases",
        title: "Reason about edge cases",
        summary: "Explain behavior clearly before implementing a fix.",
        lessonIndex: 1,
        hasChallenge: true
      },
      {
        id: "choose-an-operation",
        title: "Choose the right operation",
        summary: "Compare alternatives and identify their side effects.",
        lessonIndex: 2,
        hasChallenge: true
      },
      {
        id: "build-and-run",
        title: "Build and run a solution",
        summary: "Implement a focused feature and verify it in the terminal.",
        lessonIndex: 3,
        hasChallenge: true
      },
      {
        id: "visual-review",
        title: "Review the system visually",
        summary: "Connect the implementation to a reusable mental model.",
        lessonIndex: 4,
        hasChallenge: false
      }
    ]
  };
}

export const courses: Course[] = [
  {
    id: "javascript-rendering",
    title: "JavaScript Rendering",
    subject: "JavaScript",
    mode: "project",
    checkpoint: "render-loop-review",
    description: topics[0].description,
    progress: topics[0].progress,
    light: topics[0].light,
    files: topics[0].files,
    lastMessage: "Resume from render loops and texture cost.",
    updatedAt: "Today",
    ...createDefaultCourseMetadata("JavaScript")
  },
  {
    id: "data-structures",
    title: "Data Structures",
    subject: "Computer Science",
    mode: "fundamentals",
    checkpoint: "queues-and-graphs",
    description: topics[1].description,
    progress: topics[1].progress,
    light: topics[1].light,
    files: topics[1].files,
    lastMessage: "Continue queues, graphs, and cache tradeoffs.",
    updatedAt: "Yesterday",
    ...createDefaultCourseMetadata("Computer Science")
  }
];

export const defaultCourseCodeHtml = courses[0].files[0].codeHtml;
