import {
  applyAiFileEdits,
  extractAiFileEdits
} from "./ai-file-edits.mjs";

export function extractAiRunCommand(reply) {
  const runBlockPattern = /```STONECODE_RUN_ACTIVE_FILE\s*```/g;
  const fallbackRunPattern = /\b(node\s+\S+\.js|run\s+(the\s+)?(active\s+)?file|execute\s+(the\s+)?command|terminal)\b/i;
  return {
    displayReply: reply.replace(runBlockPattern, "").trim(),
    shouldRunActiveFile: runBlockPattern.test(reply) || fallbackRunPattern.test(reply)
  };
}

export {
  applyAiFileEdits,
  extractAiFileEdits
};
