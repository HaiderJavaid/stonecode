import type { AiFileEdit } from "@/ai/fileEditCommands";
import type { WorkspaceFile } from "@/services/workspaceFiles";

export type TutorPatchFile = {
  path: string;
  baseHash: string;
  baseContent: string;
  nextContent: string;
  edits: Array<{ find: string; replace: string }>;
};

export type TutorPatchProposal = {
  version: "tutor-patch/v1";
  toolCallId: string;
  summary: string;
  status: "pending" | "applied" | "rejected" | "undone";
  patches: TutorPatchFile[];
};

export type TutorToolPayload = {
  patches: TutorPatchProposal[];
};

export function validateClientTutorPatch(patch: TutorPatchProposal, files: WorkspaceFile[]): AiFileEdit[] {
  if (!patch || patch.version !== "tutor-patch/v1" || patch.status !== "pending" || !Array.isArray(patch.patches)) {
    throw new Error("Tutor patch is no longer available.");
  }
  return patch.patches.map((change) => {
    const current = files.find((file) => file.path === change.path);
    if (!current) throw new Error(`${change.path} no longer exists.`);
    if (current.content !== change.baseContent) throw new Error(`${change.path} changed after this patch was proposed. Ask the tutor for a fresh patch.`);
    if (change.nextContent.length > 100000) throw new Error(`${change.path} exceeds the file size limit.`);
    return { path: change.path, content: change.nextContent };
  });
}

export function updateTutorPatchStatus(payload: TutorToolPayload | undefined, toolCallId: string, status: TutorPatchProposal["status"]): TutorToolPayload | undefined {
  if (!payload) return payload;
  return {
    patches: payload.patches.map((patch) => patch.toolCallId === toolCallId ? { ...patch, status } : patch)
  };
}
