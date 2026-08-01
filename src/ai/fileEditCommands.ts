import { normalizeWorkspacePath, WorkspaceFile } from "@/services/workspaceFiles";

export type AiFileEdit = {
  path: string;
  content: string;
};

export function applyAiFileEdits(files: WorkspaceFile[], edits: AiFileEdit[], preferredIndex = 0) {
  let nextFiles = files;
  let selectedPath: string | null = null;

  for (const edit of edits) {
    const path = normalizeWorkspacePath(edit.path);
    if (!path) continue;

    selectedPath = path;
    const existingIndex = nextFiles.findIndex((file) => file.path === path);
    if (existingIndex >= 0) {
      nextFiles = nextFiles.map((file, index) => (index === existingIndex ? { ...file, content: edit.content } : file));
      continue;
    }

    if (nextFiles.length) {
      const targetIndex = Math.min(Math.max(preferredIndex, 0), nextFiles.length - 1);
      nextFiles = nextFiles.map((file, index) => (index === targetIndex ? { path, content: edit.content } : file));
      continue;
    }

    nextFiles = [{ path, content: edit.content }];
  }

  const selectedIndex = selectedPath ? nextFiles.findIndex((file) => file.path === selectedPath) : -1;

  return {
    files: nextFiles,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    appliedCount: edits.length
  };
}
