import { normalizeWorkspacePath, WorkspaceFile } from "@/services/workspaceFiles";

export type AiFileEdit = {
  path: string;
  content: string;
};

export type AiFileEditExtraction = {
  displayReply: string;
  edits: AiFileEdit[];
};

export type AiRunCommandExtraction = {
  displayReply: string;
  shouldRunActiveFile: boolean;
};

const editBlockPattern = /```STONECODE_FILE_EDIT\s*([\s\S]*?)```/g;

export function extractAiFileEdits(reply: string): AiFileEditExtraction {
  const edits: AiFileEdit[] = [];
  let displayReply = reply.replace(editBlockPattern, (_match, rawJson) => {
    const edit = parseEdit(rawJson);
    if (edit) edits.push(edit);
    return "";
  }).trim();

  if (!edits.length) {
    displayReply = displayReply.replace(/\\n\s*(\{[\s\S]*"path"[\s\S]*"content"[\s\S]*\})\s*$/g, (_match, rawJson) => {
      const edit = parseEdit(rawJson);
      if (edit) edits.push(edit);
      return "";
    }).trim();
  }

  return {
    displayReply,
    edits
  };
}

export function applyAiFileEdits(files: WorkspaceFile[], edits: AiFileEdit[]) {
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

    nextFiles = [...nextFiles, { path, content: edit.content }];
  }

  const selectedIndex = selectedPath ? nextFiles.findIndex((file) => file.path === selectedPath) : -1;

  return {
    files: nextFiles,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    appliedCount: edits.length
  };
}

export function extractAiRunCommand(reply: string): AiRunCommandExtraction {
  const runBlockPattern = /```STONECODE_RUN_ACTIVE_FILE\s*```/g;
  const fallbackRunPattern = /\b(node\s+\S+\.js|run\s+(the\s+)?(active\s+)?file|execute\s+(the\s+)?command|terminal)\b/i;
  return {
    displayReply: reply.replace(runBlockPattern, "").trim(),
    shouldRunActiveFile: runBlockPattern.test(reply) || fallbackRunPattern.test(reply)
  };
}

function parseEdit(rawJson: string): AiFileEdit | null {
  const candidates = [
    rawJson.trim(),
    rawJson.trim().replace(/\\"/g, "\"").replace(/\\n/g, "\n")
  ];

  for (const candidate of candidates) {
    const edit = parseJsonEdit(candidate);
    if (edit) return edit;
  }

  return null;
}

function parseJsonEdit(rawJson: string): AiFileEdit | null {
  try {
    const parsed = JSON.parse(rawJson.trim()) as Partial<AiFileEdit>;
    const path = normalizeWorkspacePath(String(parsed.path ?? ""));
    const content = typeof parsed.content === "string" ? parsed.content.replace(/\\n/g, "\n").replace(/\\"/g, "\"") : null;
    if (!path || content === null) return null;

    return { path, content };
  } catch {
    return null;
  }
}
