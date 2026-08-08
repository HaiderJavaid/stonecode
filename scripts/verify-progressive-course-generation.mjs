import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProgressiveCourseContent,
  restoreProgressiveGenerationState
} from "../server/learning-orchestrator/generation-worker.mjs";

const moduleWithSteps = (id, title) => ({
  id,
  title,
  summary: `${title} summary`,
  order: 0,
  unlocked: true,
  topics: [{
    id: `${id}-topic`,
    title,
    summary: `${title} topic`,
    order: 0,
    unlocked: true,
    blocks: [{
      id: `${id}-block`,
      kind: "theory",
      title,
      summary: `${title} block`,
      order: 0,
      steps: [{ type: "theory", markdown: "## Lesson\n\nA substantive generated lesson." }]
    }]
  }]
});

const skeleton = {
  schemaVersion: "course-content/v2",
  title: "Progressive Rust",
  subject: "Rust",
  description: "A complete Rust course.",
  languages: ["Rust"],
  tags: ["Rust"],
  generationDepth: "full_structure_first_module",
  assessmentReview: { strengths: [], gaps: [], suggestedModules: [] },
  modules: ["one", "two", "three"].map((id, index) => ({
    ...moduleWithSteps(id, `Module ${index + 1}`),
    order: index,
    unlocked: false,
    topics: moduleWithSteps(id, `Module ${index + 1}`).topics.map((topic) => ({ ...topic, unlocked: false }))
  }))
};

const first = moduleWithSteps("one", "Module 1");
const second = moduleWithSteps("two", "Module 2");
const state = restoreProgressiveGenerationState({
  version: "progressive-course-generation/v1",
  modules: [
    { status: "ready", content: first },
    { status: "ready", content: second },
    { status: "generating", content: null }
  ]
}, { jobId: "job-1", skeleton, launchModuleCount: 2 });

assert.deepEqual(state.modules.map((module) => module.status), ["ready", "ready", "queued"]);
const partial = buildProgressiveCourseContent({ skeleton, state, jobId: "job-1" });
assert.equal(partial.progressiveGeneration.readyModuleCount, 2);
assert.equal(partial.progressiveGeneration.status, "background");
assert.equal(partial.modules[0].topics[0].blocks[0].steps.length, 1);
assert.equal(partial.modules[1].topics[0].blocks[0].steps.length, 1);
assert.equal(partial.modules[2].topics[0].blocks[0].steps.length, 0);
assert.equal(partial.modules[2].unlocked, false);

const completeModules = [first, second, moduleWithSteps("three", "Module 3")];
const complete = buildProgressiveCourseContent({ skeleton, state, jobId: "job-1", completeContent: { ...skeleton, modules: completeModules } });
assert.equal(complete.progressiveGeneration.status, "complete");
assert.equal(complete.modules.length, 3);

const [migration, setup, panel, workspace] = await Promise.all([
  readFile(new URL("../supabase/migrations/2026-08-02-progressive-course-generation.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/components/stonecode/CourseSetupCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/stonecode/FilePanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/hooks/useCourseWorkspace.ts", import.meta.url), "utf8")
]);
assert.match(migration, /launch_stonecode_generation_job/);
assert.match(migration, /highest_lesson_index/);
assert.match(setup, /job\.launch_ready_at && job\.result_course_id/);
assert.match(panel, /module-generation-spinner/);
assert.match(panel, /moduleIsAccessible = .*=> moduleIsGenerated\(module\);/);
assert.match(panel, /topic\.blocks\.some\(\(block\) => block\.steps\.length > 0\)/);
assert.doesNotMatch(panel, /highestLessonIndex >= firstLessonIndex/);
assert.match(workspace, /requestGenerationJob\(progressiveGeneration\.jobId\)/);

console.log("Progressive course generation verification passed.");
