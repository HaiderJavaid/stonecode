import { Course } from "@/data/courses";

export type WorkspaceFile = {
  path: string;
  content: string;
};

export type WorkspaceFolder = {
  path: string;
};

export function codeHtmlToText(codeHtml: string) {
  return codeHtml
    .replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/^\d{2}\s/gm, "");
}

export function createSeedWorkspaceFiles(course: Course): WorkspaceFile[] {
  return course.files.map((file) => ({
    path: file.name,
    content: codeHtmlToText(file.codeHtml)
  }));
}

export function normalizeWorkspacePath(path: string) {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function createUntitledFolderPath(folders: WorkspaceFolder[]) {
  let index = 1;
  let path = "practice";

  while (folders.some((folder) => folder.path === path)) {
    index += 1;
    path = `practice-${index}`;
  }

  return path;
}

export function createUntitledPath(files: WorkspaceFile[]) {
  let index = 1;
  let path = "lesson-notes.ts";

  while (files.some((file) => file.path === path)) {
    index += 1;
    path = `lesson-notes-${index}.ts`;
  }

  return path;
}
