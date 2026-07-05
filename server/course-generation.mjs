import { selectCuratedRagChunks } from "./rag/curriculum-sources.mjs";

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
  const lower = normalizedSubject.toLowerCase();
  const startFromZero = /\b(beginner|from zero|zero|fundamental|fundamentals|basics|basic|intro|introduction)\b/.test(lower);
  const supported = isProgrammingLearningSubject(lower);
  const areas = resolvePrerequisiteAreas(normalizedSubject);
  const requiresAssessment = supported && !startFromZero && requiresPrerequisiteAssessment(lower);
  return {
    supported,
    requiresAssessment,
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
- Fundamentals/from-zero/basic/intro courses can start from foundations and usually do not require prerequisite assessment.
- Frameworks, libraries, broad web/app/game/fullstack/backend/frontend/data/automation paths usually require prerequisite assessment.
- Choose prerequisite areas dynamically for the requested subject. Do not always check HTML, CSS, and JavaScript.
- Examples: React needs JavaScript plus HTML/CSS basics; Next.js needs JavaScript, React, and request/response basics; C++ game development needs C++ syntax, variables, and functions; Unity scripting needs C# syntax, variables, functions, and component thinking.
- Each prerequisite area should become an assessment topic if requiresAssessment is true.
- startingDifficulty must be "entry", "basic", or "mid".
- Keep ids lowercase stable slugs.

Subject: ${trimText(subject, "Programming")}
Learner profile: ${JSON.stringify(learnerProfile ?? {}).slice(0, 1200)}
Retrieved context: ${formatStaticCourseGenerationContext(retrievedContext).slice(0, 1800)}`;
}

export function normalizeAssessmentPlan(input, fallbackSubject = "Programming") {
  const fallback = resolveAssessmentPlan(fallbackSubject);
  const supported = typeof input?.supported === "boolean" ? input.supported : fallback.supported;
  const targetSubject = trimText(input?.targetSubject || input?.subject, trimText(fallbackSubject, "Programming"));
  const courseCategory = normalizeCourseCategory(input?.courseCategory);
  const prerequisiteAreas = Array.isArray(input?.prerequisiteAreas)
    ? input.prerequisiteAreas.map((area, index) => normalizeAssessmentPlanArea(area, index)).filter(Boolean).slice(0, 8)
    : fallback.areas.map((area) => ({
        id: area.id,
        title: area.title,
        reason: `Required prerequisite signal for ${targetSubject}.`,
        startingDifficulty: "mid"
      }));
  const requiresAssessment = supported && Boolean(
    typeof input?.requiresAssessment === "boolean"
      ? input.requiresAssessment
      : fallback.requiresAssessment
  );

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

function requiresPrerequisiteAssessment(lowerSubject) {
  return /\b(react|vue|angular|svelte|next|node|express|backend|frontend|fullstack|full-stack|web dev|web development|game|games|unity|unreal|spring|django|flask|laravel|machine learning|ai|data science|mobile|ios|android|plugin|scripting|modding|automation|api)\b/.test(lowerSubject);
}

function isProgrammingLearningSubject(lowerSubject) {
  if (/\b(cooking|recipe|fitness|workout|math homework|history|geography|biology|chemistry|physics|english|writing|marketing|sales|finance|trading|music|guitar|piano|language|spanish|japanese|french|photography)\b/.test(lowerSubject)) return false;
  return /\b(program|programming|code|coding|software|developer|dev|script|scripting|web|frontend|backend|fullstack|full-stack|app|apps|game|games|unity|unreal|godot|roblox|react|next|vue|angular|svelte|node|express|django|flask|spring|laravel|html|css|javascript|typescript|python|java|c\+\+|cpp|c#|csharp|c\b|go|golang|rust|ruby|php|swift|kotlin|sql|database|api|automation|machine learning|data science|ai|mobile|ios|android|plugin|modding)\b/.test(lowerSubject);
}

function resolvePrerequisiteAreas(subject) {
  const lower = subject.toLowerCase();
  if (/\bnext\b/.test(lower)) return [javascriptArea(), reactArea(), httpArea()];
  if (/\breact\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea()];
  if (/\bvue|angular|svelte|frontend|web dev|web development\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea()];
  if (/\bfullstack|full-stack\b/.test(lower)) return [javascriptArea(), htmlArea(), cssArea(), httpArea(), dataArea()];
  if (/\bnode|express|backend\b/.test(lower)) return [javascriptArea(), httpArea(), dataArea()];
  if (/\bunity\b/.test(lower)) return [csharpSyntaxArea(), variablesArea("C#"), functionsArea("C#")];
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
Weak signals needing possible follow-up: ${JSON.stringify(weakSignals).slice(0, 1000)}`;
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
  const prerequisiteAnswers = answers.filter((answer) => answer?.questionKind !== "course_shaping");
  const shapingAnswers = answers.filter((answer) => answer?.questionKind === "course_shaping" && answer?.answer !== null && answer?.answer !== undefined);
  const skipped = prerequisiteAnswers.filter((answer) => answer?.skipped).length;
  const missed = prerequisiteAnswers.filter((answer) => answer?.type === "mcq" && answer?.isCorrect === false).length;
  const correct = prerequisiteAnswers.filter((answer) => answer?.type === "mcq" && answer?.isCorrect === true).length;
  const noConfirmedPrereqs = !correct && (skipped || missed);
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
      `${trimText(subject, "Programming")} foundations`,
      noConfirmedPrereqs ? "Syntax, symbols, and tiny runnable examples" : "Core concept checks",
      "Core practice with feedback",
      shapingAnswers.length ? "Preferred language and library path" : "Capstone assessment and review"
    ].slice(0, 4)
  };
}

export function buildAssessmentReviewPrompt({ subject, answers = [] }) {
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
- Do not assign a level label.
- Do not generate the course content here.
- Keep each list 3 to 6 items.

Assessment answers: ${JSON.stringify(answers).slice(0, 2400)}`;
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
    generationDepth: "full_course",
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
  const modules = Array.isArray(input.modules)
    ? input.modules.map((module, index) => normalizeModule(module, index, defaultLanguageInfo)).filter(Boolean)
    : [];
  if (!modules.length) throw new Error("Generated course content requires at least one module.");

  return {
    schemaVersion: contentSchemaVersionV2,
    title: trimText(input.title, "Generated course"),
    subject: trimText(input.subject, "Programming"),
    description: trimText(input.description, "Generated programming course."),
    languages: normalizedLanguages.length ? normalizedLanguages : [defaultLanguageInfo.label],
    tags: uniqueStrings(input.tags).length ? uniqueStrings(input.tags) : ["AI generated"],
    generationDepth: "full_course",
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
  if (type === "code_exercise") return "Use the active IDE file as a whiteboard and submit runnable code.";
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
- Theory sections must teach only: concept, analogy, simple example, and topic transition. Do not ask the learner to answer inside theory.
- Start every new topic with at least 3 consecutive theory-style sections before any MCQ, chat_exercise, or code_exercise.
- The first course section must greet the learner as their tutor, then teach slowly. Do not start with an exercise.
- Add clear continuity when moving topics, for example "Now that the mental model is clear, next is 1.2 HTML and CSS."
- Use MCQ or chat_exercise sections only after the relevant theory/example section.
- Use code_exercise sections only for editor work.
- If a theory explanation is long, split it into two consecutive theory sections.
- For broad subjects such as web development, teach only topic-relevant language parts instead of full language mastery.
- End each chapter with a medium or hard editor code assessment and a final summary theory section.
- Code exercises must reuse the active IDE file as a whiteboard, not create folder-heavy projects.
- Code exercise file paths should be simple filenames like main.js, index.html, styles.css, or app.py.

Learner objective: ${trimText(objective, "Programming")}
Current level: ${trimText(level, "Beginner")}
Practical outcome: ${trimText(outcome, "Build practical projects")}
Amendments: ${amendments.map((item) => trimText(item, "")).filter(Boolean).join("; ") || "none"}`;
}

export function buildLearnerGenerationContext({ subject, answers = [], assessmentReview }) {
  const prerequisiteAnswers = answers.filter((answer) => answer?.questionKind !== "course_shaping");
  const shapingAnswers = answers.filter((answer) => answer?.questionKind === "course_shaping");
  const weakSignals = prerequisiteAnswers
    .filter((answer) => answer?.skipped || answer?.isCorrect === false)
    .map((answer) => ({
      questionId: trimText(answer.questionId, "unknown"),
      prompt: trimText(answer.prompt, ""),
      answer: formatAssessmentAnswer(answer),
      skipped: Boolean(answer.skipped)
    }))
    .filter((signal) => signal.prompt)
    .slice(0, 6);
  const strongSignals = prerequisiteAnswers
    .filter((answer) => answer?.isCorrect === true)
    .map((answer) => trimText(answer.prompt, ""))
    .filter(Boolean)
    .slice(0, 5);
  const preferences = shapingAnswers
    .map((answer) => ({
      questionId: trimText(answer.questionId, "preference"),
      prompt: trimText(answer.prompt, ""),
      answer: formatAssessmentAnswer(answer)
    }))
    .filter((preference) => preference.prompt && preference.answer)
    .slice(0, 5);
  const readiness = weakSignals.length >= 2
    ? "missing_prereqs"
    : weakSignals.length === 1
      ? "needs_bridging"
      : strongSignals.length
        ? "ready"
        : "unknown";

  return {
    subject: trimText(subject, "Programming"),
    readiness,
    strengths: uniqueStrings(assessmentReview?.strengths).slice(0, 6),
    gaps: uniqueStrings(assessmentReview?.gaps).slice(0, 6),
    suggestedModules: uniqueStrings(assessmentReview?.suggestedModules).slice(0, 8),
    weakSignals,
    strongSignals,
    preferences
  };
}

export function retrieveStaticCourseGenerationContext({ subject, learnerContext }) {
  const normalizedSubject = trimText(subject, "Programming");
  const needsBridge = learnerContext?.readiness === "missing_prereqs" || learnerContext?.readiness === "needs_bridging";
  const chunks = selectCuratedRagChunks({ subject: normalizedSubject, task: "course-generation", limit: 9 });

  if (needsBridge) {
    chunks.push({
      id: "prerequisite-bridge",
      sourceType: "stonecode-curriculum",
      kind: "curriculum-pattern",
      title: "Prerequisite bridge pattern",
      content: `For ${normalizedSubject}, start with the smallest missing prerequisite before target-topic depth. Use tiny input-rule-output examples, syntax recognition, and feedback-loop practice before harder workshops.`
    });
  }

  return chunks;
}

function formatStaticCourseGenerationContext(chunks) {
  return chunks
    .map((chunk) => `- ${chunk.kind}${chunk.blockKind ? `/${chunk.blockKind}` : ""}: ${chunk.title} — ${chunk.content}`)
    .join("\n");
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

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(context).slice(0, 2200)}
Assessment answers: ${JSON.stringify(answers).slice(0, 1600)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}
Retrieved context:
${formatStaticCourseGenerationContext(retrievedContext).slice(0, 2400)}`;
}

function formatAssessmentAnswer(answer) {
  if (answer?.skipped) return "I don't know / skipped";
  if (typeof answer?.answer === "number" && Array.isArray(answer.options)) {
    return trimText(answer.options[answer.answer], String(answer.answer));
  }
  if (answer?.answer === null || answer?.answer === undefined) return "";
  return trimText(String(answer.answer), "");
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
- Assessment review suggestedModules must visibly appear, be naturally renamed, or be merged into equivalent module coverage.
- Use the Course blueprint as the hidden spine. Every module goal, workshop, lab, and project should contribute to the final project capabilities.

Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Course blueprint: ${JSON.stringify(courseBlueprint ?? {}).slice(0, 1800)}
Retrieved course-generation context:
${formatStaticCourseGenerationContext(contextChunks).slice(0, 2200)}
Subject: ${trimText(subject, "Programming")}
Assessment answers: ${JSON.stringify(answers).slice(0, 1600)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}`;
}

export function buildBlockGenerationPrompt({ blockKind, subject, moduleTitle, topicTitle, learnerContext }) {
  const kind = normalizeBlockKindName(blockKind);
  const shared = `Subject: ${trimText(subject, "Programming")}
Module: ${trimText(moduleTitle, "Current module")}
Topic: ${trimText(topicTitle, "Current topic")}
Learner context: ${JSON.stringify(learnerContext ?? {}).slice(0, 1200)}

Shared rules:
- Match the current topic; do not drift into unrelated topics.
- Assume zero syntax knowledge unless learner context proves otherwise.
- Explain new syntax before asking the learner to use it.
- Avoid generic filler and hidden prompt/internal-planning text.`;

  if (kind === "theory") {
    return `${shared}

Theory block contract:
- Use only theory, analogy, example, summary, and optional single mcq steps.
- Teach the mental model first, then names, then a tiny example.
- Do not ask for open-ended learner work inside theory markdown.
- A single quick MCQ can live inside theory; larger checks belong in quiz.`;
  }
  if (kind === "quiz") {
    return `${shared}

Quiz block contract:
- Use only mcq steps.
- Generate 4 to 10 MCQs.
- Each MCQ tests recently taught material.
- Distractors must be plausible, similar length, and not joke answers.
- correctOptionIndex should vary across questions.`;
  }
  if (kind === "workshop") {
    return `${shared}

Workshop block contract:
- First decide the concrete deliverable the learner will build.
- Use as many guided workshop steps as the deliverable naturally needs. Do not target a fixed count.
- Each step continues the same practical build unless a change is explicitly justified.
- Each step asks for one atomic editor action, usually one line or one small change, then explains that action.
- Include context, prompt, language, filePath, starterCode, acceptanceCriteria, and requiresPreview.
- The context must name what the learner just learned and why this exact edit comes next.
- The prompt must teach what to write and why before asking the learner to continue.
- Starter code must be consistent across steps; do not reset to an unrelated example.
- Acceptance criteria must be concrete and visible in code/output.`;
  }
  if (kind === "lab") {
    return `${shared}

Lab block contract:
- Usually one independent lab step.
- Reuse the same pattern taught immediately before, with a different variant and less guidance.
- Include goal/context, starterCode, concrete acceptanceCriteria, and expected visible outcome.
- Do not introduce a new concept that was not taught earlier.`;
  }
  if (kind === "project") {
    return `${shared}

Project block contract:
- Use project steps only for larger capstone-style work.
- Include a deliverable, milestones inside the prompt, starterCode when useful, and concrete acceptanceCriteria.
- Keep scope small enough for the active IDE workspace.`;
  }
  return `${shared}

Review block contract:
- Use reflection and summary steps only.
- Reflection prompts must include a short recap or clue before asking the learner to answer.
- Summary steps should close the current topic and bridge to what comes next.`;
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

Block-specific generation contracts:
${blockContracts.slice(0, 7000)}`;
}

export function buildAssessmentModuleContentPrompt({ subject, answers = [], assessmentReview, courseOutline, courseBlueprint = null, retrievedContext = null, moduleIndex = 0 }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
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
              {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"The deliverable is a tiny visible program for this topic. Start with the smallest runnable line so the learner has a baseline.","prompt":"Step 1: write one visible output line. Explain what each token does before moving on.","starterCode":"console.log('start');","acceptanceCriteria":["Creates the first visible output","Keeps the work in main.js"],"requiresPreview":false},
              {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Continue the same file and build from the previous step.","prompt":"Step 2: make one tiny change to the output value and explain why the visible result changes.","starterCode":"console.log('changed');","acceptanceCriteria":["Changes only one small part","Visible output matches the new value"],"requiresPreview":false},
              {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Keep adding atomic steps until the deliverable is complete. Add more step objects here when the build needs them.","prompt":"Step 3: add the next single code line or tiny edit required by the deliverable, then explain that exact edit.","starterCode":"const value = 'changed';\nconsole.log(value);","acceptanceCriteria":["Adds one atomic edit","Keeps continuity with the same build"],"requiresPreview":false}
            ]
          }
        ]
      }
    ]
  }
}

Rules:
- Preserve ids and titles from the module outline when possible.
- Generate complete steps for every block in this module.
- Every object inside a steps array must have a "type" field.
- Do not encode fields as {"kind":"prompt","content":"..."} or {"kind":"starterCode","content":"..."}.
- For workshop/lab/project steps, put context, prompt, language, filePath, starterCode, acceptanceCriteria, and requiresPreview on the same step object.
- Preserve planned block kinds from the module outline. Do not turn a planned quiz/workshop/lab/project block into a theory block.
- A quiz block must have 4 to 10 mcq step objects.
- A workshop block must have enough workshop step objects to complete its deliverable through atomic edits. One-step or two-step workshops are invalid.
- Do not force exactly 4 workshop steps. Use 6, 10, 18, or any natural count when the deliverable needs it.
- Each loaded module should include at least one practical workshop, lab, or project block.
- A lab block is usually one lab step, but it must stay kind "lab".
- A project block must stay kind "project".
- Only module 1 content should be fully loaded during initial course generation.
- Keep later-module outline content out of this response.
- Every topic must start with a theory block.
- Use the learner context and assessment review as binding personalization input.
- Use the Course blueprint as the hidden spine: workshop/lab/project deliverables should become small pieces of the final project, and theory/quiz should prepare those pieces.

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1000)}
Course blueprint: ${JSON.stringify(courseBlueprint ?? {}).slice(0, 2200)}
Retrieved context: ${formatStaticCourseGenerationContext(retrievedContext ?? retrieveStaticCourseGenerationContext({ subject, learnerContext })).slice(0, 2200)}
Module outline: ${JSON.stringify(moduleOutline ?? {}).slice(0, 3500)}

Block-specific generation contracts:
${blockContracts.slice(0, 7000)}`;
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
    generationDepth: "full_course",
    assessmentReview: normalizeAssessmentReview(assessmentReview),
    courseBlueprint: normalizeCourseBlueprint(courseBlueprint ?? source?.courseBlueprint),
    ragSources: normalizeRagSources(ragSources),
    modules: modules.length ? modules : buildFallbackModules(inferSubject(subject))
  };
}

export function extractGeneratedModuleFromResponse(response, fallbackModule, moduleIndex = 0) {
  const module = response?.module && typeof response.module === "object"
    ? response.module
    : Array.isArray(response?.modules)
      ? response.modules[moduleIndex]
      : Array.isArray(response?.course?.modules)
        ? response.course.modules[moduleIndex]
      : response;
  return module && typeof module === "object" ? module : fallbackModule;
}

export function buildGeneratedCourseRepairPrompt({ subject, content, qualityWarnings = [] }) {
  return `Repair only the invalid generated blocks in this Stonecode course.

Return the full corrected course JSON. Do not return a patch. Preserve the existing course/module/topic/block architecture, ids, order, and learner personalization unless a specific invalid block must be fixed.

Repair rules:
- Fix only blocks related to the quality warnings.
- Do not rewrite good modules or unrelated topics.
- If a workshop is too short, expand it until the deliverable is complete through atomic FreeCodeCamp-style steps.
- If theory is thin, expand the theory markdown with mental model, explanation, and tiny example.
- If exercise context is thin, add concrete context tied to the current topic and prior teaching.
- If quiz is too short, add enough MCQ steps to reach 4 to 10.
- If a loaded topic is missing quiz, workshop, lab, or project practice, add the planned interactive block that best matches the topic.
- Keep language, filePath, starterCode, and acceptanceCriteria consistent.

Subject: ${trimText(subject, "Programming")}
Quality warnings: ${JSON.stringify(qualityWarnings).slice(0, 2200)}
Course JSON: ${JSON.stringify(content ?? {}).slice(0, 11000)}`;
}

export function buildGeneratedModuleRepairPrompt({ subject, module, moduleIndex = 0, qualityWarnings = [] }) {
  return `Repair only this generated module.

Return strict JSON only:
{
  "moduleIndex":${moduleIndex},
  "module": { "id":"module-id", "title":"...", "summary":"...", "unlocked":true, "chapters":[] }
}

Rules:
- Preserve this module's id, title, topic ids, and block ids unless invalid.
- Fix only the warning-related topics/blocks in this module.
- Do not rewrite other modules.
- If a topic is missing interactive practice, add or restore the planned quiz, workshop, lab, or project block.
- If a loaded module has no workshop, lab, or project, add one guided workshop to the most suitable early topic.
- Workshop blocks need enough atomic workshop step objects to complete their concrete deliverable. Do not target a fixed count.
- Quiz blocks need 4 to 10 mcq step objects.
- If a lab step was emitted as workshop, return it as type "lab".
- If a review step was emitted as theory, return it as type "summary".
- Use complete step objects, not kind/content field lists.

Subject: ${trimText(subject, "Programming")}
Module index: ${moduleIndex}
Quality warnings for this module: ${JSON.stringify(qualityWarnings).slice(0, 1800)}
Module JSON: ${JSON.stringify(module ?? {}).slice(0, 7000)}`;
}

function normalizeBlockKindName(blockKind) {
  const kind = typeof blockKind === "string" ? blockKind.trim().toLowerCase() : "";
  return ["theory", "quiz", "workshop", "lab", "project", "review"].includes(kind) ? kind : "review";
}

function extractModuleOutline(courseOutline, moduleIndex) {
  const source = courseOutline?.course && typeof courseOutline.course === "object" ? courseOutline.course : courseOutline;
  const modules = Array.isArray(source?.modules) ? source.modules : [];
  return modules[moduleIndex] ?? null;
}

function blockKindsInModuleOutline(moduleOutline) {
  const rawTopics = Array.isArray(moduleOutline?.chapters) ? moduleOutline.chapters : moduleOutline?.topics;
  const kinds = new Set(["theory"]);
  for (const topic of Array.isArray(rawTopics) ? rawTopics : []) {
    for (const block of Array.isArray(topic?.blocks) ? topic.blocks : []) {
      kinds.add(normalizeBlockKindName(block?.kind));
    }
  }
  return [...kinds];
}

export function buildAssessmentCourseGenerationPrompt({ subject, answers = [], assessmentReview, courseBlueprint = null, retrievedContext = null }) {
  const learnerContext = buildLearnerGenerationContext({ subject, answers, assessmentReview });
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
                {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"We are building a tiny greeting filter one verified line at a time. The learner has already seen console output and strings before this step.","prompt":"Step 1: create one visible greeting with console.log. console.log(...) sends text to the console; quotes make the greeting text; the semicolon ends the instruction. Add one line that prints \"Hi there\".","starterCode":"console.log('Ready');","acceptanceCriteria":["Has one console.log line for the greeting","Printed text includes Hi there","Code stays in main.js"],"requiresPreview":false},
                {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Continue the same file. Step 1 made one visible result; now the learner adds a named value so later steps can reuse it.","prompt":"Step 2: create a const named playerName above the log line. const creates a name that stores a value; playerName is the label; the quoted text is the stored name. Then keep the greeting visible.","starterCode":"const playerName = 'Mina';\nconsole.log('Hi there');","acceptanceCriteria":["Creates const playerName","Keeps a visible console.log result","Does not delete the first greeting"],"requiresPreview":false},
                {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Continue the same greeting filter. The learner now connects the stored value to the visible output.","prompt":"Step 3: change the console.log text so it uses playerName in the message. The + operator joins text pieces together. Keep the output readable.","starterCode":"const playerName = 'Mina';\nconsole.log('Hi ' + playerName);","acceptanceCriteria":["console.log uses playerName","Output is a readable greeting","Keeps the const from step 2"],"requiresPreview":false},
                {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Continue the same behavior. The learner has a value and an output; now add the smallest decision.","prompt":"Step 4: add an if statement that checks whether playerName has text before printing the greeting. if (...) asks a true-or-false question; braces hold the code that runs when the question is true.","starterCode":"const playerName = 'Mina';\nif (playerName) {\n  console.log('Hi ' + playerName);\n}","acceptanceCriteria":["Has one if statement","Greeting log lives inside the if block","Keeps playerName as the checked value"],"requiresPreview":false},
                {"type":"workshop","language":"JavaScript","filePath":"main.js","context":"Finish the same mini-feature. The learner now proves both paths of the filter.","prompt":"Step 5: add an else path that prints \"No player yet\" when playerName is empty. else is the fallback path when the if question is false.","starterCode":"const playerName = 'Mina';\nif (playerName) {\n  console.log('Hi ' + playerName);\n} else {\n  console.log('No player yet');\n}","acceptanceCriteria":["Has one if path and one else path","Each path prints a visible result","Code still reads like one greeting filter"],"requiresPreview":false}
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
- Generate a complete top-level curriculum like a freeCodeCamp index, with as many modules as the subject and learner gaps naturally need.
- Use the Course blueprint as the hidden spine for the whole syllabus. The course should secretly lead to the final project; each workshop/lab/project should contribute a mini-function, behavior, or capability used later.
- Fully load module 1 with enough chapters/topics to teach the first path properly. Each loaded chapter/topic should contain intentional blocks and visible numbered steps.
- Keep modules 2 and later as locked outline shells for later high-quality generation after module 1 is validated.
- Modules 3 and later must appear in the left panel as locked shell buttons with outline-level chapters only.
- Every block must include a "kind" field: "theory", "quiz", "workshop", "lab", "project", or "review".
- Start each new topic/chapter with a theory block before any quiz, workshop, lab, or project.
- Do not generate every topic as the same template. Avoid repeating "concept -> analogy -> example -> quiz -> review" as a fixed rhythm.
- Do not use fixed counts like exactly 4 theory steps or exactly 2 workshop steps. The step count must follow the idea size, learner prerequisite gaps, and project complexity.
- A theory block can combine concept and analogy on one page when short, split subtopics across multiple theory steps when the idea is bigger, and place examples wherever they make the explanation click.
- Assume the learner has no programming, coding, or syntax knowledge unless the assessment clearly proved otherwise. Explain every new code word, symbol, punctuation mark, and line before requiring the learner to use it.
- Analogy and example are teaching tools, not mandatory separate pages for every topic. Use them when they improve understanding.
- Use one consistent analogy theme per topic. Do not change analogy themes inside that topic.
- Do not write filler like "beginner confusion", "common confusion", or "typical confusion". Teach the issue directly only when needed.
- Use block kinds intentionally:
  - A "theory" block may contain only theory, analogy, example, summary, and optional mcq steps.
  - Single MCQ checks belong inside theory blocks. If the AI only wants to assess understanding once during teaching, insert an mcq step in the current theory block instead of creating a quiz block.
  - Quiz blocks are exam-style checkpoints. A "quiz" block must contain only mcq steps and should have 4 to 10 MCQ steps like a test, not one quick question.
- A "workshop" block must be guided practical continuity. Each workshop step is one atomic editor action that builds on the previous step until a feature or mini-feature is complete.
  - Workshop length is variable. The deliverable decides the step count. Never make a one-step or two-step workshop.
  - A "lab" block must be independent practice: one bug, problem, or feature for the learner to solve with optional AI help. Use labs only after a workshop or after thorough theory + example coverage. Usually make a lab one step.
  - A "project" block is for larger capstone-style work only.
- Every workshop/lab/project step needs detailed context explaining the problem situation, why it follows from the current teaching, and what the learner is building or fixing.
- Workshop prompts must teach by tutorial: state what we are building, why we are building it, exactly what code to write for that step, and explain what each important line does before asking the learner to continue.
- Each workshop step should read like a FreeCodeCamp-style step screen: Step 1, Step 2, Step 3, etc. Use one small action per step, remind the learner what they already learned, show a tiny syntax example if needed, then give the exact code action for the editor.
- Keep workshop steps granular. Prefer many small atomic steps over a few large vague tasks when the deliverable needs it.
- A workshop step is not a lab. Do not say "build this on your own" in a workshop. Save independent problem solving for lab/project blocks.
- For each workshop, lab, project, or MCQ, make the output depend on what has already been taught, what syntax has not yet been taught, what syntax must be explained in this step, what tiny action the learner will do, and how the next step builds on it. Never include hidden planning, prompts, system instructions, or reasoning notes in learner-facing markdown/prompt/context fields.
- Labs and project exams may create multiple small connected files when the exercise genuinely needs them, such as an HTML/CSS/JS mini-page or a multi-file bug-fix. Keep that for harder labs; normal workshops should still prefer one active whiteboard file.
- If a workshop asks the learner to write syntax, the immediately previous theory/example or the same workshop prompt must have taught that syntax first.
- Labs should usually be the same project pattern as the preceding workshop but with a different variant and less guidance, so the learner practices transfer instead of guessing a new concept.
- Use requiresPreview:true on workshop/lab/project steps where the learner should inspect visual changes in the Visual view, such as web UI, animation, canvas, game, or layout work.
- Every workshop/lab/project step needs an acceptanceCriteria checklist with 2 to 5 concrete MVP requirements. These criteria become the dynamic checklist in the UI.
- Workshop steps must carry forward the previous step's file and behavior. Do not restart from unrelated starter code in the next workshop step.
- Theory must not be shallow. Loaded module 1 teaching steps should feel like a real tutor: introduce the topic naturally, explain why it matters, then use a consistent analogy and concrete example before checks.
- The first explanation for a new concept should be simple enough for a 10-year-old, then gradually add the technical names, analogy, and example.
- When showing code, explain every new token the first time it appears: keyword, name, quotes, parentheses, braces, semicolon, indentation, operator, and output call.
- The tutor voice should feel human and varied, not like a form. Use headings, bullets, short jokes, or light dry sarcasm when it helps, but never mock the learner.
- Only the first course step may introduce Stonecode. New topics should start with the topic title and a natural continuity line from the previous topic.
- Do not optimize for token saving in loaded teaching content.
- Every exercise must directly test the immediately previous theory/example/workshop. Do not introduce an exercise that requires an idea not already taught in the prior steps.
- Reflection/"Answer in chat" prompts must include a short recap or clue before asking the learner to answer.
- Theory never asks the learner to answer; questions only use mcq, reflection, lab, workshop, or project steps.
- Course-shaping assessment answers are learner preferences. Use them to choose relevant languages, libraries, frameworks, and optional modules where they fit the subject. Do not treat them as right or wrong.
- Assessment review suggestedModules are planning inputs. The generated modules must visibly include them, rename them naturally, or merge them into equivalent module coverage; do not ignore them.
- For all generated MCQ steps, make distractors plausible and similar length. Distribute correctOptionIndex across 0, 1, 2, and 3; do not default to 0.
- Use language-appropriate simple file paths. Examples: main.js, main.ts, index.html, styles.css, main.py, Main.java, main.cpp, main.c, Program.cs, main.go, main.rs, index.php, main.rb, main.swift.
- Match starterCode to the language. Never use JavaScript starter code for C++, Java, Python, Go, Rust, Ruby, Swift, C#, PHP, SQL, or shell exercises.
- Broad courses should teach only relevant language parts.

Subject: ${trimText(subject, "Programming")}
Learner generation context: ${JSON.stringify(learnerContext).slice(0, 2200)}
Course blueprint:
${JSON.stringify(courseBlueprint ?? {}).slice(0, 2400)}
Retrieved course-generation context:
${formatStaticCourseGenerationContext(contextChunks).slice(0, 2200)}
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

function normalizeModule(module, moduleIndex, defaultLanguageInfo = courseLanguages[0]) {
  const title = trimText(module?.title, `Module ${moduleIndex + 1}`);
  const id = slugify(module?.id || `${moduleIndex + 1}-${title}`);
  const rawTopics = Array.isArray(module?.chapters) ? module.chapters : module?.topics;
  const normalizedTopics = Array.isArray(rawTopics)
    ? rawTopics.map((topic, topicIndex) => normalizeTopic(topic, topicIndex, id, moduleIndex, defaultLanguageInfo)).filter(Boolean)
    : [];
  const topics = ensureLoadedModulePracticalBlock(normalizedTopics, id, title, moduleIndex, defaultLanguageInfo);
  if (!topics.length) return null;
  return {
    id,
    title,
    summary: trimText(module?.summary, "Generated module."),
    order: moduleIndex,
    unlocked: moduleIndex === 0,
    topics
  };
}

function ensureLoadedModulePracticalBlock(topics, moduleId, moduleTitle, moduleIndex, defaultLanguageInfo) {
  if (moduleIndex !== 0 || !topics.length) return topics;
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

function normalizeTopic(topic, topicIndex, moduleId, moduleIndex = 0, defaultLanguageInfo = courseLanguages[0]) {
  const title = trimText(topic?.title, `Topic ${topicIndex + 1}`);
  const summary = trimText(topic?.summary, "Generated topic.");
  const id = slugify(topic?.id || `${moduleId}-${topicIndex + 1}-${title}`);
  const normalizedBlocks = Array.isArray(topic?.blocks)
    ? topic.blocks.map((block, blockIndex) => normalizeLearningBlock(block, blockIndex, id, defaultLanguageInfo)).filter(Boolean)
    : [];
  const blocks = ensureLoadedTopicInteractiveBlock(promoteInlineMcqsToQuizBlock(normalizedBlocks, id, title), id, title, summary, moduleIndex);
  if (!blocks.length) return null;
  return {
    id,
    title,
    summary,
    order: topicIndex,
    unlocked: moduleIndex === 0,
    blocks
  };
}

function ensureLoadedTopicInteractiveBlock(blocks, topicId, topicTitle, topicSummary, moduleIndex) {
  if (moduleIndex !== 0) return blocks;
  if (blocks.some((block) => ["quiz", "workshop", "lab", "project"].includes(block.kind))) return blocks;
  return [
    ...blocks,
    {
      id: `${topicId}-practice-checkpoint`,
      kind: "quiz",
      title: `${topicTitle} practice checkpoint`,
      summary: "Confirm the core idea before moving on.",
      order: blocks.length,
      steps: buildFallbackTopicQuizSteps(topicTitle, topicSummary)
    }
  ];
}

function buildFallbackTopicQuizSteps(topicTitle, topicSummary) {
  const topic = trimText(topicTitle, "this topic");
  const summary = trimText(topicSummary, `the main idea in ${topic}`);
  return [
    {
      type: "mcq",
      prompt: `What is the safest way to study ${topic} as a beginner?`,
      options: ["Memorize the words only", "Trace one tiny example step by step", "Skip examples until later", "Change many ideas at once"],
      correctOptionIndex: 1,
      explanation: `A tiny example makes ${topic} concrete before the course adds more moving parts.`
    },
    {
      type: "mcq",
      prompt: `Why does this topic matter here?`,
      options: [`It supports ${summary}`, "It replaces all later practice", "It is only a naming detail", "It should be guessed without code"],
      correctOptionIndex: 0,
      explanation: `This checkpoint keeps the learner connected to the topic goal: ${summary}.`
    },
    {
      type: "mcq",
      prompt: `What should you do before moving past ${topic}?`,
      options: ["Ignore confusing lines", "Explain the idea in your own words", "Delete the example", "Only copy the final answer"],
      correctOptionIndex: 1,
      explanation: "Explaining the idea in your own words is a good signal that the concept is ready for practice."
    },
    {
      type: "mcq",
      prompt: `Which answer shows useful understanding of ${topic}?`,
      options: ["I can recognize the idea in a small code example", "I only know the topic title", "I need no examples", "I should avoid checking my reasoning"],
      correctOptionIndex: 0,
      explanation: "Recognizing the idea in a small example is the practical beginner-level goal."
    }
  ];
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
  if (kind === "workshop" && allowedSteps.length < minimumWorkshopStepCount) return null;
  return {
    id,
    kind,
    title,
    summary: trimText(block?.summary, "Generated block."),
    order: blockIndex,
    steps: allowedSteps
  };
}

function normalizeBlockKind(kind, steps) {
  const rawKind = typeof kind === "string" ? kind.trim().toLowerCase() : "";
  const mcqCount = steps.filter((step) => step.type === "mcq").length;
  const workshopCount = steps.filter((step) => step.type === "workshop").length;
  if (rawKind === "quiz") return mcqCount >= 4 ? "quiz" : "theory";
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
    if (kind === "workshop") return step.type === "workshop";
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
  if (step.type === "quiz" && Array.isArray(step.options)) return normalizeBlock({ ...step, type: "mcq" });
  if (step.type === "theory" || step.type === "analogy" || step.type === "example" || step.type === "summary") {
    return { type: step.type, markdown: trimText(step.markdown, "## Explanation\n\nStart with the idea, then inspect a simple example.") };
  }
  if (step.type === "mcq") return normalizeBlock(step);
  if (step.type === "reflection") {
    const prompt = trimText(step.prompt, "Explain the idea in your own words.");
    return {
      type: "reflection",
      prompt: wordCount(prompt) >= 10
        ? prompt
        : `${prompt} Include what changed, why it changed, and one tiny example from this topic.`,
      rubric: trimText(step.rubric, "Pass when the learner gives coherent beginner reasoning tied to the current topic.")
    };
  }
  if (step.type === "workshop" || step.type === "lab" || step.type === "project") {
    const languageInfo = resolveCourseLanguage(step.language || defaultLanguageInfo.label || step.filePath);
    const filePath = normalizeExerciseFilePath(step.filePath, languageInfo);
    const rawStarterCode = typeof step.starterCode === "string" ? step.starterCode : "";
    const acceptanceCriteria = uniqueStrings(step.acceptanceCriteria).length
      ? uniqueStrings(step.acceptanceCriteria)
      : defaultAcceptanceCriteria(languageInfo, step.type);
    const context = trimText(
      step.context || step.scenario || step.exampleContext,
      defaultExerciseContext(languageInfo, step.type)
    );
    const prompt = trimText(step.prompt, "Complete the task in the editor.");
    return {
      type: step.type,
      language: languageInfo.label,
      filePath,
      prompt: wordCount(prompt) >= 8
        ? prompt
        : `${prompt} Make one small code change, then check the visible result before continuing.`,
      starterCode: rawStarterCode.trim() && !isMismatchedStarterCode(rawStarterCode, languageInfo)
        ? rawStarterCode
        : starterCodeForLanguage(languageInfo),
      acceptanceCriteria: acceptanceCriteria.length >= 2
        ? acceptanceCriteria
        : [...acceptanceCriteria, "The result is visible from the code or output"],
      context: wordCount(context) >= 10
        ? context
        : `${context} This step should stay connected to the current topic and avoid introducing a new concept.`,
      requiresPreview: Boolean(step.requiresPreview)
    };
  }
  return null;
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
  if (["c", "c#", "go", "rust", "php", "ruby", "swift", "sql"].includes(label)) return looksLikeJavaScript || looksLikePython || looksLikeCpp || looksLikeJava;
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
                { type: "theory", markdown: "## Feedback loop\n\nA feedback loop means you make one small change, run it, inspect the result, then adjust. This keeps learning concrete.\n\nThe key is smallness. If you change ten things at once, you will not know which change helped or broke the result. If you change one thing, the output teaches you something specific.\n\nThis is why the editor exercise uses one file as a whiteboard. The goal is not folder structure. The goal is to practice the loop: predict, edit, run, inspect." },
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
                  prompt: `Use the current editor file as a whiteboard. Build one tiny ${appliedTheme.objectName} function, run it with two examples, and keep the output readable.`,
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

const courseLanguages = [
  {
    label: "JavaScript",
    aliases: [/javascript/i, /\bjs\b/i, /node/i],
    filePath: "main.js",
    extensions: ["js", "jsx", "mjs", "cjs"],
    outputVerb: "console.log",
    starterCode: "function describe(value) {\n  return `Value: ${value}`;\n}\n\nconsole.log(describe('stone'));\n"
  },
  {
    label: "TypeScript",
    aliases: [/typescript/i, /\bts\b/i],
    filePath: "main.ts",
    extensions: ["ts", "tsx"],
    outputVerb: "console.log",
    starterCode: "function describe(value: string): string {\n  return `Value: ${value}`;\n}\n\nconsole.log(describe('stone'));\n"
  },
  {
    label: "Python",
    aliases: [/python/i, /\bpy\b/i],
    filePath: "main.py",
    extensions: ["py", "pyw"],
    outputVerb: "print",
    starterCode: "def describe(value):\n    return f\"Value: {value}\"\n\nprint(describe(\"stone\"))\n"
  },
  {
    label: "HTML",
    aliases: [/html/i, /website/i, /web page/i],
    filePath: "index.html",
    extensions: ["html", "htm"],
    outputVerb: "rendered page",
    starterCode: "<!doctype html>\n<html>\n  <head>\n    <title>Stonecode Practice</title>\n  </head>\n  <body>\n    <h1>Value: stone</h1>\n  </body>\n</html>\n"
  },
  {
    label: "CSS",
    aliases: [/css/i],
    filePath: "styles.css",
    extensions: ["css"],
    outputVerb: "visible style",
    starterCode: ".practice-card {\n  padding: 1rem;\n  color: #102016;\n  background: #8ee8ad;\n}\n"
  },
  {
    label: "Java",
    aliases: [/\bjava\b/i],
    filePath: "Main.java",
    extensions: ["java"],
    outputVerb: "System.out.println",
    starterCode: "public class Main {\n  static String describe(String value) {\n    return \"Value: \" + value;\n  }\n\n  public static void main(String[] args) {\n    System.out.println(describe(\"stone\"));\n  }\n}\n"
  },
  {
    label: "C++",
    aliases: [/c\+\+/i, /cpp/i, /cplusplus/i],
    filePath: "main.cpp",
    extensions: ["cpp", "cc", "cxx", "hpp"],
    outputVerb: "cout",
    starterCode: "#include <iostream>\n#include <string>\n\nstd::string describe(const std::string& value) {\n  return \"Value: \" + value;\n}\n\nint main() {\n  std::cout << describe(\"stone\") << std::endl;\n  return 0;\n}\n"
  },
  {
    label: "C#",
    aliases: [/c#/i, /csharp/i, /dotnet/i],
    filePath: "Program.cs",
    extensions: ["cs"],
    outputVerb: "Console.WriteLine",
    starterCode: "using System;\n\nclass Program {\n  static string Describe(string value) {\n    return \"Value: \" + value;\n  }\n\n  static void Main() {\n    Console.WriteLine(Describe(\"stone\"));\n  }\n}\n"
  },
  {
    label: "C",
    aliases: [/\bc\b(?!#|\+\+)/i],
    filePath: "main.c",
    extensions: ["c", "h"],
    outputVerb: "printf",
    starterCode: "#include <stdio.h>\n\nint main(void) {\n  printf(\"Value: stone\\n\");\n  return 0;\n}\n"
  },
  {
    label: "Go",
    aliases: [/\bgo\b/i, /golang/i],
    filePath: "main.go",
    extensions: ["go"],
    outputVerb: "fmt.Println",
    starterCode: "package main\n\nimport \"fmt\"\n\nfunc describe(value string) string {\n  return \"Value: \" + value\n}\n\nfunc main() {\n  fmt.Println(describe(\"stone\"))\n}\n"
  },
  {
    label: "Rust",
    aliases: [/rust/i],
    filePath: "main.rs",
    extensions: ["rs"],
    outputVerb: "println!",
    starterCode: "fn describe(value: &str) -> String {\n    format!(\"Value: {}\", value)\n}\n\nfn main() {\n    println!(\"{}\", describe(\"stone\"));\n}\n"
  },
  {
    label: "PHP",
    aliases: [/php/i],
    filePath: "index.php",
    extensions: ["php"],
    outputVerb: "echo",
    starterCode: "<?php\nfunction describe($value) {\n    return \"Value: \" . $value;\n}\n\necho describe(\"stone\") . PHP_EOL;\n"
  },
  {
    label: "Ruby",
    aliases: [/ruby/i, /\brb\b/i],
    filePath: "main.rb",
    extensions: ["rb"],
    outputVerb: "puts",
    starterCode: "def describe(value)\n  \"Value: #{value}\"\nend\n\nputs describe(\"stone\")\n"
  },
  {
    label: "Swift",
    aliases: [/swift/i],
    filePath: "main.swift",
    extensions: ["swift"],
    outputVerb: "print",
    starterCode: "func describe(_ value: String) -> String {\n  return \"Value: \\(value)\"\n}\n\nprint(describe(\"stone\"))\n"
  },
  {
    label: "SQL",
    aliases: [/sql/i],
    filePath: "query.sql",
    extensions: ["sql"],
    outputVerb: "SELECT",
    starterCode: "SELECT 'Value: stone' AS message;\n"
  }
];

function resolveCourseLanguage(value) {
  const text = trimText(value, "JavaScript");
  const extension = text.toLowerCase().includes(".") ? text.toLowerCase().split(".").pop() : "";
  const extensionMatch = courseLanguages.find((language) => language.extensions.includes(extension));
  if (extensionMatch) return extensionMatch;
  if (/c#|csharp|dotnet/i.test(text)) return courseLanguages.find((language) => language.label === "C#");
  if (/c\+\+|cpp|cplusplus/i.test(text)) return courseLanguages.find((language) => language.label === "C++");
  return courseLanguages.find((language) => language.aliases.some((alias) => alias.test(text))) ?? courseLanguages[0];
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
  const value = trimText(objective, "Programming").toLowerCase();
  if (value.includes("react")) return "React";
  if (value.includes("array") || value.includes("javascript") || value.includes("js")) return "JavaScript";
  if (value.includes("python")) return "Python";
  if (value.includes("typescript")) return "TypeScript";
  if (value.includes("c++") || value.includes("cpp")) return "C++";
  if (/\bjava\b/.test(value)) return "Java";
  if (value.includes("c#") || value.includes("csharp")) return "C#";
  if (value.includes("go") || value.includes("golang")) return "Go";
  if (value.includes("rust")) return "Rust";
  if (value.includes("php")) return "PHP";
  if (value.includes("ruby")) return "Ruby";
  if (value.includes("swift")) return "Swift";
  if (value.includes("css") || value.includes("website") || value.includes("html")) return "Web Development";
  return "Programming";
}

function inferLanguages(objective) {
  const subject = inferSubject(objective);
  if (subject === "Python") return ["Python"];
  if (["TypeScript", "C++", "Java", "C#", "Go", "Rust", "PHP", "Ruby", "Swift"].includes(subject)) return [subject];
  if (subject === "Web Development" || subject === "React") return ["JavaScript", "HTML", "CSS"];
  return [resolveCourseLanguage(objective).label];
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
