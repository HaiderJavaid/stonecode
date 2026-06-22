import { topics, TopicFile } from "@/data/topics";

export type Plan = {
  name: "Free";
  activeCourseLimit: number;
};

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
};

export const currentPlan: Plan = {
  name: "Free",
  activeCourseLimit: 1
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
  files = starterCourseFiles
}: {
  title: string;
  subject: string;
  description: string;
  files?: TopicFile[];
}): Course {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

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
    updatedAt: "Today"
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
    updatedAt: "Today"
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
    updatedAt: "Yesterday"
  }
];

export const defaultCourseCodeHtml = courses[0].files[0].codeHtml;
