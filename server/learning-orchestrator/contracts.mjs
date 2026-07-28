const experienceTypes = new Set(["course", "short_course", "exercise", "guided_project"]);
const difficulties = new Set(["beginner", "intermediate", "advanced", "adaptive", "random"]);
const practiceScopes = new Set(["all", "topics", "weaknesses", "random"]);

export const initialLearningSuggestions = [
  "Learn one concept",
  "Start a full course",
  "Practice coding",
  "Build a project"
];

export function buildLearningDiscoveryPrompt({ messages = [], turn = 0 }) {
  const transcript = messages
    .filter((message) => message && (message.role === "assistant" || message.role === "user"))
    .slice(-12)
    .map((message) => `${message.role}: ${text(message.content, "")}`)
    .filter(Boolean)
    .join("\n");

  return `You are Stonecode's learning-discovery tutor. Discover what programming activity the learner wants today.

Return strict JSON only:
{
  "status":"clarifying|ready|unsupported",
  "reply":"short conversational response; one main question only while clarifying",
  "suggestions":["direct clickable answer"],
  "brief":{
    "type":"course|short_course|exercise|guided_project",
    "goal":"learner goal",
    "subject":"specific subject or topic",
    "language":"language when known",
    "framework":"framework when known",
    "platform":"web, desktop, mobile, terminal, data, game, or other useful platform",
    "desiredOutcome":"concrete result",
    "motivation":"why the learner wants this when known",
    "priorKnowledge":"what the learner already knows or has built",
    "practiceScope":"all|topics|weaknesses|random",
    "topics":["specific topic"],
    "difficulty":"beginner|intermediate|advanced|adaptive|random",
    "exerciseCount":10,
    "exerciseMixPreference":"ai|custom",
    "codingPercent":70
  }
}

Turn: ${Number.isInteger(turn) ? turn : 0}
Transcript:
${transcript || "No messages yet."}

Rules:
- On the first turn, greet naturally, ask exactly "What are we working on today?", and suggest exactly: Learn one concept, Start a full course, Practice coding, Build a project.
- Free typing is always allowed. Suggestions answer the current question directly.
- Ask only for information that materially changes the generated learning experience. Never repeat an answered question.
- A complete request becomes ready immediately. Example: "ten intermediate Python loop exercises for interview preparation, 60% coding" needs no follow-up.
- course is a broad subject or structured learning path. short_course is one bounded concept. exercise is focused coding practice. guided_project is a concrete product built through teaching steps.
- If a selected type no longer fits the goal, recommend and switch type conversationally before creation.
- course ready requires a specific subject and the learner's prior knowledge. short_course requires a bounded subject. guided_project requires a concrete desired outcome, at least one technology or platform signal, and the learner's prior knowledge.
- Exercise practice requires a language or specific subject, a scope, and a useful motivation. For a vague language request, first ask whether to cover the whole language or selected areas, then ask what the learner is preparing for or wants to build. One question per turn.
- For topic practice, return a concise topics list. For whole-language practice, propose representative topics. Weakness practice uses topics only when evidence exists.
- Default exercise count is 10 and difficulty is adaptive. Suggested count answers should include 5, 10, and 20 when count is the missing choice.
- Default exercise mix is AI-selected and mostly coding: use 70% coding unless the subject needs a different 50-90% mix. Set custom only when the learner explicitly chooses a percentage or all-MCQ/all-coding mix.
- Before offering assessment for a course or project, conversationally learn what relevant experience the learner already has. Do not turn this into a test.
- Do not ask for learning style or pace. Assessment happens only after discovery and is optional.
- Stonecode supports programming and software learning only.
- Return 2 to 4 suggestions while clarifying, none when ready.
- Do not generate content, exercises, a syllabus, or project steps yet.`;
}

export function normalizeLearningDiscoveryTurn(value, { turn = 0, messages = [] } = {}) {
  const rawStatus = ["clarifying", "ready", "unsupported"].includes(value?.status) ? value.status : "clarifying";
  const proposedBrief = value?.brief && typeof value.brief === "object" ? normalizeLearningBrief(value.brief) : null;
  const brief = proposedBrief ? groundBriefInExplicitRequest(proposedBrief, messages) : null;
  const missingFields = brief ? missingLearningBriefFields(brief) : ["type", "goal"];
  const status = rawStatus === "ready" && missingFields.length ? "clarifying" : rawStatus;
  let reply = turn === 0
    ? text(value?.reply, "Hey! What are we working on today?").slice(0, 700)
    : status === "clarifying" && rawStatus === "ready"
      ? clarificationForMissingField(missingFields[0])
      : text(value?.reply, status === "unsupported" ? "Stonecode currently supports programming and software learning." : "What would you like to work on?").slice(0, 700);
  if (status === "ready" && /\?/.test(reply)) {
    reply = brief?.type === "guided_project"
      ? "Great—I have enough to plan this guided project."
      : brief?.type === "course"
        ? "Great—I have enough to plan this course."
        : "Great—I have enough to prepare this learning experience.";
  }
  const suggestions = turn === 0
    ? initialLearningSuggestions
    : status === "ready"
      ? []
      : uniqueStrings(value?.suggestions).slice(0, 4);

  if (status !== "ready" && turn > 0 && suggestions.length < 2) {
    suggestions.push(...fallbackSuggestions(missingFields[0]));
  }

  return {
    status,
    reply,
    suggestions: uniqueStrings(suggestions).slice(0, 4),
    brief: status === "ready" ? brief : null,
    draftBrief: brief,
    missingFields,
    nextAction: status === "ready" ? resolveLearningPolicy(brief).nextAction : "clarify"
  };
}

function groundBriefInExplicitRequest(brief, messages) {
  const userMessages = (Array.isArray(messages) ? messages : []).filter((message) => message?.role === "user" && typeof message.content === "string");
  const latestUserText = [...userMessages].reverse()[0]?.content ?? "";
  const userTranscript = userMessages.map((message) => message.content).join(" ");
  let grounded = brief;
  if (/\bpygame\b/i.test(latestUserText)) {
    grounded = {
      ...brief,
      subject: /pygame/i.test(brief.subject ?? "") ? brief.subject : "Pygame",
      language: "Python",
      framework: "Pygame",
      platform: brief.platform || "desktop game"
    };
  }
  if (grounded.type === "exercise") {
    if (!hasPurposeSignal(userTranscript)) grounded = { ...grounded, motivation: undefined };
    if (!hasCustomMixSignal(userTranscript) && grounded.exerciseMixPreference === "custom") {
      grounded = { ...grounded, exerciseMixPreference: "ai", codingPercent: Math.max(50, grounded.codingPercent ?? 70) };
    }
  }
  if (grounded.type === "course" || grounded.type === "guided_project") {
    grounded = hasPriorKnowledgeSignal(userTranscript)
      ? { ...grounded, priorKnowledge: grounded.priorKnowledge || inferPriorKnowledge(userTranscript) }
      : { ...grounded, priorKnowledge: undefined };
  }
  return grounded;
}

export function normalizeLearningBrief(value) {
  const type = experienceTypes.has(value?.type) ? value.type : inferExperienceType(value);
  const goal = text(value?.goal, value?.desiredOutcome || value?.subject || "").slice(0, 240);
  const mixPreference = value?.exerciseMixPreference === "custom" ? "custom" : "ai";
  const codingPercent = type === "exercise"
    ? clampInteger(value?.codingPercent, mixPreference === "custom" ? 0 : 50, 100, 70)
    : undefined;
  const exerciseCount = type === "exercise" ? clampInteger(value?.exerciseCount, 1, 20, 10) : undefined;
  const counts = type === "exercise" ? resolveExerciseMixCounts({ exerciseCount, codingPercent }) : {};
  const brief = {
    type,
    goal,
    subject: optionalText(value?.subject, 160),
    language: optionalText(value?.language, 80),
    framework: optionalText(value?.framework, 80),
    platform: optionalText(value?.platform, 80),
    desiredOutcome: optionalText(value?.desiredOutcome, 240),
    motivation: optionalText(value?.motivation, 240),
    priorKnowledge: optionalText(value?.priorKnowledge, 300),
    practiceScope: type === "exercise" && practiceScopes.has(value?.practiceScope) ? value.practiceScope : undefined,
    topics: type === "exercise" ? uniqueStrings(value?.topics).slice(0, 12) : undefined,
    difficulty: difficulties.has(value?.difficulty) ? value.difficulty : type === "exercise" ? "adaptive" : undefined,
    exerciseCount,
    exerciseMixPreference: type === "exercise" ? mixPreference : undefined,
    codingPercent,
    codingCount: counts.codingCount,
    mcqCount: counts.mcqCount,
    supportMode: value?.supportMode === "teaching_heavy" ? "teaching_heavy" : "standard"
  };
  return Object.fromEntries(Object.entries(brief).filter(([, item]) => item !== undefined && item !== ""));
}

export function resolveLearningPolicy(brief) {
  if (!brief || missingLearningBriefFields(brief).length) return { nextAction: "clarify", requiresAssessment: false };
  const requiresAssessment = brief.type === "course" || brief.type === "guided_project";
  return { nextAction: requiresAssessment ? "assessment_offer" : "confirm", requiresAssessment };
}

export function subjectForLearningBrief(brief) {
  return text(
    brief?.subject,
    brief?.framework || brief?.language || brief?.desiredOutcome || brief?.goal || "Programming"
  );
}

export function missingLearningBriefFields(brief) {
  const missing = [];
  if (!experienceTypes.has(brief?.type)) missing.push("type");
  if (!text(brief?.goal, "")) missing.push("goal");
  if (brief?.type === "course" && !text(brief?.subject, "")) missing.push("subject");
  if (brief?.type === "course" && !text(brief?.priorKnowledge, "")) missing.push("prior_knowledge");
  if (brief?.type === "short_course" && !text(brief?.subject, "")) missing.push("subject");
  if (brief?.type === "exercise" && !/weak/i.test(text(brief?.goal, "")) && !text(brief?.language, "") && !text(brief?.subject, "")) missing.push("language_or_subject");
  if (brief?.type === "exercise" && !practiceScopes.has(brief?.practiceScope)) missing.push("practice_scope");
  if (brief?.type === "exercise" && brief?.practiceScope === "topics" && !uniqueStrings(brief?.topics).length) missing.push("topics");
  if (brief?.type === "exercise" && !text(brief?.motivation, "")) missing.push("motivation");
  if (brief?.type === "guided_project") {
    if (!text(brief?.desiredOutcome, "") && !text(brief?.goal, "")) missing.push("desiredOutcome");
    if (![brief?.language, brief?.framework, brief?.platform, brief?.subject].some((item) => text(item, ""))) missing.push("technology_or_platform");
    if (!text(brief?.priorKnowledge, "")) missing.push("prior_knowledge");
  }
  return missing;
}

function inferExperienceType(value) {
  const combined = `${value?.goal ?? ""} ${value?.subject ?? ""}`.toLowerCase();
  if (/exercise|practice|challenge|problem/.test(combined)) return "exercise";
  if (/build|project|app|game|website/.test(combined)) return "guided_project";
  if (/concept|explain|understand/.test(combined)) return "short_course";
  return "course";
}

function clarificationForMissingField(field) {
  if (field === "type") return "Would you like a full course, a short concept lesson, coding practice, or a guided project?";
  if (field === "language_or_subject") return "Which language or programming topic should the exercises practice?";
  if (field === "practice_scope") return "Should this cover the whole language, selected topics, your weaknesses, or a random mix?";
  if (field === "topics") return "Which topics or areas should the exercises focus on?";
  if (field === "motivation") return "What are you practising this for—for example a project, interviews, work, or stronger fundamentals?";
  if (field === "technology_or_platform") return "Which platform or technology should we use for this project?";
  if (field === "prior_knowledge") return "What experience do you already have with this subject or stack?";
  if (field === "subject") return "What specific programming subject or concept should we focus on?";
  return "What result do you want to achieve?";
}

function fallbackSuggestions(field) {
  if (field === "language_or_subject") return ["Python", "JavaScript", "SQL", "Choose for me"];
  if (field === "practice_scope") return ["Selected topics", "Whole language", "My weaknesses", "Random mix"];
  if (field === "topics") return ["Fundamentals", "Functions and data", "Debugging", "Choose useful topics"];
  if (field === "motivation") return ["Build projects", "Prepare for interviews", "Improve fundamentals", "Use it at work"];
  if (field === "technology_or_platform") return ["Web app", "Desktop app", "Mobile app", "Choose for me"];
  if (field === "prior_knowledge") return ["I’m completely new", "I know the basics", "I’ve built something small", "I’m comfortable already"];
  if (field === "subject") return ["JavaScript fundamentals", "Python fundamentals", "Web development", "SQL basics"];
  return initialLearningSuggestions;
}

export function resolveExerciseMixCounts(brief = {}) {
  const exerciseCount = clampInteger(brief.exerciseCount, 1, 20, 10);
  const codingPercent = clampInteger(brief.codingPercent, 0, 100, 70);
  const codingCount = Math.min(exerciseCount, Math.max(0, Math.round(exerciseCount * codingPercent / 100)));
  return { codingCount, mcqCount: exerciseCount - codingCount };
}

function hasPurposeSignal(value) {
  return /\b(for|because|prepare|preparing|interview|job|work|school|class|build|building|project|website|web|game|mobile|backend|frontend|data|automation|fundamentals|career)\b/i.test(value);
}

function hasCustomMixSignal(value) {
  return /\b\d{1,3}\s*%|all[ -](?:coding|mcq)|only\s+(?:coding|mcq)|no\s+(?:coding|mcq)\b/i.test(value);
}

function hasPriorKnowledgeSignal(value) {
  return /\b(new|beginner|from scratch|never (?:used|coded|built)|no experience|know|used|tried|built|experience|familiar|comfortable|intermediate|advanced|refresher)\b/i.test(value);
}

function inferPriorKnowledge(value) {
  if (/\b(from scratch|completely new|never (?:used|coded|built)|no experience|beginner)\b/i.test(value)) return "Complete beginner";
  if (/\b(comfortable|advanced)\b/i.test(value)) return "Comfortable with the relevant fundamentals";
  if (/\b(built|used|tried|experience|intermediate|know)\b/i.test(value)) return "Has some relevant experience";
  return "Prior experience described in the discovery conversation";
}

function optionalText(value, max) {
  const normalized = text(value, "");
  return normalized ? normalized.slice(0, max) : undefined;
}

function text(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = text(value, "").slice(0, 100);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(Math.max(number, min), max) : fallback;
}
