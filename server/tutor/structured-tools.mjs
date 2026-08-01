import { createHash } from "node:crypto";

export const tutorToolDefinitions = [{
  type: "function",
  name: "propose_workspace_patch",
  description: "Propose small workspace file changes for the learner to explicitly Apply or Reject. Never mutates files directly.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "changes"],
    properties: {
      summary: { type: "string", minLength: 1, maxLength: 240 },
      changes: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "edits"],
          properties: {
            path: { type: "string", minLength: 1, maxLength: 180 },
            edits: {
              type: "array",
              minItems: 1,
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["find", "replace"],
                properties: {
                  find: { type: "string", maxLength: 30000 },
                  replace: { type: "string", maxLength: 30000 }
                }
              }
            }
          }
        }
      }
    }
  }
}];

export function extractTutorToolCall(event) {
  if (event?.event !== "response.output_item.done") return null;
  const item = event.data?.item ?? event.data;
  if (item?.type !== "function_call" || typeof item.name !== "string" || typeof item.arguments !== "string") return null;
  return { id: String(item.call_id ?? item.id ?? "tool-call"), name: item.name, arguments: item.arguments };
}

export function validateTutorToolCall(call, trustedContext) {
  if (!call || call.name !== "propose_workspace_patch") throw toolError("unsupported_tutor_tool", "Unsupported tutor tool call.");
  let args;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    throw toolError("invalid_tutor_tool_arguments", "Tutor patch arguments were not valid JSON.");
  }
  if (!plainObject(args) || extraKeys(args, ["summary", "changes"])) throw toolError("invalid_tutor_patch", "Tutor patch shape is invalid.");
  const summary = cleanText(args.summary, 240);
  if (!summary || !Array.isArray(args.changes) || args.changes.length < 1 || args.changes.length > 6) {
    throw toolError("invalid_tutor_patch", "Tutor patch needs a summary and 1 to 6 file changes.");
  }
  const workspace = new Map((trustedContext.workspaceFiles ?? []).map((file) => [file.path, file.content]));
  const patches = args.changes.map((change, index) => validateFileChange(change, workspace, index));
  return {
    version: "tutor-patch/v1",
    toolCallId: call.id,
    summary,
    status: "pending",
    patches
  };
}

function validateFileChange(change, workspace, index) {
  if (!plainObject(change) || extraKeys(change, ["path", "edits"])) throw toolError("invalid_tutor_patch", `Patch change ${index + 1} has an invalid shape.`);
  const path = normalizeWorkspacePath(change.path);
  if (!path) throw toolError("invalid_tutor_patch_path", `Patch change ${index + 1} has an unsafe path.`);
  const baseContent = workspace.get(path);
  if (typeof baseContent !== "string") throw toolError("tutor_patch_file_not_found", `Tutor can only patch an existing owned workspace file: ${path}.`);
  if (!Array.isArray(change.edits) || change.edits.length < 1 || change.edits.length > 12) throw toolError("invalid_tutor_patch", `Patch change ${index + 1} needs 1 to 12 edits.`);
  let nextContent = baseContent;
  const edits = change.edits.map((edit, editIndex) => {
    if (!plainObject(edit) || extraKeys(edit, ["find", "replace"]) || typeof edit.find !== "string" || typeof edit.replace !== "string" || !edit.find) {
      throw toolError("invalid_tutor_patch", `Patch edit ${editIndex + 1} for ${path} is invalid.`);
    }
    if (edit.find.length > 30000 || edit.replace.length > 30000) throw toolError("tutor_patch_too_large", `Patch edit for ${path} is too large.`);
    const first = nextContent.indexOf(edit.find);
    if (first < 0 || nextContent.indexOf(edit.find, first + edit.find.length) >= 0) {
      throw toolError("tutor_patch_anchor_mismatch", `Patch anchor for ${path} must match exactly once.`);
    }
    nextContent = `${nextContent.slice(0, first)}${edit.replace}${nextContent.slice(first + edit.find.length)}`;
    return { find: edit.find, replace: edit.replace };
  });
  if (nextContent.length > 100000) throw toolError("tutor_patch_too_large", `${path} would exceed the 100 KB file limit.`);
  return {
    path,
    baseHash: sha256(baseContent),
    baseContent,
    nextContent,
    edits
  };
}

function normalizeWorkspacePath(value) {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  if (!raw || raw.startsWith("/") || raw.includes("\0")) return null;
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.length > 100)) return null;
  return parts.join("/").slice(0, 180);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extraKeys(value, allowed) {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function toolError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}
