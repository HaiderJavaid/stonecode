const blockingQualityCodes = new Set([
  "topic_missing_theory",
  "topic_missing_theory_teaching",
  "topic_starts_without_theory_teaching",
  "topic_missing_interactive_block",
  "loaded_module_missing_practical_block",
  "theory_block_missing_teaching",
  "workshop_too_short",
  "workshop_prompt_missing_action",
  "workshop_continuity_broken",
  "workshop_expected_change_missing",
  "workshop_no_code_delta",
  "workshop_missing_recap",
  "workshop_code_explanation_missing",
  "workshop_suggested_questions_missing",
  "exercise_workspace_missing_active_file",
  "visual_exercise_missing_scene",
  "lab_before_workshop",
  "project_before_practice_readiness",
  "exercise_topic_mismatch",
  "mcq_topic_mismatch",
  "mcq_duplicate_prompt",
  "quiz_too_short",
  "repetitive_topic_cadence",
  "syntax_teaching_missing",
  "course_introduction_missing_orientation",
  "hard_lab_before_final_third"
]);

export function validateGeneratedCourseQuality(content, { conceptual = false, moduleIndexOffset = 0, totalModuleCount = content?.modules?.length ?? 1 } = {}) {
  if (!content || content.schemaVersion !== "course-content/v2") return [];

  const warnings = [];
  for (const [moduleIndex, module] of (content.modules ?? []).entries()) {
    const courseModuleIndex = moduleIndex + moduleIndexOffset;
    const practiceState = { workshops: 0, labs: 0, practicalBlocks: 0 };
    let previousPracticeSignature = null;
    let repeatedPracticeSignatureCount = 0;
    const hasPracticalBlock = (module.topics ?? []).some((topic) =>
      (topic.blocks ?? []).some((block) => ["workshop", "lab", "project"].includes(block.kind))
    );
    if (courseModuleIndex === 0 && !hasSubstantiveCourseIntroduction(module)) {
      warnings.push(createWarning(
        "course_introduction_missing_orientation",
        `modules[${moduleIndex}] needs a friendly first lesson explaining what the subject is, why people use it, what learners can build, an interesting fact or analogy, and the course path in language a 10-year-old can follow.`
      ));
    }
    if (courseModuleIndex === 0 && !conceptual && !hasPracticalBlock) {
      warnings.push(createWarning("loaded_module_missing_practical_block", `modules[${moduleIndex}] has no workshop, lab, or project block.`));
    }

    for (const [topicIndex, topic] of (module.topics ?? []).entries()) {
      const topicPath = `modules[${moduleIndex}].topics[${topicIndex}]`;
      const practiceSignature = (topic.blocks ?? [])
        .map((block) => block?.kind)
        .filter((kind) => kind && !["theory", "review"].includes(kind))
        .join(">");
      if (practiceSignature && practiceSignature === previousPracticeSignature) {
        repeatedPracticeSignatureCount += 1;
      } else {
        previousPracticeSignature = practiceSignature || null;
        repeatedPracticeSignatureCount = practiceSignature ? 1 : 0;
      }
      if (repeatedPracticeSignatureCount >= 3) {
        warnings.push(createWarning(
          "repetitive_topic_cadence",
          `${topicPath} repeats the ${practiceSignature} practice cadence for ${repeatedPracticeSignatureCount} consecutive topics.`
        ));
      }
      const hasTheory = (topic.blocks ?? []).some((block) => block.kind === "theory");
      const hasTeachingTheory = (topic.blocks ?? []).some((block) => block.kind === "theory" && hasTeachingSteps(block));
      if (courseModuleIndex === 0 && !hasTheory) {
        warnings.push(createWarning("topic_missing_theory", `${topicPath} has no theory block.`));
      }
      if (courseModuleIndex === 0 && !hasTeachingTheory) {
        warnings.push(createWarning("topic_missing_theory_teaching", `${topicPath} has no theory block with teaching steps.`));
      }

      const firstBlock = (topic.blocks ?? [])[0];
      if (courseModuleIndex === 0 && firstBlock && (firstBlock.kind !== "theory" || !hasTeachingSteps(firstBlock))) {
        warnings.push(createWarning("topic_starts_without_theory_teaching", `${topicPath} does not start with real theory teaching.`));
      }

      const hasInteractiveBlock = (topic.blocks ?? []).some((block) => ["quiz", "workshop", "lab", "project"].includes(block.kind));
      if (courseModuleIndex === 0 && !hasInteractiveBlock) {
        warnings.push(createWarning("topic_missing_interactive_block", `${topicPath} has no quiz, workshop, lab, or project block.`));
      }

      const priorTeaching = [];
      const topicMcqPrompts = new Set();
      for (const [blockIndex, block] of (topic.blocks ?? []).entries()) {
        const blockPath = `${topicPath}.blocks[${blockIndex}]`;
        if (block?.kind === "lab" && isHardOrCumulativeLab(block) && courseModuleIndex < Math.ceil(Math.max(totalModuleCount, 1) * 2 / 3)) {
          warnings.push(createWarning("hard_lab_before_final_third", `${blockPath} is a hard or cumulative lab before the final third of the course.`));
        }
        if (courseModuleIndex === 0) validatePracticeProgression(block, blockPath, warnings, practiceState);
        validateBlock(block, blockPath, warnings, priorTeaching.join("\n"), `${topic.title ?? ""} ${topic.summary ?? ""}`, topicMcqPrompts);
        for (const step of Array.isArray(block?.steps) ? block.steps : []) {
          if (["theory", "analogy", "example", "summary"].includes(step?.type)) priorTeaching.push(cleanText(step.markdown));
        }
      }
    }
  }
  return warnings;
}

function hasSubstantiveCourseIntroduction(module) {
  const firstTeachingStep = (module?.topics?.[0]?.blocks ?? [])
    .find((block) => block?.kind === "theory")
    ?.steps?.find((step) => ["theory", "analogy", "example"].includes(step?.type));
  const markdown = cleanText(firstTeachingStep?.markdown);
  const paragraphs = String(firstTeachingStep?.markdown ?? "").split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const hasPurposeAndPossibility = /\b(?:used?|useful|build|create|make|game|app|website|robot|system|tool|real[- ]world)\b/i.test(markdown);
  return paragraphs.length >= 3 && wordCount >= 90 && hasPurposeAndPossibility;
}

function isHardOrCumulativeLab(block) {
  const textValue = [block?.title, block?.summary, ...(block?.steps ?? []).flatMap((step) => [step?.context, step?.prompt])]
    .filter(Boolean)
    .join(" ");
  return /\b(?:hard|advanced|comprehensive|cumulative|capstone|final challenge|overall knowledge)\b/i.test(textValue);
}

export function hasBlockingGeneratedCourseQualityWarnings(warnings) {
  return getBlockingGeneratedCourseQualityWarnings(warnings).length > 0;
}

export function getBlockingGeneratedCourseQualityWarnings(warnings) {
  return (warnings ?? []).filter((warning) => blockingQualityCodes.has(warning?.code));
}

export function hasRepairableGeneratedCourseQualityWarnings(warnings) {
  return hasBlockingGeneratedCourseQualityWarnings(warnings);
}

function validatePracticeProgression(block, blockPath, warnings, state) {
  if (block?.kind === "lab" && state.workshops < 1) {
    warnings.push(createWarning("lab_before_workshop", `${blockPath} lab appears before any guided workshop.`));
  }
  if (block?.kind === "project" && (state.workshops < 2 || state.labs < 1)) {
    warnings.push(createWarning(
      "project_before_practice_readiness",
      `${blockPath} project appears before multiple workshops and at least one lab establish readiness.`
    ));
  }
  if (block?.kind === "workshop") state.workshops += 1;
  if (block?.kind === "lab") state.labs += 1;
  if (["workshop", "lab", "project"].includes(block?.kind)) state.practicalBlocks += 1;
}

export function groupGeneratedCourseWarningsByModule(warnings) {
  const grouped = new Map();
  for (const warning of warnings ?? []) {
    const match = String(warning?.message ?? "").match(/modules\[(\d+)\]/);
    const moduleIndex = match ? Number(match[1]) : 0;
    if (!Number.isInteger(moduleIndex) || moduleIndex < 0) continue;
    if (!grouped.has(moduleIndex)) grouped.set(moduleIndex, []);
    grouped.get(moduleIndex).push(warning);
  }
  return grouped;
}

export function groupGeneratedCourseWarningsByTopic(warnings, moduleIndex = 0) {
  const grouped = new Map();
  for (const warning of warnings ?? []) {
    const match = String(warning?.message ?? "").match(/modules\[(\d+)\]\.topics\[(\d+)\]/);
    if (!match || Number(match[1]) !== moduleIndex) continue;
    const topicIndex = Number(match[2]);
    if (!Number.isInteger(topicIndex) || topicIndex < 0) continue;
    if (!grouped.has(topicIndex)) grouped.set(topicIndex, []);
    grouped.get(topicIndex).push(warning);
  }
  return grouped;
}

function validateBlock(block, blockPath, warnings, priorTeaching = "", topicContext = "", topicMcqPrompts = new Set()) {
  const steps = Array.isArray(block?.steps) ? block.steps : [];
  if (!steps.length) {
    warnings.push(createWarning("block_empty", `${blockPath} has no steps.`));
    return;
  }

  if (block.kind === "theory") {
    const teachingSteps = steps.filter((step) => ["theory", "analogy", "example", "summary"].includes(step?.type));
    if (!teachingSteps.length) {
      warnings.push(createWarning("theory_block_missing_teaching", `${blockPath} theory block has no teaching steps.`));
    }
    if (steps[0]?.type === "mcq") {
      warnings.push(createWarning("theory_starts_with_quiz", `${blockPath} starts with a quiz instead of teaching.`));
    }
  }
  if (block.kind === "workshop" && steps.filter((step) => step.type === "workshop").length < 4) {
    warnings.push(createWarning("workshop_too_short", `${blockPath} workshop has fewer than 4 steps.`));
  }
  if (block.kind === "workshop") {
    const workshopSteps = steps.filter((step) => step.type === "workshop");
    validateWorkshopContinuity(workshopSteps, blockPath, warnings);
    if (steps.at(-1)?.type !== "summary") {
      warnings.push(createWarning("workshop_missing_recap", `${blockPath} workshop does not end with a non-coding summary step.`));
    }
  }
  if (block.kind === "quiz" && steps.filter((step) => step.type === "mcq").length < 4) {
    warnings.push(createWarning("quiz_too_short", `${blockPath} quiz has fewer than 4 MCQs.`));
  }

  const blockContext = `${topicContext} ${cleanText(block?.title)} ${cleanText(block?.summary)}`;
  let availableTeaching = priorTeaching;
  for (const [stepIndex, step] of steps.entries()) {
    const stepPath = `${blockPath}.steps[${stepIndex}]`;
    if (["theory", "analogy", "example", "summary"].includes(step?.type)) {
      validateTeachingStep(step, stepPath, warnings);
    }
    if (step?.type === "mcq") validateMcqStep(step, stepPath, warnings, availableTeaching, blockContext, topicMcqPrompts);
    if (["workshop", "lab", "project"].includes(step?.type)) validateExerciseStep(step, stepPath, warnings, availableTeaching, blockContext);
    if (step?.type === "reflection") validateReflectionStep(step, stepPath, warnings);
    if (["theory", "analogy", "example", "summary"].includes(step?.type)) {
      availableTeaching = `${availableTeaching}\n${cleanText(step.markdown)}`;
    }
  }
}

function validateTeachingStep(step, stepPath, warnings) {
  const markdown = cleanText(step.markdown);
  if (wordCount(markdown) < 18) {
    warnings.push(createWarning("theory_too_thin", `${stepPath} teaching content is too thin.`));
  }
  if (containsInternalPromptLeak(markdown)) {
    warnings.push(createWarning("prompt_leak", `${stepPath} contains internal prompt language.`));
  }
}

function validateMcqStep(step, stepPath, warnings, priorTeaching = "", topicContext = "", topicMcqPrompts = new Set()) {
  const options = Array.isArray(step.options) ? step.options.filter((option) => typeof option === "string" && option.trim()) : [];
  const prompt = cleanText(step.prompt);
  const explanation = cleanText(step.explanation);
  if (!prompt) warnings.push(createWarning("mcq_missing_prompt", `${stepPath} has no prompt.`));
  if (options.length !== 4) warnings.push(createWarning("mcq_wrong_option_count", `${stepPath} does not have 4 options.`));
  if (!Number.isInteger(step.correctOptionIndex) || step.correctOptionIndex < 0 || step.correctOptionIndex >= options.length) {
    warnings.push(createWarning("mcq_bad_correct_index", `${stepPath} has invalid correctOptionIndex.`));
  }
  if (!explanation) warnings.push(createWarning("mcq_missing_explanation", `${stepPath} has no explanation.`));
  const promptKey = prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (promptKey && topicMcqPrompts.has(promptKey)) {
    warnings.push(createWarning("mcq_duplicate_prompt", `${stepPath} repeats an earlier question in this topic.`));
  }
  if (promptKey) topicMcqPrompts.add(promptKey);
  if (prompt) {
    const grounding = classifyTopicGrounding(
      `${topicContext} ${priorTeaching}`,
      `${prompt} ${explanation} ${options.join(" ")} ${uniqueText(step?.conceptIds)}`
    );
    if (grounding === "mismatch") {
      warnings.push(createWarning("mcq_topic_mismatch", `${stepPath} does not reinforce the current topic teaching.`));
    } else if (grounding === "uncertain") {
      warnings.push(createWarning("mcq_topic_grounding_uncertain", `${stepPath} is programming-related but has weak lexical grounding to the current topic.`));
    }
  }
}

function validateExerciseStep(step, stepPath, warnings, priorTeaching = "", topicContext = "") {
  const context = cleanText(step.context);
  const prompt = cleanText(step.prompt);
  const criteria = Array.isArray(step.acceptanceCriteria) ? step.acceptanceCriteria.filter((item) => cleanText(item)) : [];
  if (wordCount(context) < 10) warnings.push(createWarning("exercise_context_too_thin", `${stepPath} has weak exercise context.`));
  if (wordCount(prompt) < 8) warnings.push(createWarning("exercise_prompt_too_thin", `${stepPath} has weak exercise prompt.`));
  if (criteria.length < 2) warnings.push(createWarning("exercise_criteria_too_thin", `${stepPath} needs at least 2 acceptance criteria.`));
  if (!cleanText(step.language)) warnings.push(createWarning("exercise_missing_language", `${stepPath} has no language.`));
  if (!cleanText(step.filePath)) warnings.push(createWarning("exercise_missing_file_path", `${stepPath} has no filePath.`));
  const workspaceFiles = Array.isArray(step.workspaceFiles) ? step.workspaceFiles : [];
  if (!workspaceFiles.some((file) => cleanText(file?.path) === cleanText(step.filePath))) {
    warnings.push(createWarning("exercise_workspace_missing_active_file", `${stepPath} workspaceFiles does not include its active filePath.`));
  }
  if (step.requiresPreview && !workspaceFiles.some((file) => /\.(html?|css|js|jsx|mjs)$/i.test(cleanText(file?.path)))) {
    warnings.push(createWarning("visual_exercise_missing_scene", `${stepPath} requires Output but has no browser-renderable source file.`));
  }
  if (containsInternalPromptLeak(`${context}\n${prompt}`)) warnings.push(createWarning("prompt_leak", `${stepPath} contains internal prompt language.`));
  const grounding = classifyTopicGrounding(
    `${topicContext} ${priorTeaching}`,
    `${context} ${prompt} ${criteria.join(" ")} ${cleanText(step.codeExplanation)} ${uniqueText(step.conceptIds)} ${cleanText(step.starterCode)} ${cleanText(step.resultCode)}`
  );
  if (grounding === "mismatch") {
    warnings.push(createWarning("exercise_topic_mismatch", `${stepPath} does not reference the current topic goal or teaching.`));
  } else if (grounding === "uncertain") {
    warnings.push(createWarning("exercise_topic_grounding_uncertain", `${stepPath} is programming-related but has weak lexical grounding to the current topic.`));
  }
  if (cleanText(step.starterCode) && !hasSyntaxTeaching(`${priorTeaching}\n${context}\n${prompt}\n${cleanText(step.codeExplanation)}`)) {
    warnings.push(createWarning("syntax_teaching_missing", `${stepPath} uses code but does not explain syntax before the learner edits.`));
  }
  if (step?.type === "workshop") validateWorkshopStep(step, stepPath, warnings);
}

function validateWorkshopContinuity(steps, blockPath, warnings) {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const stepPath = `${blockPath}.steps[${index}]`;
    if (!cleanText(step.expectedChange)) {
      warnings.push(createWarning("workshop_expected_change_missing", `${stepPath} has no explicit micro-edit contract.`));
    }
    if (cleanText(step.starterCode) === cleanText(step.resultCode)) {
      warnings.push(createWarning("workshop_no_code_delta", `${stepPath} resultCode does not change starterCode.`));
    }
    if (index === 0) continue;
    const previous = steps[index - 1];
    if (!cleanText(step.buildsOnStepId) || step.buildsOnStepId !== previous.id) {
      warnings.push(createWarning("workshop_continuity_broken", `${stepPath} does not reference the previous workshop step.`));
    } else if (cleanText(previous.resultCode) && cleanText(step.starterCode) !== cleanText(previous.resultCode)) {
      warnings.push(createWarning("workshop_continuity_broken", `${stepPath} starterCode does not equal the previous resultCode.`));
    }
  }
}

function validateWorkshopStep(step, stepPath, warnings) {
  const context = cleanText(step.context);
  const prompt = cleanText(step.prompt);
  if (!/\b(learn|practice|build|useful|because|why|connects?|continues?|previous|next|now|helps?|allows?|lets?|matters?|purpose|prepares?|foundation|so that)\b/i.test(context)) {
    warnings.push(createWarning("workshop_context_missing_purpose", `${stepPath} workshop context does not explain why this step matters.`));
  }
  if (!/\b(add|change|replace|write|create|call|print|show|return|move|wrap|put|type|edit|set|define)\b/i.test(prompt)) {
    warnings.push(createWarning("workshop_prompt_missing_action", `${stepPath} workshop prompt does not include a concrete edit action.`));
  }
  if (wordCount(prompt) > 120) {
    warnings.push(createWarning("workshop_prompt_too_broad", `${stepPath} workshop prompt is too broad for one atomic step.`));
  }
  if (!cleanText(step.codeExplanation)) {
    warnings.push(createWarning("workshop_code_explanation_missing", `${stepPath} does not explain its exact micro-change.`));
  }
  if (!Array.isArray(step.suggestedQuestions) || step.suggestedQuestions.filter((question) => cleanText(question)).length < 2) {
    warnings.push(createWarning("workshop_suggested_questions_missing", `${stepPath} needs at least two relevant suggested questions.`));
  }
}

function validateReflectionStep(step, stepPath, warnings) {
  const prompt = cleanText(step.prompt);
  if (wordCount(prompt) < 10) warnings.push(createWarning("reflection_prompt_too_thin", `${stepPath} reflection prompt is too thin.`));
  if (!cleanText(step.rubric)) warnings.push(createWarning("reflection_missing_rubric", `${stepPath} has no rubric.`));
}

function createWarning(code, message) {
  return { code, message };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function wordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function hasMeaningfulTokenOverlap(left, right) {
  const ignored = new Set(["about", "after", "and", "before", "beginner", "build", "code", "course", "current", "does", "exercise", "first", "for", "from", "how", "into", "learn", "learning", "module", "practice", "program", "step", "that", "the", "this", "topic", "under", "using", "what", "when", "where", "which", "with", "why"]);
  const tokens = semanticTokens(left, ignored);
  if (!tokens.length) return true;
  const haystack = new Set(semanticTokens(right, ignored));
  return tokens.some((token) => haystack.has(token));
}

function classifyTopicGrounding(reference, candidate) {
  if (hasMeaningfulTokenOverlap(reference, candidate)) return "grounded";
  return hasProgrammingEvidence(candidate) ? "uncertain" : "mismatch";
}

function hasProgrammingEvidence(value) {
  return /```|\b(?:algorithm|argument|array|assign|attribute|boolean|branch|class|code|condition|constant|debug|dictionary|element|error|expression|file|function|html|indent|input|iteration|keyword|list|loop|method|object|operator|output|parameter|print|program|property|return|selector|string|syntax|tuple|type|value|variable)\b|[(){};]|\b(?:const|let|var|def|elif|else|for|if|while)\b/i.test(cleanText(value));
}

function uniqueText(value) {
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean).join(" ") : "";
}

function semanticTokens(value, ignored) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length >= 3 && !ignored.has(token))
    .map((token) => token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token);
}

function containsInternalPromptLeak(value) {
  return /\b(hidden reasoning|system instruction|prompt rule|do not output|before generating|assessment intent)\b/i.test(value);
}

function hasTeachingSteps(block) {
  return (Array.isArray(block?.steps) ? block.steps : []).some((step) => ["theory", "analogy", "example", "summary"].includes(step?.type));
}

function hasSyntaxTeaching(value) {
  const text = cleanText(value);
  return /```|syntax|token|keyword|quotes?|parentheses|braces?|semicolon|operator|indentation|line\s+does|this\s+line|console\.log|print\s*\(|Console\.WriteLine|std::cout/i.test(text)
    || /\b(variable|function|method|parameter|argument|string|const|let|var)\b.{0,90}\b(means|stores|holds|names|runs|calls|receives|creates|text|value)\b/i.test(text)
    || /\b(means|stores|holds|names|runs|calls|receives|creates|text|value)\b.{0,90}\b(variable|function|method|parameter|argument|string|const|let|var)\b/i.test(text);
}
