import assert from "node:assert/strict";
import { extractTutorToolCall, tutorToolDefinitions, validateTutorToolCall } from "../server/tutor/structured-tools.mjs";

assert.equal(tutorToolDefinitions[0].name, "propose_workspace_patch");
assert.equal(tutorToolDefinitions[0].strict, true);

const call = extractTutorToolCall({
  event: "response.output_item.done",
  data: {
    item: {
      type: "function_call",
      call_id: "call-1",
      name: "propose_workspace_patch",
      arguments: JSON.stringify({
        summary: "Change the greeting",
        changes: [{ path: "main.js", edits: [{ find: "Hello", replace: "Hello, learner" }] }]
      })
    }
  }
});
const patch = validateTutorToolCall(call, { workspaceFiles: [{ path: "main.js", content: "console.log('Hello');\n" }] });
assert.equal(patch.status, "pending");
assert.equal(patch.patches[0].nextContent, "console.log('Hello, learner');\n");
assert.equal(patch.patches[0].baseHash.length, 64);

assert.throws(() => validateTutorToolCall({ ...call, arguments: JSON.stringify({ summary: "Escape", changes: [{ path: "../secret", edits: [{ find: "x", replace: "y" }] }] }) }, { workspaceFiles: [] }), /unsafe path/);
assert.throws(() => validateTutorToolCall({ ...call, arguments: JSON.stringify({ summary: "Ambiguous", changes: [{ path: "main.js", edits: [{ find: "x", replace: "y" }] }] }) }, { workspaceFiles: [{ path: "main.js", content: "xx" }] }), /exactly once/);
assert.throws(() => validateTutorToolCall({ ...call, arguments: JSON.stringify({ summary: "Other file", changes: [{ path: "other.js", edits: [{ find: "x", replace: "y" }] }] }) }, { workspaceFiles: [{ path: "main.js", content: "x" }] }), /existing owned workspace file/);

console.log("structured tutor tool checks passed");
