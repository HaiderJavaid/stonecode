import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.env.STONECODE_ROOT ?? process.cwd());
const editableCourseGenerationRulesPath = join(projectRoot, "docs", "AI_COURSE_GENERATION_RULES.md");

export function readEditableCourseGenerationRules() {
  try {
    return readFileSync(editableCourseGenerationRulesPath, "utf8").trim();
  } catch {
    return "";
  }
}

export function formatEditableCourseGenerationRules(maxLength = 5000) {
  const rules = readEditableCourseGenerationRules();
  if (!rules) return "Editable course-generation rules: unavailable.";
  return `Editable course-generation rules:\n${rules.slice(0, maxLength)}`;
}
