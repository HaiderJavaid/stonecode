import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTutorDiagramSvg } from "../server/tutor/visuals.mjs";

const cue = {
  version: "tutor-visual-cue/v1",
  id: "queue-flow",
  kind: "diagram",
  title: "Queue flow",
  description: "Input; First in; First out",
  caption: "Values leave in arrival order.",
  altText: "A queue showing first-in-first-out order.",
  labels: ["Enqueue", "Queue", "Dequeue"],
  preferredRenderer: "svg"
};
const svg = buildTutorDiagramSvg(cue);
assert.match(svg, /^<svg/);
assert.match(svg, /Queue flow/);
assert.match(svg, /aria-labelledby="title desc"/);
assert.doesNotMatch(buildTutorDiagramSvg({ ...cue, title: "<script>alert(1)<\/script>" }), /<script>/);

const card = readFileSync(new URL("../src/components/stonecode/CourseCard.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
assert.match(card, /tutor-visual-attachment/);
assert.match(card, /aria-modal="true"/);
assert.match(card, /event\.key === "Escape"/);
assert.match(card, /setPointerCapture/);
assert.match(card, /returnFocusRef\.current\?\.focus/);
assert.match(server, /createOrReadTutorVisual/);
assert.match(server, /readTutorVisualContent/);

console.log("chat visual checks passed");
