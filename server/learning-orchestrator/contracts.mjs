import {
  browserFrameworkAllowlist,
  findLearningDomain,
  learningDomainCatalog,
  productionTechnologyIds,
  technologyCatalog
} from "../../shared/stonecode-product.mjs";
import { resolveRagTechnologyId } from "../rag/technology-corpora.mjs";

const experienceTypes = new Set(["course", "exercise", "guided_project"]);
const difficulties = new Set(["beginner", "intermediate", "advanced", "adaptive", "random"]);
const practiceScopes = new Set(["all", "topics", "weaknesses", "random"]);
const discoveryQuestionFields = new Set([
  "learning_intent", "learning_domain", "focus_areas", "type", "goal", "subject", "desiredOutcome", "language_or_subject",
  "practice_scope", "topics", "motivation", "technology_or_platform", "supported_technology",
  "available_technology", "prior_knowledge", "guidance"
]);
export const maxLearningDiscoveryQuestions = 7;

export const initialLearningGreeting = "Hey, welcome to Stonecode. Tell me what you want to learn or build first—a language, project idea, feature, end goal, or lesson type. Share as much as you already know, and I’ll only ask for the missing pieces.";

export const initialLearningSuggestions = [
  "Build a project",
  "Learn a language",
  "Add a feature",
  "Reach an end goal",
  "Choose lesson type"
];

export function buildLearningDiscoveryPrompt({
  messages = [],
  turn = 0,
  availableTechnologyIds = productionTechnologyIds,
  availableDomainIds = learningDomainCatalog.map((domain) => domain.id)
}) {
  const availableTechnologies = technologyNames(availableTechnologyIds);
  const availableDomains = domainNames(availableDomainIds);
  const transcript = messages
    .filter((message) => message && (message.role === "assistant" || message.role === "user"))
    .slice(-12)
    .map((message) => `${message.role}: ${text(message.content, "")}`)
    .filter(Boolean)
    .join("\n");

  return `You are Stonecode's learning-discovery tutor. Discover what computing activity the learner wants today.

Return strict JSON only:
{
  "status":"clarifying|ready|unsupported",
  "reply":"short conversational response; one main question only while clarifying",
  "questionField":"learning_intent|learning_domain|focus_areas|type|goal|subject|desiredOutcome|language_or_subject|practice_scope|topics|motivation|technology_or_platform|supported_technology|available_technology|prior_knowledge|guidance|null",
  "selectionMode":"single|multi",
  "suggestions":["direct clickable answer"],
  "brief":{
    "type":"course|project|exercise",
    "domainId":"programming|computer_fundamentals|internet_web|algorithms_data_structures|math_for_programmers",
    "technologyId":"enabled technology id when a coding path is selected",
    "focusAreas":["selected learning area"],
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
    "codingPercent":70,
    "supportMode":"standard|teaching_heavy"
  }
}

Turn: ${Number.isInteger(turn) ? turn : 0}
Transcript:
${transcript || "No messages yet."}

Rules:
- On the first turn, greet properly and ask the learner to say what they want to learn or build. Make it clear they may start from any entry point: project, language, feature, end goal, course, guided project, or exercise pack. Suggest exactly: Build a project, Learn a language, Add a feature, Reach an end goal, Choose lesson type.
- Free typing is always allowed. Suggestions must answer the current question directly; never reuse generic mode chips unless the current question asks for mode.
- Answer brief questions about Stonecode's supported languages or learning modes before asking the next missing discovery question. A capability question alone is not the learner's course goal.
- While clarifying, questionField must name the one checklist field asked by reply. Suggestions must directly answer that same field. Use null only when ready or unsupported.
- Accept details in any order. Reconstruct the checklist from the whole transcript instead of forcing a questionnaire sequence.
- Ask only for information that materially changes the generated learning experience. Never repeat an answered question.
- Keep discovery short. Ask at most ${maxLearningDiscoveryQuestions} assistant clarification questions including the greeting. If the learner has already answered enough required checklist items, return ready instead of polishing optional preferences. If turn ${maxLearningDiscoveryQuestions - 1} is reached and required information is still missing, ask one final focused question for the single most important missing item.
- Discovery checklist: concrete learning/build intent, entry type/mode, supported language/framework/platform or subject, relevant prior knowledge/experience level, desired depth or guidance level, and branch-specific preferences. Ask only for missing items, in the order that best fits what the learner already said.
- Branch-specific preferences: projects need the finished deliverable and required features/workflows when they materially change the build; courses may ask one multi-select focus-areas question when it would materially improve scope; exercise packs need practice scope, motivation, count/difficulty only when not already clear.
- When asking focus_areas, set selectionMode to multi and return 4 to 8 domain-specific choices. For every other question set selectionMode to single. Free typing always remains available.
- A complete request becomes ready immediately. Example: "ten intermediate Python loop exercises for interview preparation, 60% coding" needs no follow-up.
- course covers both compact concepts and broader structured learning paths. exercise is focused coding practice. project is a concrete product built through teaching steps.
- If a selected type no longer fits the goal, recommend and switch type conversationally before creation.
- course ready requires a specific subject and the learner's prior knowledge. project requires a concrete desired outcome, at least one technology or platform signal, and the learner's prior knowledge.
- Exercise practice requires a language or specific subject, a scope, and a useful motivation. For a vague language request, first ask whether to cover the whole language or selected areas, then ask what the learner is preparing for or wants to build. One question per turn.
- For topic practice, return a concise topics list. For whole-language practice, propose representative topics. Weakness practice uses topics only when evidence exists.
- Default exercise count is 10 and difficulty is adaptive. Suggested count answers should include 5, 10, and 20 when count is the missing choice.
- Default exercise mix is AI-selected and mostly coding: use 70% coding unless the subject needs a different 50-90% mix. Set custom only when the learner explicitly chooses a percentage or all-MCQ/all-coding mix.
- Conversationally learn what relevant experience the learner already has. Never turn onboarding into a knowledge test.
- Gather depth and useful preferences only when they materially change the proposal. Ask about concrete prior experience instead of a vague self-rated label. Do not ask for a schedule or duration.
- Stonecode supports programming plus these enabled computing domains: ${availableDomains.join(", ")}.
- Technologies available on this deployment are ${availableTechnologies.join(", ")}. Approved browser-only libraries are React, Vue, Svelte, D3, Chart.js, and p5.js.
- Algorithms/data structures and math coding paths require an explicitly selected runnable technology. Computer/IT and internet/web Courses may remain conceptual; their projects and exercise packs require a runnable technology. Never invent execution for conceptual lessons.
- If the learner requests a known language that is not in the available deployment list, explain the current launch choices and ask them to choose one. Keep status clarifying so they can continue.
- Return unsupported for external engines, native GUI frameworks, server-dependent frameworks, arbitrary packages, Assembly, or a framework/library outside the approved browser list. Never suggest Pygame, Unity, Unreal, Godot, Flutter, Django, Rails, Laravel, Spring, or package installation.
- Return 2 to 5 suggestions while clarifying, or 4 to 8 for a multi-select focus_areas question; none when ready. Every suggestion must directly answer the latest question.
- Do not generate content, exercises, a syllabus, or project steps yet.`;
}

export function normalizeLearningDiscoveryTurn(value, {
  turn = 0,
  messages = [],
  availableTechnologyIds = productionTechnologyIds,
  availableDomainIds = learningDomainCatalog.map((domain) => domain.id)
} = {}) {
  const rawStatus = ["clarifying", "ready", "unsupported"].includes(value?.status) ? value.status : "clarifying";
  const userMessages = (Array.isArray(messages) ? messages : []).filter((message) => message?.role === "user" && typeof message.content === "string");
  const latestUserMessage = userMessages.at(-1)?.content ?? "";
  const languageCapabilityQuestion = isLearningCapabilityQuestion(latestUserMessage);
  const requestedCapabilityDomain = inferLearningDomainId(latestUserMessage, { fallback: null });
  const capabilityQuestionOnly = languageCapabilityQuestion
    && userMessages.length === 1
    && !resolveRagTechnologyId(latestUserMessage)
    && (!requestedCapabilityDomain || requestedCapabilityDomain === "programming");
  const proposedBrief = capabilityQuestionOnly
    ? null
    : value?.brief && typeof value.brief === "object" ? normalizeLearningBrief(value.brief) : null;
  const brief = proposedBrief ? groundBriefInExplicitRequest(proposedBrief, messages) : null;
  const availableIds = normalizedTechnologyIds(availableTechnologyIds);
  const availableDomains = normalizedDomainIds(availableDomainIds);
  const requestedDomainId = brief ? resolveLearningBriefDomainId(brief) : null;
  const unavailableDomain = requestedDomainId && !availableDomains.includes(requestedDomainId)
    ? learningDomainCatalog.find((item) => item.id === requestedDomainId)
    : null;
  const requestedTechnologyId = brief ? resolveLearningBriefTechnologyId(brief) : null;
  const unavailableTechnology = requestedTechnologyId && !availableIds.includes(requestedTechnologyId)
    ? technologyCatalog.find((item) => item.id === requestedTechnologyId)
    : null;
  const missingFields = unavailableDomain
    ? ["learning_domain"]
    : unavailableTechnology
    ? ["available_technology"]
    : brief ? missingLearningBriefFields(brief) : ["type", "goal"];
  const unsupportedReason = brief ? unsupportedLearningBriefReason(brief) : null;
  const status = unsupportedReason
    ? "unsupported"
    : unavailableDomain || unavailableTechnology
      ? "clarifying"
      : brief && missingFields.length === 0
        ? "ready"
        : rawStatus === "ready" && missingFields.length ? "clarifying" : rawStatus;
  const questionField = status === "clarifying"
    ? capabilityQuestionOnly ? "learning_intent" : missingFields[0] ?? null
    : null;
  const modelQuestionField = discoveryQuestionFields.has(value?.questionField) ? value.questionField : null;
  const modelReply = text(value?.reply, "").slice(0, 700);
  const useAlignedModelTurn = status === "clarifying"
    && modelQuestionField === questionField
    && replyTargetsQuestionField(modelReply, questionField);
  let reply = unsupportedReason
    ? unsupportedReason
    : unavailableDomain
      ? `${unavailableDomain.displayName} is not enabled on this deployment. Available areas are ${domainNames(availableDomains).join(", ")}. Which area should we use?`
    : unavailableTechnology
      ? `${unavailableTechnology.displayName} is not enabled for launch yet. Stonecode currently supports ${technologyNames(availableIds).join(", ")}. Which one should we use?`
    : turn === 0
    ? initialLearningGreeting
    : capabilityQuestionOnly
      ? learningCapabilityReply(availableIds, availableDomains)
    : status === "clarifying" && questionField
      ? useAlignedModelTurn ? modelReply : clarificationForMissingField(questionField)
      : text(value?.reply, status === "unsupported" ? "Stonecode currently supports programming and software learning." : "What would you like to work on?").slice(0, 700);
  if (status === "clarifying" && turn >= maxLearningDiscoveryQuestions - 1 && missingFields.length) {
    reply = finalClarificationForMissingField(questionField);
  }
  if (status === "ready" && /\?/.test(reply)) {
    reply = brief?.type === "guided_project"
      ? "Great—I have enough to plan this guided project."
      : brief?.type === "course"
        ? "Great—I have enough to plan this course."
        : "Great—I have enough to prepare this learning experience.";
  }
  const safeModelSuggestions = safeDiscoverySuggestions(value?.suggestions, availableIds, questionField);
  const suggestions = unavailableDomain
    ? domainNames(availableDomains).slice(0, 5)
    : unavailableTechnology
    ? technologyNames(availableIds).slice(0, 5)
    : turn === 0
    ? initialLearningSuggestions
    : capabilityQuestionOnly
      ? technologyNames(availableIds).slice(0, 5)
    : status === "ready" || status === "unsupported"
      ? []
      : useAlignedModelTurn && safeModelSuggestions.length >= 2
        ? safeModelSuggestions
      : questionField
        ? fallbackSuggestions(questionField, brief)
        : uniqueStrings(value?.suggestions).slice(0, 5);
  const selectionMode = status === "clarifying" && questionField === "focus_areas" ? "multi" : "single";
  const suggestionLimit = selectionMode === "multi" ? 8 : 5;

  return {
    status,
    reply,
    suggestions: uniqueStrings(suggestions).slice(0, suggestionLimit),
    selectionMode,
    brief: status === "ready" ? brief : null,
    draftBrief: brief,
    missingFields,
    questionField,
    responseTurn: turn,
    nextAction: status === "ready" ? resolveLearningPolicy(brief).nextAction : status === "unsupported" ? "unsupported" : "clarify"
  };
}

function groundBriefInExplicitRequest(brief, messages) {
  const userMessages = (Array.isArray(messages) ? messages : []).filter((message) => message?.role === "user" && typeof message.content === "string");
  const userTranscript = userMessages.map((message) => message.content).join(" ");
  let grounded = brief;
  if (Array.isArray(grounded.focusAreas)) {
    const explicitFocusAreas = grounded.focusAreas.filter((area) => userTranscript.toLowerCase().includes(String(area).toLowerCase()));
    grounded = { ...grounded, focusAreas: explicitFocusAreas.length ? explicitFocusAreas : undefined };
  }
  const framework = text(grounded.framework, "");
  const normalizedFramework = framework.toLowerCase().replace(/^(react|vue|svelte|d3)\.js$/, "$1");
  const frameworkWasRequested = framework && userTranscript.toLowerCase().includes(framework.toLowerCase());
  const genericFramework = /^(?:build\s+(?:a\s+)?project|learn\s+(?:a\s+)?language|add\s+(?:a\s+)?feature|reach\s+(?:an?\s+)?end\s+goal|choose\s+lesson\s+type|project(?:-based learning)?|course|exercise(?:\s+pack)?|guided\s+project|web\s+app|website|app)$/i;
  if (
    framework &&
    !browserFrameworkAllowlist.includes(normalizedFramework) &&
    !isExplicitlyBlockedTechnology(framework) &&
    (genericFramework.test(framework) || !frameworkWasRequested)
  ) {
    grounded = { ...grounded, framework: undefined };
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
    grounded = hasGuidanceSignal(userTranscript)
      ? { ...grounded, supportMode: grounded.supportMode || inferSupportMode(userTranscript) }
      : { ...grounded, supportMode: undefined };
  }
  return grounded;
}

export function normalizeLearningBrief(value) {
  const requestedType = value?.type === "project" ? "guided_project" : value?.type === "short_course" ? "course" : value?.type;
  const type = experienceTypes.has(requestedType) ? requestedType : inferExperienceType(value);
  const goal = text(value?.goal, value?.desiredOutcome || value?.subject || "").slice(0, 240);
  const mixPreference = value?.exerciseMixPreference === "custom" ? "custom" : "ai";
  const codingPercent = type === "exercise"
    ? clampInteger(value?.codingPercent, mixPreference === "custom" ? 0 : 50, 100, 70)
    : undefined;
  const exerciseCount = type === "exercise" ? clampInteger(value?.exerciseCount, 5, 25, 10) : undefined;
  const counts = type === "exercise" ? resolveExerciseMixCounts({ exerciseCount, codingPercent }) : {};
  const inferredDomainId = inferLearningDomainId([
    value?.domainId,
    value?.subject,
    value?.goal,
    value?.desiredOutcome
  ].filter(Boolean).join(" "));
  const explicitTechnologyId = technologyCatalog.some((technology) => technology.id === value?.technologyId) ? value.technologyId : undefined;
  const brief = {
    type,
    domainId: inferredDomainId,
    technologyId: explicitTechnologyId,
    focusAreas: uniqueStrings(value?.focusAreas).slice(0, 12),
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
    supportMode: value?.supportMode === "teaching_heavy" || value?.supportMode === "standard" ? value.supportMode : undefined
  };
  return Object.fromEntries(Object.entries(brief).filter(([, item]) => item !== undefined && item !== ""));
}

export function resolveLearningPolicy(brief) {
  if (unsupportedLearningBriefReason(brief)) return { nextAction: "unsupported", requiresAssessment: false };
  if (!brief || missingLearningBriefFields(brief).length) return { nextAction: "clarify", requiresAssessment: false };
  return { nextAction: "confirm", requiresAssessment: false };
}

export function subjectForLearningBrief(brief) {
  const domain = findLearningDomain(resolveLearningBriefDomainId(brief));
  return text(
    brief?.subject,
    brief?.framework || brief?.language || brief?.desiredOutcome || brief?.goal || domain?.displayName || "Programming"
  );
}

export function resolveLearningBriefTechnologyId(brief) {
  const explicit = technologyCatalog.find((technology) => technology.id === brief?.technologyId);
  return explicit?.id ?? [brief?.language, brief?.framework, brief?.subject, brief?.goal, brief?.desiredOutcome]
    .map((value) => resolveRagTechnologyId(value))
    .find(Boolean) ?? null;
}

export function resolveLearningBriefDomainId(brief) {
  return inferLearningDomainId([
    brief?.domainId,
    brief?.subject,
    brief?.goal,
    brief?.desiredOutcome
  ].filter(Boolean).join(" "));
}

export function unsupportedLearningBriefReason(brief) {
  const request = [brief?.language, brief?.framework, brief?.subject, brief?.goal, brief?.desiredOutcome].filter(Boolean).join(" ");
  if (isExplicitlyBlockedTechnology(request)) {
    return "Stonecode currently teaches plain code and approved browser libraries only. External engines, server frameworks, native GUI frameworks, and arbitrary packages are unavailable.";
  }
  const framework = text(brief?.framework, "").toLowerCase().replace(/^(react|vue|svelte|d3)\.js$/, "$1");
  if (framework && !browserFrameworkAllowlist.includes(framework)) {
    return "That framework is outside Stonecode's reviewed browser allowlist. Choose plain language code or React, Vue, Svelte, D3, Chart.js, or p5.js.";
  }
  return null;
}

function isExplicitlyBlockedTechnology(value) {
  return /\b(?:assembly|wasm|unity|unreal|godot|pygame|flutter|django|flask|fastapi|laravel|rails|spring|express|next(?:\.js)?|angular|blender|roblox|gamemaker)\b/i.test(text(value, ""));
}

export function missingLearningBriefFields(brief) {
  const missing = [];
  if (!experienceTypes.has(brief?.type)) missing.push("type");
  if (!text(brief?.goal, "")) missing.push("goal");
  if (brief?.type === "course" && !text(brief?.subject, "")) missing.push("subject");
  const domain = findLearningDomain(resolveLearningBriefDomainId(brief));
  const normalizedType = brief?.type === "guided_project" ? "project" : brief?.type;
  const technologyRequired = domain?.technologyRequiredFor.includes(normalizedType) ?? true;
  if (brief?.type === "course" && domain?.id !== "programming" && !uniqueStrings(brief?.focusAreas).length) missing.push("focus_areas");
  const hasTechnologySignal = [brief?.technologyId, brief?.language, brief?.framework, brief?.subject].some((item) => text(item, ""));
  const technologyMissing = !resolveLearningBriefTechnologyId(brief) && (technologyRequired || hasTechnologySignal && domain?.id === "programming");
  if (brief?.type === "course" && technologyMissing) missing.push("supported_technology");
  if (brief?.type === "course" && !text(brief?.priorKnowledge, "")) missing.push("prior_knowledge");
  if (brief?.type === "course" && !["standard", "teaching_heavy"].includes(brief?.supportMode)) missing.push("guidance");
  if (brief?.type === "exercise" && !/weak/i.test(text(brief?.goal, "")) && !text(brief?.language, "") && !text(brief?.subject, "")) missing.push("language_or_subject");
  if (brief?.type === "exercise" && technologyMissing) missing.push("supported_technology");
  if (brief?.type === "exercise" && !practiceScopes.has(brief?.practiceScope)) missing.push("practice_scope");
  if (brief?.type === "exercise" && brief?.practiceScope === "topics" && !uniqueStrings(brief?.topics).length) missing.push("topics");
  if (brief?.type === "exercise" && !text(brief?.motivation, "")) missing.push("motivation");
  if (brief?.type === "guided_project") {
    if (!text(brief?.desiredOutcome, "") && !hasConcreteProjectGoal(brief?.goal)) missing.push("desiredOutcome");
    if (technologyMissing) missing.push("supported_technology");
    if (!text(brief?.priorKnowledge, "")) missing.push("prior_knowledge");
    if (!["standard", "teaching_heavy"].includes(brief?.supportMode)) missing.push("guidance");
  }
  return missing;
}

function inferExperienceType(value) {
  const combined = `${value?.goal ?? ""} ${value?.subject ?? ""}`.toLowerCase();
  if (/exercise|practice|challenge|problem/.test(combined)) return "exercise";
  if (/build|project|app|game|website/.test(combined)) return "guided_project";
  if (/concept|explain|understand/.test(combined)) return "course";
  return "course";
}

function clarificationForMissingField(field) {
  if (field === "learning_intent") return "What would you like to learn or build?";
  if (field === "learning_domain") return "Which computing area would you like to learn?";
  if (field === "focus_areas") return "Which areas should this focus on? Choose as many as you like, or type your own.";
  if (field === "type") return "Should this become a course, a guided project, or an exercise pack?";
  if (field === "desiredOutcome") return "What kind of project or end result should we build?";
  if (field === "language_or_subject") return "Which language or programming topic should the exercises practice?";
  if (field === "practice_scope") return "Should this cover the whole language, selected topics, your weaknesses, or a random mix?";
  if (field === "topics") return "Which topics or areas should the exercises focus on?";
  if (field === "motivation") return "What are you practising this for—for example a project, interviews, work, or stronger fundamentals?";
  if (field === "technology_or_platform") return "Which platform or technology should we use for this project?";
  if (field === "supported_technology") return "Which supported programming language should this use?";
  if (field === "available_technology") return "Which currently available language should this use?";
  if (field === "prior_knowledge") return "What experience do you already have with this subject or stack?";
  if (field === "guidance") return "How much guidance would help—step by step, balanced, or faster with less hand-holding?";
  if (field === "subject") return "What specific programming subject or concept should we focus on?";
  return "What result do you want to achieve?";
}

function finalClarificationForMissingField(field) {
  if (field === "type") return "Last choice before I draft the proposal: should this be a course, guided project, or exercise pack?";
  if (field === "desiredOutcome") return "Last thing I need: what should the finished project do?";
  if (field === "prior_knowledge") return "Last thing I need: what have you already tried or learned around this?";
  if (field === "guidance") return "Last thing I need: should this be step by step, balanced, or faster with less hand-holding?";
  if (field === "technology_or_platform") return "Last thing I need: which supported language, browser library, or platform should this use?";
  if (field === "motivation") return "Last thing I need: what are you practising for?";
  if (field === "practice_scope") return "Last thing I need: should the exercises cover the whole language, selected topics, weaknesses, or a random mix?";
  if (field === "subject") return "Last thing I need: what exact programming subject should this focus on?";
  if (field === "language_or_subject") return "Last thing I need: which language or programming topic should this use?";
  if (field === "available_technology") return "Last thing I need: choose one currently available language for this learning path.";
  return "Last thing I need: what concrete result should this produce for you?";
}

function fallbackSuggestions(field, brief = null) {
  if (field === "learning_intent") return initialLearningSuggestions;
  if (field === "learning_domain") return domainNames(learningDomainCatalog.map((domain) => domain.id));
  if (field === "focus_areas") return findLearningDomain(resolveLearningBriefDomainId(brief))?.focusAreas ?? ["Fundamentals", "Practical examples", "Problem solving", "Reviews"];
  if (field === "type") return ["Course", "Guided project", "Exercise pack", "Help me choose"];
  if (field === "desiredOutcome") return ["Personal website", "Browser game", "CLI notes app", "Help me choose"];
  if (field === "language_or_subject") return ["Python", "JavaScript", "TypeScript", "Choose for me"];
  if (field === "supported_technology" || field === "available_technology") return ["JavaScript", "Python", "TypeScript", "HTML/CSS"];
  if (field === "practice_scope") return ["Selected topics", "Whole language", "My weaknesses", "Random mix"];
  if (field === "topics") return ["Fundamentals", "Functions and data", "Debugging", "Choose useful topics"];
  if (field === "motivation") return ["Build projects", "Prepare for interviews", "Improve fundamentals", "Use it at work"];
  if (field === "technology_or_platform") return ["Browser JavaScript", "HTML/CSS/JS", "Python terminal", "Choose for me"];
  if (field === "prior_knowledge") return ["I’m completely new", "I know the basics", "I’ve built something small", "I’m comfortable already"];
  if (field === "guidance") return ["Step-by-step guidance", "Balanced theory and practice", "Faster, less hand-holding", "Choose for me"];
  if (field === "subject") return ["JavaScript fundamentals", "Python fundamentals", "TypeScript fundamentals", "HTML and CSS"];
  return initialLearningSuggestions;
}

function isLearningCapabilityQuestion(value) {
  return /\b(?:what|which|list|show|tell)\b[\s\S]{0,50}\b(?:languages?|technologies|tech(?:nology)?|frameworks?|subjects?|topics?|areas?|domains?)\b[\s\S]{0,40}\b(?:support|teach|available|offer|use|cover)\b|\b(?:languages?|technologies|frameworks?|subjects?|topics?|areas?|domains?)\b[\s\S]{0,40}\b(?:can you|do you)\b[\s\S]{0,20}\b(?:teach|support|use|cover)\b/i.test(text(value, ""));
}

function learningCapabilityReply(availableTechnologyIds, availableDomainIds) {
  const languages = technologyNames(availableTechnologyIds);
  const domains = domainNames(availableDomainIds);
  return `Stonecode teaches ${domains.join(", ")}. Runnable technologies are ${languages.join(", ")}, with browser-only React, Vue, Svelte, D3, Chart.js, and p5.js. What would you like to learn or build?`;
}

function replyTargetsQuestionField(reply, field) {
  if (!reply || !field || (reply.match(/\?/g) ?? []).length > 1) return false;
  const patterns = {
    learning_intent: /\b(?:want|learn|build|course|project|exercise|language|topic)\b/i,
    learning_domain: /\b(?:area|domain|programming|computer|internet|algorithm|math)\b/i,
    focus_areas: /\b(?:areas|topics|focus|choose|select|interested)\b/i,
    type: /\b(?:course|guided project|project|exercise pack|lesson type|learning mode)\b/i,
    goal: /\b(?:goal|result|achieve|want to learn|want to build|outcome)\b/i,
    subject: /\b(?:subject|concept|topic|language|focus)\b/i,
    desiredOutcome: /\b(?:project|finished|end result|build|create|should it do)\b/i,
    language_or_subject: /\b(?:language|subject|topic|practice)\b/i,
    practice_scope: /\b(?:whole language|selected topics|weakness|random|scope|cover)\b/i,
    topics: /\b(?:topics|areas|concepts|focus)\b/i,
    motivation: /\b(?:practis|practic|prepar|interview|project|work|why|goal)\b/i,
    technology_or_platform: /\b(?:platform|technology|language|stack|browser|terminal)\b/i,
    supported_technology: /\b(?:supported|language|technology|stack)\b/i,
    available_technology: /\b(?:available|language|technology|choose|use)\b/i,
    prior_knowledge: /\b(?:experience|already|tried|learned|built|new|know|familiar)\b/i,
    guidance: /\b(?:guidance|step.by.step|balanced|hand.holding|faster|pace|support)\b/i
  };
  return patterns[field]?.test(reply) === true;
}

function safeDiscoverySuggestions(values, availableTechnologyIds, questionField) {
  const suggestions = uniqueStrings(values);
  if (!["subject", "language_or_subject", "technology_or_platform", "supported_technology", "available_technology"].includes(questionField)) {
    return suggestions.slice(0, 5);
  }
  const available = new Set(normalizedTechnologyIds(availableTechnologyIds));
  return suggestions.filter((suggestion) => {
    const technologyId = resolveRagTechnologyId(suggestion);
    return !technologyId || available.has(technologyId);
  }).slice(0, 5);
}

export function resolveExerciseMixCounts(brief = {}) {
  const exerciseCount = clampInteger(brief.exerciseCount, 5, 25, 10);
  const codingPercent = clampInteger(brief.codingPercent, 0, 100, 70);
  const codingCount = Math.min(exerciseCount, Math.max(0, Math.round(exerciseCount * codingPercent / 100)));
  return { codingCount, mcqCount: exerciseCount - codingCount };
}

function hasPurposeSignal(value) {
  return /\b(for|because|prepare|preparing|interview|job|work|school|class|build|building|project|website|web|game|mobile|backend|frontend|data|automation|fundamentals|career)\b/i.test(value);
}

function hasConcreteProjectGoal(value) {
  const normalized = text(value, "");
  if (!normalized) return false;
  if (/^(?:build\s+(?:a\s+)?project|make\s+(?:an?\s+)?app|create\s+(?:something|a project)|project|app|feature)$/i.test(normalized)) return false;
  return /\b(?:website|page|game|tool|timer|tracker|dashboard|quiz|notes|calculator|portfolio|form|chart|visualizer|cli|terminal|automation|feature|component|app)\b/i.test(normalized)
    || normalized.split(/\s+/).length >= 4;
}

function hasCustomMixSignal(value) {
  return /\b\d{1,3}\s*%|all[ -](?:coding|mcq)|only\s+(?:coding|mcq)|no\s+(?:coding|mcq)\b/i.test(value);
}

function hasPriorKnowledgeSignal(value) {
  return /\b(new|beginner|from scratch|never (?:used|coded|built)|no experience|know|used|tried|built|experience|familiar|comfortable|intermediate|advanced|refresher)\b/i.test(value);
}

function hasGuidanceSignal(value) {
  return /\b(step[ -]by[ -]step|guided|guidance|hand[- ]?holding|explain(?:ed|ing)? everything|deep dive|in depth|balanced|concise|fast(?:er)?|accelerated|choose for me)\b/i.test(value);
}

function inferSupportMode(value) {
  return /\b(step[ -]by[ -]step|guided|explain(?:ed|ing)? everything|deep dive|in depth|more guidance|more hand[- ]?holding)\b/i.test(value)
    ? "teaching_heavy"
    : "standard";
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

function normalizedTechnologyIds(values) {
  const requested = Array.isArray(values) ? values : [];
  return technologyCatalog
    .filter((technology) => requested.includes(technology.id))
    .map((technology) => technology.id);
}

function normalizedDomainIds(values) {
  const requested = new Set(Array.isArray(values) ? values : []);
  return learningDomainCatalog.filter((domain) => requested.has(domain.id)).map((domain) => domain.id);
}

function technologyNames(values) {
  const ids = normalizedTechnologyIds(values);
  return technologyCatalog.filter((technology) => ids.includes(technology.id)).map((technology) => technology.displayName);
}

function domainNames(values) {
  const ids = normalizedDomainIds(values);
  return learningDomainCatalog.filter((domain) => ids.includes(domain.id)).map((domain) => domain.displayName);
}

function inferLearningDomainId(value, { fallback = "programming" } = {}) {
  const normalized = text(value, "").toLowerCase();
  const direct = learningDomainCatalog.find((domain) => normalized.includes(domain.id));
  if (direct) return direct.id;
  if (/\b(?:algorithm|data structure|big[ -]?o|complexity|sorting|searching|linked list|stack|queue|tree|graph traversal)\b/i.test(normalized)) return "algorithms_data_structures";
  if (/\b(?:math(?:ematics)? for programmers?|algebra|discrete math|probability|statistics|linear function|equation|combinatorics)\b/i.test(normalized)) return "math_for_programmers";
  if (/\b(?:computer|it) fundamentals?\b|\b(?:computer hardware|operating systems?|file systems?|storage|cybersecurity basics?|phishing|troubleshooting)\b/i.test(normalized)) return "computer_fundamentals";
  if (/\b(?:internet|web) fundamentals?\b|\b(?:how (?:the )?(?:internet|web) works|dns|domain name system|http(?:s)?|urls?|browser(?:s)? and servers?|web standards?)\b/i.test(normalized)) return "internet_web";
  return fallback;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(Math.max(number, min), max) : fallback;
}
