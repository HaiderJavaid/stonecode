export const AUTO_SIMPLE_VISUAL_MARKER: "auto-simple-v1";

export type SimpleVisualPreviewInput = {
  path: string;
  content: string;
  language?: string;
  context?: string;
  prompt?: string;
  requiresPreview?: boolean;
};

export type SimpleVisualInspection = {
  supported: boolean;
  excludedEngine: boolean;
  profileId: string;
  label: string;
};

export type SimpleVisualPreviewFile = {
  path: string;
  content: string;
  purpose: string;
  editable: false;
};

export function inspectSimpleVisualSource(input: SimpleVisualPreviewInput): SimpleVisualInspection;
export function createSimpleVisualPreviewFile(input: SimpleVisualPreviewInput, existingPaths?: string[]): SimpleVisualPreviewFile | null;
export function isAutoSimpleVisualPreview(html: string): boolean;
export function buildSimpleVisualPreviewHtml(
  input: SimpleVisualPreviewInput,
  options?: { previewPath?: string; inspection?: SimpleVisualInspection }
): string;
