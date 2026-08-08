import { Course, GeneratedCourseBlock, GeneratedCourseLearningBlock, GeneratedCourseSection, GeneratedCourseStep, GeneratedExerciseWorkspaceFile, LearningExperienceType, TutorVisualCueV1, toGeneratedCourseContentV2 } from "@/data/courses";
import { defaultFilePath, defaultStarterCode, resolveEditorLanguage } from "@/services/editorLanguages";

type GeneratedPracticalStep = Extract<GeneratedCourseStep, { type: "workshop" | "lab" | "project" }>;
type GeneratedWorkshopStep = GeneratedPracticalStep & { type: "workshop" };

export type LessonDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type LessonOption = {
  label: string;
};

export type LessonCodeExercise = {
  type: "code_exercise";
  exerciseKind: "workshop" | "lab" | "project";
  language: string;
  filePath: string;
  prompt: string;
  starterCode: string;
  resultCode?: string;
  expectedChange?: string;
  codeExplanation?: string;
  acceptanceCriteria: string[];
  context?: string;
  requiresPreview?: boolean;
  requiresTerminal?: boolean;
  workspaceView?: "code" | "preview" | "terminal";
  workspaceFiles?: GeneratedExerciseWorkspaceFile[];
};

export type LessonStep = {
  kind: "theory" | "chat-exercise" | "multiple-choice" | "terminal-exercise" | "canvas";
  label: string;
  title: string;
  tutor: string;
  suggestions: string[];
  sectionId?: string;
  chapterId?: string;
  moduleId?: string;
  topicId?: string;
  blockId?: string;
  blockKind?: string;
  blockStepIndex?: number;
  blockStepCount?: number;
  generatedBlocks?: GeneratedCourseBlock[];
  codeExercise?: LessonCodeExercise;
  correctOptionIndex?: number;
  mcqExplanation?: string;
  language?: string;
  difficulty?: LessonDifficulty;
  xp?: number;
  options?: LessonOption[];
  visualCue?: TutorVisualCueV1;
};

export const lessonSteps: LessonStep[] = [
  {
    kind: "theory",
    label: "Theory",
    title: "Read the Current File",
    tutor: `## Let's inspect the current file

Start by reading the smallest function or statement that controls the current behavior.

- Name the input.
- Name the output.
- Point to the line that changes state.

**Goal:** explain what data enters and what leaves before editing anything.

Ask for clarification at any point. If a question belongs to an upcoming section, the tutor will tell you where it will be covered.`,
    suggestions: ["Explain the state change", "Give me a small hint", "What comes next?"]
  },
  {
    kind: "chat-exercise",
    label: "Exercise",
    title: "Answer in Chat",
    language: "JavaScript",
    difficulty: "Beginner",
    xp: 10,
    tutor: `## Check your understanding

The function receives an array and returns its first element.

**Question:** what should the function return when the array is empty, and why?

Write your answer in chat. The tutor will review your reasoning before you continue.`,
    suggestions: ["Give me a hint", "Show the function signature", "Review my answer"]
  },
  {
    kind: "multiple-choice",
    label: "Exercise",
    title: "Choose the Best Answer",
    language: "JavaScript",
    difficulty: "Beginner",
    xp: 15,
    tutor: `## Which operation changes the array?

Choose the answer that mutates the original array.`,
    suggestions: [],
    options: [
      { label: "array.map(item => item * 2)" },
      { label: "array.slice(1)" },
      { label: "array.push(nextItem)" },
      { label: "[...array, nextItem]" }
    ]
  },
  {
    kind: "terminal-exercise",
    label: "Exercise",
    title: "Write and Run Code",
    language: "JavaScript",
    difficulty: "Intermediate",
    xp: 25,
    tutor: `## Complete this in the editor

Create \`practice/queue.js\` and implement a queue with:

- \`enqueue(value)\`
- \`dequeue()\`
- an empty-queue guard

Run the file in the terminal when ready, then explain the time complexity in chat.`,
    suggestions: ["Show related files", "Explain queue complexity", "Review my implementation"]
  },
  {
    kind: "canvas",
    label: "Visual explanation",
    title: "See the Data Move",
    tutor: `## Queue flow

\`\`\`diagram
enqueue("A")  ->  [ A ]
enqueue("B")  ->  [ A ][ B ]
dequeue()     ->       [ B ]
                    front ^
\`\`\`

\`\`\`css
.queue-item {
  border: 1px solid #74d99f;
  background: #10261a;
  color: #baf5cf;
}
\`\`\`

The first item added is the first item removed. This is **FIFO**: first in, first out.`,
    suggestions: ["Explain FIFO again", "Compare queue vs stack", "Start a queue problem"]
  }
];

export function resolveCourseLessonSteps(course: Course): LessonStep[] {
  if (!course.courseContent) return lessonSteps;
  if (course.courseContent.schemaVersion !== "course-content/v1") {
    const navigableContent = toGeneratedCourseContentV2(course.courseContent);
    const generatedSteps = navigableContent.modules.flatMap((module, moduleIndex) =>
      module.topics.flatMap((topic, topicIndex) =>
        topic.blocks.flatMap((block, blockIndex) =>
          stepsForGeneratedBlock(block).map((step, stepIndex, blockSteps) => generatedCourseStepToLesson({
            blockId: block.id,
            blockIndex,
            blockKind: block.kind,
            blockTitle: block.title,
            blockSummary: block.summary,
            blockStepCount: blockSteps.length,
            courseSubject: course.subject,
            experienceType: course.experienceType,
            moduleIndex,
            moduleId: module.id,
            step,
            stepIndex,
            topicId: topic.id,
            topicTitle: topic.title,
            topicIndex
          }))
        )
      )
    );
    return generatedSteps.length ? generatedSteps : lessonSteps;
  }
  if (!course.courseContent.chapters.length) return lessonSteps;
  return course.courseContent.chapters.flatMap((chapter) =>
    chapter.sections.flatMap((section, sectionIndex) => generatedSectionToLessons(section, chapter.id, sectionIndex))
  );
}

function generatedCourseStepToLesson({
  blockId,
  blockIndex,
  blockKind,
  blockTitle: title,
  blockSummary,
  blockStepCount,
  courseSubject,
  experienceType,
  moduleIndex,
  moduleId,
  step,
  stepIndex,
  topicId,
  topicTitle,
  topicIndex
}: {
  blockId: string;
  blockIndex: number;
  blockKind: string;
  blockTitle: string;
  blockSummary: string;
  blockStepCount: number;
  courseSubject: string;
  experienceType: LearningExperienceType;
  moduleIndex: number;
  moduleId: string;
  step: GeneratedCourseStep;
  stepIndex: number;
  topicId: string;
  topicTitle: string;
  topicIndex: number;
}): LessonStep {
  const mcq = step.type === "mcq" ? step : null;
  const reflection = step.type === "reflection" ? step : null;
  const codeExercise = step.type === "workshop" || step.type === "lab" || step.type === "project"
    ? normalizeGeneratedExerciseStep(step, courseSubject)
    : null;
  const displayStep = codeExercise ?? step;
  const kind: LessonStep["kind"] = codeExercise
    ? "terminal-exercise"
    : mcq
      ? "multiple-choice"
      : reflection
        ? "chat-exercise"
        : "theory";

  return {
    kind,
    label: blockKind === "workshop" && step.type === "summary"
      ? "Workshop recap"
      : kind === "theory" && experienceType === "guided_project"
        ? blockIndex === 0 ? "Project intro" : "Project recap"
        : kind === "theory" ? "Theory" : "Exercise",
    title: stepLessonTitle(title, step.type),
    visualCue: step.visualCue,
    tutor: renderGeneratedCourseStep(title, blockSummary, displayStep, topicTitle, moduleIndex, topicIndex, blockIndex, stepIndex, courseSubject, experienceType),
    suggestions: codeExercise?.type === "workshop"
      ? workshopSuggestedQuestions(codeExercise)
      : ["Explain this slower", "Give me a simple example", "What should I remember?"],
    sectionId: `${moduleId}:${topicId}:${blockId}:${stepIndex}`,
    moduleId,
    topicId,
    codeExercise: codeExercise
      ? {
          type: "code_exercise",
          exerciseKind: codeExercise.type,
          language: codeExercise.language,
          filePath: codeExercise.filePath,
          prompt: codeExercise.prompt,
          starterCode: codeExercise.starterCode,
          resultCode: codeExercise.resultCode,
          expectedChange: codeExercise.expectedChange,
          codeExplanation: codeExercise.codeExplanation,
          acceptanceCriteria: codeExercise.acceptanceCriteria,
          context: codeExercise.context,
          requiresPreview: codeExercise.requiresPreview,
          requiresTerminal: codeExercise.requiresTerminal,
          workspaceView: codeExercise.workspaceView,
          workspaceFiles: codeExercise.workspaceFiles
        }
      : undefined,
    blockId,
    blockKind,
    blockStepIndex: stepIndex,
    blockStepCount,
    correctOptionIndex: mcq?.correctOptionIndex,
    mcqExplanation: mcq?.explanation,
    language: codeExercise?.language ?? resolveGeneratedExerciseLanguage("", courseSubject, ""),
    difficulty: "Beginner",
    xp: kind === "theory" ? undefined : codeExercise ? 20 : 10,
    options: mcq?.options.map((label) => ({ label })) ?? []
  };
}

function renderGeneratedCourseStep(blockTitle: string, blockSummary: string, step: GeneratedCourseStep, topicTitle: string, moduleIndex: number, topicIndex: number, blockIndex: number, stepIndex: number, courseSubject: string, experienceType: LearningExperienceType) {
  if (step.type === "theory" || step.type === "analogy" || step.type === "example" || step.type === "summary") {
    const greeting = moduleIndex === 0 && topicIndex === 0 && blockIndex === 0 && stepIndex === 0
      ? experienceType === "guided_project"
        ? `## Before you build\n\nThis quick project orientation shows what you are making, why it is useful, and how the finished parts fit together. It refreshes only the ideas needed for **${topicTitle}**; it is not a lesson test.\n\n`
        : friendlyCourseWelcome(courseSubject, topicTitle)
      : blockIndex === 0 && stepIndex === 0
        ? `## ${topicTitle}\n\nThis chapter focuses on **${topicTitle}** and how it supports the larger goal of learning ${courseSubject}. ${cleanLearnerText(blockSummary)} We will build the mental model first, then connect it to a small code example before practice.\n\n`
        : "";
    return `${greeting}${normalizeTheoryMarkdownForDisplay(step.markdown, courseSubject)}`;
  }
  if (step.type === "mcq") return `## Topic practice\n\n${cleanLearnerText(step.prompt)}`;
  if (step.type === "reflection") return `## Answer in chat\n\n${cleanLearnerText(step.prompt)}`;
  if (step.type === "workshop" || step.type === "lab" || step.type === "project") {
    const contextText = normalizeExerciseContextForDisplay(step.context, step.language);
    const context = contextText && (step.type !== "workshop" || stepIndex === 0) ? `\n\n${contextText}` : "";
    const buildHeading = step.type === "workshop" && stepIndex === 0 ? `## ${blockTitle}` : step.type === "workshop" ? "" : "## What you are solving";
    const focus = step.type !== "workshop" && step.acceptanceCriteria?.[0]
      ? `\n\n> **Important:** ${cleanLearnerText(step.acceptanceCriteria[0])}. Decide the implementation yourself; use the visible behavior as your guide.`
      : "";
    const tutorial = step.type === "workshop"
      ? renderCompactWorkshopStep(step as GeneratedWorkshopStep, stepIndex)
      : `\n\n## Task\n\n${cleanLearnerText(step.prompt)}${focus}`;
    const viewNote = step.requiresPreview
      ? "\n\n## Output check\n\nOpen the Output tab when you want to compare the real page before and after your edit. Code stays selected so you remain in control of when to preview it."
      : "";
    const projectNote = step.workspaceFiles && step.workspaceFiles.length > 1
      ? `\n\n## Project files\n\nThis step uses ${step.workspaceFiles.map((file) => `\`${file.path}\``).join(", ")}. The tutor can reason across all of them.`
      : "";
    return `${buildHeading}${context}${tutorial}${viewNote}${projectNote}`;
  }
  return `## ${blockTitle}\n\n${blockSummary}`;
}

function friendlyCourseWelcome(courseSubject: string, topicTitle: string) {
  const normalized = courseSubject.toLowerCase();
  const purpose = normalized.includes("c++")
    ? "C++ powers things that need speed and control: games and game engines, browsers, robots, simulations, and parts of operating systems. It is like learning how to drive while also seeing what the engine is doing."
    : normalized.includes("python")
      ? "Python is used for automation, websites, data, science, and AI. Its code reads almost like plain instructions, so you can make useful tools without fighting lots of punctuation first."
      : normalized.includes("javascript") || normalized.includes("typescript")
        ? `${courseSubject} helps turn websites from posters into things people can click, play with, and use. It can power forms, dashboards, games, and full applications in the browser.`
        : normalized.includes("java")
          ? "Java is used for large applications, business systems, tools, and many Android projects. It teaches you to organize instructions carefully so bigger programs stay understandable."
          : normalized.includes("rust")
            ? "Rust is built for fast software that also protects you from many memory mistakes. People use it for command-line tools, game technology, browsers, and systems software."
            : normalized.includes("sql")
              ? "SQL lets you ask databases questions and change stored information. Apps use it to find users, orders, scores, messages, and nearly every other kind of organized record."
              : `${courseSubject} is a way to give a computer small, exact instructions and combine them into useful tools, apps, games, or automated jobs.`;
  return `## Welcome to ${courseSubject}\n\n${purpose}\n\nImagine teaching a very fast robot: it follows exactly what you say, not what you meant. We will learn how to give that robot clear instructions, test what happened, and fix mistakes without panic.\n\nWe begin with **${topicTitle}** because it is the foundation every later idea will reuse. You do not need to know the technical words yet—we will add them only after the simple idea makes sense.\n\n`;
}

export function stepsForGeneratedBlock(block: GeneratedCourseLearningBlock): GeneratedCourseStep[] {
  if (block.kind !== "workshop") return block.steps;
  const displaySteps = block.steps.filter((step) => !isLegacyRunOnlyWorkshopStep(step));
  if (displaySteps.at(-1)?.type === "summary") return displaySteps;
  const workshopSteps = displaySteps.filter((step): step is GeneratedWorkshopStep => step.type === "workshop");
  if (!workshopSteps.length) return displaySteps;
  return [...displaySteps, buildWorkshopRecapStep(block, workshopSteps)];
}

function isLegacyRunOnlyWorkshopStep(step: GeneratedCourseStep) {
  if (step.type !== "workshop") return false;
  const hasCodeChange = Boolean(step.resultCode?.trim() && step.resultCode.trim() !== step.starterCode.trim());
  const requestsCodeEdit = /\b(?:add|write|change|replace|create|define|call|import|remove|move|wrap)\b/i.test(step.prompt);
  const requestsOnlyVerification = /\b(?:run|open|inspect|confirm|read|check)\b/i.test(step.prompt);
  return !hasCodeChange && !requestsCodeEdit && requestsOnlyVerification;
}

function buildWorkshopRecapStep(
  block: GeneratedCourseLearningBlock,
  workshopSteps: GeneratedWorkshopStep[]
): GeneratedCourseStep {
  const finalStep = workshopSteps.at(-1);
  const changes = workshopSteps
    .map((step) => cleanLearnerText(step.expectedChange || step.prompt))
    .filter(Boolean)
    .map((change) => `- ${change.replace(/^Step\s+\d+\s*:\s*/i, "")}`)
    .join("\n");
  const finalCode = finalStep?.resultCode?.trim();
  const code = finalCode ? `\n\n## The finished code\n\n\`\`\`${markdownLanguage(finalStep?.language || "text")}\n${finalCode}\n\`\`\`` : "";
  return {
    type: "summary",
    markdown: `## Workshop complete\n\nYou finished **${block.title}**. ${block.summary}\n\n## What the code now does\n\n${changes || "- It combines the workshop's small edits into one working behavior."}${code}\n\n## Why this matters\n\nThis is the complete pattern you practiced, not another coding task. You can ask the tutor to explain any line before moving to the next checkpoint.`
  };
}

function renderCompactWorkshopStep(
  step: GeneratedWorkshopStep,
  stepIndex: number
) {
  const code = extractWorkshopCodeChange(step.starterCode, step.resultCode || "");
  const codeSection = code
    ? `\n\n## Type this\n\n\`\`\`${markdownLanguage(step.language)}\n${code}\n\`\`\``
    : "";
  const explanation = cleanLearnerText(step.codeExplanation || explainWorkshopCodeChange(code, step.language, step.expectedChange));
  const explanationSection = explanation ? `\n\n${explanation}` : "";
  return `\n\n## Step ${stepIndex + 1}\n\n${normalizeWorkshopPromptForDisplay(step.prompt, step.language)}${codeSection}${explanationSection}`;
}

function extractWorkshopCodeChange(starterCode: string, resultCode: string) {
  if (!resultCode.trim()) return "";
  const before = starterCode.replace(/\r\n/g, "\n").split("\n");
  const after = resultCode.replace(/\r\n/g, "\n").split("\n");
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;
  return after.slice(prefix, after.length - suffix).join("\n").trim();
}

function explainWorkshopCodeChange(code: string, language: string, expectedChange?: string) {
  const line = code.trim();
  if (!line) return cleanLearnerText(expectedChange || "Make only the requested micro-change.");
  if (/^import\s+[A-Za-z_][\w.]*/.test(line)) {
    const packageName = line.match(/^import\s+([A-Za-z_][\w.]*)/)?.[1] ?? "the package";
    return `\`import\` loads code from the \`${packageName}\` package so this file can use its tools.`;
  }
  if (/^[A-Za-z_]\w*\s*=/.test(line)) {
    const name = line.match(/^([A-Za-z_]\w*)/)?.[1] ?? "The name";
    return `\`${name}\` stores the value produced on the right side of \`=\`, so later steps can reuse it.`;
  }
  if (/^while\s+.+:/.test(line)) return "`while` repeats the indented code while its condition stays true. The colon starts that loop block.";
  if (/\w+\.\w+\s*\(/.test(line)) return "The dot selects a tool from the object or package. Parentheses call that tool with the values inside them.";
  return cleanLearnerText(expectedChange || `This is the only new ${language} code required in this step.`);
}

function workshopSuggestedQuestions(step: Extract<GeneratedCourseStep, { type: "workshop" | "lab" | "project" }>) {
  const generated = step.suggestedQuestions?.map(cleanLearnerText).filter(Boolean).slice(0, 3) ?? [];
  const defaults = [
    "Explain the new code line",
    "Why does this step come next?",
    "What happens if I change this value?"
  ];
  return [...new Set([...generated, ...defaults])].slice(0, 3);
}

function markdownLanguage(language: string) {
  return language.toLowerCase().replace(/[^a-z0-9+#]/g, "") || "text";
}

function normalizeTheoryMarkdownForDisplay(markdown: string, courseSubject: string) {
  let text = cleanLearnerText(markdown);
  if (/c#|csharp|dotnet/i.test(courseSubject)) {
    text = text
      .replace(/\bA C example\b/g, "A C# example")
      .replace(/\bA C program\b/g, "A C# program")
      .replace(/\bIn C,\b/g, "In C#,")
      .replace(/\bC can\b/g, "C# can");
  }
  return text;
}

function normalizeExerciseContextForDisplay(context: string | undefined, language: string) {
  const cleaned = context ? cleanLearnerText(context) : "";
  if (/input-rule-output loop|turns that exact idea into one tiny editable file/i.test(cleaned)) {
    return `Before any bigger project, this step teaches the smallest ${language} habit: make one result visible, then read each line so later workshops and labs are not guessing.`;
  }
  if (/same feedback-loop pattern as the workshop/i.test(cleaned)) {
    return `This lab uses the same ${language} pattern as the workshop, but as a different variant with less guidance. Nothing here should require a new concept.`;
  }
  return cleaned;
}

function normalizeWorkshopPromptForDisplay(prompt: string, language: string) {
  let text = cleanLearnerText(prompt)
    .replace(/\bLoad the starter file,?\s*/gi, "The starter is already in the editor. ")
    .replace(/\bLoad the starter in the editor if it is not loaded yet\.?\s*/gi, "")
    .replace(/\bSubmit the editor code\b/gi, "Press Check");

  if (language.toLowerCase() === "c#") {
    text = text
      .replace(/\bIn C,\s*printf\b/g, "In C#, `Console.WriteLine`")
      .replace(/\bprintf\b/g, "`Console.WriteLine`")
      .replace(/\bA C program\b/g, "A C# program")
      .replace(/\bC example\b/g, "C# example");
  }
  return text;
}

function normalizeGeneratedExerciseStep(
  step: Extract<GeneratedCourseStep, { type: "workshop" | "lab" | "project" }>,
  courseSubject: string
): Extract<GeneratedCourseStep, { type: "workshop" | "lab" | "project" }> {
  const resolvedLanguage = resolveGeneratedExerciseLanguage(step.language, courseSubject, step.filePath);
  const languageDefaults = generatedLanguageDefaults(resolvedLanguage);
  const resolvedFilePath = resolveEditorLanguage(step.filePath).id === resolveEditorLanguage(resolvedLanguage).id
    ? step.filePath
    : languageDefaults.filePath;
  const starterCode = isMismatchedStarterForDisplay(step.starterCode, resolvedLanguage)
    ? languageDefaults.starterCode
    : step.starterCode;
  const acceptanceCriteria = normalizeAcceptanceCriteriaForDisplay(step.acceptanceCriteria, resolvedLanguage, step.type);
  const workspaceFiles = (step.workspaceFiles ?? []).map((file) => file.path === step.filePath
    ? { ...file, path: resolvedFilePath, content: starterCode }
    : file);
  const languageId = resolveEditorLanguage(resolvedFilePath).id;
  const hasBrowserEntrypoint = workspaceFiles.some((file) => /\.html?$/i.test(file.path)) || languageId === "html";
  const supportsRealBrowserOutput = hasBrowserEntrypoint && ["html", "css", "javascript"].includes(languageId);
  const externalEngine = /\b(unity|unreal|godot|roblox|cryengine|gamemaker|blender)\b/i.test(`${courseSubject} ${step.context ?? ""}`);
  const requiresPreview = Boolean(step.requiresPreview && supportsRealBrowserOutput && !externalEngine);
  const requiresTerminal = Boolean(step.requiresTerminal && !externalEngine);

  return {
    ...step,
    language: resolvedLanguage,
    filePath: resolvedFilePath,
    starterCode,
    workspaceFiles,
    requiresPreview,
    requiresTerminal,
    workspaceView: !requiresTerminal && step.workspaceView === "terminal"
      ? "code"
      : !requiresPreview && step.workspaceView === "preview"
        ? "code"
        : step.workspaceView,
    acceptanceCriteria
  };
}

function resolveGeneratedExerciseLanguage(language: string, courseSubject: string, filePath: string) {
  const declared = resolveEditorLanguage(language);
  if (declared.id !== "plaintext") return declared.displayName;
  const explicit = resolveEditorLanguage(filePath || language);
  if (explicit.id !== "plaintext") return explicit.displayName;
  const fromCourse = resolveEditorLanguage(courseSubject);
  return fromCourse.id !== "plaintext" ? fromCourse.displayName : language || "JavaScript";
}

function generatedLanguageDefaults(language: string) {
  return {
    filePath: defaultFilePath(language),
    starterCode: defaultStarterCode(language)
  };
}

function isMismatchedStarterForDisplay(code: string, language: string) {
  const normalized = code.toLowerCase();
  if (!normalized.trim()) return false;
  if (language.toLowerCase() === "c#") return /\bprintf\s*\(|#include\s*<stdio\.h>|int\s+main\s*\(/.test(normalized);
  return false;
}

function normalizeAcceptanceCriteriaForDisplay(criteria: string[], language: string, type: GeneratedCourseStep["type"]) {
  const cleaned = criteria.map(cleanLearnerText).filter(Boolean);
  if (type !== "workshop") return cleaned.length ? cleaned : ["Code solves the stated task", "Result is visible"];
  const outputCall = outputCallForLanguage(language);
  const fallback = [
    `Uses ${outputCall} for visible output`,
    "Keeps previous workshop behavior",
    "Adds only the requested small change"
  ];
  return (cleaned.length ? cleaned : fallback).map((criterion) =>
    criterion
      .replace(/\bprintf\b/g, outputCall)
      .replace(/\bconsole logs?\b/gi, `${outputCall} output`)
      .replace(/\blog\b/gi, "show")
  );
}

function outputCallForLanguage(language: string) {
  const label = language.toLowerCase();
  if (label === "c#") return "Console.WriteLine";
  if (label === "java") return "System.out.println";
  if (label === "python") return "print";
  if (label === "c++") return "std::cout";
  if (label === "go") return "fmt.Println";
  if (label === "rust") return "println!";
  if (label === "kotlin" || label === "julia") return "println";
  if (label === "dart" || label === "swift" || label === "r") return "print";
  if (label === "ruby") return "puts";
  if (label === "php") return "echo";
  if (label === "fortran") return "print";
  if (label === "cobol") return "DISPLAY";
  if (label === "basic") return "PRINT";
  if (label === "sql") return "SELECT";
  return "console.log";
}

function cleanLearnerText(value: string) {
  return value
    .split("\n")
    .filter((line) => !/\b(internal|hidden reasoning|system instruction|prompt rule|do not output|before generating|assessment intent)\b/i.test(line))
    .join("\n")
    .trim();
}

function startsWithHeading(markdown: string, title: string) {
  const firstLine = markdown.trim().split("\n")[0]?.replace(/^#+\s*/, "").trim().toLowerCase();
  return Boolean(firstLine && title.trim() && firstLine.includes(title.trim().toLowerCase()));
}

function stepLessonTitle(blockTitle: string, type: GeneratedCourseStep["type"]) {
  if (type === "mcq") return `${blockTitle} practice`;
  if (type === "reflection") return `${blockTitle} written practice`;
  if (type === "workshop" || type === "lab" || type === "project") return `${blockTitle} editor exercise`;
  return blockTitle;
}

function generatedSectionToLessons(section: GeneratedCourseSection, chapterId: string, sectionIndex: number): LessonStep[] {
  if (!section.blocks.length) return [generatedBlockToLesson(section, chapterId, null, 0, sectionIndex)];
  return section.blocks.map((block, blockIndex) => generatedBlockToLesson(section, chapterId, block, blockIndex, sectionIndex));
}

function generatedBlockToLesson(section: GeneratedCourseSection, chapterId: string, block: GeneratedCourseBlock | null, blockIndex: number, sectionIndex: number): LessonStep {
  const mcq = block?.type === "mcq" ? block : null;
  const chatExercise = block?.type === "chat_exercise" ? block : null;
  const codeExercise = block?.type === "code_exercise" ? block : null;
  const kind: LessonStep["kind"] = codeExercise
    ? "terminal-exercise"
    : mcq
      ? "multiple-choice"
      : chatExercise
        ? "chat-exercise"
        : block?.type === "canvas" || block?.type === "code_showcase"
          ? "canvas"
          : "theory";

  return {
    kind,
    label: kind === "theory" ? "Theory" : kind === "canvas" ? "Visual explanation" : "Exercise",
    title: block ? blockTitle(section.title, block.type) : section.title,
    tutor: renderGeneratedBlock(section, block, chapterId, sectionIndex, blockIndex),
    suggestions: ["Explain this slower", "Give me a small hint", "What should I do next?"],
    sectionId: block ? `${section.id}:${blockIndex}` : section.id,
    chapterId,
    generatedBlocks: block ? [block] : [],
    codeExercise: codeExercise ? { ...codeExercise, exerciseKind: "lab" } : undefined,
    correctOptionIndex: mcq?.correctOptionIndex,
    mcqExplanation: mcq?.explanation,
    language: codeExercise?.language ?? "JavaScript",
    difficulty: "Beginner",
    xp: kind === "theory" || kind === "canvas" ? undefined : 10,
    options: mcq?.options.map((label) => ({ label })) ?? []
  };
}

function renderGeneratedBlock(section: GeneratedCourseSection, block: GeneratedCourseBlock | null, chapterId: string, sectionIndex: number, blockIndex: number) {
  if (!block) {
    return `## ${section.title}\n\nThis section outline is ready. Your personal AI Tutor will generate the full lesson when the chapter unlocks.`;
  }

  if (block.type === "theory" || block.type === "extra_explanation" || block.type === "canvas" || block.type === "code_showcase") {
    const greeting = sectionIndex === 0 && blockIndex === 0 && chapterId === "chapter-1"
      ? `## ${section.title}\n\nThis opening chapter gives you the mental model behind ${section.title} before you write code. You will connect each new idea to a concrete example, then use it in guided practice later in the course.\n\n`
      : sectionIndex === 0 && blockIndex === 0 && !startsWithHeading(block.markdown, section.title)
        ? `## ${section.title}\n\n`
      : "";
    return `${greeting}${block.markdown}`;
  }
  if (block.type === "mcq") {
    return `## Topic practice\n\n${block.prompt}`;
  }
  if (block.type === "chat_exercise") {
    return `## Answer in chat\n\n${block.prompt}`;
  }
  if (block.type === "code_exercise") {
    return `## Code exercise\n\n${block.prompt}`;
  }
  return "";
}

function blockTitle(sectionTitle: string, type: GeneratedCourseBlock["type"]) {
  if (type === "mcq") return `${sectionTitle} practice`;
  if (type === "chat_exercise") return `${sectionTitle} written practice`;
  if (type === "code_exercise") return `${sectionTitle} editor exercise`;
  return sectionTitle;
}
