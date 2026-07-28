import { defaultCourseCodeHtml } from "@/data/courses";
import { FilePanel } from "@/components/stonecode/FilePanel";
import { RunTerminal } from "@/components/stonecode/RunTerminal";
import { StoneEditor } from "@/components/stonecode/StoneEditor";
import { resolveCourseLessonSteps } from "@/components/stonecode/lessonData";
import { ActiveState, EditorDiagnostic } from "@/components/stonecode/types";
import { Course } from "@/data/courses";
import { RunLog } from "@/services/codeRunner";
import { resolveEditorLanguage } from "@/services/editorLanguages";
import { EditorLanguageId } from "@/services/editorLanguages";
import { buildSimpleVisualPreviewHtml, isAutoSimpleVisualPreview } from "@/services/simpleVisualPreview.mjs";
import { normalizeWorkspacePath, WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { useEffect, useMemo, useState } from "react";

type WorkspaceView = "code" | "preview" | "terminal";

export function CourseWorkspace({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  activeLessonIndex,
  editorDiagnostics,
  planName,
  selectedFile,
  userEmail,
  terminalLogs,
  isRunningCode,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onSelectFile,
  onLessonNavigate,
  onMoveFile,
  onMoveFolder,
  onFileChange,
  onRun,
  onClearTerminal
}: {
  active: ActiveState | null;
  activeCourse: Course | null;
  activeFiles: WorkspaceFile[];
  activeFolders: WorkspaceFolder[];
  activeLessonIndex: number;
  editorDiagnostics: EditorDiagnostic[];
  planName: string;
  selectedFile: WorkspaceFile | null;
  userEmail: string;
  terminalLogs: RunLog[];
  isRunningCode: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: () => void;
  onDeleteFile: () => void;
  onSelectFile: (index: number) => void;
  onLessonNavigate: (lessonIndex: number) => void;
  onMoveFile: (fileIndex: number, folderPath: string) => void;
  onMoveFolder: (folderPath: string, targetFolderPath: string) => void;
  onFileChange: (nextValue: string) => void;
  onRun: () => void;
  onClearTerminal: () => void;
}) {
  const codeText = selectedFile?.content ?? "";
  const [editorMode, setEditorMode] = useState<WorkspaceView>("code");
  const editorLanguage = selectedFile ? resolveEditorLanguage(selectedFile.path) : null;
  const recommendedView = useMemo<WorkspaceView>(() => {
    if (!activeCourse) return "code";
    const lesson = resolveCourseLessonSteps(activeCourse)[activeLessonIndex];
    if (lesson?.codeExercise?.workspaceView) return lesson.codeExercise.workspaceView;
    if (lesson?.codeExercise?.requiresPreview) return "preview";
    if (lesson?.codeExercise?.requiresTerminal) return "terminal";
    return "code";
  }, [activeCourse, activeLessonIndex]);
  const preview = useMemo(
    () => buildEditorPreview(activeFiles, selectedFile),
    [activeFiles, selectedFile]
  );

  useEffect(() => {
    setEditorMode(recommendedView);
  }, [activeCourse?.id, activeLessonIndex, recommendedView]);

  return (
    <>
      <FilePanel
        active={Boolean(active)}
        activeCourse={activeCourse}
        activeFiles={activeFiles}
        activeFolders={activeFolders}
        activeLessonIndex={activeLessonIndex}
        planName={planName}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onMoveFile={onMoveFile}
        onMoveFolder={onMoveFolder}
        onRenameFile={onRenameFile}
        onSelectFile={onSelectFile}
        onSelectLesson={onLessonNavigate}
        selectedFile={selectedFile}
        selectedFileIndex={active?.fileIndex ?? -1}
        userEmail={userEmail}
      />

      <section className={`terminal${active && selectedFile ? " has-ide-workspace" : ""}`} aria-label="Stone IDE simulator">
        {active && selectedFile ? (
          <div className="ide-workspace">
            <div className="editor-workspace-tabs" role="tablist" aria-label="Workspace view">
              <WorkspaceTab active={editorMode === "code"} label="Code" onSelect={() => setEditorMode("code")} />
              <WorkspaceTab active={editorMode === "preview"} label="Visual" onSelect={() => setEditorMode("preview")} />
              <WorkspaceTab active={editorMode === "terminal"} label="Terminal" onSelect={() => setEditorMode("terminal")} />
            </div>
            <div className={`editor-shell is-${editorMode}`}>
              {editorMode === "code" ? (
                <StoneEditor
                  filePath={selectedFile.path}
                  diagnostics={editorDiagnostics.filter((diagnostic) =>
                    !diagnostic.filePath || normalizeWorkspacePath(diagnostic.filePath) === normalizeWorkspacePath(selectedFile.path)
                  )}
                  onChange={onFileChange}
                  value={codeText}
                />
              ) : editorMode === "preview" ? (
                <EditorPreview preview={preview} />
              ) : (
                <RunTerminal
                  canRun={canRunInTerminal(editorLanguage?.id)}
                  filePath={selectedFile.path}
                  isRunning={isRunningCode}
                  logs={terminalLogs}
                  onClear={onClearTerminal}
                  onRun={onRun}
                  runNote={editorLanguage?.runNote}
                />
              )}
            </div>
          </div>
        ) : (
          <pre>
            <code id="code-output" dangerouslySetInnerHTML={{ __html: defaultCourseCodeHtml }} />
          </pre>
        )}
      </section>
    </>
  );
}

function canRunInTerminal(languageId: EditorLanguageId | undefined) {
  if (!languageId) return false;
  return !["html", "css", "json", "markdown", "yaml", "xml", "vue", "svelte", "plaintext"].includes(languageId);
}

function WorkspaceTab({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      aria-selected={active}
      className={active ? "is-active" : ""}
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

type EditorPreviewState =
  | { available: true; title: string; srcDoc: string; entryPath: string; connectedPaths: string[]; missingPaths: string[] }
  | { available: false; title: string; message: string };

function EditorPreview({ preview }: { preview: EditorPreviewState }) {
  if (!preview.available) {
    return (
      <div className="editor-preview-empty">
        <strong>{preview.title}</strong>
        <p>{preview.message}</p>
      </div>
    );
  }

  return (
    <div className="editor-preview-shell">
      <div className={`editor-preview-source${preview.missingPaths.length ? " has-warning" : ""}`}>
        <strong>{preview.entryPath}</strong>
        <span>
          {preview.missingPaths.length
            ? `Missing: ${preview.missingPaths.join(", ")}`
            : preview.connectedPaths.length
              ? `Connected: ${preview.connectedPaths.join(", ")}`
              : "HTML only · link CSS or JavaScript to include it"}
        </span>
      </div>
      <iframe
        className="editor-preview-frame"
        sandbox="allow-scripts"
        srcDoc={preview.srcDoc}
        title={preview.title}
      />
    </div>
  );
}

export function buildEditorPreview(files: WorkspaceFile[], selectedFile: WorkspaceFile | null): EditorPreviewState {
  if (!selectedFile) {
    return { available: false, title: "No file selected", message: "Open a file to preview it." };
  }

  const activeLanguage = resolveEditorLanguage(selectedFile.path);
  const htmlFiles = files.filter((file) => resolveEditorLanguage(file.path).id === "html");
  const htmlFile = activeLanguage.id === "html"
    ? selectedFile
    : findConnectedHtmlEntry(htmlFiles, selectedFile.path);

  if (htmlFile) {
    const composed = composeHtmlPreview(htmlFile, files);
    return {
      available: true,
      title: activeLanguage.id === "html" ? `${htmlFile.path} preview` : `${selectedFile.path} via ${htmlFile.path}`,
      entryPath: htmlFile.path,
      connectedPaths: composed.connectedPaths,
      missingPaths: composed.missingPaths,
      srcDoc: composed.srcDoc
    };
  }

  if (activeLanguage.id === "css") {
    return {
      available: false,
      title: `${selectedFile.path} is not connected`,
      message: `Link this stylesheet from an HTML file, for example <link rel="stylesheet" href="${fileName(selectedFile.path)}">. Visual will then render that HTML entrypoint.`
    };
  }

  if (activeLanguage.id === "javascript") {
    return {
      available: false,
      title: `${selectedFile.path} is not connected`,
      message: `Link this browser script from an HTML file with <script src="${fileName(selectedFile.path)}"></script>, or use Terminal when it is a standalone JavaScript program.`
    };
  }

  return {
    available: false,
    title: `${activeLanguage.displayName} preview`,
    message: "This source file does not render directly in a browser. A visual course step should include an HTML scene reference; use Terminal for runnable output."
  };
}

function findConnectedHtmlEntry(htmlFiles: WorkspaceFile[], selectedPath: string) {
  const normalizedSelectedPath = normalizePreviewPath(selectedPath);
  const connected = htmlFiles.filter((htmlFile) =>
    collectHtmlDependencyPaths(htmlFile).includes(normalizedSelectedPath)
  );
  return [...connected].sort((left, right) => previewEntryScore(left.path) - previewEntryScore(right.path))[0] ?? null;
}

function previewEntryScore(path: string) {
  const normalized = normalizePreviewPath(path);
  const name = fileName(normalized).toLowerCase();
  return (name === "index.html" ? 0 : 100) + normalized.split("/").length;
}

function collectHtmlDependencyPaths(htmlFile: WorkspaceFile) {
  const dependencies = new Set<string>();
  for (const tag of htmlFile.content.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((readHtmlAttribute(tag, "name") ?? "").toLowerCase() !== "stonecode-source") continue;
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "content"));
    if (resolved) dependencies.add(resolved);
  }
  for (const tag of htmlFile.content.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\bstylesheet\b/i.test(readHtmlAttribute(tag, "rel") ?? "")) continue;
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "href"));
    if (resolved) dependencies.add(resolved);
  }
  for (const tag of htmlFile.content.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "src"));
    if (resolved) dependencies.add(resolved);
  }
  return [...dependencies];
}

function composeHtmlPreview(htmlFile: WorkspaceFile, files: WorkspaceFile[]) {
  const fileByPath = new Map(files.map((file) => [normalizePreviewPath(file.path), file]));
  const connectedPaths = new Set<string>();
  const missingPaths = new Set<string>();
  let html = htmlFile.content;

  if (isAutoSimpleVisualPreview(html)) {
    const sourceTag = (html.match(/<meta\b[^>]*>/gi) ?? []).find((tag) =>
      (readHtmlAttribute(tag, "name") ?? "").toLowerCase() === "stonecode-source"
    );
    const resolvedSource = resolveWorkspaceReference(htmlFile.path, sourceTag ? readHtmlAttribute(sourceTag, "content") : null);
    const sourceFile = resolvedSource ? fileByPath.get(resolvedSource) : null;
    if (resolvedSource && sourceFile) {
      connectedPaths.add(sourceFile.path);
      html = buildSimpleVisualPreviewHtml({
        path: sourceFile.path,
        content: sourceFile.content,
        requiresPreview: true
      }, { previewPath: htmlFile.path });
      return { srcDoc: html, connectedPaths: [...connectedPaths], missingPaths: [] };
    }
    if (resolvedSource) missingPaths.add(resolvedSource);
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((readHtmlAttribute(tag, "name") ?? "").toLowerCase() !== "stonecode-source") continue;
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "content"));
    if (!resolved) continue;
    const file = fileByPath.get(resolved);
    if (file) connectedPaths.add(file.path);
    else missingPaths.add(resolved);
  }

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\bstylesheet\b/i.test(readHtmlAttribute(tag, "rel") ?? "")) return tag;
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "href"));
    if (!resolved) return tag;
    const file = fileByPath.get(resolved);
    if (!file) {
      missingPaths.add(resolved);
      return `<!-- Missing stylesheet: ${escapeHtml(resolved)} -->`;
    }
    connectedPaths.add(file.path);
    return `<style data-path="${escapeHtml(file.path)}">\n${file.content}\n</style>`;
  });

  html = html.replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    const resolved = resolveWorkspaceReference(htmlFile.path, readHtmlAttribute(tag, "src"));
    if (!resolved) return tag;
    const file = fileByPath.get(resolved);
    if (!file) {
      missingPaths.add(resolved);
      return `<!-- Missing script: ${escapeHtml(resolved)} -->`;
    }
    connectedPaths.add(file.path);
    const type = readHtmlAttribute(tag, "type");
    return `<script${type ? ` type="${escapeHtml(type)}"` : ""} data-path="${escapeHtml(file.path)}">\n${file.content}\n<\/script>`;
  });

  if (missingPaths.size) {
    const notice = `<aside style="position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:10px 12px;border:1px solid #e39a8f;border-radius:8px;background:#2a1110;color:#ffd9d2;font:13px/1.4 system-ui">Missing linked workspace file: ${[...missingPaths].map(escapeHtml).join(", ")}</aside>`;
    html = /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, (body) => `${body}${notice}`) : `${notice}${html}`;
  }

  return { srcDoc: html, connectedPaths: [...connectedPaths], missingPaths: [...missingPaths] };
}

function readHtmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
}

function resolveWorkspaceReference(fromPath: string, reference: string | null) {
  if (!reference) return null;
  const cleanReference = reference.trim().split(/[?#]/, 1)[0];
  if (!cleanReference || cleanReference.startsWith("#") || /^(?:[a-z]+:)?\/\//i.test(cleanReference) || /^(?:data|blob|mailto):/i.test(cleanReference)) return null;
  const baseDirectory = normalizePreviewPath(fromPath).split("/").slice(0, -1).join("/");
  return normalizePreviewPath(cleanReference.startsWith("/") ? cleanReference : `${baseDirectory}/${cleanReference}`);
}

function normalizePreviewPath(path: string) {
  const segments: string[] = [];
  for (const segment of normalizeWorkspacePath(path).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function fileName(path: string) {
  return normalizePreviewPath(path).split("/").at(-1) ?? path;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
