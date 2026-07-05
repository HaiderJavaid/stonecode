export function validateGeneratedCourseQuality(content) {
  if (!content || content.schemaVersion !== "course-content/v2") return [];

  const warnings = [];
  for (const [moduleIndex, module] of (content.modules ?? []).entries()) {
    const hasPracticalBlock = (module.topics ?? []).some((topic) =>
      (topic.blocks ?? []).some((block) => ["workshop", "lab", "project"].includes(block.kind))
    );
    if (moduleIndex === 0 && !hasPracticalBlock) {
      warnings.push(createWarning("loaded_module_missing_practical_block", `modules[${moduleIndex}] has no workshop, lab, or project block.`));
    }

    for (const [topicIndex, topic] of (module.topics ?? []).entries()) {
      const topicPath = `modules[${moduleIndex}].topics[${topicIndex}]`;
      const hasTheory = (topic.blocks ?? []).some((block) => block.kind === "theory");
      if (moduleIndex === 0 && !hasTheory) {
        warnings.push(createWarning("topic_missing_theory", `${topicPath} has no theory block.`));
      }

      const hasInteractiveBlock = (topic.blocks ?? []).some((block) => ["quiz", "workshop", "lab", "project"].includes(block.kind));
      if (moduleIndex === 0 && !hasInteractiveBlock) {
        warnings.push(createWarning("topic_missing_interactive_block", `${topicPath} has no quiz, workshop, lab, or project block.`));
      }

      for (const [blockIndex, block] of (topic.blocks ?? []).entries()) {
        const blockPath = `${topicPath}.blocks[${blockIndex}]`;
        validateBlock(block, blockPath, warnings);
      }
    }
  }
  return warnings;
}

export function hasBlockingGeneratedCourseQualityWarnings(warnings) {
  const blockingCodes = new Set(["topic_missing_theory", "topic_missing_interactive_block", "loaded_module_missing_practical_block", "workshop_too_short", "quiz_too_short"]);
  return warnings.some((warning) => blockingCodes.has(warning.code));
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

function validateBlock(block, blockPath, warnings) {
  const steps = Array.isArray(block?.steps) ? block.steps : [];
  if (!steps.length) {
    warnings.push(createWarning("block_empty", `${blockPath} has no steps.`));
    return;
  }

  if (block.kind === "workshop" && steps.length < 4) {
    warnings.push(createWarning("workshop_too_short", `${blockPath} workshop has fewer than 4 steps.`));
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
    if (["workshop", "lab", "project"].includes(step?.type)) validateExerciseStep(step, stepPath, warnings);
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

function validateExerciseStep(step, stepPath, warnings) {
  const context = cleanText(step.context);
  const prompt = cleanText(step.prompt);
  const criteria = Array.isArray(step.acceptanceCriteria) ? step.acceptanceCriteria.filter((item) => cleanText(item)) : [];
  if (wordCount(context) < 10) warnings.push(createWarning("exercise_context_too_thin", `${stepPath} has weak exercise context.`));
  if (wordCount(prompt) < 8) warnings.push(createWarning("exercise_prompt_too_thin", `${stepPath} has weak exercise prompt.`));
  if (criteria.length < 2) warnings.push(createWarning("exercise_criteria_too_thin", `${stepPath} needs at least 2 acceptance criteria.`));
  if (!cleanText(step.language)) warnings.push(createWarning("exercise_missing_language", `${stepPath} has no language.`));
  if (!cleanText(step.filePath)) warnings.push(createWarning("exercise_missing_file_path", `${stepPath} has no filePath.`));
  if (containsInternalPromptLeak(`${context}\n${prompt}`)) warnings.push(createWarning("prompt_leak", `${stepPath} contains internal prompt language.`));
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

function containsInternalPromptLeak(value) {
  return /\b(hidden reasoning|system instruction|prompt rule|do not output|before generating|assessment intent)\b/i.test(value);
}
