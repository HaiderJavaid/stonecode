import { Course, GeneratedCourseBlock, GeneratedCourseSection, GeneratedCourseStep } from "@/data/courses";

export type LessonDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type LessonOption = {
  label: string;
};

export type LessonCodeExercise = {
  type: "code_exercise";
  language: string;
  filePath: string;
  prompt: string;
  starterCode: string;
  acceptanceCriteria: string[];
  context?: string;
  requiresPreview?: boolean;
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
    language: "Python",
    difficulty: "Intermediate",
    xp: 25,
    tutor: `## Complete this in the editor

Create \`practice/queue.py\` and implement a queue with:

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
  if (course.courseContent.schemaVersion === "course-content/v2") {
    const generatedSteps = course.courseContent.modules.flatMap((module, moduleIndex) =>
      module.topics.flatMap((topic, topicIndex) =>
        topic.blocks.flatMap((block) =>
          block.steps.map((step, stepIndex) => generatedCourseStepToLesson({
            blockId: block.id,
            blockKind: block.kind,
            blockTitle: block.title,
            blockSummary: block.summary,
            blockStepCount: block.steps.length,
            courseSubject: course.subject,
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
  blockKind,
  blockTitle: title,
  blockSummary,
  blockStepCount,
  courseSubject,
  moduleIndex,
  moduleId,
  step,
  stepIndex,
  topicId,
  topicTitle,
  topicIndex
}: {
  blockId: string;
  blockKind: string;
  blockTitle: string;
  blockSummary: string;
  blockStepCount: number;
  courseSubject: string;
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
    label: kind === "theory" ? "Theory" : "Exercise",
    title: stepLessonTitle(title, step.type),
    tutor: renderGeneratedCourseStep(title, blockSummary, displayStep, topicTitle, moduleIndex, topicIndex, stepIndex, courseSubject),
    suggestions: ["Explain this slower", "Give me a simple example", "What should I remember?"],
    sectionId: `${moduleId}:${topicId}:${blockId}:${stepIndex}`,
    moduleId,
    topicId,
    codeExercise: codeExercise
      ? {
          type: "code_exercise",
          language: codeExercise.language,
          filePath: codeExercise.filePath,
          prompt: codeExercise.prompt,
          starterCode: codeExercise.starterCode,
          acceptanceCriteria: codeExercise.acceptanceCriteria,
          context: codeExercise.context,
          requiresPreview: codeExercise.requiresPreview
        }
      : undefined,
    blockId,
    blockKind,
    blockStepIndex: stepIndex,
    blockStepCount,
    correctOptionIndex: mcq?.correctOptionIndex,
    mcqExplanation: mcq?.explanation,
    language: codeExercise?.language ?? "JavaScript",
    difficulty: "Beginner",
    xp: kind === "theory" ? undefined : codeExercise ? 20 : 10,
    options: mcq?.options.map((label) => ({ label })) ?? []
  };
}

function renderGeneratedCourseStep(blockTitle: string, blockSummary: string, step: GeneratedCourseStep, topicTitle: string, moduleIndex: number, topicIndex: number, stepIndex: number, courseSubject: string) {
  if (step.type === "theory" || step.type === "analogy" || step.type === "example" || step.type === "summary") {
    const greeting = moduleIndex === 0 && topicIndex === 0 && stepIndex === 0
      ? "## Welcome\n\nHi, I'm your personal AI Tutor for this course. We'll start slowly and keep each check tied to what you just learned.\n\n"
      : stepIndex === 0 && !startsWithHeading(step.markdown, topicTitle)
        ? `## ${topicTitle}\n\n`
        : "";
    return `${greeting}${normalizeTheoryMarkdownForDisplay(step.markdown, courseSubject)}`;
  }
  if (step.type === "mcq") return `## Quick check\n\n${cleanLearnerText(step.prompt)}`;
  if (step.type === "reflection") return `## Answer in chat\n\n${cleanLearnerText(step.prompt)}`;
  if (step.type === "workshop" || step.type === "lab" || step.type === "project") {
    const contextText = normalizeExerciseContextForDisplay(step.context, step.language);
    const context = contextText ? `\n\n## Context\n\n${contextText}` : "";
    const buildHeading = step.type === "workshop" ? "## What we are building" : "## What you are solving";
    const tutorial = step.type === "workshop"
      ? `\n\n## Step ${stepIndex + 1}\n\n${normalizeWorkshopPromptForDisplay(step.prompt, step.language)}${buildSyntaxReminder(step.language, step.starterCode)}\n\n## What the code means\n\n${explainStarterCode(step.language, step.starterCode)}\n\n## Your exact move\n\n${buildWorkshopMove(step)}`
      : `\n\n## Task\n\n${cleanLearnerText(step.prompt)}${buildSyntaxReminder(step.language, step.starterCode)}`;
    const previewNote = step.requiresPreview ? "\n\n## Visual check\n\nAfter editing, switch the center editor to Visual view and inspect the change before submitting." : "";
    return `${buildHeading}${context}${tutorial}${previewNote}\n\n**Use Check to verify the middle editor. When every checklist item passes, the button becomes Submit and next.**\n\n## MVP checklist\n\n${step.acceptanceCriteria.map((criterion) => `- ${cleanLearnerText(criterion)}`).join("\n")}`;
  }
  return `## ${blockTitle}\n\n${blockSummary}`;
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

function buildWorkshopMove(step: Extract<GeneratedCourseStep, { type: "workshop" | "lab" | "project" }>) {
  if (step.type !== "workshop") return cleanLearnerText(step.prompt);
  const prompt = normalizeWorkshopPromptForDisplay(step.prompt, step.language);
  const actionSentence = prompt
    .split(/(?<=[.!?])\s+/)
    .reverse()
    .find((sentence) => /\b(add|change|replace|write|create|call|print|show|return|check|move|wrap|put)\b/i.test(sentence))
    ?? "Make the one code change requested for this step.";
  return [
    `1. In the editor, make this one change: ${actionSentence}`,
    "2. Keep the earlier workshop code unless this step explicitly tells you to change it.",
    "3. Press Check. Use the checklist feedback to fix only the missing items.",
    "4. When every item passes, submit and continue."
  ].join("\n");
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
  const starterCode = isMismatchedStarterForDisplay(step.starterCode, resolvedLanguage)
    ? languageDefaults.starterCode
    : step.starterCode;
  const acceptanceCriteria = normalizeAcceptanceCriteriaForDisplay(step.acceptanceCriteria, resolvedLanguage, step.type);

  return {
    ...step,
    language: resolvedLanguage,
    filePath: languageDefaults.filePath,
    starterCode,
    acceptanceCriteria
  };
}

function resolveGeneratedExerciseLanguage(language: string, courseSubject: string, filePath: string) {
  const target = `${courseSubject} ${language} ${filePath}`.toLowerCase();
  if (/c#|csharp|dotnet|\.cs\b/.test(target)) return "C#";
  if (/c\+\+|cpp|cplusplus|\.cpp\b|\.cc\b|\.cxx\b/.test(target)) return "C++";
  if (/\bjava\b|\.java\b/.test(target)) return "Java";
  if (/python|\.py\b/.test(target)) return "Python";
  if (/typescript|\.ts\b/.test(target)) return "TypeScript";
  if (/javascript|\bjs\b|\.js\b/.test(target)) return "JavaScript";
  if (/\bgo\b|golang|\.go\b/.test(target)) return "Go";
  if (/rust|\.rs\b/.test(target)) return "Rust";
  if (/php|\.php\b/.test(target)) return "PHP";
  if (/ruby|\.rb\b/.test(target)) return "Ruby";
  if (/swift|\.swift\b/.test(target)) return "Swift";
  if (/sql|\.sql\b/.test(target)) return "SQL";
  return language || "JavaScript";
}

function generatedLanguageDefaults(language: string) {
  const label = language.toLowerCase();
  if (label === "c#") {
    return {
      filePath: "Program.cs",
      starterCode: "using System;\n\nclass Program {\n  static string Describe(string value) {\n    return \"Value: \" + value;\n  }\n\n  static void Main() {\n    Console.WriteLine(Describe(\"stone\"));\n  }\n}\n"
    };
  }
  if (label === "c++") {
    return {
      filePath: "main.cpp",
      starterCode: "#include <iostream>\n#include <string>\n\nstd::string describe(const std::string& value) {\n  return \"Value: \" + value;\n}\n\nint main() {\n  std::cout << describe(\"stone\") << std::endl;\n  return 0;\n}\n"
    };
  }
  if (label === "java") {
    return {
      filePath: "Main.java",
      starterCode: "public class Main {\n  static String describe(String value) {\n    return \"Value: \" + value;\n  }\n\n  public static void main(String[] args) {\n    System.out.println(describe(\"stone\"));\n  }\n}\n"
    };
  }
  if (label === "python") {
    return { filePath: "main.py", starterCode: "def describe(value):\n    return f\"Value: {value}\"\n\nprint(describe(\"stone\"))\n" };
  }
  return {
    filePath: label === "typescript" ? "main.ts" : "main.js",
    starterCode: "function describe(value) {\n  return `Value: ${value}`;\n}\n\nconsole.log(describe('stone'));\n"
  };
}

function isMismatchedStarterForDisplay(code: string, language: string) {
  const normalized = code.toLowerCase();
  if (!normalized.trim()) return true;
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
  return "console.log";
}

function buildSyntaxReminder(language: string, starterCode: string) {
  const notes = languageSyntaxNotes(language, starterCode);
  if (!notes.length) return "";
  return `\n\n## Syntax you need first\n\n${notes.map((note) => `- ${note}`).join("\n")}`;
}

function languageSyntaxNotes(language: string, starterCode: string) {
  const label = language.toLowerCase();
  if (label === "java") {
    return [
      "`class` means a container for Java code.",
      "`public static void main(String[] args)` is the method Java runs first.",
      "`System.out.println(...)` prints visible output.",
      "Parentheses `(...)` hold input for a method call.",
      "Curly braces `{ ... }` mark where a class or method starts and ends.",
      "A semicolon `;` ends one Java instruction."
    ];
  }
  if (label === "python") {
    return [
      "`print(...)` shows visible output.",
      "Parentheses `(...)` hold input for a function call.",
      "`def` creates a named function.",
      "Indentation shows which lines belong inside a block."
    ];
  }
  if (label === "c++") {
    return [
      "`#include <iostream>` loads console input/output tools.",
      "`int main()` is where a C++ program starts.",
      "`std::cout` prints visible output.",
      "Curly braces `{ ... }` mark a block of code.",
      "A semicolon `;` ends one C++ instruction."
    ];
  }
  if (label === "c#") {
    return [
      "`using System;` imports the basic console tools.",
      "`class Program` is a container for this small C# program.",
      "`static void Main()` is where this beginner console program starts running.",
      "`Console.WriteLine(...)` prints visible output.",
      "Parentheses `(...)` hold input for a method call.",
      "Curly braces `{ ... }` mark where a class or method starts and ends.",
      "A semicolon `;` ends one C# instruction."
    ];
  }
  if (label === "javascript" || label === "typescript") {
    return [
      "`console.log(...)` prints visible output.",
      "Quotes mark text values.",
      "Parentheses `(...)` pass input into a function call.",
      "Curly braces `{ ... }` group code that belongs together."
    ];
  }
  if (starterCode.trim()) {
    return [
      "Read one line at a time before editing.",
      "Find the line that produces visible output.",
      "Change the smallest piece needed for this step."
    ];
  }
  return [];
}

function explainStarterCode(language: string, starterCode: string) {
  if (!starterCode.trim()) {
    return "This step starts from an empty file. Add only the code requested above, then submit it.";
  }
  const label = language.toLowerCase();
  if (label === "java") return explainJavaStarter(starterCode);
  if (label === "python") return explainPythonStarter(starterCode);
  if (label === "c++") return explainCppStarter(starterCode);
  if (label === "c#") return explainCsharpStarter(starterCode);
  if (label === "javascript" || label === "typescript") return explainJavaScriptStarter(starterCode);
  return explainGenericStarter(starterCode);
}

function explainJavaStarter(starterCode: string) {
  const notes = [
    "`public class Main` names the Java class. In this editor, `Main` matches `Main.java`.",
    "`{` and `}` are braces. They show where the class or method body begins and ends.",
    "`public static void main(String[] args)` is the entry point. Java starts running inside this method.",
    "`String` means text. A `String value` parameter is text given to a method.",
    "`return` sends a result back from a method.",
    "`System.out.println(...)` prints something so you can inspect the output.",
    "`;` ends a Java statement, like a period ending a sentence."
  ];
  return `${notes.map((note) => `- ${note}`).join("\n")}\n\nSmall starter excerpt:\n\n\`\`\`java\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function explainPythonStarter(starterCode: string) {
  const notes = [
    "`def` creates a function, which is a named reusable rule.",
    "The name before `(...)` is the function name.",
    "Text inside quotes is a string.",
    "`return` sends a result back from a function.",
    "`print(...)` shows the result so you can inspect it.",
    "Indentation matters in Python because indented lines belong inside the function."
  ];
  return `${notes.map((note) => `- ${note}`).join("\n")}\n\nSmall starter excerpt:\n\n\`\`\`python\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function explainCppStarter(starterCode: string) {
  const notes = [
    "`#include <iostream>` loads the console output tool.",
    "`int main()` is where the program starts.",
    "`std::cout` prints visible output.",
    "`return` sends a result back from a function.",
    "`{ ... }` marks a block of code.",
    "`;` ends one instruction."
  ];
  return `${notes.map((note) => `- ${note}`).join("\n")}\n\nSmall starter excerpt:\n\n\`\`\`cpp\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function explainCsharpStarter(starterCode: string) {
  const notes = [
    "`using System;` lets this file use `Console`, the built-in console output tool.",
    "`class Program` names the code container. For now, think of it as the box that holds your program.",
    "`static void Main()` is the starting method. C# begins running inside these braces.",
    "`static string Describe(string value)` creates a reusable method named `Describe`.",
    "`string value` means the method receives text and calls that text `value` inside the method.",
    "`return` sends a result back out of the method.",
    "`Console.WriteLine(...)` prints a result so you can inspect it.",
    "`+` joins text together here, and `;` ends the instruction."
  ];
  return `${notes.map((note) => `- ${note}`).join("\n")}\n\nSmall starter excerpt:\n\n\`\`\`csharp\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function explainJavaScriptStarter(starterCode: string) {
  const notes = [
    "`function` creates a named reusable rule.",
    "`return` sends a result back from the function.",
    "`console.log(...)` prints visible output.",
    "Quotes mark text values.",
    "`{ ... }` groups code that belongs together."
  ];
  return `${notes.map((note) => `- ${note}`).join("\n")}\n\nSmall starter excerpt:\n\n\`\`\`javascript\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function explainGenericStarter(starterCode: string) {
  return `Read this starter one line at a time. First find the input, then the rule, then the visible output.\n\n\`\`\`\n${trimStarterExcerpt(starterCode)}\n\`\`\``;
}

function trimStarterExcerpt(starterCode: string) {
  return starterCode.trim().split("\n").slice(0, 12).join("\n");
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
  if (type === "mcq") return `${blockTitle} check`;
  if (type === "reflection") return `${blockTitle} written check`;
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
    codeExercise: codeExercise ?? undefined,
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
      ? "## Welcome\n\nHi, I'm your personal AI Tutor for this course. We'll start slowly: first the idea, then an analogy, then a simple example. No exercise yet.\n\n"
      : sectionIndex === 0 && blockIndex === 0 && !startsWithHeading(block.markdown, section.title)
        ? `## ${section.title}\n\n`
      : "";
    return `${greeting}${block.markdown}`;
  }
  if (block.type === "mcq") {
    return `## Quick check\n\n${block.prompt}`;
  }
  if (block.type === "chat_exercise") {
    return `## Answer in chat\n\n${block.prompt}`;
  }
  if (block.type === "code_exercise") {
    return `## Code exercise\n\n${block.prompt}\n\n**Submit from the middle editor.**\n\n${block.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")}`;
  }
  return "";
}

function blockTitle(sectionTitle: string, type: GeneratedCourseBlock["type"]) {
  if (type === "mcq") return `${sectionTitle} check`;
  if (type === "chat_exercise") return `${sectionTitle} written check`;
  if (type === "code_exercise") return `${sectionTitle} editor exercise`;
  return sectionTitle;
}
