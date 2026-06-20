import { Course } from "@/data/courses";
import { StoredChatMessage } from "@/services/courseStorage";
import { WorkspaceFile } from "@/services/workspaceFiles";

export type TutorContextInput = {
  course: Course;
  files: WorkspaceFile[];
  currentFile: WorkspaceFile | null;
  recentMessages: StoredChatMessage[];
  userMessage: string;
};

export type TutorContext = {
  courseTitle: string;
  courseSubject: string;
  checkpoint: string;
  currentFilePath: string | null;
  currentFileContent: string | null;
  fileTree: string[];
  recentMessages: Array<{
    role: StoredChatMessage["role"];
    content: string;
  }>;
  userMessage: string;
};

export function buildTutorContext(input: TutorContextInput): TutorContext {
  return {
    courseTitle: input.course.title,
    courseSubject: input.course.subject,
    checkpoint: input.course.checkpoint,
    currentFilePath: input.currentFile?.path ?? null,
    currentFileContent: input.currentFile?.content ?? null,
    fileTree: input.files.map((file) => file.path),
    recentMessages: input.recentMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content
    })),
    userMessage: input.userMessage
  };
}

