export function validateGeneratedCourseQuality(content) {
  if (!content || content.schemaVersion !== "course-content/v2") return [];

  const warnings = [];
  for (const [moduleIndex, module] of (content.modules ?? []).entries()) {
    const practiceState = { workshops: 0, labs: 0, practicalBlocks: 0 };
    const hasPracticalBlock = (module.topics ?? []).some((topic) =>
      (topic.blocks ?? []).some((block) => ["workshop", "lab", "project"].includes(block.kind))
    );
    if (moduleIndex === 0 && !hasPracticalBlock) {
      warnings.push(createWarning("loaded_module_missing_practical_block", `modules[${moduleIndex}] has no workshop, lab, or project block.`));
    }

    for (const [topicIndex, topic] of (module.topics ?? []).entries()) {
      const topicPath = `modules[${moduleIndex}].topics[${topicIndex}]`;
      const hasTheory = (topic.blocks ?? []).some((block) => block.kind === "theory");
      const hasTeachingTheory = (topic.blocks ?? []).some((block) => block.kind === "theory" && hasTeachingSteps(block));
      if (moduleIndex === 0 && !hasTheory) {
        warnings.push(createWarning("topic_missing_theory", `${topicPath} has no theory block.`));
      }
      if (moduleIndex === 0 && !hasTeachingTheory) {
        warnings.push(createWarning("topic_missing_theory_teaching", `${topicPath} has no theory block with teaching steps.`));
      }

      const firstBlock = (topic.blocks ?? [])[0];
      if (moduleIndex === 0 && firstBlock && (firstBlock.kind !== "theory" || !hasTeachingSteps(firstBlock))) {
        warnings.push(createWarning("topic_starts_without_theory_teaching", `${topicPath} does not start with real theory teaching.`));
      }

      const hasInteractiveBlock = (topic.blocks ?? []).some((block) => ["quiz", "workshop", "lab", "project"].includes(block.kind));
      if (moduleIndex === 0 && !hasInteractiveBlock) {
        warnings.push(createWarning("topic_missing_interactive_block", `${topicPath} has no quiz, workshop, lab, or project block.`));
      }

      const priorTeaching = [];
      for (const [blockIndex, block] of (topic.blocks ?? []).entries()) {
        const blockPath = `${topicPath}.blocks[${blockIndex}]`;
        if (moduleIndex === 0) validatePracticeProgression(block, blockPath, warnings, practiceState);
        validateBlock(block, blockPath, warnings, priorTeaching.join("\n"), `${topic.title ?? ""} ${topic.summary ?? ""}`);
        for (const step of Array.isArray(block?.steps) ? block.steps : []) {
          if (["theory", "analogy", "example", "summary"].includes(step?.type)) priorTeaching.push(cleanText(step.markdown));
        }
      }
    }
  }
  return warnings;
}

export function hasBlockingGeneratedCourseQualityWarnings(warnings) {
  const blockingCodes = new Set([
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
    "quiz_too_short",
    "syntax_teaching_missing"
  ]);
  return warnings.some((warning) => blockingCodes.has(warning.code));
}

export function hasRepairableGeneratedCourseQualityWarnings(warnings) {
  return hasBlockingGeneratedCourseQualityWarnings(warnings)
    || warnings.some((warning) => warning.code === "workshop_context_missing_purpose");
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

function validateBlock(block, blockPath, warnings, priorTeaching = "", topicContext = "") {
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

  for (const [stepIndex, step] of steps.entries()) {
    const stepPath = `${blockPath}.steps[${stepIndex}]`;
    if (["theory", "analogy", "example", "summary"].includes(step?.type)) {
      validateTeachingStep(step, stepPath, warnings);
    }
    if (step?.type === "mcq") validateMcqStep(step, stepPath, warnings);
    if (["workshop", "lab", "project"].includes(step?.type)) validateExerciseStep(step, stepPath, warnings, priorTeaching, topicContext);
    if (step?.type === "reflection") validateReflectionStep(step, stepPath, warnings);
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

function validateMcqStep(step, stepPath, warnings) {
  const options = Array.isArray(step.options) ? step.options.filter((option) => typeof option === "string" && option.trim()) : [];
  if (!cleanText(step.prompt)) warnings.push(createWarning("mcq_missing_prompt", `${stepPath} has no prompt.`));
  if (options.length !== 4) warnings.push(createWarning("mcq_wrong_option_count", `${stepPath} does not have 4 options.`));
  if (!Number.isInteger(step.correctOptionIndex) || step.correctOptionIndex < 0 || step.correctOptionIndex >= options.length) {
    warnings.push(createWarning("mcq_bad_correct_index", `${stepPath} has invalid correctOptionIndex.`));
  }
  if (!cleanText(step.explanation)) warnings.push(createWarning("mcq_missing_explanation", `${stepPath} has no explanation.`));
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
    warnings.push(createWarning("visual_exercise_missing_scene", `${stepPath} requires Visual view but has no browser-renderable scene file.`));
  }
  if (containsInternalPromptLeak(`${context}\n${prompt}`)) warnings.push(createWarning("prompt_leak", `${stepPath} contains internal prompt language.`));
  if (!hasMeaningfulTokenOverlap(topicContext, `${context} ${prompt} ${criteria.join(" ")}`)) {
    warnings.push(createWarning("exercise_topic_mismatch", `${stepPath} does not reference the current topic goal.`));
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
  if (!/\b(learn|practice|build|useful|because|why|connects?|continues?|previous|next|now)\b/i.test(context)) {
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
  const ignored = new Set(["about", "after", "before", "beginner", "build", "code", "course", "current", "exercise", "first", "learn", "learning", "module", "practice", "program", "step", "topic", "using", "with"]);
  const tokens = cleanText(left).toLowerCase().split(/[^a-z0-9+#]+/).filter((token) => token.length >= 3 && !ignored.has(token));
  if (!tokens.length) return true;
  const haystack = cleanText(right).toLowerCase();
  return tokens.some((token) => haystack.includes(token));
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
