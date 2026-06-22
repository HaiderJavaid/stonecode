import assert from "node:assert/strict";
import {
  applyAiFileEdits,
  extractAiFileEdits,
  extractAiRunCommand
} from "../server/ai-actions.mjs";

const reply = `Here is the update.

\`\`\`STONECODE_FILE_EDIT
{"path":"README.md","content":"# Updated"}
\`\`\`

Done.`;

const extracted = extractAiFileEdits(reply);
assert.equal(extracted.edits.length, 1);
assert.equal(extracted.edits[0].path, "README.md");
assert.equal(extracted.edits[0].content, "# Updated");
assert.equal(extracted.displayReply, "Here is the update.\n\n\n\nDone.");

const applied = applyAiFileEdits(
  [
    { path: "README.md", content: "# Old" },
    { path: "src/index.ts", content: "console.log('old');" }
  ],
  extracted.edits
);

assert.equal(applied.files.length, 2);
assert.equal(applied.files[0].content, "# Updated");
assert.equal(applied.selectedIndex, 0);
assert.equal(applied.appliedCount, 1);

const created = applyAiFileEdits(applied.files, [{ path: "/notes/new.md", content: "New" }]);
assert.equal(created.files.length, 3);
assert.equal(created.files[2].path, "notes/new.md");
assert.equal(created.selectedIndex, 2);

const runCommand = extractAiRunCommand("Run it.\n```STONECODE_RUN_ACTIVE_FILE\n```\nDone.");
assert.equal(runCommand.shouldRunActiveFile, true);
assert.equal(runCommand.displayReply, "Run it.\n\nDone.");

const fallbackRunCommand = extractAiRunCommand("You can run this with `node index.js` in the terminal.");
assert.equal(fallbackRunCommand.shouldRunActiveFile, true);

const escapedReply = `Updated README.md

\\n{"path":"README.md","content":"# Escaped\\\\n\\\\nRun it"}`

const escaped = extractAiFileEdits(escapedReply);
assert.equal(escaped.edits.length, 1);
assert.equal(escaped.edits[0].path, "README.md");
assert.equal(escaped.edits[0].content, "# Escaped\n\nRun it");
assert.equal(escaped.displayReply, "Updated README.md");

console.log("ai file edit checks passed");
