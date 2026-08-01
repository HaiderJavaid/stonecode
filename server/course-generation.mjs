import {
  blockKindsInModuleOutline,
  buildBlockGenerationPrompt,
  extractModuleOutline,
  normalizeBlockKindName
} from "./course-generation/block-contracts.mjs";
import {
  buildLearnerGenerationContext,
  formatStaticCourseGenerationContext,
  retrieveStaticCourseGenerationContext
} from "./course-generation/generation-context.mjs";
import {
  formatEditableCourseGenerationRules,
  readEditableCourseGenerationRules
} from "./course-generation/editable-rules.mjs";
import {
  classifyCourseIntent,
  courseLanguageCapabilities,
  inferGeneratedLanguages,
  inferGeneratedSubject,
  isSupportedProgrammingSubject,
  resolveCourseLanguageCapability
} from "./course-generation/language-capabilities.mjs";
import { browserFrameworkCatalog } from "../shared/stonecode-product.mjs";

const browserFrameworkRuntimeContract = JSON.stringify(browserFrameworkCatalog);

export {
  buildBlockGenerationPrompt,
  buildLearnerGenerationContext,
  readEditableCourseGenerationRules,
  retrieveStaticCourseGenerationContext
};

const contentSchemaVersion = "course-content/v1";
const contentSchemaVersionV2 = "course-content/v2";
const minimumWorkshopStepCount = 4;

export function createFallbackAssessmentQuestion({ subject, step = 0 }) {
  const normalizedSubject = trimText(subject, "Programming");
  const target = resolveAssessmentQuestionTarget({ subject: normalizedSubject, step, answers: [] });
  return buildFallbackPrerequisiteQuestion({ subject: normalizedSubject, target, step });
}

function buildFallbackPrerequisiteQuestion({ subject, target, step = 0 }) {
  const areaTitle = target.area.title;
  const question = target.area.questions[target.difficulty] ?? target.area.questions.entry;
  return rotateCorrectOption({
    id: `assessment-${target.area.id}-${target.difficulty}-${step + 1}`,
    type: "mcq",
    questionKind: "prerequisite",
    assessmentArea: target.area.id,
    difficulty: target.difficulty,
    prompt: question.prompt(subject, areaTitle),
    options: question.options,
    correctOptionIndex: 0
  }, `${subject}:${target.area.id}:${target.difficulty}:${step}`);
}

function fallbackGenericAssessmentAreas(subject) {
  const normalizedSubject = trimText(subject, "Programming");
  return [
    {
      id: "programming-model",
      title: `${normalizedSubject} readiness`,
      questions: {
        mid: {
          prompt: (course) => `In a small ${course} example, you see input, a rule, and output. What should you trace first?`,
          options: ["One concrete input through the rule to the output", "Every term in the lesson before checking behavior", "The editor settings before reading the code", "A larger example before the small one"]
        },
        basic: {
          prompt: (course) => `A ${course} line creates a visible result. What is the most useful beginner check?`,
          options: ["Read the line and predict the visible result", "Rename the file before running anything", "Skip the line and read the next module", "Memorize the punctuation without output"]
        },
        entry: {
          prompt: (course) => `Before a ${course} workshop starts, what should the course explain first?`,
          options: ["What each new word or symbol is doing", "Only the final project goal", "Framework setup before the first line", "Advanced patterns before simple output"]
        }
      }
    }
  ];
}

export function stabilizeAssessmentQuestion({ question, subject, step = 0, answers = [] }) {
  const normalizedSubject = trimText(subject, "Programming");
  const target = resolveAssessmentQuestionTarget({ subject: normalizedSubject, step, answers });
  const prerequisitePrompts = answers
    .filter((answer) => answer?.questionKind !== "course_shaping")
    .map((answer) => trimText(answer.prompt, "").toLowerCase());
  const prompt = trimText(question?.prompt, "").toLowerCase();
  const repeatedPrereqAngle = question?.questionKind !== "course_shaping"
    && prerequisitePrompts.some((previous) => previous && promptsOverlap(previous, prompt));

  const wrongTarget = question?.assessmentArea && question.assessmentArea !== target.area.id
    || question?.difficulty && question.difficulty !== target.difficulty;

  if (repeatedPrereqAngle || question?.questionKind === "course_shaping" || wrongTarget) {
    return buildFallbackPrerequisiteQuestion({ subject: normalizedSubject, target, step });
  }

  return {
    ...question,
    questionKind: "prerequisite",
    assessmentArea: question?.assessmentArea ?? target.area.id,
    difficulty: question?.difficulty ?? target.difficulty
  };
}

export function resolveAssessmentPlan(subject) {
  const normalizedSubject = trimText(subject, "Programming");
  const intent = classifyCourseIntent(normalizedSubject);
  const supported = isSupportedProgrammingSubject(normalizedSubject);
  const areas = resolvePrerequisiteAreas(normalizedSubject);
  const requiresAssessment = supported && intent.requiresAssessment;
  return {
    supported,
    requiresAssessment,
    intentKind: intent.kind,
    reason: !supported
      ? "Stonecode currently supports programming, software, scripting, and code-related courses only."
      : requiresAssessment
      ? `${normalizedSubject} depends on prerequisite knowledge before the course can be shaped well.`
      : `${normalizedSubject} can start from foundations without a prerequisite assessment.`,
    areas
  };
}

export function buildAssessmentPlanPrompt({ subject, learnerProfile = null, retrievedContext = [] }) {
  return `Create the Stonecode assessment plan for a requested learning subject.

Return JSON only:
{
  "supported":true,
  "reason":"short explanation",
  "targetSubject":"normalized programming subject",
  "courseCategory":"fundamentals",
  "requiresAssessment":true,
  "prerequisiteAreas":[
    {"id":"javascript","title":"JavaScript basics","reason":"why this is needed","startingDifficulty":"mid"}
  ]
}

Rules:
- Non-code subjects are unavailable. Stonecode supports programming, software, scripting, developer tools, web/app/game development, automation, data/code, and framework/library courses.
- A standalone programming language course starts from foundations and does not require prerequisite assessment. Examples: Python, Java, C++, C#, Kotlin, Swift, Dart, Go, Rust, Ruby, PHP, R, Julia, Fortran, COBOL, and BASIC.
- Frameworks, libraries, advanced language specializations, and broad applied paths require prerequisite assessment even when the learner is a beginner.
- Choose prerequisite areas dynamically for the requested subject. Do not always check HTML, CSS, and JavaScript.
- Examples: React needs JavaScript plus HTML/CSS basics; Next.js needs JavaScript, React, and request/response basics; C++ game development needs C++ syntax, variables, and functions; Unity scripting needs C# syntax, variables, functions, and component thinking.
- Each prerequisite area should become an assessment topic if requiresAssessment is true.
- startingDifficulty must be "entry", "basic", or "mid".
- Keep ids lowercase stable slugs.

Subject: ${trimText(subject, "Programming")}
Learner profile: ${JSON.stringify(learnerProfile ?? {}).slice(0, 1200)}
Retrieved context: ${formatStaticCourseGenerationContext(retrievedContext).slice(0, 1800)}
${formatEditableCourseGenerationRules(3000)}`;
}

export function normalizeAssessmentPlan(input, fallbackSubject = "Programming") {
  const fallback = resolveAssessmentPlan(fallbackSubject);
  const supported = typeof input?.supported === "boolean" ? input.supported : fallback.supported;
  const rawTargetSubject = trimText(fallbackSubject, "Programming");
  const targetIntent = classifyCourseIntent(rawTargetSubject);
  const targetSubject = targetIntent.kind === "language-fundamentals" && targetIntent.language
    ? targetIntent.language.label
    : rawTargetSubject;
  const courseCategory = normalizeCourseCategory(input?.courseCategory);
  const generatedPrerequisiteAreas = Array.isArray(input?.prerequisiteAreas)
    ? input.prerequisiteAreas.map((area, index) => normalizeAssessmentPlanArea(area, index)).filter(Boolean).slice(0, 8)
    : fallback.areas.map((area) => ({
        id: area.id,
        title: area.title,
        reason: `Required prerequisite signal for ${targetSubject}.`,
        startingDifficulty: "mid"
      }));
  const policy = resolveAssessmentPlan(targetSubject);
  const prerequisiteAreas = /\bpygame\b/i.test(targetSubject)
    ? policy.areas.map((area) => ({ id: area.id, title: area.title, reason: `Required prerequisite signal for ${targetSubject}.`, startingDifficulty: "mid" }))
    : generatedPrerequisiteAreas;
  const requiresAssessment = supported && policy.requiresAssessment;

  return {
    supported,
    reason: trimText(input?.reason, fallback.reason),
    targetSubject,
    courseCategory,
    requiresAssessment,
    prerequisiteAreas: requiresAssessment ? prerequisiteAreas : []
  };
}

function normalizeAssessmentPlanArea(area, index) {
  if (!area || typeof area !== "object") return null;
  const title = trimText(area.title, `Prerequisite ${index + 1}`);
  return {
    id: slugify(area.id || title),
    title,
    reason: trimText(area.reason, "This prerequisite helps shape the generated course."),
    startingDifficulty: ["entry", "basic", "mid"].includes(area.startingDifficulty) ? area.startingDifficulty : "mid"
  };
}

function normalizeCourseCategory(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["fundamentals", "framework", "library", "game-dev", "web-dev", "backend", "fullstack", "data", "automation", "other-code"].includes(normalized)
    ? normalized
    : "other-code";
}

function resolveAssessmentQuestionTarget({ subject, step = 0, answers = [] }) {
  const areas = resolveAssessmentPlan(subject).areas;
  const prerequisiteAnswers = answers.filter((answer) => answer?.questionKind !== "course_shaping");
  const latest = prerequisiteAnswers.at(-1);
  const latestAreaId = latest?.assessmentArea;
  const latestWeak = latest && (latest.skipped || latest.isCorrect === false);
  if (latestWeak && latestAreaId) {
    const area = areas.find((item) => item.id === latestAreaId) ?? areas[0];
    if (latest.difficulty !== "entry") return { area, difficulty: lowerAssessmentDifficulty(latest.difficulty) };
  }

  for (const area of areas) {
    const areaAnswers = prerequisiteAnswers.filter((answer) => answer.assessmentArea === area.id);
    if (!areaAnswers.some((answer) => answer.isCorrect === true) && areaAnswers.length < 2) {
      return { area, difficulty: areaAnswers.length ? "basic" : "mid" };
    }
  }
  return { area: areas[Math.min(step, areas.length - 1)] ?? areas[0], difficulty: "entry" };
}

function lowerAssessmentDifficulty(difficulty) {
  if (difficulty === "mid") return "basic";
  if (difficulty === "basic") return "entry";
  return "entry";
}

function resolvePrerequisiteAreas(subject) {
  const lower = subject.toLowerCase();
  if (/\bnext\b/.test(lower)) return [javascriptArea(), reactArea(), httpArea()];
  if (/\breact\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea()];
  if (/\bvue|angular|svelte|frontend|web dev|web development\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea()];
  if (/\bfullstack|full-stack\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea(), httpArea(), dataArea()];
  if (/\bnode|express|backend\b/.test(lower)) return [javascriptArea(), httpArea(), dataArea()];
  if (/\bunity\b/.test(lower)) return [csharpSyntaxArea(), variablesArea("C#"), functionsArea("C#")];
  if (/\bpygame\b/.test(lower)) return [pythonSyntaxArea(), variablesArea("Python"), functionsArea("Python")];
  if (/\bunreal\b/.test(lower)) return [cppSyntaxArea(), variablesArea("C++"), functionsArea("C++")];
  if (/\bgodot\b/.test(lower)) return [programmingSyntaxArea("GDScript"), variablesArea("GDScript"), functionsArea("GDScript")];
  if (/\bgame|games|modding|plugin|scripting\b/.test(lower)) return [languageSyntaxArea(subject), variablesArea(subject), functionsArea(subject)];
  if (/\bmachine learning|data science|ai\b/.test(lower)) return [languageSyntaxArea(subject), variablesArea(subject), dataArea()];
  if (/\bautomation|api\b/.test(lower)) return [languageSyntaxArea(subject), variablesArea(subject), httpArea()];
  return fallbackGenericAssessmentAreas(subject);
}

function htmlArea() {
  return {
    id: "html",
    title: "HTML structure",
    questions: {
      mid: {
        prompt: () => "In HTML, which element is normally used for the main visible heading on a page?",
        options: ["<h1>", "<script>", "<style>", "<meta>"]
      },
      basic: {
        prompt: () => "What is HTML mainly responsible for on a web page?",
        options: ["Page structure and content", "Database storage", "Server deployment", "Animation timing"]
      },
      entry: {
        prompt: () => "What does an HTML tag usually mark?",
        options: ["A piece of page content", "A terminal command", "A saved password", "A package version"]
      }
    }
  };
}

function cssArea() {
  return {
    id: "css",
    title: "CSS styling",
    questions: {
      mid: {
        prompt: () => "Which CSS rule changes text color for paragraph elements?",
        options: ["p { color: red; }", "p = red", "<p color='red'>", "text.red(p)"]
      },
      basic: {
        prompt: () => "What is CSS mainly used for?",
        options: ["Styling how page content looks", "Creating database rows", "Writing server routes", "Compiling native apps"]
      },
      entry: {
        prompt: () => "If HTML creates the words on a page, CSS mainly controls what?",
        options: ["How those words and boxes look", "Which account is logged in", "Where the files are hosted", "How passwords are encrypted"]
      }
    }
  };
}

function javascriptArea() {
  return {
    id: "javascript",
    title: "JavaScript basics",
    questions: {
      mid: {
        prompt: () => "What does `const count = 1;` do in JavaScript?",
        options: ["Creates a named value called count", "Prints count automatically", "Creates an HTML heading", "Changes CSS color"]
      },
      basic: {
        prompt: () => "What does `console.log('Hi')` do?",
        options: ["Shows Hi in the console", "Creates a web button", "Saves Hi to a database", "Changes the file name"]
      },
      entry: {
        prompt: () => "In JavaScript, what is a variable name for?",
        options: ["Remembering a value to use later", "Choosing the browser window size", "Installing a package", "Closing the editor"]
      }
    }
  };
}

function reactArea() {
  return {
    id: "react",
    title: "React fundamentals",
    questions: {
      mid: {
        prompt: () => "In React, what is a component mainly used for?",
        options: ["A reusable piece of UI", "A database table", "A CSS color value", "A package lock file"]
      },
      basic: {
        prompt: () => "What does JSX let React code describe?",
        options: ["UI structure using tag-like syntax", "Server passwords", "Git commit history", "Operating system settings"]
      },
      entry: {
        prompt: () => "Before learning Next.js, what React idea is most important to recognize?",
        options: ["UI is built from components", "CSS replaces JavaScript", "Databases draw buttons", "Files run without code"]
      }
    }
  };
}

function httpArea() {
  return {
    id: "http",
    title: "request/response basics",
    questions: {
      mid: {
        prompt: () => "In a web app, what is a request?",
        options: ["A client asking a server for something", "A CSS color change", "A variable name", "A loop ending"]
      },
      basic: {
        prompt: () => "What usually sends a response in a backend app?",
        options: ["The server", "The stylesheet", "The image file", "The keyboard"]
      },
      entry: {
        prompt: () => "Why do frontend and backend code communicate?",
        options: ["To send data or actions between them", "To rename every file", "To turn CSS into HTML", "To avoid using functions"]
      }
    }
  };
}

function programmingSyntaxArea(subject) {
  return {
    id: "syntax",
    title: "basic syntax",
    questions: fallbackGenericAssessmentAreas(subject)[0].questions
  };
}

function languageSyntaxArea(subject) {
  const lower = subject.toLowerCase();
  if (/\bc#|csharp|unity\b/.test(lower)) return csharpSyntaxArea();
  if (/\bc\+\+|cpp|unreal\b/.test(lower)) return cppSyntaxArea();
  if (/\bjava\b/.test(lower)) return javaSyntaxArea();
  if (/\bpython\b/.test(lower)) return pythonSyntaxArea();
  if (/\bjavascript|typescript|node|react|next\b/.test(lower)) return javascriptArea();
  return programmingSyntaxArea(subject);
}

function csharpSyntaxArea() {
  return {
    id: "csharp-syntax",
    title: "C# syntax",
    questions: {
      mid: {
        prompt: () => "In C#, what does `Console.WriteLine(\"Hi\");` do?",
        options: ["Prints Hi to the console", "Creates a Unity scene", "Declares a class", "Imports a package"]
      },
      basic: {
        prompt: () => "In C#, what does `int score = 0;` create?",
        options: ["A whole-number variable named score", "A method named score", "A scene object", "A text color"]
      },
      entry: {
        prompt: () => "Before Unity scripting, what should a C# course explain first?",
        options: ["What each symbol and line does", "Only the final game idea", "Asset store setup first", "Advanced physics settings"]
      }
    }
  };
}

function cppSyntaxArea() {
  return {
    id: "cpp-syntax",
    title: "C++ syntax",
    questions: {
      mid: {
        prompt: () => "In C++, what does `std::cout << \"Hi\";` do?",
        options: ["Prints Hi as output", "Creates a class", "Starts a game engine", "Declares a loop"]
      },
      basic: {
        prompt: () => "In C++, what does `int score = 0;` create?",
        options: ["A whole-number variable named score", "A function named score", "A project file", "A namespace"]
      },
      entry: {
        prompt: () => "Before C++ game development, what should the course explain first?",
        options: ["What each new symbol and line means", "Only engine menus", "Advanced rendering", "Build settings before code"]
      }
    }
  };
}

function javaSyntaxArea() {
  return {
    id: "java-syntax",
    title: "Java syntax",
    questions: {
      mid: {
        prompt: () => "In Java, what does `System.out.println(\"Hi\");` do?",
        options: ["Prints Hi as output", "Creates a class file", "Starts a game loop", "Imports a library"]
      },
      basic: {
        prompt: () => "In Java, what does `int score = 0;` create?",
        options: ["A whole-number variable named score", "A method named score", "A package named score", "A window"]
      },
      entry: {
        prompt: () => "Before Java game development, what should the course explain first?",
        options: ["What each new word and symbol does", "Only graphics APIs", "Deployment first", "Advanced architecture"]
      }
    }
  };
}

function pythonSyntaxArea() {
  return {
    id: "python-syntax",
    title: "Python syntax",
    questions: {
      mid: {
        prompt: () => "In Python, what does `print(\"Hi\")` do?",
        options: ["Shows Hi as output", "Creates a list", "Starts a server", "Defines a class"]
      },
      basic: {
        prompt: () => "In Python, what does `score = 0` create?",
        options: ["A name storing the value 0", "A printed message", "A package", "A loop"]
      },
      entry: {
        prompt: () => "Before Python automation, what should the course explain first?",
        options: ["How each simple line runs", "Only scheduling tools", "Cloud deployment", "Advanced decorators"]
      }
    }
  };
}

function variablesArea(subject) {
  return {
    id: "variables",
    title: "variables and values",
    questions: {
      mid: {
        prompt: () => `In ${subject}, what is a variable usually used for?`,
        options: ["Storing a value under a name", "Skipping a line of code", "Changing the editor theme", "Opening a browser tab"]
      },
      basic: {
        prompt: () => "Why give a value a name in code?",
        options: ["So later code can reuse it", "So the file becomes larger", "So comments disappear", "So syntax is optional"]
      },
      entry: {
        prompt: () => "If a course says 'store this number', what idea is it probably teaching?",
        options: ["A variable", "A framework", "A deployment", "A stylesheet"]
      }
    }
  };
}

function functionsArea(subject) {
  return {
    id: "functions",
    title: "functions and reusable actions",
    questions: {
      mid: {
        prompt: () => `In ${subject}, why would code use a function or method?`,
        options: ["To package reusable behavior", "To delete all variables", "To style a web page", "To install the language"]
      },
      basic: {
        prompt: () => "What does calling a function usually mean?",
        options: ["Run the behavior stored in it", "Rename the project folder", "Change text color", "Stop the program from reading code"]
      },
      entry: {
        prompt: () => "If the same action is needed more than once, what can code use to group it?",
        options: ["A function", "A screenshot", "A subscription", "A heading"]
      }
    }
  };
}

function dataArea() {
  return {
    id: "data",
    title: "data tables and lists",
    questions: {
      mid: {
        prompt: () => "What does a list or array help you represent?",
        options: ["Many related values together", "Only one fixed word", "A color rule", "A server password"]
      },
      basic: {
        prompt: () => "Why would a program loop over data?",
        options: ["To handle each item one at a time", "To erase the code file", "To change the language", "To avoid output"]
      },
      entry: {
        prompt: () => "What is data in a beginner program?",
        options: ["Values the program can use", "The editor background", "The course title only", "A hidden prompt"]
      }
    }
  };
}

function promptsOverlap(previousPrompt, nextPrompt) {
  const tokens = (value) => new Set(value.split(/[^a-z0-9+]+/).filter((token) => token.length > 4));
  const previousTokens = tokens(previousPrompt);
  const nextTokens = tokens(nextPrompt);
  if (!previousTokens.size || !nextTokens.size) return false;
  let shared = 0;
  for (const token of nextTokens) {
    if (previousTokens.has(token)) shared += 1;
  }
  return shared >= 3;
}

export function buildAssessmentQuestionPrompt({ subject, step = 0, answers = [] }) {
  const assessmentPlan = resolveAssessmentPlan(subject);
  const target = resolveAssessmentQuestionTarget({ subject, step, answers });
  const weakSignals = answers
    .filter((answer) => answer?.skipped || answer?.isCorrect === false)
    .map((answer) => ({
      questionId: answer.questionId,
      prompt: answer.prompt,
      answer: answer.answer,
      skipped: Boolean(answer.skipped),
      wasCorrect: answer.isCorrect
    }));
  return `Create one adaptive assessment MCQ for a learner who wants to study ${trimText(subject, "Programming")}.

Return JSON only:
{
  "id":"short-stable-id",
  "type":"mcq",
  "questionKind":"prerequisite",
  "prompt":"question text",
  "options":["A","B","C","D"],
  "correctOptionIndex":2
}

Rules:
- Generate a fresh question; do not use generic canned wording.
- Ask only about the target prerequisite area and difficulty below.
- The first question for an area should be mid/entry-level. If the learner failed or skipped that area, the next question should drop one level instead of switching to an unrelated preference question.
- Pick exactly one assessment intent for this question: missing prerequisite, syntax readiness, debugging mindset, or required module coverage.
- The question text must not mention your assessment intent, these rules, hidden reasoning, internal plans, prompts, or system instructions.
- Most questions should assess prerequisite knowledge needed to customize the course modules, not quiz trivia for its own sake.
- Do not ask learning-preference or course-shaping questions here. This assessment exists only to measure prerequisite knowledge for course generation.
- If the latest previous prerequisite answer was skipped or wrong, drop one difficulty level in the same prerequisite area.
- Never ask more than one consecutive question about the same concept, skill, syntax shape, or prerequisite.
- Do not keep asking hard questions after a wrong or skipped answer. Step down or switch to course customization.
- Assess readiness signals: mindset for debugging, ability to trace input/rule/output, basic syntax recognition, and missing prerequisite concepts that should become bridge modules.
- If the learner misses basic syntax, ask whether the course should include the needed syntax bridge instead of continuing with harder target-topic trivia.
- The product UI has an "I don't know" button outside the four options. Do not include "I don't know" as one of the JSON options.
- Keep it beginner-friendly but diagnostic.
- Do not ask for learning style, project preference, user level, or goals.
- Exactly 4 options.
- For prerequisite MCQs, only one answer is correct.
- For prerequisite MCQs, the three wrong answers must be plausible misconception choices, not jokes, tools, or obviously absurd options.
- Make all four choices similar length, similar grammar, and similar specificity.
- For prerequisite MCQs, do not make the correct option longer, more detailed, more careful, or more obviously professional than the distractors.
- Avoid giveaway words such as "always", "never", "obviously", "best practice", and "correct" unless all options use similar framing.
- Do not use an option that is merely "skip", "memorize everything", "use a paid editor", or any cartoonishly bad answer.
- Randomize the correct option position after writing all options.
- Do not default to A or B. Correct answers should be distributed across A, B, C, and D over an assessment.
- Avoid repeating recently used correct positions when previous answers include correctOptionIndex.

Assessment plan: ${JSON.stringify({
  requiresAssessment: assessmentPlan.requiresAssessment,
  requiredAreas: assessmentPlan.areas.map((area) => ({ id: area.id, title: area.title })),
  targetArea: { id: target.area.id, title: target.area.title },
  targetDifficulty: target.difficulty
}).slice(0, 1200)}
Previous answers: ${JSON.stringify(answers).slice(0, 1800)}
Weak signals needing possible follow-up: ${JSON.stringify(weakSignals).slice(0, 1000)}
${formatEditableCourseGenerationRules(2200)}`;
}

export function normalizeAssessmentQuestion(input, fallbackSubject = "Programming", fallbackStep = 0) {
  const fallback = createFallbackAssessmentQuestion({ subject: fallbackSubject, step: fallbackStep });
  const options = uniqueStrings(input?.options).slice(0, 4);
  if (input?.type !== "mcq" || options.length !== 4) return fallback;
  const correctOptionIndex = Number.isInteger(input.correctOptionIndex)
    ? Math.min(Math.max(input.correctOptionIndex, 0), options.length - 1)
    : 0;
  const normalized = {
    id: slugify(input.id || `${fallbackSubject}-assessment-${fallbackStep + 1}`),
    type: "mcq",
    questionKind: input.questionKind === "course_shaping" ? "course_shaping" : fallback.questionKind ?? "prerequisite",
    assessmentArea: typeof input.assessmentArea === "string" && input.assessmentArea.trim() ? input.assessmentArea.trim() : fallback.assessmentArea,
    difficulty: ["entry", "basic", "mid"].includes(input.difficulty) ? input.difficulty : fallback.difficulty,
    prompt: trimText(input.prompt, fallback.prompt),
    options,
    correctOptionIndex
  };
  return normalized.questionKind === "course_shaping"
    ? normalized
    : rotateCorrectOption(normalized, `${normalized.id}:${normalized.prompt}:${fallbackStep}`);
}

export function createFallbackAssessmentReview({ subject, answers = [] }) {
  if (!answers.length) {
    const language = resolveCourseLanguage(subject).label;
    return {
      strengths: ["The course can start cleanly from foundations without assuming prior programming knowledge."],
      gaps: [],
      suggestedModules: [`${language} foundations`, "Values, variables, and visible output", "Decisions and repetition", "Functions and small reusable programs", `A guided ${language} project`]
    };
  }
  const prerequisiteAnswers = answers.filter((answer) => answer?.questionKind !== "course_shaping");
  const shapingAnswers = answers.filter((answer) => answer?.questionKind === "course_shaping" && answer?.answer !== null && answer?.answer !== undefined);
  const skipped = prerequisiteAnswers.filter((answer) => answer?.skipped).length;
  const missed = prerequisiteAnswers.filter((answer) => answer?.type === "mcq" && answer?.isCorrect === false).length;
  const correct = prerequisiteAnswers.filter((answer) => answer?.type === "mcq" && answer?.isCorrect === true).length;
  const noConfirmedPrereqs = !correct && (skipped || missed);
  const needsTargetedRefresher = resolveAssessmentPlan(subject).requiresAssessment && Boolean(skipped || missed);
  const baseLanguage = resolveCourseLanguage(subject).label;
  return {
    strengths: correct
      ? ["Some prerequisite MCQ answers showed usable starting knowledge."]
      : ["The learner named a target subject, but prerequisite knowledge is not confirmed yet."],
    gaps: noConfirmedPrereqs
      ? ["Assume complete beginner status and teach syntax, symbols, and tiny runnable examples before harder modules."]
      : skipped || missed
        ? ["Skipped or missed prerequisite checks should become bridge lessons before harder modules."]
        : ["The course should still verify each concept before harder practice."],
    suggestedModules: [
      needsTargetedRefresher ? `Targeted ${baseLanguage} refresher for ${trimText(subject, "Programming")}` : null,
      !needsTargetedRefresher ? `${trimText(subject, "Programming")} foundations` : null,
      noConfirmedPrereqs ? "Syntax, symbols, and tiny runnable examples" : "Core concept checks",
      "Core practice with feedback",
      shapingAnswers.length ? "Preferred language and library path" : "Capstone assessment and review"
    ].filter(Boolean).slice(0, 4)
  };
}

export function buildAssessmentReviewPrompt({ subject, answers = [] }) {
  const noAssessmentGuidance = answers.length
    ? ""
    : `\n- No assessment was required because this is a standalone programming-language course. Do not invent missing evidence or prerequisite gaps.\n- Return strengths that say the course will start from foundations, return an empty gaps array, and suggest a natural beginner module path for the language.`;
  return `Review prerequisite assessment answers for a learner who wants to study ${trimText(subject, "Programming")}.

Return JSON only:
{
  "strengths":["..."],
  "gaps":["..."],
  "suggestedModules":["..."]
}

Rules:
- Summarize what appears strong and weak based on MCQ answers and skipped questions.
- Use isCorrect, skipped, prompt, options, correctOptionIndex, and questionKind when present.
- Treat "course_shaping" answers as course customization preferences, not strengths or weaknesses.
- If a wrong or skipped answer is followed by a correct follow-up, mark that area as "needs reinforcement" rather than a complete blocker.
- Recommend modules to include, especially prerequisites required for the target subject and any relevant language/library/tool preferences from course-shaping answers.
- For an advanced, framework, library, game, web, data, or applied course: if answers show prerequisite gaps, make the first suggested module a targeted refresher. Name the base language and target, such as "Targeted Python refresher for Pygame".
- A targeted refresher teaches only prerequisite language features the target course will actually use. Do not insert a generic full fundamentals course.
- If the learner proves the relevant prerequisites, do not add a refresher module merely for completeness.
${noAssessmentGuidance}
- Do not assign a level label.
- Do not generate the course content here.
- Keep each list 3 to 6 items.

Assessment answers: ${JSON.stringify(answers).slice(0, 2400)}
${formatEditableCourseGenerationRules(2200)}`;
}

export function createFallbackGeneratedCourseFromAssessment({ subject, assessmentReview }) {
  const normalizedSubject = inferSubject(subject);
  const title = `${titleCase(trimText(subject, normalizedSubject)).slice(0, 52)} Course`;
  return normalizeGeneratedCourseContent({
    schemaVersion: contentSchemaVersionV2,
    title,
    subject: normalizedSubject,
    description: `A complete beginner-friendly ${normalizedSubject} course generated from prerequisite assessment signals.`,
    languages: inferLanguages(subject),
    tags: ["AI generated", "Assessment based", "MVP"],
    generationDepth: "full_structure_first_module",
    assessmentReview: assessmentReview ?? createFallbackAssessmentReview({ subject }),
    courseBlueprint: createDefaultCourseBlueprint({ subject: normalizedSubject, assessmentReview }),
    modules: buildFallbackModules(normalizedSubject)
  });
}

export function createFallbackGeneratedCourse({ objective, level, outcome }) {
  const subject = inferSubject(objective);
  const title = titleCase(trimText(objective, "Programming course")).slice(0, 60);
  const firstChapter = buildChapter({
    chapterIndex: 0,
    subject,
    title: "Foundation and first practice",
    summary: `Start ${title} with plain-language concepts, checks, and one editor-based task.`,
    includeContent: true
  });
  const roadmapOnlyChapters = [
    buildChapter({
      chapterIndex: 1,
      subject,
      title: "Core patterns",
      summary: `Practice common ${subject} patterns with mixed explanations and exercises.`,
      includeContent: false
    }),
    buildChapter({
      chapterIndex: 2,
      subject,
      title: "Build and review",
      summary: `Use ${subject} in a small project and review the tradeoffs.`,
      includeContent: false
    })
  ];

  return normalizeGeneratedCourseContent({
    schemaVersion: contentSchemaVersion,
    title,
    subject,
    description: `${trimText(level, "Beginner")} path for ${title}, aimed at ${trimText(outcome, "building practical confidence")}.`,
    languages: inferLanguages(objective),
    tags: ["AI generated", "Beginner", "Practice"],
    generationDepth: "roadmap_first_chapter",
    chapters: [firstChapter, ...roadmapOnlyChapters]
  });
}

export function createFallbackGeneratedChapter(content, chapterIndex) {
  const baseChapter = content?.chapters?.[chapterIndex];
  const subject = content?.subject ?? "Programming";
  const chapter = buildChapter({
    chapterIndex,
    subject,
    title: baseChapter?.title ?? `Chapter ${chapterIndex + 1}`,
    summary: baseChapter?.summary ?? `Generated practice for ${subject}.`,
    includeContent: true
  });

  return {
    chapterIndex,
    chapter: normalizeChapter(chapter, chapterIndex)
  };
}

export function normalizeGeneratedCourseContent(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Generated course content must be an object.");
  }
  if (input.schemaVersion === contentSchemaVersionV2 || Array.isArray(input.modules)) {
    return normalizeGeneratedCourseContentV2(input);
  }

  const chapters = Array.isArray(input.chapters)
    ? input.chapters.map((chapter, index) => normalizeChapter(chapter, index))
    : [];
  if (!chapters.length) throw new Error("Generated course content requires at least one chapter.");

  return {
    schemaVersion: contentSchemaVersion,
    title: trimText(input.title, "Generated course"),
    subject: trimText(input.subject, "Programming"),
    description: trimText(input.description, "Generated programming course."),
    languages: uniqueStrings(input.languages).length ? uniqueStrings(input.languages) : ["JavaScript"],
    tags: uniqueStrings(input.tags).length ? uniqueStrings(input.tags) : ["AI generated"],
    generationDepth: input.generationDepth === "full_course" ? "full_course" : "roadmap_first_chapter",
    chapters
  };
}

function normalizeGeneratedCourseContentV2(input) {
  const normalizedLanguages = uniqueStrings(input.languages);
  const defaultLanguageInfo = resolveCourseLanguage(normalizedLanguages[0] || input.subject);
  const unlockAllModules = input.generationDepth === "full_course";
  const modules = Array.isArray(input.modules)
    ? input.modules.map((module, index) => normalizeModule(module, index, defaultLanguageInfo, unlockAllModules)).filter(Boolean)
    : [];
  if (!modules.length) throw new Error("Generated course content requires at least one module.");

  return {
    schemaVersion: contentSchemaVersionV2,
    title: trimText(input.title, "Generated course"),
    subject: trimText(input.subject, "Programming"),
    description: trimText(input.description, "Generated programming course."),
    languages: normalizedLanguages.length ? normalizedLanguages : [defaultLanguageInfo.label],
    tags: uniqueStrings(input.tags).length ? uniqueStrings(input.tags) : ["AI generated"],
    generationDepth: input.generationDepth === "full_course" ? "full_course" : "full_structure_first_module",
    assessmentReview: normalizeAssessmentReview(input.assessmentReview),
    courseBlueprint: normalizeCourseBlueprint(input.courseBlueprint),
    ragSources: normalizeRagSources(input.ragSources),
    modules
  };
}

export function buildCourseSyllabusFromContent(content) {
  let lessonIndex = 0;
  return content.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.flatMap((section) => {
      const blocks = section.blocks.length ? section.blocks : [null];
      return blocks.map((block, blockIndex) => ({
        id: block ? `${section.id}:${blockIndex}` : section.id,
        title: `${chapterIndex + 1}.${lessonIndex + 1} ${block ? blockTitle(section.title, block.type) : section.title}`,
        summary: block ? blockSummary(section.summary, block.type) : section.summary,
        lessonIndex: lessonIndex++,
        hasChallenge: Boolean(block && (block.type === "mcq" || block.type === "chat_exercise" || block.type === "code_exercise"))
      }));
    })
  );
}

function blockTitle(sectionTitle, type) {
  if (type === "mcq") return `${sectionTitle} check`;
  if (type === "chat_exercise") return `${sectionTitle} written check`;
  if (type === "code_exercise") return `${sectionTitle} editor exercise`;
  return sectionTitle;
}

function blockSummary(sectionSummary, type) {
  if (type === "mcq") return "Answer a quick multiple-choice check before continuing.";
  if (type === "chat_exercise") return "Explain the idea in your own words for tutor review.";
  if (type === "code_exercise") return "Use the active IDE file as a focused scratch file and submit runnable code.";
  return sectionSummary;
}

export function mergeGeneratedChapter(content, generatedChapter) {
  const chapterIndex = generatedChapter.chapterIndex;
  const chapters = content.chapters.map((chapter, index) =>
    index === chapterIndex ? normalizeChapter(generatedChapter.chapter, index) : chapter
  );
  return normalizeGeneratedCourseContent({ ...content, chapters });
}

export function buildCourseGenerationPrompt({ objective, level, outcome, amendments = [] }) {
  return `Generate a Stonecode beginner programming course as strict JSON.

Return only JSON matching this shape:
{
  "schemaVersion":"course-content/v1",
  "title":"short course title",
  "subject":"topic",
  "description":"one sentence",
  "languages":["JavaScript"],
  "tags":["Beginner"],
  "generationDepth":"roadmap_first_chapter",
  "chapters":[
    {
      "id":"chapter-slug",
      "title":"Chapter title",
      "summary":"Chapter summary",
      "sections":[
        {
          "id":"section-slug",
          "title":"Section title",
          "summary":"Section summary",
          "blocks":[
            {"type":"theory","markdown":"## Explanation\\n..."},
            {"type":"mcq","prompt":"Question","options":["A","B","C","D"],"correctOptionIndex":0,"explanation":"Why"},
            {"type":"code_exercise","language":"JavaScript","filePath":"main.js","prompt":"Task","starterCode":"console.log('start')","acceptanceCriteria":["Criterion"]}
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate roadmap for 3 chapters.
- Fully fill only chapter 1 blocks.
- Later chapters must include section titles/summaries and may use empty blocks.
- Separate learning beats into separate sections. Do not put theory, MCQ, writing exercise, and code exercise into one section.
- Theory sections must teach only: concept, analogy, simple example, and topic transition. Start with explanatory prose and a mental model before bullets. Explain why the idea exists, include a useful analogy and map it back to code, and do not ask the learner to answer inside theory.
- Start every new topic with at least 3 consecutive theory-style sections before any MCQ, chat_exercise, or code_exercise.
- The first course section must meaningfully introduce the course: what the learner will understand or build, the course path, why it matters, and why the first topic comes first. A greeting alone is not an introduction. Do not start with an exercise.
- Add clear continuity when moving topics, for example "Now that the mental model is clear, next is 1.2 HTML and CSS."
- Use MCQ or chat_exercise sections only after the relevant theory/example section.
- Use code_exercise sections only for editor work.
- If a theory explanation is long, split it into two consecutive theory sections.
- For broad subjects such as web development, teach only topic-relevant language parts instead of full language mastery.
- End each chapter with a medium or hard editor code assessment and a final summary theory section.
- Code exercises must reuse the active IDE file as a focused scratch file, not create folder-heavy projects.
- Code exercise file paths should be simple filenames like main.js, index.html, styles.css, or app.py.

Learner objective: ${trimText(objective, "Programming")}
Current level: ${trimText(level, "Beginner")}
Practical outcome: ${trimText(outcome, "Build practical projects")}
Amendments: ${amendments.map((item) => trimText(item, "")).filter(Boolean).join("; ") || "none"}`;
}

export function buildCourseBlueprintPrompt({ subject, answers = [], assessmentReview, learnerContext, retrievedContext = [] }) {
  const context = learnerContext ?? buildLearnerGenerationContext({ subject, answers, assessmentReview });
  return `Create the hidden Stonecode courseBlueprint for this generated course.

Return JSON only:
{
  "courseBlueprint":{
    "finalProject":{"title":"Final project title","description":"what the learner can build","capabilities":["capability"]},
    "miniProjects":[{"title":"mini build","moduleId":"planned-module-or-empty","topicId":"planned-topic-or-empty","blockKind":"workshop","connectsTo":"final project capability"}],
    "conceptSequence":["concept in teaching order"],
    "prerequisiteBridges":["missing prerequisite bridge"],
    "moduleGoals":[{"moduleId":"planned-module-or-empty","goal":"module capability"}]
  }
}

Rules:
- The courseBlueprint is hidden planning metadata, not a visible new hierarchy.
- The finalProject should be realistic for the requested subject and beginner path.
- Every workshop, lab, project, quiz, and theory block generated later should connect to this spine.
- Mini-projects should be small functions, UI pieces, scripts, mechanics, or behaviors that can become part of the final project.
- Do not force a fixed number of modules, topics, blocks, or workshop steps.
- Use assessment gaps to add prerequisiteBridges before harder project capabilities.
- When learnerContext.refresher.needed is true, make the first bridge a narrow target-relevant refresher. When false, do not invent one.

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(context).slice(0, 2200)}
Assessment answers: ${JSON.stringify(answers).slice(0, 1600)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}
Retrieved context:
${formatStaticCourseGenerationContext(retrievedContext).slice(0, 2400)}
${formatEditableCourseGenerationRules(3500)}`;
}

export function buildAssessmentCourseOutlinePrompt({ subject, answers = [], assessmentReview, courseBlueprint = null, retrievedContext = null }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
  const contextChunks = retrievedContext ?? retrieveStaticCourseGenerationContext({ subject, learnerContext });
  return `Course outline phase.

Generate only the Stonecode course plan as strict JSON. Do not write full lesson markdown, full workshop prompts, starter code, quizzes, or lab bodies yet.

Return JSON matching the course-content/v2 shape, but keep step arrays empty or use only short placeholder summaries inside blocks. The next model call will write loaded content.

Required plan:
- Choose the natural number of modules for the subject and assessment gaps. Do not target a fixed module count.
- Module 1 is unlocked and planned in detail with enough topics to teach the first path properly.
- Modules 2 and later are locked outline modules until the first module proves the system quality.
- Every topic plans intentional block kinds using only: theory, quiz, workshop, lab, project, review.
- Start each topic with theory.
- Do not force every topic into the same rhythm.
- Practical progression is theory/example -> guided workshop -> independent lab -> later milestone project. This is a dependency rule, not a required template for every topic.
- Never plan a lab before a relevant workshop. Thorough theory alone does not make an independent lab appropriate.
- A lab is a small checkpoint exam and does not need to immediately follow its workshop. Reviews, quizzes, theory, topic transitions, or other workshops may appear between them.
- Plan milestone projects only after multiple workshops and at least one lab have prepared the required ideas. Keep the final project near the end of the course.
- Multiple labs and milestone projects are allowed when the curriculum naturally needs them. The final project remains the main course exam.
- Assessment review suggestedModules must visibly appear, be naturally renamed, or be merged into equivalent module coverage.
- If learnerContext.refresher.needed is true, Module 1 must be a clearly named targeted refresher covering only prerequisites used by the requested subject. If false, begin directly with the requested subject.
- Use the Course blueprint as the hidden spine. Every module goal, workshop, lab, and project should contribute to the final project capabilities.

Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Course blueprint: ${JSON.stringify(courseBlueprint ?? {}).slice(0, 1800)}
Retrieved course-generation context:
${formatStaticCourseGenerationContext(contextChunks).slice(0, 2200)}
Subject: ${trimText(subject, "Programming")}
Assessment answers: ${JSON.stringify(answers).slice(0, 1600)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}
${formatEditableCourseGenerationRules(3500)}`;
}

export function buildAssessmentCourseContentPrompt({ subject, answers = [], assessmentReview, courseOutline, courseBlueprint = null, retrievedContext = null }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
  const blockContracts = ["theory", "quiz", "workshop", "lab", "project", "review"]
    .map((blockKind) => buildBlockGenerationPrompt({
      blockKind,
      subject,
      moduleTitle: "Any generated module",
      topicTitle: "Any generated topic",
      learnerContext
    }))
    .join("\n\n---\n\n");
  const basePrompt = buildAssessmentCourseGenerationPrompt({ subject, answers, assessmentReview, courseBlueprint, retrievedContext });
  return `${basePrompt}

Loaded content phase.

Use the course outline as the fixed plan when provided. Preserve module/topic/block ids and titles unless they are invalid. Fully write loaded content for module 1 only. Keep later modules as locked shell outlines.

Course outline:
${JSON.stringify(courseOutline ?? {}).slice(0, 6000)}
Course blueprint:
${JSON.stringify(courseBlueprint ?? {}).slice(0, 2200)}
Retrieved context:
${formatStaticCourseGenerationContext(retrievedContext ?? retrieveStaticCourseGenerationContext({ subject, learnerContext })).slice(0, 2200)}
${formatEditableCourseGenerationRules(3500)}

Block-specific generation contracts:
${blockContracts.slice(0, 14000)}`;
}

export function buildAssessmentModuleContentPrompt({ subject, answers = [], assessmentReview, courseOutline, courseBlueprint = null, retrievedContext = null, moduleIndex = 0 }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
  const requestedLanguage = resolveCourseLanguage(subject);
  const moduleOutline = extractModuleOutline(courseOutline, moduleIndex);
  const blockKinds = blockKindsInModuleOutline(moduleOutline);
  const blockContracts = blockKinds
    .map((blockKind) => buildBlockGenerationPrompt({
      blockKind,
      subject,
      moduleTitle: moduleOutline?.title ?? `Module ${moduleIndex + 1}`,
      topicTitle: "Any topic in this module",
      learnerContext
    }))
    .join("\n\n---\n\n");

  return `Loaded module content phase.

Generate full block steps only for this module. Do not generate other modules.

Return strict JSON only:
{
  "moduleIndex":${moduleIndex},
  "module":{
    "id":"module-id",
    "title":"Module title",
    "summary":"Module summary",
    "unlocked":true,
    "chapters":[
      {
        "id":"topic-id",
        "title":"Topic title",
        "summary":"Topic summary",
        "unlocked":true,
        "blocks":[
          {
            "id":"block-id",
            "kind":"theory",
            "title":"Block title",
            "summary":"Block summary",
            "steps":[
              {"type":"theory","markdown":"## Explanation\\n\\nFull teaching content goes here."},
              {"type":"mcq","prompt":"Question","options":["A","B","C","D"],"correctOptionIndex":0,"explanation":"Why"}
            ]
          },
          {
            "id":"workshop-id",
            "kind":"workshop",
            "title":"Workshop title",
            "summary":"Guided build with as many atomic steps as the deliverable needs",
            "steps":[
              {"id":"workshop-step-1","type":"workshop","buildsOnStepId":null,"conceptIds":["console-output"],"language":"JavaScript","filePath":"main.js","context":"The deliverable is a tiny visible program for this topic. Start with the smallest runnable line so the learner has a baseline.","prompt":"Step 1: add one console.log line that prints Ready.","expectedChange":"Add exactly one console.log('Ready') statement.","starterCode":"","resultCode":"console.log('Ready');","acceptanceCriteria":["Creates the first visible output","Keeps the work in main.js"],"requiresPreview":false},
              {"id":"workshop-step-2","type":"workshop","buildsOnStepId":"workshop-step-1","conceptIds":["string-value"],"language":"JavaScript","filePath":"main.js","context":"Continue the same file and build from the previous step.","prompt":"Step 2: change only the quoted text from Ready to Hello.","expectedChange":"Replace the Ready string with Hello and change nothing else.","starterCode":"console.log('Ready');","resultCode":"console.log('Hello');","acceptanceCriteria":["Changes only the string value","Visible output says Hello"],"requiresPreview":false},
              {"id":"workshop-step-3","type":"workshop","buildsOnStepId":"workshop-step-2","conceptIds":["named-value"],"language":"JavaScript","filePath":"main.js","context":"Continue the same visible message. Now give the text a reusable name.","prompt":"Step 3: add a const named message above the output line.","expectedChange":"Add const message = 'Hello'; above the existing line.","starterCode":"console.log('Hello');","resultCode":"const message = 'Hello';\nconsole.log('Hello');","acceptanceCriteria":["Creates const message","Keeps the visible output"],"requiresPreview":false},
              {"id":"workshop-step-4","type":"workshop","buildsOnStepId":"workshop-step-3","conceptIds":["variable-use"],"language":"JavaScript","filePath":"main.js","context":"Finish the same tiny program by using the named value.","prompt":"Step 4: replace only the quoted text inside console.log with message.","expectedChange":"Change console.log('Hello') to console.log(message).","starterCode":"const message = 'Hello';\nconsole.log('Hello');","resultCode":"const message = 'Hello';\nconsole.log(message);","acceptanceCriteria":["console.log uses message","Keeps const message"],"requiresPreview":false}
            ]
          }
        ]
      }
    ]
  }
}

Rules:
- The exact requested implementation language is ${requestedLanguage.label}, using ${requestedLanguage.filePath} by default. JavaScript shown in the schema example demonstrates field shape only; never copy its language, path, or syntax into a ${requestedLanguage.label} course.
- Preserve ids and titles from the module outline when possible.
- Generate complete steps for every block in this module.
- Every object inside a steps array must have a "type" field.
- Do not encode fields as {"kind":"prompt","content":"..."} or {"kind":"starterCode","content":"..."}.
- For workshop/lab/project steps, put context, prompt, language, filePath, starterCode, acceptanceCriteria, requiresPreview, requiresTerminal, workspaceView, and workspaceFiles on the same step object.
- workspaceFiles is a complete small project manifest: [{"path":"src/main.py","content":"...","purpose":"...","editable":true}]. Include the active file and every related file in its real folder.
- Visual web/game/layout work must preload a renderable scene. Open workspaceView:"preview" for the initial scene or bug state, then let later micro-steps open Code while still requiring a Visual check.
- Visual web work must use an HTML entrypoint that explicitly links each required local stylesheet and browser script with correct relative href/src paths. Do not assume every CSS/JavaScript file is injected automatically.
- Terminal-output work uses requiresTerminal:true and workspaceView:"terminal" when the immediate learner action is run/read/fix output.
- Preserve planned block kinds from the module outline. Do not turn a planned quiz/workshop/lab/project block into a theory block.
- A quiz block is low-stakes topic practice and must have 4 to 10 mcq step objects.
- Every quiz question must practice a different concrete concept, code example, runtime behavior, or scenario taught in this exact topic. Never use prerequisite assessment, generic study advice, trivia, or paraphrased repeat questions.
- Each explanation must reconnect the answer to the topic teaching so a wrong answer still improves understanding.
- A workshop block must have enough workshop step objects to complete its deliverable through atomic edits. One-step or two-step workshops are invalid.
- Every workshop step must include id, buildsOnStepId, conceptIds, expectedChange, starterCode, and resultCode.
- Every workshop coding step must also include codeExplanation for only that micro-change and 2 to 3 suggestedQuestions tied to the current line.
- Step 1 introduces the workshop deliverable once. Later steps do not repeat the introduction, generic syntax lists, whole-file explanations, or starter excerpts.
- End every workshop with one non-coding {"type":"summary","markdown":"..."} step that explains the completed code, how its parts connect, and where it is useful.
- starterCode is the exact pre-edit file. resultCode is the exact file after the requested micro-edit. For steps after Step 1, starterCode must equal the previous step resultCode.
- expectedChange must describe one small code delta, not a broad task. Never preload resultCode into the learner editor for that same step.
- Do not force exactly 4 workshop steps. Use 6, 10, 18, or any natural count when the deliverable needs it.
- Each loaded module should include at least one practical workshop, lab, or project block.
- A guided workshop must be the first practical code block in the learning path.
- A lab block is usually one lab step, but it must stay kind "lab".
- A lab must follow a relevant workshop and reuse only already workshopped concepts. Thorough theory alone is not enough.
- The relevant workshop may be earlier rather than adjacent; intervening teaching, quizzes, reviews, and workshops are allowed.
- A project block must stay kind "project".
- A milestone project requires multiple earlier workshops and at least one earlier lab. It must not be the learner's first or second practical coding experience.
- Multiple labs and milestone projects are allowed. Choose their timing dynamically from demonstrated curriculum readiness; reserve the final project as the main exam near the end.
- Fully load only module ${moduleIndex + 1} in this response.
- Keep every other module's content out of this response.
- Every topic must start with a theory block.
- A theory block must contain real teaching steps before checks. Never return a theory block whose steps are only MCQs.
- When teaching syntax, include a fenced code snippet with the correct language tag and explain the new tokens before any workshop/lab asks the learner to edit them.
- Use the learner context and assessment review as binding personalization input.
- Use the Course blueprint as the hidden spine: workshop/lab/project deliverables should become small pieces of the final project, and theory/quiz should prepare those pieces.

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}
Course blueprint: ${JSON.stringify(courseBlueprint ?? {}).slice(0, 2200)}
Retrieved context: ${formatStaticCourseGenerationContext(retrievedContext ?? retrieveStaticCourseGenerationContext({ subject, learnerContext })).slice(0, 2200)}
Module outline: ${JSON.stringify(moduleOutline ?? {}).slice(0, 3500)}
${formatEditableCourseGenerationRules(3500)}

Block-specific generation contracts:
${blockContracts.slice(0, 14000)}`;
}

export function createGeneratedCourseSkeletonFromOutline(outline, { subject = "Programming", assessmentReview = null, courseBlueprint = null, ragSources = [] } = {}) {
  const source = outline?.course && typeof outline.course === "object" ? outline.course : outline;
  const rawModules = Array.isArray(source?.modules) ? source.modules : [];
  const modules = rawModules.map((module, moduleIndex) => {
    const title = trimText(module?.title, `Module ${moduleIndex + 1}`);
    const moduleId = slugify(module?.id || `${moduleIndex + 1}-${title}`);
    const rawTopics = Array.isArray(module?.chapters) ? module.chapters : module?.topics;
    const topics = (Array.isArray(rawTopics) ? rawTopics : []).map((topic, topicIndex) => {
      const topicTitle = trimText(topic?.title, `Topic ${topicIndex + 1}`);
      const topicId = slugify(topic?.id || `${moduleId}-${topicIndex + 1}-${topicTitle}`);
      const rawBlocks = Array.isArray(topic?.blocks) ? topic.blocks : [{ kind: "review", summary: topic?.summary }];
      const blocks = rawBlocks.map((block, blockIndex) => {
        const kind = normalizeBlockKindName(block?.kind);
        const blockTitle = trimText(block?.title, `${titleCase(kind)} outline`);
        const summary = trimText(block?.summary, "Outline content will load for this block.");
        return {
          id: slugify(block?.id || `${topicId}-${blockIndex + 1}-${kind}`),
          kind,
          title: blockTitle,
          summary,
          order: blockIndex,
          steps: [{ type: "summary", markdown: `## ${blockTitle}\n\n${summary}` }]
        };
      });
      return {
        id: topicId,
        title: topicTitle,
        summary: trimText(topic?.summary, "Generated topic outline."),
        order: topicIndex,
        unlocked: moduleIndex === 0 && module?.locked !== true && module?.status !== "locked",
        blocks
      };
    });
    return {
      id: moduleId,
      title,
      summary: trimText(module?.summary, "Generated module outline."),
      order: moduleIndex,
      unlocked: moduleIndex === 0 && module?.locked !== true && module?.status !== "locked",
      topics: topics.length ? topics : [
        {
          id: `${moduleId}-outline`,
          title: "Outline",
          summary: "Locked outline.",
          order: 0,
          unlocked: moduleIndex === 0,
          blocks: [{
            id: `${moduleId}-outline-review`,
            kind: "review",
            title: "Outline",
            summary: "Content will load later.",
            order: 0,
            steps: [{ type: "summary", markdown: "## Outline\n\nContent will load later." }]
          }]
        }
      ]
    };
  });

  return {
    schemaVersion: contentSchemaVersionV2,
    title: trimText(source?.title, `${titleCase(subject)} Course`),
    subject: inferSubject(source?.subject || subject),
    description: trimText(source?.description || source?.summary, `Personalized ${trimText(subject, "Programming")} course.`),
    languages: inferLanguages(source?.subject || subject),
    tags: ["AI generated", "Assessment based", "QA outline"],
    generationDepth: "full_structure_first_module",
    assessmentReview: normalizeAssessmentReview(assessmentReview),
    courseBlueprint: normalizeCourseBlueprint(courseBlueprint ?? source?.courseBlueprint),
    ragSources: normalizeRagSources(ragSources),
    modules: modules.length ? modules : buildFallbackModules(inferSubject(subject))
  };
}

export function extractGeneratedModuleFromResponse(response, fallbackModule, moduleIndex = 0) {
  const candidate = response?.module && typeof response.module === "object"
    ? response.module
    : Array.isArray(response?.modules)
      ? response.modules[moduleIndex]
      : Array.isArray(response?.course?.modules)
        ? response.course.modules[moduleIndex]
      : response;
  const rawTopics = Array.isArray(candidate?.topics)
    ? candidate.topics
    : Array.isArray(candidate?.chapters)
      ? candidate.chapters
      : [];
  if (!candidate || typeof candidate !== "object" || !rawTopics.length) return fallbackModule;
  return {
    ...fallbackModule,
    ...candidate,
    id: trimText(candidate.id, fallbackModule?.id),
    topics: rawTopics
  };
}

export function extractGeneratedTopicFromResponse(response, fallbackTopic, topicIndex = 0, qualityWarnings = null) {
  const candidate = response?.topic && typeof response.topic === "object"
    ? response.topic
    : Array.isArray(response?.topics)
      ? response.topics[topicIndex]
      : Array.isArray(response?.module?.topics)
        ? response.module.topics[topicIndex]
        : response;
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.blocks) || !candidate.blocks.length) {
    return fallbackTopic;
  }
  const repairedTopic = {
    ...fallbackTopic,
    ...candidate,
    id: trimText(candidate.id, fallbackTopic?.id),
    blocks: candidate.blocks
  };
  if (!Array.isArray(qualityWarnings) || !qualityWarnings.length) return repairedTopic;

  const targetedBlockIndexes = new Set();
  let needsWholeTopicRepair = false;
  for (const warning of qualityWarnings) {
    const match = String(warning?.message ?? "").match(/\.blocks\[(\d+)\]/);
    if (match) targetedBlockIndexes.add(Number(match[1]));
    else needsWholeTopicRepair = true;
  }
  if (needsWholeTopicRepair || !targetedBlockIndexes.size) return repairedTopic;

  const blocks = [...(fallbackTopic?.blocks ?? [])];
  for (const blockIndex of targetedBlockIndexes) {
    const fallbackBlock = blocks[blockIndex];
    const repairedBlock = fallbackBlock?.id
      ? candidate.blocks.find((block) => block?.id === fallbackBlock.id) ?? candidate.blocks[blockIndex]
      : candidate.blocks[blockIndex];
    if (repairedBlock && typeof repairedBlock === "object") blocks[blockIndex] = repairedBlock;
  }
  return { ...fallbackTopic, blocks };
}

export function buildGeneratedCourseRepairPrompt({ subject, content, qualityWarnings = [] }) {
  return `Repair only the invalid generated blocks in this Stonecode course.

Return the full corrected course JSON. Do not return a patch. Preserve the existing course/module/topic/block architecture, ids, order, and learner personalization unless a specific invalid block must be fixed.

Repair rules:
- Fix only blocks related to the quality warnings.
- Do not rewrite good modules or unrelated topics.
- If a theory block has only MCQs, add real theory/analogy/example/summary teaching steps before any MCQ.
- Every loaded topic must start with real theory teaching, not a quiz, lab, project, or workshop.
- If syntax_teaching_missing appears, add syntax teaching before the exercise or inside the workshop prompt before the edit. Explain keywords, names, quotes, parentheses, braces, semicolons, operators, and output calls the first time they appear.
- If workshop_context_missing_purpose appears, rewrite context to briefly say what the learner is learning, why it is useful, and how this step continues the build.
- If workshop_prompt_missing_action appears, rewrite the prompt so it gives one immediate concrete edit action plus a small syntax hint when relevant.
- If workshop_continuity_broken appears, give each step a stable id, point buildsOnStepId to the previous step, and make the previous resultCode exactly equal the next starterCode.
- If workshop_expected_change_missing appears, add one explicit expectedChange describing the tiny code delta.
- If workshop_no_code_delta appears, provide distinct starterCode and resultCode states separated by exactly the requested micro-edit.
- If exercise_topic_mismatch appears, replace the exercise with one that directly practices the current topic goal and preceding teaching while preserving the block kind.
- When teaching syntax in markdown, include fenced code examples with the correct language tag such as \`\`\`js, \`\`\`python, \`\`\`cpp, \`\`\`csharp, or \`\`\`java.
- If a workshop is too short, expand it until the deliverable is complete through atomic FreeCodeCamp-style steps.
- If workshop_missing_recap appears, add one final non-coding summary step after all coding steps.
- If workshop_code_explanation_missing appears, explain only the exact line or micro-change introduced by that coding step.
- If workshop_suggested_questions_missing appears, add 2 to 3 short questions relevant to that exact step.
- If theory is thin, expand the theory markdown with mental model, explanation, and tiny example.
- If exercise context is thin, add concrete context tied to the current topic and prior teaching.
- If quiz is too short, add enough distinct, topic-grounded MCQ practice steps to reach 4 to 10.
- If quiz questions repeat or drift from the topic, replace only those questions with concrete exercises based on this topic's preceding explanation or worked example.
- If a loaded topic is missing quiz, workshop, lab, or project practice, add the planned interactive block that best matches the topic.
- If lab_before_workshop appears, insert or restore a relevant guided workshop before the lab; do not solve it by adding more theory.
- If project_before_practice_readiness appears, move the project later or replace it with a workshop/lab until multiple workshops and at least one lab establish readiness.
- Keep language, filePath, starterCode, and acceptanceCriteria consistent.

Subject: ${trimText(subject, "Programming")}
Quality warnings: ${JSON.stringify(qualityWarnings).slice(0, 2200)}
Course JSON: ${JSON.stringify(content ?? {}).slice(0, 11000)}
${formatEditableCourseGenerationRules(3000)}`;
}

export function buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex = 0, qualityWarnings = [] }) {
  const requestedLanguage = resolveCourseLanguage(subject);
  return `Repair only this generated module.

Return strict JSON only:
{
  "moduleIndex":${moduleIndex},
  "module": { "id":"module-id", "title":"...", "summary":"...", "unlocked":true, "topics":[] }
}

Rules:
- Keep every coding step in ${requestedLanguage.label}, using ${requestedLanguage.filePath} by default. Do not copy JavaScript syntax from generic schema examples.
- Preserve this module's id, title, topic ids, and block ids unless invalid.
- Fix only the warning-related topics/blocks in this module.
- Do not rewrite other modules.
- If a theory block has only MCQs, add real teaching steps before the MCQs or split the MCQs into a quiz block.
- Every loaded topic must start with real theory teaching. Do not start a topic with only quiz questions.
- If syntax_teaching_missing appears, add syntax teaching before the exercise or inside the workshop prompt before the edit. Explain keywords, names, quotes, parentheses, braces, semicolons, operators, and output calls the first time they appear.
- If workshop_context_missing_purpose appears, rewrite context to briefly say what the learner is learning, why it is useful, and how this step continues the build.
- If workshop_prompt_missing_action appears, rewrite the prompt so it gives one immediate concrete edit action plus a small syntax hint when relevant.
- If workshop_continuity_broken appears, give each step a stable id, point buildsOnStepId to the previous step, and make the previous resultCode exactly equal the next starterCode.
- If workshop_expected_change_missing appears, add one explicit expectedChange describing the tiny code delta.
- If workshop_no_code_delta appears, provide distinct starterCode and resultCode states separated by exactly the requested micro-edit.
- If exercise_topic_mismatch appears, rewrite only that exercise so it directly practices the current topic and preceding teaching.
- When teaching syntax in markdown, include fenced code examples with the correct language tag such as \`\`\`js, \`\`\`python, \`\`\`cpp, \`\`\`csharp, or \`\`\`java.
- If a topic is missing interactive practice, add or restore the planned quiz, workshop, lab, or project block.
- If a loaded module has no workshop, lab, or project, add one guided workshop to the most suitable early topic.
- If lab_before_workshop appears, insert or restore a relevant guided workshop before that lab. More theory alone does not satisfy this warning.
- If project_before_practice_readiness appears, move the project later or use workshops/labs first until multiple workshops and at least one lab establish readiness.
- Workshop blocks need enough atomic workshop step objects to complete their concrete deliverable. Do not target a fixed count.
- Every workshop ends with one non-coding summary step after its atomic coding steps.
- Quiz blocks need 4 to 10 distinct topic-practice mcq step objects. They reinforce the exact preceding topic; they do not assess prerequisites or ask generic study questions.
- If a lab step was emitted as workshop, return it as type "lab".
- If a review step was emitted as theory, return it as type "summary".
- Use complete step objects, not kind/content field lists.

Subject: ${trimText(subject, "Programming")}
Module index: ${moduleIndex}
Quality warnings for this module: ${JSON.stringify(qualityWarnings).slice(0, 1800)}
Module JSON: ${JSON.stringify(module ?? {}).slice(0, 7000)}
${formatEditableCourseGenerationRules(3000)}`;
}

export function buildGeneratedTopicRepairPrompt({ subject, topic, moduleIndex = 0, topicIndex = 0, qualityWarnings = [] }) {
  const requestedLanguage = resolveCourseLanguage(subject);
  return `Repair only this generated Stonecode topic.

Return strict JSON only:
{
  "moduleIndex":${moduleIndex},
  "topicIndex":${topicIndex},
  "topic": { "id":"topic-id", "title":"...", "summary":"...", "blocks":[] }
}

Rules:
- Keep every coding step in ${requestedLanguage.label}, using ${requestedLanguage.filePath} by default. Do not copy JavaScript syntax from generic schema examples.
- Preserve the topic id, title, block ids, block kinds, and all valid content.
- Fix only the blocks named by the supplied warnings.
- The first block must be theory with real theory/analogy/example/summary teaching before any check.
- A quiz block contains 4 to 10 distinct topic-practice MCQ steps tied to this exact topic's teaching and examples.
- Workshops are guided tutorials with enough atomic steps for the deliverable.
- Every workshop step needs id, buildsOnStepId, conceptIds, context, prompt, expectedChange, starterCode, resultCode, and acceptanceCriteria.
- Every workshop coding step also needs codeExplanation and 2 to 3 suggestedQuestions relevant to that exact micro-change.
- Every practical step also needs workspaceView and a workspaceFiles project manifest. Preserve real folders and related-file contents across steps.
- Each workshop prompt gives one concrete edit. Each context explains what is learned, why it matters, and how it continues the build.
- For workshop continuity, each previous resultCode must exactly equal the next starterCode, and every resultCode must differ from its own starterCode.
- Introduce the whole workshop only on Step 1. Later coding steps explain only their new line or tiny edit; never repeat generic syntax lists, whole-starter explanations, or starter excerpts.
- The final workshop step is a non-coding summary that explains the complete code and its practical use.
- Explain new syntax with a correctly tagged fenced code example before asking the learner to edit it.
- Exercises must directly practice the topic and preceding teaching.
- A lab may appear only after a relevant workshop; a project requires multiple earlier workshops and at least one lab.
- Return the complete corrected topic, not a patch, commentary, module, or course.

Subject: ${trimText(subject, "Programming")}
Module index: ${moduleIndex}
Topic index: ${topicIndex}
Quality warnings for this topic: ${JSON.stringify(qualityWarnings).slice(0, 1800)}
Topic JSON: ${JSON.stringify(topic ?? {}).slice(0, 7500)}
${formatEditableCourseGenerationRules(2600)}`;
}

export function buildAssessmentCourseGenerationPrompt({ subject, answers = [], assessmentReview, courseBlueprint = null, retrievedContext = null }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
  const requestedLanguage = resolveCourseLanguage(subject);
  const contextChunks = retrievedContext ?? retrieveStaticCourseGenerationContext({ subject, learnerContext });
  return `Generate a full Stonecode course as strict JSON.

Return only JSON matching:
{
  "schemaVersion":"course-content/v2",
  "title":"short title",
  "subject":"topic",
  "description":"one sentence",
  "languages":["JavaScript"],
  "tags":["Assessment based"],
  "generationDepth":"full_course",
  "assessmentReview":{"strengths":["..."],"gaps":["..."],"suggestedModules":["..."]},
  "courseBlueprint":{"finalProject":{"title":"...","description":"...","capabilities":["..."]},"miniProjects":[],"conceptSequence":[],"prerequisiteBridges":[],"moduleGoals":[]},
  "modules":[
    {
      "id":"module-slug",
      "title":"Module title",
      "summary":"Module summary",
      "unlocked":true,
      "chapters":[
        {
          "id":"topic-slug",
          "title":"Topic title",
          "summary":"Topic summary",
          "unlocked":true,
          "blocks":[
            {
              "id":"block-slug",
              "kind":"theory",
              "title":"Block title",
              "summary":"Block summary",
              "steps":[
                {"type":"theory","markdown":"## Natural topic intro\\n..."},
                {"type":"analogy","markdown":"## Same analogy, only if useful\\n..."},
                {"type":"example","markdown":"## Small example\\n..."},
                {"type":"mcq","prompt":"Question","options":["A","B","C","D"],"correctOptionIndex":2,"explanation":"Why"}
              ]
            },
            {
              "id":"workshop-block-slug",
              "kind":"workshop",
              "title":"Workshop title",
              "summary":"Guided practical build",
              "steps":[
                {"id":"greeting-step-1","type":"workshop","buildsOnStepId":null,"conceptIds":["console-output"],"language":"JavaScript","filePath":"main.js","context":"We are building a tiny greeting one verified line at a time after learning console output.","prompt":"Step 1: add one console.log line that prints Hi there.","expectedChange":"Add exactly one visible greeting statement.","starterCode":"","resultCode":"console.log('Hi there');","acceptanceCriteria":["Has one console.log greeting","Printed text includes Hi there"],"requiresPreview":false},
                {"id":"greeting-step-2","type":"workshop","buildsOnStepId":"greeting-step-1","conceptIds":["named-value"],"language":"JavaScript","filePath":"main.js","context":"Continue the same greeting. Give the name a reusable label.","prompt":"Step 2: add const playerName = 'Mina' above the greeting.","expectedChange":"Add one const declaration above the existing output.","starterCode":"console.log('Hi there');","resultCode":"const playerName = 'Mina';\nconsole.log('Hi there');","acceptanceCriteria":["Creates const playerName","Keeps the greeting"],"requiresPreview":false},
                {"id":"greeting-step-3","type":"workshop","buildsOnStepId":"greeting-step-2","conceptIds":["string-joining"],"language":"JavaScript","filePath":"main.js","context":"Continue the same greeting and use the stored player name.","prompt":"Step 3: replace only 'there' with ' + playerName'.","expectedChange":"Make console.log join Hi with playerName.","starterCode":"const playerName = 'Mina';\nconsole.log('Hi there');","resultCode":"const playerName = 'Mina';\nconsole.log('Hi ' + playerName);","acceptanceCriteria":["console.log uses playerName","Keeps the const"],"requiresPreview":false},
                {"id":"greeting-step-4","type":"workshop","buildsOnStepId":"greeting-step-3","conceptIds":["condition"],"language":"JavaScript","filePath":"main.js","context":"Continue the same greeting. Add the smallest decision after learning if syntax.","prompt":"Step 4: wrap the existing console.log line in if (playerName) braces.","expectedChange":"Add one if wrapper without changing the greeting line.","starterCode":"const playerName = 'Mina';\nconsole.log('Hi ' + playerName);","resultCode":"const playerName = 'Mina';\nif (playerName) {\n  console.log('Hi ' + playerName);\n}","acceptanceCriteria":["Has one if statement","Greeting stays inside the if block"],"requiresPreview":false},
                {"id":"greeting-step-5","type":"workshop","buildsOnStepId":"greeting-step-4","conceptIds":["fallback-branch"],"language":"JavaScript","filePath":"main.js","context":"Finish the same greeting by handling the empty-name path.","prompt":"Step 5: add an else block that prints No player yet.","expectedChange":"Add one else block after the existing if block.","starterCode":"const playerName = 'Mina';\nif (playerName) {\n  console.log('Hi ' + playerName);\n}","resultCode":"const playerName = 'Mina';\nif (playerName) {\n  console.log('Hi ' + playerName);\n} else {\n  console.log('No player yet');\n}","acceptanceCriteria":["Has if and else paths","Each path prints a result"],"requiresPreview":false}
              ]
            },
            {
              "id":"lab-block-slug",
              "kind":"lab",
              "title":"Lab title",
              "summary":"Independent practice after teaching/workshop",
              "steps":[
                {"type":"lab","language":"JavaScript","filePath":"main.js","context":"The learner has already practiced this exact pattern in the workshop. Now they solve a similar small case independently.","prompt":"Independent task","starterCode":"console.log('start');","acceptanceCriteria":["Criterion","Visible output"],"requiresPreview":false}
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- The exact requested implementation language is ${requestedLanguage.label}, using ${requestedLanguage.filePath} by default. JavaScript shown in the schema example demonstrates field shape only; never copy its language, path, or syntax into a ${requestedLanguage.label} course.
- Generate a complete top-level curriculum like a freeCodeCamp index, with as many modules as the subject and learner gaps naturally need.
- Use only plain raw code in the approved technology catalog. Browser libraries are limited to React, Vue, Svelte, D3, Chart.js, and p5.js with pinned sandboxed versions. Never require external engines, native GUI frameworks, server-dependent frameworks, arbitrary packages, package installation, Assembly, or unreviewed runtimes.
- Pinned browser runtime manifest: ${browserFrameworkRuntimeContract}
- Use only those exact asset URLs. React browser lessons use plain JavaScript with React.createElement, not JSX or a build tool. Vue single-file lessons connect App.vue from HTML with <script type="text/vue" src="App.vue" data-target="#app"></script>; App.vue exports an Options API component with render() using Vue.h, never a template compiler or imports. Svelte connects App.svelte with type="text/svelte" the same way. Other approved libraries use their exact pinned script URL.
- Use the Course blueprint as the hidden spine for the whole syllabus. The course should secretly lead to the final project; each workshop/lab/project should contribute a mini-function, behavior, or capability used later.
- Fully load every generated module with enough chapters/topics to teach its approved direction properly. Each chapter/topic should contain intentional blocks and visible numbered steps.
- The first loaded course step should be a substantive, friendly course introduction before formal teaching. Use 3 to 6 short paragraphs to explain what the learner will understand or build, common real-world uses, the course path, one interesting practical fact, and why the first topic comes first. Do not make it only a tutor greeting.
- Return complete teaching and guided practice for every module. Never return locked outline-only shells as a completed Course.
- Every block must include a "kind" field: "theory", "quiz", "workshop", "lab", "project", or "review".
- Start each new topic/chapter with a theory block before any quiz, workshop, lab, or project. Its opening must orient the learner: the problem this topic solves, how it connects to the course goal/project, and what the learner will understand or build by the end.
- Every theory block must include real teaching steps before any MCQ. Never create a theory block made only of MCQ steps.
- When a topic introduces code syntax, use fenced code snippets with language tags and explain new tokens before the learner uses them in a workshop, lab, or project.
- Do not generate every topic as the same template. Avoid repeating "concept -> analogy -> example -> quiz -> review" as a fixed rhythm.
- Do not use fixed counts like exactly 4 theory steps or exactly 2 workshop steps. The step count must follow the idea size, learner prerequisite gaps, and project complexity.
- A theory block can combine concept and analogy on one page when short, split subtopics across multiple theory steps when the idea is bigger, and place examples wherever they make the explanation click.
- A theory block may use several theory/analogy/example/summary steps when the topic needs more teaching. Do not force exactly one theory step or exactly one MCQ.
- Assume the learner has no programming, coding, or syntax knowledge unless the assessment clearly proved otherwise. Explain every new code word, symbol, punctuation mark, and line before requiring the learner to use it.
- Analogy and example are teaching tools, not mandatory separate pages for every topic. Use them when they improve understanding, and map it back to code or runtime behavior before moving on.
- Use one consistent analogy theme per topic. Do not change analogy themes inside that topic.
- Do not write filler like "beginner confusion", "common confusion", or "typical confusion". Teach the issue directly only when needed.
- Use block kinds intentionally:
  - A "theory" block may contain only theory, analogy, example, summary, and optional mcq steps.
  - Single MCQ checks belong inside theory blocks. If the AI only wants to assess understanding once during teaching, insert an mcq step in the current theory block instead of creating a quiz block.
  - Quiz blocks are low-stakes reinforcement exercises. A "quiz" block must contain only mcq steps and should have 4 to 10 distinct questions grounded in the exact topic just taught.
  - Never use course MCQs to reassess prior knowledge, ask generic study-strategy questions, repeat the same concept in different words, or introduce an untaught concept.
  - Prefer code tracing, output prediction, debugging, and scenario choices. Every explanation teaches the topic connection after either a correct or incorrect choice.
- A "workshop" block must be guided practical continuity. Each workshop step is one atomic editor action that builds on the previous step until a feature or mini-feature is complete.
  - Workshop length is variable. The deliverable decides the step count. Never make a one-step or two-step workshop.
  - A "lab" block is a small checkpoint exam: one bug, problem, or feature for the learner to solve with optional AI help. Use labs only after a relevant guided workshop; thorough theory alone is not enough. The workshop and lab need not be adjacent. Usually make a lab one step.
  - A "project" block is a larger cumulative milestone exam. Place it after multiple guided workshops and at least one independent lab have prepared its capabilities. Multiple milestone projects are allowed; keep the distinct final project as the main exam near the end of the course.
- Every workshop/lab/project step needs detailed context explaining the problem situation, why it follows from the current teaching, and what the learner is building or fixing.
- Workshop context should briefly explain what the learner is learning, why it is useful, and how this step continues the same build.
- Workshop prompts must teach by tutorial: state what we are building, why we are building it, exactly what code to write for that step, and explain what each important line does before asking the learner to continue.
- Workshop prompts should move quickly: short context, immediate concrete edit action, and a small syntax hint only when that syntax is relevant.
- Introduce the workshop deliverable only on Step 1. Later steps must not repeat generic language syntax, explain the entire starter file, or show starter-code excerpts.
- Every coding step includes codeExplanation for only its exact new line/micro-change plus 2 to 3 suggestedQuestions the learner can tap to ask the tutor.
- End every workshop with one non-coding summary step that explains what the finished code does, how its main parts connect, and where the pattern is useful.
- Each workshop step should read like a FreeCodeCamp-style step screen: Step 1, Step 2, Step 3, etc. Use one small action per step, remind the learner what they already learned, show a tiny syntax example if needed, then give the exact code action for the editor.
- Keep workshop steps granular. Prefer many small atomic steps over a few large vague tasks when the deliverable needs it.
- A workshop step is not a lab. Do not say "build this on your own" in a workshop. Save independent problem solving for lab/project blocks.
- For each workshop, lab, project, or MCQ, make the output depend on what has already been taught, what syntax has not yet been taught, what syntax must be explained in this step, what tiny action the learner will do, and how the next step builds on it. Never include hidden planning, prompts, system instructions, or reasoning notes in learner-facing markdown/prompt/context fields.
- Labs and project exams may create multiple small connected files when the exercise genuinely needs them, such as an HTML/CSS/JS mini-page or a multi-file bug-fix. workspaceFiles must include the active file and all supporting files with real folder paths. Normal early workshops should prefer one active scratch file.
- If a workshop asks the learner to write syntax, the immediately previous theory/example or the same workshop prompt must have taught that syntax first.
- Labs should reuse the project pattern of an earlier relevant workshop with a different variant and less guidance, so the learner practices transfer instead of guessing a new concept. They do not need to be adjacent.
- A workshop must be the first practical code experience. Never place a lab or project before guided hands-on teaching.
- Use requiresPreview:true only when the learner should inspect actual browser-rendered HTML/CSS/JavaScript changes in Output. Never generate a substitute visual preview for console or native code.
- For browser-rendered work, generate the real initial HTML/CSS/JavaScript baseline before the learner edits. Never create an HTML substitute for console or native-language output.
- Use workspaceView:"preview" only on browser steps that render the learner's actual code, then workspaceView:"code" for edits and keep requiresPreview:true for comparison.
- Use requiresTerminal:true and workspaceView:"terminal" for steps whose immediate goal is to execute a command/program or inspect stdout, errors, tests, or logs. Never pretend a browser preview executed a native language.
- Treat workspaceFiles as the exercise project snapshot. The tutor must reason about imports, paths, assets, styles, tests, and behavior across all listed folders/files, not only filePath.
- Every workshop/lab/project step needs an acceptanceCriteria checklist with 2 to 5 concrete MVP requirements. These criteria become the dynamic checklist in the UI.
- Workshop steps must carry forward the previous step's file and behavior. Do not restart from unrelated starter code in the next workshop step.
- Encode workshop continuity explicitly: Step 1 has buildsOnStepId:null; each later step references the previous step id; each resultCode becomes the next starterCode.
- Theory must not be shallow. Loaded module 1 teaching steps should feel like a real tutor: introduce the topic naturally, explain why it matters, then use a consistent analogy and concrete example before checks.
- The first explanation for a new concept should be simple enough for a 10-year-old, then gradually add the technical names, analogy, and example.
- When showing code, explain every new token the first time it appears: keyword, name, quotes, parentheses, braces, semicolon, indentation, operator, and output call.
- The tutor voice should feel human and varied, not like a form. Use headings, bullets, short jokes, or light dry sarcasm when it helps, but never mock the learner.
- Only the first course step may introduce Stonecode. New topics should start with the topic title and a natural continuity line from the previous topic.
- Do not optimize for token saving in loaded teaching content.
- Every exercise must test relevant material already taught and practiced earlier in the course path. Do not introduce an exercise that requires an untaught idea. Only workshop micro-steps require immediate step-to-step code continuity.
- Reflection/"Answer in chat" prompts must include a short recap or clue before asking the learner to answer.
- Theory never asks the learner to answer; questions only use mcq, reflection, lab, workshop, or project steps.
- Course-shaping assessment answers are learner preferences. Use them only to choose relevant catalog languages and approved browser libraries. Do not treat them as right or wrong.
- Assessment review suggestedModules are planning inputs. The generated modules must visibly include them, rename them naturally, or merge them into equivalent module coverage; do not ignore them.
- For advanced/applied subjects, use learnerContext.refresher as a gate: when needed, Module 1 is a narrow refresher containing only base-language concepts required by the target (for example, JavaScript functions, arrays, objects, and DOM events needed before React). When not needed, do not add a generic refresher.
- For all generated MCQ steps, make distractors plausible and similar length. Distribute correctOptionIndex across 0, 1, 2, and 3; do not default to 0.
- Use language-appropriate simple file paths. Examples: main.js, main.ts, index.html, styles.css, main.py, Main.java, main.cpp, main.c, Program.cs, main.go, main.rs, index.php, main.rb, main.swift.
- Match starterCode to the language. Never use JavaScript starter code for C++, Java, Python, Go, Rust, Ruby, Swift, C#, PHP, SQL, or shell exercises.
- Broad courses should teach only relevant language parts.
- A step may include optional visualCue using {"version":"tutor-visual-cue/v1","id":"...","kind":"diagram|illustration","title":"...","description":"...","caption":"...","altText":"...","labels":["..."],"preferredRenderer":"auto|svg|image"}.
- Add visualCue only when a diagram or spatial illustration materially improves the explanation. Prefer diagram/svg for algorithms, data structures, control flow, memory, architecture, and exact relationships. Do not use it for browser program output.

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Course blueprint:
${JSON.stringify(courseBlueprint ?? {}).slice(0, 2400)}
Retrieved course-generation context:
${formatStaticCourseGenerationContext(contextChunks).slice(0, 2200)}
${formatEditableCourseGenerationRules(4500)}
Assessment answers: ${JSON.stringify(answers).slice(0, 2000)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}`;
}

export function buildCourseSetupReplyPrompt({ messages, answerCount }) {
  const transcript = messages
    .map((message) => `${message.role}: ${trimText(message.content, "")}`)
    .filter((line) => line.trim())
    .join("\n");
  const nextInstruction = answerCount <= 1
    ? "Acknowledge the requested subject, say you need to check prerequisite skills for that subject, and ask if they are ready for a short assessment."
    : "Continue the assessment flow only. Ask exactly one assessment exercise or say the assessment review is ready. Do not ask for learning preferences.";

  return `Course setup transcript:
${transcript}

Task:
${nextInstruction}

Rules:
- One short friendly reply.
- Ask exactly one main question.
- Do not ask for current level, project type, learning mode, Leetcode preference, preferred pace, design preference, or course preview changes.
- Do not claim the course is finalized.
- Do not list a syllabus yet.`;
}

export function buildCourseDiscoveryPrompt({ messages = [], turn = 0 }) {
  const transcript = messages
    .filter((message) => message && (message.role === "assistant" || message.role === "user"))
    .slice(-10)
    .map((message) => `${message.role}: ${trimText(message.content, "")}`)
    .filter((line) => line.trim())
    .join("\n");

  return `You are the Stonecode course-discovery tutor. Hold a short, natural conversation that turns a beginner's vague programming goal into one specific course target before prerequisite assessment.

Return strict JSON only:
{
  "status":"clarifying|ready|unsupported",
  "reply":"short conversational response ending with at most one question when clarifying",
  "suggestions":["clickable direct answer","clickable direct answer"],
  "resolvedSubject":"specific course target when ready, otherwise empty"
}

Conversation turn: ${Number.isInteger(turn) ? turn : 0}
Transcript:
${transcript || "No messages yet. Start the conversation."}

Rules:
- When there is no transcript, greet the learner naturally and make it clear they may start from a project idea, language, feature, end goal, or lesson type. Ask one broad first question and provide 5 varied recommended programming starting points that directly answer that question.
- Suggestions must answer the exact question in reply. Make them short, distinct, useful, and clickable without editing.
- Keep free typing possible; never imply the learner must choose a suggestion.
- Ask only one main clarification question per turn.
- Keep discovery short; do not drag the learner past 6 to 7 useful clarification questions.
- Clarify only what changes the curriculum: intended outcome, product type, platform, or relevant technology choice.
- If the learner names an exact standalone language fundamentals course, it can be ready immediately.
- If the learner says only "make a game", "build a website", "make an app", "backend", "data", or another broad outcome, ask focused follow-ups until the target is teachable.
- The learner does not need to know a language/framework. If they do not, recommend a reviewed catalog choice in suggestions with plain outcome-focused labels. Do not expect technical knowledge.
- A ready target should be specific enough to plan, for example "Python fundamentals", "browser games with JavaScript Canvas", or "beginner component interfaces with React".
- Return unsupported for external engines, native GUI frameworks, server-dependent frameworks, arbitrary packages, Assembly, or a framework/library outside React, Vue, Svelte, D3, Chart.js, and p5.js.
- Do not ask for self-rated level, learning style, pace, Leetcode preference, or design preference. Prerequisite knowledge is handled by assessment later.
- Stonecode supports programming/software courses only. For unsupported requests, briefly redirect and suggest programming alternatives.
- Do not fabricate live popularity, usage counts, or claims about what other users learned this week. You may call suggestions "popular starting points" without claiming real-time analytics.
- Do not generate a syllabus, assessment question, or course content yet.
- After several vague turns, narrow the choices to 2 to 4 concrete recommended paths, but wait for the learner to choose or confirm one.
- status=ready requires a non-empty resolvedSubject and should not ask another clarification question.
- status=clarifying or unsupported requires 2 to 6 suggestions and an empty resolvedSubject.`;
}

export function normalizeCourseDiscoveryTurn(value) {
  const status = ["clarifying", "ready", "unsupported"].includes(value?.status) ? value.status : "";
  const reply = trimText(value?.reply, "").slice(0, 700);
  const suggestions = uniqueStrings(value?.suggestions).map((item) => item.slice(0, 90)).slice(0, 6);
  const resolvedSubject = trimText(value?.resolvedSubject, "").slice(0, 140);

  if (!status || !reply) throw new Error("Course discovery response is missing status or reply.");
  if (status === "ready" && !resolvedSubject) throw new Error("Ready course discovery response is missing resolvedSubject.");
  if (status !== "ready" && suggestions.length < 2) throw new Error("Course discovery question needs at least two suggested answers.");

  return {
    status,
    reply,
    suggestions: status === "ready" ? [] : suggestions,
    resolvedSubject: status === "ready" ? resolvedSubject : ""
  };
}

export function buildChapterGenerationPrompt({ content, chapterIndex }) {
  const chapter = content.chapters[chapterIndex];
  return `Generate full Stonecode content for chapter ${chapterIndex + 1} as strict JSON.

Return only JSON matching:
{"chapterIndex":${chapterIndex},"chapter":{ "id":"${chapter?.id ?? `chapter-${chapterIndex + 1}`}", "title":"...", "summary":"...", "sections":[...] }}

Course: ${content.title}
Subject: ${content.subject}
Chapter roadmap title: ${chapter?.title ?? `Chapter ${chapterIndex + 1}`}
Chapter roadmap summary: ${chapter?.summary ?? ""}

Rules:
- Preserve the chapter id when present.
- Fill every section with blocks.
- Keep theory, checks, writing prompts, and code exercises in separate sections.
- Theory sections must teach only: concept, analogy, example, and topic transition. Do not ask the learner to answer inside theory.
- Start every new topic with at least 3 consecutive theory-style sections before any MCQ, chat_exercise, or code_exercise.
- Put all learner tests in MCQ, chat_exercise, or code_exercise sections after the teaching section.
- Code exercises need language, simple filePath, prompt, starterCode, and acceptanceCriteria.
- Code exercise file paths should be simple filenames, not nested folders.`;
}

function buildChapter({ chapterIndex, subject, title, summary, includeContent }) {
  const chapterId = slugify(`${chapterIndex + 1}-${title}`);
  const sections = [
    {
      id: `${chapterId}-mental-model`,
      title: "Mental model",
      summary: `Understand the key idea before touching code.`,
      blocks: includeContent
        ? [
            { type: "theory", markdown: `## ${title}\n\nThink of ${subject} as a set of small moves you can name, test, and combine.\n\n## Simple example\n\nA tiny program has an input, a step that changes or reads it, and an output you can inspect.` },
            { type: "extra_explanation", markdown: `## Analogy\n\nTreat the code like a small kitchen recipe. Inputs are ingredients, the steps are instructions, and output is the finished plate.` },
            { type: "extra_explanation", markdown: `## Slow explanation\n\nFirst identify the input, then the transformation, then the output.\n\nNow that the mental model is clear, the next checkpoint will test the idea separately.` }
          ]
        : []
    },
    {
      id: `${chapterId}-check`,
      title: "Quick check",
      summary: `Answer a short generated question before coding.`,
      blocks: includeContent
        ? [
            {
              type: "mcq",
              prompt: "What should you identify before editing beginner code?",
              options: ["The input and output", "The font size", "The deployment provider", "The invoice ID"],
              correctOptionIndex: 0,
              explanation: "Inputs and outputs tell you what behavior must stay correct."
            },
            {
              type: "chat_exercise",
              prompt: "Explain the current idea in one or two sentences using your own words.",
              rubric: "Pass when the learner names the input, the expected output, and one reason the step matters."
            }
          ]
        : []
    },
    {
      id: `${chapterId}-editor-task`,
      title: "Editor practice",
      summary: `Write code in the middle editor and submit it from the course panel.`,
      blocks: includeContent
        ? [
            {
              type: "code_exercise",
              language: inferPrimaryLanguage(subject),
              filePath: "main.js",
              prompt: "Create a tiny function, run it with two examples, and keep the output readable.",
              starterCode: "function describeInput(value) {\n  return `Input: ${value}`;\n}\n\nconsole.log(describeInput(\"stone\"));\n",
              acceptanceCriteria: ["Uses a named function", "Logs at least one example", "Keeps the code runnable in the Stonecode editor"]
            }
          ]
        : []
    }
  ];

  return { id: chapterId, title, summary, sections };
}

function normalizeChapter(chapter, chapterIndex) {
  const title = trimText(chapter?.title, `Chapter ${chapterIndex + 1}`);
  const id = slugify(chapter?.id || `${chapterIndex + 1}-${title}`);
  const sections = Array.isArray(chapter?.sections)
    ? chapter.sections.map((section, sectionIndex) => normalizeSection(section, sectionIndex, id))
    : [];
  if (!sections.length) throw new Error(`Chapter ${chapterIndex + 1} requires at least one section.`);
  return {
    id,
    title,
    summary: trimText(chapter?.summary, "Generated chapter."),
    order: chapterIndex,
    sections
  };
}

function normalizeSection(section, sectionIndex, chapterId) {
  const title = trimText(section?.title, `Section ${sectionIndex + 1}`);
  return {
    id: slugify(section?.id || `${chapterId}-${sectionIndex + 1}-${title}`),
    title,
    summary: trimText(section?.summary, "Generated section."),
    order: sectionIndex,
    blocks: Array.isArray(section?.blocks) ? section.blocks.map(normalizeBlock).filter(Boolean) : []
  };
}

function normalizeBlock(block) {
  if (!block || typeof block !== "object") return null;
  const type = block.type;
  if (type === "theory" || type === "extra_explanation") {
    return { type, markdown: trimText(block.markdown, "## Explanation\n\nRead this idea, then try the check.") };
  }
  if (type === "mcq") {
    const options = uniqueStrings(block.options).slice(0, 6);
    if (options.length < 2) return null;
    const correctOptionIndex = Number.isInteger(block.correctOptionIndex)
      ? Math.min(Math.max(block.correctOptionIndex, 0), options.length - 1)
      : 0;
    return rotateCorrectOption({
      type,
      prompt: trimText(block.prompt, "Choose the best answer."),
      options,
      correctOptionIndex,
      explanation: trimText(block.explanation, "Review the explanation and try again.")
    }, `${trimText(block.prompt, "Choose the best answer.")}:${options.join("|")}`);
  }
  if (type === "chat_exercise") {
    return {
      type,
      prompt: trimText(block.prompt, "Answer in chat using your own words."),
      rubric: trimText(block.rubric, "Look for clear beginner reasoning.")
    };
  }
  if (type === "code_exercise") {
    const languageInfo = resolveCourseLanguage(block.language || block.filePath);
    const acceptanceCriteria = uniqueStrings(block.acceptanceCriteria).length
      ? uniqueStrings(block.acceptanceCriteria)
      : defaultAcceptanceCriteria(languageInfo, "lab");
    return {
      type,
      language: languageInfo.label,
      filePath: normalizeExerciseFilePath(block.filePath, languageInfo),
      prompt: trimText(block.prompt, "Complete the task in the editor."),
      starterCode: typeof block.starterCode === "string" && block.starterCode.trim() ? block.starterCode : starterCodeForLanguage(languageInfo),
      acceptanceCriteria: acceptanceCriteria.length >= 2 ? acceptanceCriteria : [...acceptanceCriteria, "Task behavior is visible"]
    };
  }
  if (type === "canvas" || type === "code_showcase") {
    return {
      type,
      language: typeof block.language === "string" ? block.language.trim() : "",
      markdown: trimText(block.markdown, "```js\nconsole.log(\"example\")\n```")
    };
  }
  return null;
}

function normalizeAssessmentReview(review) {
  return {
    strengths: uniqueStrings(review?.strengths).slice(0, 6),
    gaps: uniqueStrings(review?.gaps).slice(0, 6),
    suggestedModules: uniqueStrings(review?.suggestedModules).slice(0, 8)
  };
}

function normalizeCourseBlueprint(blueprint) {
  const finalProject = blueprint?.finalProject && typeof blueprint.finalProject === "object" ? blueprint.finalProject : {};
  return {
    finalProject: {
      title: trimText(finalProject.title, "Final project"),
      description: trimText(finalProject.description, "Combine the course skills into one small finished program."),
      capabilities: uniqueStrings(finalProject.capabilities).slice(0, 10)
    },
    miniProjects: Array.isArray(blueprint?.miniProjects)
      ? blueprint.miniProjects.map(normalizeMiniProject).filter(Boolean).slice(0, 20)
      : [],
    conceptSequence: uniqueStrings(blueprint?.conceptSequence).slice(0, 40),
    prerequisiteBridges: uniqueStrings(blueprint?.prerequisiteBridges).slice(0, 12),
    moduleGoals: Array.isArray(blueprint?.moduleGoals)
      ? blueprint.moduleGoals.map(normalizeModuleGoal).filter(Boolean).slice(0, 20)
      : []
  };
}

function createDefaultCourseBlueprint({ subject, assessmentReview }) {
  const normalizedSubject = trimText(subject, "Programming");
  const suggested = uniqueStrings(assessmentReview?.suggestedModules);
  return {
    finalProject: {
      title: `${normalizedSubject} final project`,
      description: `Build a small ${normalizedSubject} project that combines the core course skills.`,
      capabilities: ["Read a small requirement", "Write tiny connected pieces", "Test visible behavior"]
    },
    miniProjects: suggested.slice(0, 6).map((title, index) => ({
      title: `${title} mini build`,
      moduleId: `module-${index + 1}`,
      topicId: "",
      blockKind: index % 2 === 0 ? "workshop" : "lab",
      connectsTo: "Final project capability"
    })),
    conceptSequence: suggested,
    prerequisiteBridges: uniqueStrings(assessmentReview?.gaps).slice(0, 6),
    moduleGoals: suggested.slice(0, 8).map((goal, index) => ({
      moduleId: `module-${index + 1}`,
      goal
    }))
  };
}

function normalizeMiniProject(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: trimText(item.title, "Mini build"),
    moduleId: trimText(item.moduleId, ""),
    topicId: trimText(item.topicId, ""),
    blockKind: normalizeBlockKindName(item.blockKind),
    connectsTo: trimText(item.connectsTo, "Final project capability")
  };
}

function normalizeModuleGoal(item) {
  if (!item || typeof item !== "object") return null;
  return {
    moduleId: trimText(item.moduleId, ""),
    goal: trimText(item.goal, "Build one course capability")
  };
}

function normalizeRagSources(sources) {
  return Array.isArray(sources)
    ? sources.map((source) => ({
        id: trimText(source?.id, ""),
        title: trimText(source?.title, ""),
        sourceType: trimText(source?.sourceType, ""),
        url: trimText(source?.url, "")
      })).filter((source) => source.id).slice(0, 20)
    : [];
}

function normalizeModule(module, moduleIndex, defaultLanguageInfo = courseLanguages[0], unlockAllModules = false) {
  const title = trimText(module?.title, `Module ${moduleIndex + 1}`);
  const id = slugify(module?.id || `${moduleIndex + 1}-${title}`);
  const rawTopics = Array.isArray(module?.chapters) ? module.chapters : module?.topics;
  const normalizedTopics = Array.isArray(rawTopics)
    ? rawTopics.map((topic, topicIndex) => normalizeTopic(topic, topicIndex, id, moduleIndex, defaultLanguageInfo, unlockAllModules)).filter(Boolean)
    : [];
  const topics = ensureLoadedModulePracticalBlock(normalizedTopics, id, title, moduleIndex, defaultLanguageInfo, unlockAllModules);
  if (!topics.length) return null;
  return {
    id,
    title,
    summary: trimText(module?.summary, "Generated module."),
    order: moduleIndex,
    unlocked: unlockAllModules || moduleIndex === 0,
    topics
  };
}

function ensureLoadedModulePracticalBlock(topics, moduleId, moduleTitle, moduleIndex, defaultLanguageInfo, unlockAllModules = false) {
  if ((!unlockAllModules && moduleIndex !== 0) || !topics.length) return topics;
  const hasPracticalBlock = topics.some((topic) =>
    topic.blocks.some((block) => ["workshop", "lab", "project"].includes(block.kind))
  );
  if (hasPracticalBlock) return topics;
  const targetTopicIndex = Math.min(1, topics.length - 1);
  const targetTopic = topics[targetTopicIndex];
  const workshop = buildFallbackWorkshopBlock({
    moduleId,
    moduleTitle,
    topic: targetTopic,
    blockIndex: targetTopic.blocks.length,
    languageInfo: defaultLanguageInfo
  });
  return topics.map((topic, index) =>
    index === targetTopicIndex
      ? { ...topic, blocks: [...topic.blocks, workshop] }
      : topic
  );
}

function normalizeTopic(topic, topicIndex, moduleId, moduleIndex = 0, defaultLanguageInfo = courseLanguages[0], unlockAllModules = false) {
  const title = trimText(topic?.title, `Topic ${topicIndex + 1}`);
  const summary = trimText(topic?.summary, "Generated topic.");
  const id = slugify(topic?.id || `${moduleId}-${topicIndex + 1}-${title}`);
  const normalizedBlocks = Array.isArray(topic?.blocks)
    ? topic.blocks.map((block, blockIndex) => normalizeLearningBlock(block, blockIndex, id, defaultLanguageInfo)).filter(Boolean)
    : [];
  const blocks = promoteInlineMcqsToQuizBlock(normalizedBlocks, id, title);
  if (!blocks.length) return null;
  return {
    id,
    title,
    summary,
    order: topicIndex,
    unlocked: unlockAllModules || moduleIndex === 0,
    blocks
  };
}

function buildFallbackWorkshopBlock({ moduleId, moduleTitle, topic, blockIndex, languageInfo }) {
  const topicTitle = trimText(topic?.title, "this topic");
  const topicSummary = trimText(topic?.summary, `practice ${topicTitle}`);
  const filePath = normalizeExerciseFilePath("", languageInfo);
  const fallbackSteps = buildFallbackWorkshopSteps({ moduleTitle, topicTitle, topicSummary, languageInfo, filePath });
  return {
    id: `${topic?.id ?? moduleId}-guided-workshop`,
    kind: "workshop",
    title: `${topicTitle} guided workshop`,
    summary: `Practice ${topicTitle} with a small guided ${languageInfo.label} build.`,
    order: blockIndex,
    steps: fallbackSteps.map((step, stepIndex) => ({
      type: "workshop",
      language: languageInfo.label,
      filePath,
      context: fallbackWorkshopContext({ moduleTitle, topicTitle, topicSummary, stepNumber: stepIndex + 1, languageInfo }),
      prompt: step.prompt,
      starterCode: step.starterCode,
      acceptanceCriteria: fallbackWorkshopAcceptanceCriteria({ stepNumber: stepIndex + 1, filePath }),
      requiresPreview: false
    }))
  };
}

function fallbackWorkshopContext({ moduleTitle, topicTitle, topicSummary, stepNumber, languageInfo }) {
  const setup = `This ${languageInfo.label} workshop belongs to ${moduleTitle} and practices ${topicTitle}.`;
  if (stepNumber === 1) return `${setup} The topic goal is ${topicSummary}. Start with one tiny visible result so the learner can connect the explanation to runnable code.`;
  return `${setup} Continue the same file from step ${stepNumber - 1}. Keep the task small so the learner practices the same idea without a new concept jump.`;
}

function buildFallbackWorkshopSteps({ topicTitle, languageInfo }) {
  const starter = starterCodeForLanguage(languageInfo);
  return [
    {
      prompt: `Step 1: read the starter code for ${topicTitle}. Identify the one line that creates visible output before changing anything.`,
      starterCode: starter
    },
    {
      prompt: "Step 2: change one literal value in that output line. This teaches that tiny code edits can create visible behavior changes.",
      starterCode: starter
    },
    {
      prompt: "Step 3: create one named value for the thing you changed. Explain that the name lets later code reuse the value.",
      starterCode: starter
    },
    {
      prompt: "Step 4: print the named value instead of repeating the literal. Keep the same file and only make this one substitution.",
      starterCode: starter
    },
    {
      prompt: "Step 5: add one second named value that belongs to the same tiny example. Do not introduce a new concept beyond another stored value.",
      starterCode: starter
    },
    {
      prompt: "Step 6: combine the two named values in one visible output line, then check that the result matches your reasoning.",
      starterCode: starter
    }
  ];
}

function fallbackWorkshopAcceptanceCriteria({ stepNumber, filePath }) {
  return [
    `Keeps the work in ${filePath}`,
    `Completes workshop step ${stepNumber}`,
    "Produces a visible result or clear code change"
  ];
}

function promoteInlineMcqsToQuizBlock(blocks, topicId, topicTitle) {
  if (blocks.some((block) => ["quiz", "workshop", "lab", "project"].includes(block.kind))) return blocks;
  const mcqSteps = blocks.flatMap((block) => block.kind === "theory" ? block.steps.filter((step) => step.type === "mcq") : []);
  if (mcqSteps.length < 4) return blocks;
  const theoryBlocks = blocks
    .map((block) => {
      if (block.kind !== "theory") return block;
      const nonMcqSteps = block.steps.filter((step) => step.type !== "mcq");
      return nonMcqSteps.length ? { ...block, steps: nonMcqSteps } : null;
    })
    .filter(Boolean);
  return [
    ...theoryBlocks,
    {
      id: `${topicId}-quiz`,
      kind: "quiz",
      title: `${topicTitle} checkpoint`,
      summary: "Check understanding before moving on.",
      order: theoryBlocks.length,
      steps: mcqSteps.slice(0, 10)
    }
  ];
}

function normalizeLearningBlock(block, blockIndex, topicId, defaultLanguageInfo = courseLanguages[0]) {
  const title = trimText(block?.title, `Block ${blockIndex + 1}`);
  const id = slugify(block?.id || `${topicId}-${blockIndex + 1}-${title}`);
  const steps = Array.isArray(block?.steps) ? block.steps.map((step) => normalizeLearningStep(step, defaultLanguageInfo)).filter(Boolean) : [];
  if (!steps.length) return null;
  let kind = normalizeBlockKind(block?.kind, steps);
  let allowedSteps = filterStepsForKind(kind, coerceStepsForKind(kind, steps));
  if (!allowedSteps.length) {
    kind = normalizeBlockKind("", steps);
    allowedSteps = filterStepsForKind(kind, coerceStepsForKind(kind, steps));
  }
  if (!allowedSteps.length) return null;
  const workshopSteps = kind === "workshop" ? allowedSteps.filter((step) => step.type === "workshop") : [];
  if (kind === "workshop" && workshopSteps.length < minimumWorkshopStepCount) return null;
  const contractedSteps = kind === "workshop"
    ? ensureWorkshopRecapStep({
        blockId: id,
        blockSummary: trimText(block?.summary, "Generated workshop."),
        blockTitle: title,
        summaryStep: [...allowedSteps].reverse().find((step) => step.type === "summary"),
        workshopSteps: normalizeWorkshopContinuity(workshopSteps, id)
      })
    : allowedSteps.map((step, stepIndex) => ({ ...step, id: step.id || `${id}-step-${stepIndex + 1}` }));
  return {
    id,
    kind,
    title,
    summary: trimText(block?.summary, "Generated block."),
    order: blockIndex,
    steps: contractedSteps
  };
}

function ensureWorkshopRecapStep({ blockId, blockSummary, blockTitle, summaryStep, workshopSteps }) {
  const recap = summaryStep ?? {
    type: "summary",
    markdown: buildWorkshopRecapMarkdown(blockTitle, blockSummary, workshopSteps)
  };
  return [...workshopSteps, { ...recap, id: recap.id || `${blockId}-recap` }];
}

function buildWorkshopRecapMarkdown(blockTitle, blockSummary, workshopSteps) {
  const changes = workshopSteps
    .map((step) => trimText(step.expectedChange, step.prompt))
    .filter(Boolean)
    .map((change) => `- ${change.replace(/^Step\s+\d+\s*:\s*/i, "")}`)
    .join("\n");
  const finalStep = workshopSteps.at(-1);
  const finalCode = trimText(finalStep?.resultCode, "");
  const language = trimText(finalStep?.language, "text").toLowerCase().replace(/[^a-z0-9+#]/g, "");
  const code = finalCode ? `\n\n## The finished code\n\n\`\`\`${language}\n${finalCode}\n\`\`\`` : "";
  return `## Workshop complete\n\nYou finished **${blockTitle}**. ${blockSummary}\n\n## What the code now does\n\n${changes || "- It combines the workshop edits into one working behavior."}${code}\n\n## Why this matters\n\nThis recap closes the guided build. Ask the tutor about any line before moving to independent practice.`;
}

function normalizeWorkshopContinuity(steps, blockId) {
  const normalized = [];
  for (let index = 0; index < steps.length; index += 1) {
    const raw = steps[index];
    const previous = normalized[index - 1] ?? null;
    const id = slugify(raw.id || `${blockId}-step-${index + 1}`);
    const starterCode = previous?.resultCode || raw.starterCode;
    const nextStarterCode = typeof steps[index + 1]?.starterCode === "string" ? steps[index + 1].starterCode : "";
    const resultCode = trimText(raw.resultCode, nextStarterCode || starterCode);
    normalized.push({
      ...raw,
      id,
      buildsOnStepId: previous?.id ?? null,
      starterCode,
      resultCode,
      workspaceFiles: normalizeExerciseWorkspaceFiles(raw.workspaceFiles, { filePath: raw.filePath, starterCode }),
      expectedChange: trimText(raw.expectedChange, raw.prompt),
      conceptIds: uniqueStrings(raw.conceptIds).length ? uniqueStrings(raw.conceptIds) : [slugify(raw.assessmentArea || blockId)]
    });
  }
  return normalized;
}

function normalizeBlockKind(kind, steps) {
  const rawKind = typeof kind === "string" ? kind.trim().toLowerCase() : "";
  const mcqCount = steps.filter((step) => step.type === "mcq").length;
  const teachingCount = steps.filter((step) => ["theory", "analogy", "example", "summary"].includes(step.type)).length;
  const workshopCount = steps.filter((step) => step.type === "workshop").length;
  if (rawKind === "quiz") return mcqCount >= 4 ? "quiz" : "theory";
  if (rawKind === "theory" && teachingCount === 0 && mcqCount >= 4) return "quiz";
  if (["theory", "workshop", "lab", "project", "review"].includes(rawKind)) return rawKind;
  if (steps.every((step) => step.type === "mcq")) return mcqCount >= 4 ? "quiz" : "theory";
  if (steps.some((step) => step.type === "lab")) return "lab";
  if (workshopCount >= minimumWorkshopStepCount) return "workshop";
  if (steps.some((step) => step.type === "project")) return "project";
  if (steps.every((step) => step.type === "summary")) return "review";
  return "theory";
}

function filterStepsForKind(kind, steps) {
  return steps.filter((step) => {
    if (kind === "theory") return ["theory", "analogy", "example", "summary", "mcq"].includes(step.type);
    if (kind === "quiz") return step.type === "mcq";
    if (kind === "workshop") return step.type === "workshop" || step.type === "summary";
    if (kind === "lab") return step.type === "lab";
    if (kind === "project") return step.type === "project";
    if (kind === "review") return step.type === "reflection" || step.type === "summary";
    return true;
  });
}

function coerceStepsForKind(kind, steps) {
  return steps.map((step) => {
    if (kind === "lab" && step.type === "workshop") return { ...step, type: "lab" };
    if (kind === "project" && (step.type === "workshop" || step.type === "lab")) return { ...step, type: "project" };
    if (kind === "review" && step.type === "theory") return { type: "summary", markdown: step.markdown };
    if (kind === "review" && step.type === "mcq") {
      return {
        type: "reflection",
        prompt: `Quick recap: ${step.prompt}`,
        rubric: trimText(step.explanation, "Pass when the learner explains the idea in their own words.")
      };
    }
    return step;
  });
}

function normalizeLearningStep(step, defaultLanguageInfo = courseLanguages[0]) {
  if (!step || typeof step !== "object") return null;
  if (step.type === "quiz" && Array.isArray(step.options)) return withTutorVisualCue(normalizeBlock({ ...step, type: "mcq" }), step);
  if (step.type === "theory" || step.type === "analogy" || step.type === "example" || step.type === "summary") {
    return withTutorVisualCue({ type: step.type, markdown: trimText(step.markdown, "## Explanation\n\nStart with the idea, then inspect a simple example.") }, step);
  }
  if (step.type === "mcq") return withTutorVisualCue(normalizeBlock(step), step);
  if (step.type === "reflection") {
    const prompt = trimText(step.prompt, "Explain the idea in your own words.");
    return withTutorVisualCue({
      type: "reflection",
      prompt: wordCount(prompt) >= 10
        ? prompt
        : `${prompt} Include what changed, why it changed, and one tiny example from this topic.`,
      rubric: trimText(step.rubric, "Pass when the learner gives coherent beginner reasoning tied to the current topic.")
    }, step);
  }
  if (step.type === "workshop" || step.type === "lab" || step.type === "project") {
    const languageInfo = resolveCourseLanguage(step.language || defaultLanguageInfo.label || step.filePath);
    const filePath = normalizeExerciseFilePath(step.filePath, languageInfo);
    const rawStarterCode = typeof step.starterCode === "string" ? step.starterCode : "";
    const starterCode = typeof step.starterCode === "string" && !isMismatchedStarterCode(rawStarterCode, languageInfo)
      ? rawStarterCode
      : starterCodeForLanguage(languageInfo);
    const acceptanceCriteria = uniqueStrings(step.acceptanceCriteria).length
      ? uniqueStrings(step.acceptanceCriteria)
      : defaultAcceptanceCriteria(languageInfo, step.type);
    const context = trimText(
      step.context || step.scenario || step.exampleContext,
      defaultExerciseContext(languageInfo, step.type)
    );
    const prompt = trimText(step.prompt, "Complete the task in the editor.");
    const browserRequested = languageInfo.execution === "preview" || (languageInfo.id === "javascript" && Boolean(step.requiresPreview));
    const normalizedWorkspaceFiles = normalizeExerciseWorkspaceFiles(step.workspaceFiles, { filePath, starterCode });
    const rawWorkspaceFiles = browserRequested
      ? normalizedWorkspaceFiles
      : normalizedWorkspaceFiles.filter((file) => !file.path.toLowerCase().startsWith("preview/"));
    const workspaceFiles = browserRequested ? ensureCourseBrowserWorkspace(rawWorkspaceFiles, languageInfo) : rawWorkspaceFiles;
    const requiresPreview = browserRequested && (hasCourseBrowserEntry(workspaceFiles) || (filePath.toLowerCase() === "index.html" && hasRenderableHtml(step.resultCode)));
    const requiresTerminal = !requiresPreview && languageInfo.execution !== "preview";
    return withTutorVisualCue({
      type: step.type,
      id: typeof step.id === "string" ? slugify(step.id) : undefined,
      language: languageInfo.label,
      filePath,
      prompt: wordCount(prompt) >= 8
        ? prompt
        : `${prompt} Make one small code change, then check the visible result before continuing.`,
      starterCode,
      resultCode: typeof step.resultCode === "string" && step.resultCode.trim() ? step.resultCode : undefined,
      expectedChange: trimText(step.expectedChange, prompt),
      codeExplanation: trimText(step.codeExplanation, step.expectedChange || prompt),
      suggestedQuestions: uniqueStrings(step.suggestedQuestions).length
        ? uniqueStrings(step.suggestedQuestions).slice(0, 3)
        : ["Explain the new code line", "Why does this step come next?", "What happens if I change this value?"],
      buildsOnStepId: typeof step.buildsOnStepId === "string" ? slugify(step.buildsOnStepId) : null,
      conceptIds: uniqueStrings(step.conceptIds),
      acceptanceCriteria: acceptanceCriteria.length >= 2
        ? acceptanceCriteria
        : [...acceptanceCriteria, "The result is visible from the code or output"],
      context: wordCount(context) >= 10
        ? context
        : `${context} This step should stay connected to the current topic and avoid introducing a new concept.`,
      requiresPreview,
      requiresTerminal,
      workspaceView: requiresPreview && step.workspaceView === "preview"
        ? "preview"
        : requiresTerminal && step.workspaceView === "terminal"
          ? "terminal"
          : "code",
      workspaceFiles
    }, step);
  }
  return null;
}

function withTutorVisualCue(normalizedStep, rawStep) {
  const visualCue = normalizeTutorVisualCue(rawStep?.visualCue);
  return visualCue && normalizedStep ? { ...normalizedStep, visualCue } : normalizedStep;
}

function normalizeTutorVisualCue(value) {
  if (!value || typeof value !== "object") return undefined;
  const title = trimText(value.title, "Visual explanation").slice(0, 120);
  const description = trimText(value.description, "A focused visual explanation for this learning step.").slice(0, 800);
  const altText = trimText(value.altText, description).slice(0, 300);
  const caption = trimText(value.caption, title).slice(0, 240);
  const kind = value.kind === "illustration" ? "illustration" : "diagram";
  return {
    version: "tutor-visual-cue/v1",
    id: slugify(value.id || title),
    kind,
    title,
    description,
    caption,
    altText,
    labels: uniqueStrings(value.labels).slice(0, 6),
    preferredRenderer: ["auto", "svg", "image"].includes(value.preferredRenderer) ? value.preferredRenderer : "auto"
  };
}

function normalizeExerciseWorkspaceFiles(files, { filePath, starterCode }) {
  const normalized = Array.isArray(files)
    ? files.map((file) => {
        if (!file || typeof file !== "object") return null;
        const rawPath = typeof file.path === "string" ? file.path.trim() : "";
        if (!rawPath) return null;
        const path = normalizePath(rawPath);
        if (path.endsWith("/")) return null;
        return {
          path,
          content: typeof file.content === "string" ? file.content.slice(0, 40000) : "",
          purpose: typeof file.purpose === "string" ? file.purpose.trim().slice(0, 180) : undefined,
          editable: file.editable !== false
        };
      }).filter(Boolean).slice(0, 12)
    : [];
  const activeIndex = normalized.findIndex((file) => file.path === filePath);
  const activeFile = { path: filePath, content: starterCode, purpose: "Active exercise file", editable: true };
  if (activeIndex >= 0) normalized[activeIndex] = { ...normalized[activeIndex], ...activeFile };
  else normalized.unshift(activeFile);
  return normalized;
}

function ensureCourseBrowserWorkspace(files, languageInfo) {
  const output = files.map((file) => ({ ...file }));
  let htmlIndex = output.findIndex((file) => file.path.toLowerCase() === "index.html");
  if (htmlIndex < 0) {
    const cssLink = languageInfo.id === "css" ? '  <link rel="stylesheet" href="styles.css">\n' : "";
    const jsScript = languageInfo.id === "javascript" ? '  <script src="main.js" defer></script>\n' : "";
    output.unshift({
      path: "index.html",
      content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n${cssLink}${jsScript}  <title>Stonecode output</title>\n</head>\n<body>\n  <main id="app">Learning output</main>\n</body>\n</html>`,
      purpose: "Browser output shell",
      editable: languageInfo.id === "html"
    });
    htmlIndex = 0;
  }
  const html = output[htmlIndex];
  if (languageInfo.id === "css" && !/href=["'][^"']*\.css["']/i.test(html.content)) {
    output[htmlIndex] = { ...html, content: html.content.replace(/<\/head>/i, '  <link rel="stylesheet" href="styles.css">\n</head>') };
  }
  if (languageInfo.id === "javascript" && !/<script\b[^>]*src=["'][^"']*\.js["']/i.test(html.content)) {
    output[htmlIndex] = { ...output[htmlIndex], content: output[htmlIndex].content.replace(/<\/body>/i, '  <script src="main.js"></script>\n</body>') };
  }
  return output;
}

function hasCourseBrowserEntry(files) {
  const html = files.find((file) => file.path.toLowerCase() === "index.html")?.content;
  return hasRenderableHtml(html);
}

function hasRenderableHtml(value) {
  return typeof value === "string" && /<(?:html|body|main|div|canvas|section|article|button|form|input|p|h[1-6]|ul|ol)\b/i.test(value);
}

function isMismatchedStarterCode(code, languageInfo) {
  const normalized = trimText(code, "").toLowerCase();
  if (!normalized) return false;
  const label = languageInfo.label.toLowerCase();
  const looksLikeJavaScript = /\bconsole\.log\s*\(|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|\bfunction\s+\w+\s*\(|=>/.test(normalized);
  const looksLikePython = /\bdef\s+\w+\s*\(|\bprint\s*\(|:\n\s{2,}\w/.test(normalized);
  const looksLikeCpp = /#include\s*<iostream>|std::|int\s+main\s*\(/.test(normalized);
  const looksLikeJava = /public\s+class\s+main|system\.out\.println|public\s+static\s+void\s+main/.test(normalized);

  if (label === "javascript" || label === "typescript") return false;
  if (label === "python") return looksLikeJavaScript || looksLikeCpp || looksLikeJava;
  if (label === "c++") return looksLikeJavaScript || looksLikePython || looksLikeJava;
  if (label === "java") return looksLikeJavaScript || looksLikePython || looksLikeCpp;
  if (["c", "c#", "go", "rust", "php", "ruby", "swift", "kotlin", "dart", "r", "julia", "fortran", "cobol", "basic", "sql"].includes(label)) return looksLikeJavaScript || looksLikePython || looksLikeCpp || looksLikeJava;
  return false;
}

function rotateCorrectOption(question, salt) {
  if (!question || !Array.isArray(question.options) || question.options.length < 2) return question;
  const currentIndex = Number.isInteger(question.correctOptionIndex)
    ? Math.min(Math.max(question.correctOptionIndex, 0), question.options.length - 1)
    : 0;
  let targetIndex = stableIndex(salt, question.options.length);
  if (targetIndex === currentIndex && currentIndex === 0) {
    targetIndex = 1 + stableIndex(`${salt}:shift`, question.options.length - 1);
  }
  if (targetIndex === currentIndex) return question;
  const correctOption = question.options[currentIndex];
  const remaining = question.options.filter((_, index) => index !== currentIndex);
  const options = [...remaining];
  options.splice(targetIndex, 0, correctOption);
  return { ...question, options, correctOptionIndex: targetIndex };
}

function stableIndex(value, modulo) {
  if (!modulo) return 0;
  const text = trimText(value, "assessment");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

function buildFallbackModules(subject) {
  const languageInfo = resolveCourseLanguage(subject);
  const language = languageInfo.label;
  const starterCode = starterCodeForLanguage(languageInfo);
  const codeFile = languageInfo.filePath;
  const appliedTheme = fallbackAppliedTheme(subject);
  const lockedModules = [
    ["module-3-problem-solving", "Problem solving patterns", "Turn requirements into small testable steps.", "Inputs, transformations, and outputs"],
    ["module-4-debugging", "Debugging and feedback loops", "Read errors, inspect state, and fix behavior safely.", "Trace the bug"],
    ["module-5-real-world-use", "Real-world application", "Apply the subject to practical examples without overbuilding.", "Small applied build"],
    ["module-6-capstone", "Capstone and review", "Combine the course skills in one final assessment.", "Final course project"]
  ];
  return [
    {
      id: "module-1-foundations",
      title: `${subject} foundations`,
      summary: "Build the mental model, vocabulary, and first runnable feedback loop.",
      unlocked: true,
      topics: [
        {
          id: "chapter-1-mental-model",
          title: "Mental model",
          summary: "Understand the job of the subject before memorizing syntax.",
          unlocked: true,
          blocks: [
            {
              id: "block-1-concept",
              kind: "theory",
              title: "Concept and mental model",
              summary: "Learn the concept, analogy, and first example.",
              steps: [
                { type: "theory", markdown: `## Start here\n\nBefore touching syntax, let us slow the topic down. ${subject} is about turning an idea into behavior you can inspect.\n\nA useful first question is not \"what command do I memorize?\" The useful first question is: what information goes in, what rule changes it, and what result should I be able to see?\n\nFor this topic, keep that three-part shape in mind: input, rule, output. We will use it first in plain language, then in an analogy, then in a small code example.` },
                { type: "analogy", markdown: "## Analogy\n\nThink of a program like a recipe in a kitchen. The input is the ingredients on the counter. The steps are the instructions you follow. The output is the finished plate.\n\nIf the plate tastes wrong, you do not throw away the whole kitchen. You inspect one part: were the ingredients correct, did you miss a step, or did the final result not match what you expected?\n\nLearning code works the same way. You slow the problem down until you can point to the part that matters. That is why beginners should start with tiny examples instead of large projects." },
                { type: "example", markdown: `## Example\n\nImagine a tiny ${subject} task: receive a name, turn it into a greeting, and show the greeting.\n\nThe input is the name. The step is combining that name with greeting text. The output is the visible sentence. Even if the real syntax changes between languages or tools, this mental model stays useful.\n\nWhen a lesson asks you to build something later, do not start by thinking about every possible feature. Start by finding the smallest input, the smallest rule, and the smallest output you can verify.` },
                {
                  type: "mcq",
                  prompt: "What should you identify first when learning a new coding concept?",
                  options: ["Input, step, and output", "A perfect folder structure", "Every advanced API", "Deployment settings"],
                  correctOptionIndex: 0,
                  explanation: "Input, step, and output make the behavior testable."
                },
                { type: "theory", markdown: "## Next topic\n\nNow that the mental model is clear, the next checkpoint connects the idea to vocabulary. Vocabulary is not trivia; it is how you label the moving parts so the tutor, the error message, and your own notes all describe the same thing." }
              ]
            },
            {
              id: "block-3-written-review",
              kind: "review",
              title: "Explain the mental model",
              summary: "Answer in chat after a short recap.",
              steps: [
                {
                  type: "reflection",
                  prompt: `Quick recap: in our recipe analogy, ingredients are input, instructions are the rule, and the finished plate is output. Using that clue, explain ${subject} in one or two sentences.`,
                  rubric: "Pass when the learner connects input, steps, and output in plain language."
                }
              ]
            },
            {
              id: "block-4-summary",
              kind: "review",
              title: "Mental model summary",
              summary: "Close the first topic before moving to vocabulary.",
              steps: [
                { type: "summary", markdown: `## Chapter summary\n\nYou now have the core ${subject} loop: understand the idea, inspect a tiny example, answer a check, then prove it in code.` }
              ]
            }
          ]
        },
        {
          id: "chapter-2-vocabulary",
          title: "Essential vocabulary",
          summary: "Name the beginner concepts you will reuse throughout the course.",
          unlocked: true,
          blocks: [
            {
              id: "block-4-terms",
              kind: "theory",
              title: "Words that matter",
              summary: "Build the vocabulary before adding harder examples.",
              steps: [
                { type: "theory", markdown: `## Key words\n\nIn ${subject}, beginners need a small vocabulary first: input, output, state, rule, and feedback.\n\nInput means the information the program starts with. Output means the result you can inspect. A rule is the instruction that transforms input into output. State is information that can change while the program runs. Feedback is what tells you whether your last change worked.\n\nThese words matter because they help you debug. Instead of saying \"it does not work,\" you can say \"the input is correct, but the output is wrong,\" or \"the state changed earlier than I expected.\" That is much easier to fix.` },
                { type: "analogy", markdown: "## Analogy\n\nVocabulary is like labels on kitchen drawers. If every drawer is unlabeled, cooking feels slow because you keep searching. Once the labels are clear, you can focus on the recipe instead of hunting for tools.\n\nIn programming, clear labels reduce panic. When you know whether you are dealing with an input, an output, or state, the next step becomes smaller." },
                { type: "example", markdown: "## Example\n\nIf a task says transform a value, look for the input value, the rule that changes it, and the output you can verify.\n\nFor example, if a value starts as `stone` and the expected output is `Value: stone`, the rule is adding readable text around the original value. You do not need a big app to understand that behavior. One tiny example is enough to learn the pattern." },
                {
                  type: "mcq",
                  prompt: "Which pair is most important when checking a tiny program?",
                  options: ["Input and output", "Logo and pricing", "Folder and README", "Font and color"],
                  correctOptionIndex: 0,
                  explanation: "Input and output show whether the behavior is correct."
                }
              ]
            }
          ]
        },
        {
          id: "chapter-3-first-feedback-loop",
          title: "First feedback loop",
          summary: "Use one file to prove the idea with runnable code.",
          unlocked: true,
          blocks: [
            {
              id: "block-6-feedback-loop",
              kind: "theory",
              title: "Run, inspect, adjust",
              summary: "Learn the edit-run-review cycle.",
              steps: [
                { type: "theory", markdown: "## Feedback loop\n\nA feedback loop means you make one small change, run it, inspect the result, then adjust. This keeps learning concrete.\n\nThe key is smallness. If you change ten things at once, you will not know which change helped or broke the result. If you change one thing, the output teaches you something specific.\n\nThis is why the editor exercise uses one focused scratch file. The goal is not folder structure. The goal is to practice the loop: predict, edit, run, inspect." },
                { type: "analogy", markdown: "## Analogy\n\nStay with the kitchen recipe. Change one ingredient, taste the plate, then decide whether the change helped. If you changed five ingredients at once, you would not know which one mattered." },
                { type: "example", markdown: `## First ${language} code shape\n\nBefore the workshop asks you to edit anything, read this tiny starter like a sentence:\n\n\`\`\`${language.toLowerCase().replace(/[^a-z0-9+#]/g, "")}\n${starterCode.trim()}\n\`\`\`\n\nThe important parts are simple:\n\n- \`${languageInfo.outputVerb}\` is the output move. It shows a result you can inspect.\n- The text value is the input for the tiny example.\n- The named function is the rule. It receives a value and returns readable text.\n- The last lines call the rule and show the result.\n\nIn the workshop, every step changes only one small part of this same file. No surprise side quest. We are not summoning a whole framework just to print a sentence.` },
                { type: "summary", markdown: `## Workshop bridge\n\nYou now know what the starter is for: it gives us one visible ${language} result, then we slowly turn that result into a reusable rule. The next block is a guided workshop, not an exam. Each step tells you the exact tiny edit to make and why it works.` }
              ]
            },
            {
              id: "block-7-guided-workshop",
              kind: "workshop",
              title: "Guided feedback-loop workshop",
              summary: "Build the tiny runnable example one action at a time.",
              steps: [
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: `${appliedTheme.workshopContext}. We are building one tiny visible ${language} result first, because beginners need proof that the file is doing what they think it is doing before adding rules.`,
                  prompt: `Step 1: start with one visible result. In ${language}, ${languageInfo.outputVerb} is the output instruction: it tells the program to show something so you can inspect it. The starter is already in the editor. Find the output line, read it left to right, then change only the visible text value.`,
                  starterCode,
                  acceptanceCriteria: [`Uses ${languageInfo.outputVerb} for visible output`, "Visible text was changed for this step", "The output line stays readable"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "Continue from step 1. You already saw how one visible line confirms one output.",
                  prompt: `Step 2: add one more ${languageInfo.outputVerb} line with a different value. Keep the same punctuation style as the first line. This step only adds a second visible output so you can compare two results before any function work.`,
                  starterCode,
                  acceptanceCriteria: ["Keeps the first visible output", `Adds a second ${languageInfo.outputVerb} output`, "Both outputs are readable"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: `Now the file can show two values for the ${appliedTheme.objectName}. The next tiny move is to put the repeated behavior behind a reusable name.`,
                  prompt: `Step 3: keep the visible output, then add or keep a named function that receives one ${appliedTheme.inputName}. A function is a named rule. The name lets you reuse the rule, and the value inside the parentheses is the input the rule receives.`,
                  starterCode,
                  acceptanceCriteria: ["Defines a named function or method", "The function accepts one value", "Existing output still makes sense"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "You now have a named rule. The next step is to make the rule return readable text.",
                  prompt: "Step 4: update the function so it returns readable text for the value it receives. Return means send a result back out of the function. Do not add a new concept yet; just connect input to output.",
                  starterCode,
                  acceptanceCriteria: ["Function returns readable text", "Returned text includes the input value", "The file stays simple"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: `Final guided step for this workshop: prove the ${appliedTheme.objectName} rule works with more than one input.`,
                  prompt: `Step 5: call the function with two different ${appliedTheme.inputName}s and show both results with ${languageInfo.outputVerb}. This is the full tiny feedback loop.`,
                  starterCode,
                  acceptanceCriteria: ["Calls the function twice", "Shows two different results", "Keeps the same file and function"]
                }
              ]
            },
            {
              id: "block-8-independent-lab",
              kind: "lab",
              title: "Independent feedback-loop lab",
              summary: "Solve one small task after the guided workshop.",
              steps: [
                {
                  type: "lab",
                  language,
                  filePath: codeFile,
                  context: `This lab uses the same ${appliedTheme.objectName} pattern as the workshop, but with a slightly different variant and less guidance.`,
                  prompt: `Use the current editor scratch file. Build one tiny ${appliedTheme.objectName} function, run it with two examples, and keep the output readable.`,
                  starterCode,
                  acceptanceCriteria: ["Uses a named function", "Runs at least two examples", "Keeps code in one simple file"]
                }
              ]
            },
            {
              id: "block-9-module-summary",
              kind: "review",
              title: "Module summary",
              summary: "Wrap up the foundation module.",
              steps: [
                { type: "summary", markdown: `## Module summary\n\nYou now have the core ${subject} loop: understand the idea, name the parts, answer a check, then prove it in code.` }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "module-2-core-syntax",
      title: "Core syntax and data",
      summary: "Learn the smallest useful syntax and data shapes for real practice.",
      unlocked: true,
      topics: [
        {
          id: "chapter-4-values-and-names",
          title: "Values and names",
          summary: "Use names to hold small pieces of information.",
          unlocked: true,
          blocks: [
            {
              id: "block-10-values",
              kind: "theory",
              title: "Values, names, and memory",
              summary: "Learn how code remembers tiny pieces of information.",
              steps: [
                { type: "theory", markdown: `## Values and names\n\nImagine you are labeling boxes. A value is what goes inside the box. A name is the label you stick on the box so you can find it later.\n\nIn ${subject}, this matters because almost every useful program needs to remember something briefly: a name, a number, a setting, or the result of a previous step.` },
                { type: "example", markdown: `## Tiny example\n\nA ${language} example can store one value, transform it, and show the result. The exact syntax depends on the language, but the idea stays the same: name the value so the next line can use it.` },
                {
                  type: "mcq",
                  prompt: "In the box analogy, what is the variable name most like?",
                  options: ["The label on the box", "The room holding every box", "The sound the box makes", "The tape closing the box"],
                  correctOptionIndex: 0,
                  explanation: "The name is the label you use to find the stored value later."
                }
              ]
            }
          ]
        },
        {
          id: "chapter-5-choices",
          title: "Choices",
          summary: "Make code choose between two simple paths.",
          unlocked: true,
          blocks: [
            {
              id: "block-12-choices-theory",
              kind: "theory",
              title: "If this, then that",
              summary: "Learn the basic decision shape.",
              steps: [
                { type: "theory", markdown: "## Choices\n\nA choice in code is like a simple fork in a path: if something is true, go this way; otherwise, go that way.\n\nDo not make it fancy yet. The beginner version is only one question and two paths." },
                { type: "example", markdown: `## Example\n\nA tiny ${language} program can check whether a value is empty, then print one message for empty and another message for filled. That is already a real decision.` }
              ]
            },
            {
              id: "block-13-choices-workshop",
              kind: "workshop",
              title: "Guided choice workshop",
              summary: "Add one decision to the existing feedback loop.",
              steps: [
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: `You already have a tiny ${appliedTheme.objectName} function pattern. Now add one beginner decision so it behaves differently for two inputs.`,
                  prompt: "Step 1: keep the current tiny function file. Read the example that stores a value and shows a result before changing anything. A stored value is just information given a name so later code can use it.",
                  starterCode,
                  acceptanceCriteria: ["Keeps the work in one file", "Identifies the stored value", "Identifies the visible result"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "You just found the stored value. A decision needs one question to ask about that value.",
                  prompt: "Step 2: add one simple condition that checks whether the value is empty or missing. A condition is a true-or-false question. The code uses that answer to choose a path.",
                  starterCode,
                  acceptanceCriteria: ["Adds one condition", "Checks one value only", "Keeps existing output readable"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "The condition is the fork in the road. Now each path needs a message.",
                  prompt: "Step 3: add the first path for the normal value. Make it show a readable success message.",
                  starterCode,
                  acceptanceCriteria: ["Handles the normal value path", "Shows a readable message", "Does not remove the condition"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "One side of the fork works. Now add the fallback path.",
                  prompt: "Step 4: add the second path for the empty or missing value. Make it show a helpful fallback message.",
                  starterCode,
                  acceptanceCriteria: ["Handles the empty path", "Shows a helpful fallback", "Keeps both paths in the same decision"]
                },
                {
                  type: "workshop",
                  language,
                  filePath: codeFile,
                  context: "Final guided choice step: prove both paths work.",
                  prompt: `Step 5: run or show one normal value and one empty value with ${languageInfo.outputVerb}, so both decision paths are visible.`,
                  starterCode,
                  acceptanceCriteria: ["Shows the normal path", "Shows the empty path", "Both outputs are readable"]
                }
              ]
            }
          ]
        },
        {
          id: "chapter-6-core-syntax-lab",
          title: "Core syntax lab",
          summary: "Solve one small task using values and choices.",
          unlocked: true,
          blocks: [
            {
              id: "block-14-core-syntax-lab",
              kind: "lab",
              title: "Small independent syntax lab",
              summary: "Use values and one choice without being guided line by line.",
              steps: [
                {
                  type: "lab",
                  language,
                  filePath: codeFile,
                  context: `You have learned boxes-and-labels for values and a fork-in-the-road for choices. This lab combines those two ideas inside a small ${appliedTheme.objectName} variant.`,
                  prompt: `Build a tiny ${appliedTheme.objectName} example that stores a value, checks it with one decision, and shows a readable result.`,
                  starterCode,
                  acceptanceCriteria: ["Stores at least one named value", "Uses one clear decision", "Shows a readable result"]
                }
              ]
            }
          ]
        }
      ]
    },
    ...lockedModules.map(([id, title, summary, chapterTitle], index) => ({
      id,
      title,
      summary,
      unlocked: false,
      topics: [
        {
          id: `${id}-chapter-1`,
          title: chapterTitle,
          summary: "Locked outline. Content will load when this module unlocks.",
          unlocked: false,
          blocks: [
            {
              id: `${id}-outline`,
              kind: "review",
              title: "Locked outline",
              summary: `Unlock after module ${index + 1}.`,
              steps: [{ type: "summary", markdown: "## Locked\n\nComplete the previous module to unlock this chapter content." }]
            }
          ]
        }
      ]
    }))
  ];
}

function fallbackAppliedTheme(subject) {
  const normalized = trimText(subject, "programming").toLowerCase();
  if (normalized.includes("game")) {
    return {
      objectName: "game-status",
      inputName: "player or score value",
      workshopContext: "You are building the first tiny game-console habit: show one piece of game state, then turn it into a reusable rule"
    };
  }
  if (normalized.includes("automation")) {
    return {
      objectName: "automation-result",
      inputName: "file or task value",
      workshopContext: "You are building the first tiny automation habit: show one task result, then turn it into a reusable rule"
    };
  }
  if (normalized.includes("web")) {
    return {
      objectName: "page-message",
      inputName: "page value",
      workshopContext: "You are building the first tiny web-development habit: show one page-related value, then turn it into a reusable rule"
    };
  }
  return {
    objectName: "feedback-loop",
    inputName: "input value",
    workshopContext: "You just learned the input-rule-output loop"
  };
}

function trimText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function wordCount(value) {
  return trimText(value, "").split(/\s+/).filter(Boolean).length;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
}

function slugify(value) {
  return trimText(value, "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function normalizePath(value) {
  return trimText(value, "main.js")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .trim() || "main.js";
}

const courseLanguages = courseLanguageCapabilities;

function resolveCourseLanguage(value) {
  return resolveCourseLanguageCapability(value);
}

function starterCodeForLanguage(languageInfo) {
  return languageInfo.starterCode;
}

function normalizeExerciseFilePath(value, languageInfo) {
  const normalized = normalizePath(value || languageInfo.filePath);
  const extension = normalized.toLowerCase().split(".").pop() ?? "";
  return languageInfo.extensions.includes(extension) ? normalized : languageInfo.filePath;
}

function defaultExerciseContext(languageInfo, stepType) {
  if (stepType === "workshop") {
    return `This guided ${languageInfo.label} step continues directly from the current concept. Keep the same file and add one small behavior at a time.`;
  }
  if (stepType === "lab") {
    return `This independent ${languageInfo.label} lab practices the same idea the learner just saw, without adding new concepts.`;
  }
  return `This ${languageInfo.label} project step applies the current concept in a small visible slice.`;
}

function defaultAcceptanceCriteria(languageInfo, stepType) {
  if (stepType === "workshop") {
    return [`Keeps the work in ${languageInfo.filePath}`, "Adds one small behavior", "Shows a visible result"];
  }
  if (stepType === "lab") {
    return [`Uses ${languageInfo.filePath}`, "Solves the stated problem", "Shows a visible result"];
  }
  return [`Uses ${languageInfo.filePath}`, "Completes the requested MVP behavior", "Keeps the result easy to inspect"];
}

function inferSubject(objective) {
  return inferGeneratedSubject(objective);
}

function inferLanguages(objective) {
  return inferGeneratedLanguages(objective);
}

function inferPrimaryLanguage(subject) {
  return resolveCourseLanguage(subject).label;
}

function titleCase(value) {
  return trimText(value, "Programming")
    .split(/\s+/)
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}
