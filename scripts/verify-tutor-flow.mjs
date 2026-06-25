import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const lessonData = read("src/components/stonecode/lessonData.ts");
const courseCard = read("src/components/stonecode/CourseCard.tsx");
const workspace = read("src/hooks/useCourseWorkspace.ts");
const fileTree = read("src/components/stonecode/WorkspaceFileTree.tsx");
const courseHome = read("src/components/stonecode/CourseHome.tsx");
const roadmap = read("src/components/stonecode/CourseRoadmap.tsx");
const independentExercises = read("src/components/stonecode/IndependentExercisePanel.tsx");
const setup = read("src/components/stonecode/CourseSetupCard.tsx");

for (const kind of ["theory", "chat-exercise", "multiple-choice", "terminal-exercise", "canvas"]) {
  expect(lessonData.includes(`kind: "${kind}"`), `missing tutor lesson kind: ${kind}`);
}

for (const extension of ["py", "java", "cpp", "cs", "go", "rs", "php", "rb", "swift", "sql", "vue", "svelte"]) {
  expect(fileTree.includes(`"${extension}"`) || fileTree.includes(`=== "${extension}"`), `missing file icon mapping: ${extension}`);
}

expect(courseCard.includes("Section {lessonIndex + 1} / {lessonSteps.length}"), "missing lesson progress copy");
expect(courseCard.includes("lesson-options"), "missing multiple-choice controls");
expect(courseCard.includes("event.key === \"Enter\" && !event.shiftKey"), "Enter should submit while Shift+Enter inserts a line");
expect(courseCard.includes("requestSubmit()"), "chat Enter handler should submit the form");
expect(workspace.includes("target instanceof HTMLTextAreaElement"), "card keyboard handler must ignore chat textareas");
expect(courseHome.includes("Exercises"), "course home must expose independent exercises");
expect(courseHome.includes("Course roadmap"), "course home must expose the course roadmap");
expect(roadmap.includes("onSelectSection(section.lessonIndex)"), "roadmap sections must navigate to real lesson indexes");
expect(independentExercises.includes("stonecode.exerciseSession.v1"), "independent limits must be shared across courses");
expect(independentExercises.includes("Hint used for this exercise"), "exercise hint composer must lock after use");
expect(setup.includes("Proposed course"), "course setup must render a structured proposal");

console.log("tutor flow checks passed");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
