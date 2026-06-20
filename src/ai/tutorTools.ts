import { WorkspaceFile, normalizeWorkspacePath } from "@/services/workspaceFiles";

export type WorkspaceToolName =
  | "listFiles"
  | "readFile"
  | "createFile"
  | "updateFile"
  | "deleteFile";

export type WorkspaceToolResult = {
  files: WorkspaceFile[];
  selectedPath?: string;
  message: string;
};

export const workspaceToolContracts = [
  {
    name: "listFiles",
    description: "List all files in the current course workspace."
  },
  {
    name: "readFile",
    description: "Read a file by path from the current course workspace."
  },
  {
    name: "createFile",
    description: "Create a new file at a path with provided content."
  },
  {
    name: "updateFile",
    description: "Replace the full content of an existing file."
  },
  {
    name: "deleteFile",
    description: "Delete an existing file after user confirmation."
  }
] as const;

export function listFiles(files: WorkspaceFile[]): string[] {
  return files.map((file) => file.path);
}

export function readFile(files: WorkspaceFile[], path: string): WorkspaceFile | null {
  const normalizedPath = normalizeWorkspacePath(path);
  return files.find((file) => file.path === normalizedPath) ?? null;
}

export function createFile(files: WorkspaceFile[], path: string, content = ""): WorkspaceToolResult {
  const normalizedPath = normalizeWorkspacePath(path);
  if (!normalizedPath) return { files, message: "File path is required." };
  if (files.some((file) => file.path === normalizedPath)) return { files, message: "File already exists." };

  return {
    files: [...files, { path: normalizedPath, content }],
    selectedPath: normalizedPath,
    message: `Created ${normalizedPath}.`
  };
}

export function updateFile(files: WorkspaceFile[], path: string, content: string): WorkspaceToolResult {
  const normalizedPath = normalizeWorkspacePath(path);
  if (!files.some((file) => file.path === normalizedPath)) return { files, message: "File not found." };

  return {
    files: files.map((file) => (file.path === normalizedPath ? { ...file, content } : file)),
    selectedPath: normalizedPath,
    message: `Updated ${normalizedPath}.`
  };
}

export function deleteFile(files: WorkspaceFile[], path: string): WorkspaceToolResult {
  const normalizedPath = normalizeWorkspacePath(path);
  if (files.length <= 1) return { files, message: "At least one file must remain." };
  if (!files.some((file) => file.path === normalizedPath)) return { files, message: "File not found." };

  return {
    files: files.filter((file) => file.path !== normalizedPath),
    message: `Deleted ${normalizedPath}.`
  };
}

