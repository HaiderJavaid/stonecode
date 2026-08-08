import { FilePanel } from "@/components/stonecode/FilePanel";
import { RunTerminal } from "@/components/stonecode/RunTerminal";
import { StoneEditor } from "@/components/stonecode/StoneEditor";
import { resolveCourseLessonSteps } from "@/components/stonecode/lessonData";
import { ActiveState, EditorDiagnostic } from "@/components/stonecode/types";
import { Course } from "@/data/courses";
import { RunLog } from "@/services/codeRunner";
import { resolveEditorLanguage } from "@/services/editorLanguages";
import { EditorLanguageId } from "@/services/editorLanguages";
import { normalizeWorkspacePath, WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { approvedBrowserAssetUrls, browserFrameworkCatalog, isApprovedBrowserAssetUrl } from "../../../shared/stonecode-product.mjs";
import { useEffect, useMemo, useState } from "react";

type WorkspaceView = "code" | "output" | "terminal";
const idleEditorSource = `const workspace = createStonecode({
  mode: "learn-by-building",
  surfaces: ["Code", "Output", "Terminal"],
  tutor: "ready"
});`;

export function CourseWorkspace({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  activeLessonIndex,
  initialLeftPanelView,
  dynamicSurfacesEnabled,
  showNavigationPanel,
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
  initialLeftPanelView: "course" | "files";
  dynamicSurfacesEnabled: boolean;
  showNavigationPanel: boolean;
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
  const activeLesson = useMemo(
    () => activeCourse && showNavigationPanel ? resolveCourseLessonSteps(activeCourse)[activeLessonIndex] : null,
    [activeCourse, activeLessonIndex, showNavigationPanel]
  );
  const availableViews = useMemo<WorkspaceView[]>(() => {
    if (!dynamicSurfacesEnabled) return ["code", "output", "terminal"];
    const views: WorkspaceView[] = ["code"];
    if (activeLesson?.codeExercise?.requiresPreview || activeLesson?.codeExercise?.workspaceView === "preview") views.push("output");
    if (activeLesson?.codeExercise?.requiresTerminal || activeLesson?.codeExercise?.workspaceView === "terminal") views.push("terminal");
    return views;
  }, [activeLesson, dynamicSurfacesEnabled]);
  const preview = useMemo(
    () => buildEditorPreview(activeFiles, selectedFile),
    [activeFiles, selectedFile]
  );

  useEffect(() => {
    setEditorMode("code");
  }, [activeCourse?.id, activeLessonIndex]);

  return (
    <>
      <FilePanel
        active={Boolean(active && showNavigationPanel)}
        activeCourse={activeCourse}
        activeFiles={activeFiles}
        activeFolders={activeFolders}
        activeLessonIndex={activeLessonIndex}
        preferredView={initialLeftPanelView}
        planName={planName}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onMoveFile={onMoveFile}
        onMoveFolder={onMoveFolder}
        onRenameFile={onRenameFile}
        onSelectFile={onSelectFile}
        onSelectLesson={onLessonNavigate}
        selectedFileIndex={active?.fileIndex ?? -1}
        userEmail={userEmail}
      />

      <section className={`terminal${active ? " has-ide-workspace" : ""}`} aria-label="Stone IDE simulator">
        {active ? (
          <div className={`ide-workspace${availableViews.length === 1 ? " is-code-only" : ""}`}>
            {availableViews.length > 1 && (
              <div className="editor-workspace-tabs" role="tablist" aria-label="Workspace view" style={{ gridTemplateColumns: `repeat(${availableViews.length}, minmax(0, 1fr))` }}>
                {availableViews.includes("code") && <WorkspaceTab active={editorMode === "code"} label="Code" onSelect={() => setEditorMode("code")} />}
                {availableViews.includes("output") && <WorkspaceTab active={editorMode === "output"} label="Output" onSelect={() => setEditorMode("output")} />}
                {availableViews.includes("terminal") && <WorkspaceTab active={editorMode === "terminal"} label="Terminal" onSelect={() => setEditorMode("terminal")} />}
              </div>
            )}
            <div className={`editor-shell is-${editorMode}`}>
              {editorMode === "code" ? (
                <StoneEditor
                  filePath={selectedFile?.path ?? "workspace.txt"}
                  diagnostics={editorDiagnostics.filter((diagnostic) =>
                    !diagnostic.filePath || normalizeWorkspacePath(diagnostic.filePath) === normalizeWorkspacePath(selectedFile?.path ?? "")
                  )}
                  onChange={onFileChange}
                  readOnly={!selectedFile}
                  value={codeText}
                />
              ) : editorMode === "output" ? (
                <EditorPreview preview={preview} />
              ) : (
                <RunTerminal
                  canRun={canRunInTerminal(editorLanguage?.id)}
                  filePath={selectedFile?.path ?? "workspace"}
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
          <div className="ide-workspace is-code-only is-idle">
            <div className="editor-shell is-code">
              <StoneEditor filePath="stonecode.js" onChange={() => undefined} readOnly value={idleEditorSource} />
            </div>
          </div>
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
  | { available: true; title: string; srcDoc: string; entryPath: string; connectedPaths: string[]; missingPaths: string[]; blockedPaths: string[] }
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
      <div className={`editor-preview-source${preview.missingPaths.length || preview.blockedPaths.length ? " has-warning" : ""}`}>
        <strong>{preview.entryPath}</strong>
        <span>
          {preview.blockedPaths.length
            ? `Blocked unapproved remote asset: ${preview.blockedPaths.join(", ")}`
            : preview.missingPaths.length
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
      blockedPaths: composed.blockedPaths,
      srcDoc: composed.srcDoc
    };
  }

  if (activeLanguage.id === "css") {
    return {
      available: false,
      title: `${selectedFile.path} is not connected`,
      message: `Link this stylesheet from an HTML file, for example <link rel="stylesheet" href="${fileName(selectedFile.path)}">. Output will then render that HTML entrypoint.`
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
    message: "This source file does not render directly in a browser. Use Terminal for supported console output."
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
  const blockedPaths = new Set<string>();
  let html = htmlFile.content;

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
    const href = readHtmlAttribute(tag, "href");
    if (isRemoteReference(href)) {
      blockedPaths.add(href!);
      return `<!-- Blocked unapproved remote stylesheet: ${escapeHtml(href!)} -->`;
    }
    const resolved = resolveWorkspaceReference(htmlFile.path, href);
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
    const src = readHtmlAttribute(tag, "src");
    if (isRemoteReference(src)) {
      if (isApprovedBrowserAssetUrl(src)) return tag;
      blockedPaths.add(src!);
      return `<!-- Blocked unapproved remote script: ${escapeHtml(src!)} -->`;
    }
    const resolved = resolveWorkspaceReference(htmlFile.path, src);
    if (!resolved) return tag;
    const file = fileByPath.get(resolved);
    if (!file) {
      missingPaths.add(resolved);
      return `<!-- Missing script: ${escapeHtml(resolved)} -->`;
    }
    connectedPaths.add(file.path);
    const type = readHtmlAttribute(tag, "type");
    if (type?.toLowerCase() === "text/vue") return buildVueBrowserScript(file.content, readHtmlAttribute(tag, "data-target"));
    if (type?.toLowerCase() === "text/svelte") return buildSvelteBrowserScript(file.content, readHtmlAttribute(tag, "data-target"));
    return `<script${type ? ` type="${escapeHtml(type)}"` : ""} data-path="${escapeHtml(file.path)}">\n${file.content}\n<\/script>`;
  });

  html = html.replace(/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    const remoteImports = collectRemoteModuleImports(tag);
    const unapproved = remoteImports.filter((url) => !isApprovedBrowserAssetUrl(url));
    if (!unapproved.length) return tag;
    unapproved.forEach((url) => blockedPaths.add(url));
    return `<!-- Blocked script with unapproved remote import: ${unapproved.map(escapeHtml).join(", ")} -->`;
  });

  html = injectPreviewSecurityPolicy(html);

  if (missingPaths.size) {
    const notice = `<aside style="position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:10px 12px;border:1px solid #e39a8f;border-radius:8px;background:#2a1110;color:#ffd9d2;font:13px/1.4 system-ui">Missing linked workspace file: ${[...missingPaths].map(escapeHtml).join(", ")}</aside>`;
    html = /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, (body) => `${body}${notice}`) : `${notice}${html}`;
  }

  return {
    srcDoc: html,
    connectedPaths: [...connectedPaths],
    missingPaths: [...missingPaths],
    blockedPaths: [...blockedPaths]
  };
}

function injectPreviewSecurityPolicy(html: string) {
  const approvedScripts = approvedBrowserAssetUrls.join(" ");
  const policy = [
    "default-src 'none'",
    `script-src 'unsafe-inline' blob: ${approvedScripts}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src 'none'",
    "connect-src 'none'",
    "media-src data: blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'"
  ].join("; ");
  const security = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(policy)}"><meta name="referrer" content="no-referrer">`;
  return /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (head) => `${head}${security}`)
    : `${security}${html}`;
}

function buildVueBrowserScript(source: string, requestedTarget: string | null) {
  const framework = browserFrameworkCatalog.find((item) => item.id === "vue")!;
  const runtimeUrl = framework.assets[0].url;
  const style = source.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() ?? "";
  const componentSource = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim() ?? "export default {}";
  const target = normalizeMountTarget(requestedTarget);
  const moduleSource = componentSource.includes("export default") ? componentSource : `${componentSource}\nexport default {};`;
  return `<script src="${runtimeUrl}"></script>${style ? `<style>${style}</style>` : ""}<script type="module">
const moduleUrl = URL.createObjectURL(new Blob([${serializeForInlineScript(moduleSource)}], { type: "text/javascript" }));
try {
  const componentModule = await import(moduleUrl);
  const target = document.querySelector(${serializeForInlineScript(target)}) || document.body;
  Vue.createApp(componentModule.default).mount(target);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
<\/script>`;
}

function buildSvelteBrowserScript(source: string, requestedTarget: string | null) {
  const framework = browserFrameworkCatalog.find((item) => item.id === "svelte")!;
  const compilerUrl = framework.assets.find((item) => item.url.includes("compiler.js"))!.url;
  const runtimeUrl = framework.assets.find((item) => item.url.includes("internal/index.mjs"))!.url;
  const target = normalizeMountTarget(requestedTarget);
  return `<script type="importmap">{"imports":{"svelte/internal":"${runtimeUrl}"}}</script><script src="${compilerUrl}"></script><script type="module">
const compiled = window.svelte.compile(${serializeForInlineScript(source)}, { css: true, dev: false, format: "esm" });
if (compiled.css?.code) {
  const style = document.createElement("style");
  style.textContent = compiled.css.code;
  document.head.append(style);
}
const moduleUrl = URL.createObjectURL(new Blob([compiled.js.code], { type: "text/javascript" }));
try {
  const componentModule = await import(moduleUrl);
  const target = document.querySelector(${serializeForInlineScript(target)}) || document.body;
  new componentModule.default({ target });
} finally {
  URL.revokeObjectURL(moduleUrl);
}
<\/script>`;
}

function normalizeMountTarget(value: string | null) {
  const target = String(value ?? "#app").trim();
  return /^[#.][a-zA-Z][\w-]*$/.test(target) ? target : "#app";
}

function serializeForInlineScript(value: string) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function collectRemoteModuleImports(scriptTag: string) {
  const urls = new Set<string>();
  const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](https:\/\/[^"']+)["']/gi;
  for (const match of scriptTag.matchAll(importPattern)) urls.add(match[1]);
  return [...urls];
}

function isRemoteReference(value: string | null): value is string {
  return Boolean(value && /^(?:https?:)?\/\//i.test(value.trim()));
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
