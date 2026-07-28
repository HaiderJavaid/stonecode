import type { EditorDiagnostic } from "@/components/stonecode/types";

export function buildWorkshopEditorDiagnostics(actualCode: string, expectedCode: string, filePath?: string): EditorDiagnostic[] {
  const actual = normalizeLines(actualCode);
  const expected = normalizeLines(expectedCode);
  if (!expected.length || actual.join("\n") === expected.join("\n")) return [];

  let prefix = 0;
  while (prefix < actual.length && prefix < expected.length && actual[prefix] === expected[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < actual.length - prefix
    && suffix < expected.length - prefix
    && actual[actual.length - 1 - suffix] === expected[expected.length - 1 - suffix]
  ) suffix += 1;

  const actualChanged = actual.slice(prefix, actual.length - suffix);
  const expectedChanged = expected.slice(prefix, expected.length - suffix);
  const count = Math.max(actualChanged.length, expectedChanged.length, 1);
  const diagnostics: EditorDiagnostic[] = [];

  for (let index = 0; index < count; index += 1) {
    const actualLine = actualChanged[index];
    const expectedLine = expectedChanged[index];
    const line = Math.max(1, Math.min(prefix + index + 1, actual.length || 1));
    if (actualLine === expectedLine) continue;
    diagnostics.push({
      filePath,
      line,
      message: !actualLine
        ? `Add: ${expectedLine?.trim() || "the missing workshop line"}`
        : !expectedLine
          ? "Remove this extra line for this step."
          : `Expected: ${expectedLine.trim()}`
    });
  }

  return diagnostics.slice(0, 5);
}

function normalizeLines(code: string) {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 1 && !lines.at(-1)?.trim()) lines.pop();
  return lines;
}
