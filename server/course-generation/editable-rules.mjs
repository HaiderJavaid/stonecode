import { readFileSync } from "node:fs";

const editableCourseGenerationRulesUrl = new URL("../../docs/AI_COURSE_GENERATION_RULES.md", import.meta.url);

export function readEditableCourseGenerationRules() {
  try {
    return readFileSync(editableCourseGenerationRulesUrl, "utf8").trim();
  } catch {
    return "";
  }
}

export function formatEditableCourseGenerationRules(maxLength = 5000) {
  const rules = readEditableCourseGenerationRules();
  if (!rules) return "Editable course-generation rules: unavailable.";
  return `Editable course-generation rules:\n${rules.slice(0, maxLength)}`;
}
