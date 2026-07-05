import { defaultCourseCodeHtml } from "@/data/courses";
import { FilePanel } from "@/components/stonecode/FilePanel";
import { RunTerminal } from "@/components/stonecode/RunTerminal";
import { StoneEditor } from "@/components/stonecode/StoneEditor";
import { ActiveState } from "@/components/stonecode/types";
import { Course } from "@/data/courses";
import { RunLog } from "@/services/codeRunner";
import { resolveEditorLanguage } from "@/services/editorLanguages";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { useMemo, useState } from "react";

export function CourseWorkspace({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  activeLessonIndex,
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
  const [editorMode, setEditorMode] = useState<"code" | "preview">("code");
  const editorLanguage = selectedFile ? resolveEditorLanguage(selectedFile.path) : null;
  const preview = useMemo(
    () => buildEditorPreview(activeFiles, selectedFile),
    [activeFiles, selectedFile]
  );

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

      <section className="terminal" aria-label="Stone IDE simulator">
        {active && selectedFile ? (
          <div className="ide-workspace">
            <div className={`editor-shell is-${editorMode}`}>
              <button
                className="editor-preview-toggle"
                onClick={() => setEditorMode((current) => current === "code" ? "preview" : "code")}
                type="button"
              >
                {editorMode === "code" ? "Visual" : "Code"}
              </button>
              {editorMode === "code" ? (
                <StoneEditor
                  filePath={selectedFile.path}
                  onChange={onFileChange}
                  value={codeText}
                />
              ) : (
                <EditorPreview preview={preview} />
              )}
            </div>
            <RunTerminal
              canRun={editorLanguage?.canRunInBrowser ?? false}
              filePath={selectedFile.path}
              isRunning={isRunningCode}
              logs={terminalLogs}
              onClear={onClearTerminal}
              onRun={onRun}
              runNote={editorLanguage?.runNote}
            />
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

type EditorPreviewState =
  | { available: true; title: string; srcDoc: string }
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
    <iframe
      className="editor-preview-frame"
      sandbox="allow-scripts"
      srcDoc={preview.srcDoc}
      title={preview.title}
    />
  );
}

export function buildEditorPreview(files: WorkspaceFile[], selectedFile: WorkspaceFile | null): EditorPreviewState {
  if (!selectedFile) {
    return { available: false, title: "No file selected", message: "Open a file to preview it." };
  }

  const activeLanguage = resolveEditorLanguage(selectedFile.path);
  const htmlFile = activeLanguage.id === "html"
    ? selectedFile
    : files.find((file) => resolveEditorLanguage(file.path).id === "html");
  const cssFiles = files.filter((file) => resolveEditorLanguage(file.path).id === "css");
  const jsFiles = files.filter((file) => resolveEditorLanguage(file.path).id === "javascript");

  if (htmlFile) {
    return {
      available: true,
      title: `${htmlFile.path} preview`,
      srcDoc: composeHtmlPreview(htmlFile.content, cssFiles, jsFiles)
    };
  }

  if (activeLanguage.id === "css") {
    return {
      available: true,
      title: `${selectedFile.path} preview`,
      srcDoc: `<!doctype html><html><head><style>${selectedFile.content}</style></head><body><main class="practice-card"><h1>CSS preview</h1><p>Edit the current stylesheet and watch this sample surface change.</p><button>Sample button</button></main></body></html>`
    };
  }

  if (activeLanguage.id === "javascript") {
    return {
      available: true,
      title: `${selectedFile.path} preview`,
      srcDoc: `<!doctype html><html><body><main id="app"></main><script>${selectedFile.content}<\/script></body></html>`
    };
  }

  return {
    available: false,
    title: `${activeLanguage.displayName} preview`,
    message: activeLanguage.runNote ?? "Visual preview is available for HTML, CSS, and browser JavaScript files. This language is fully editable here, but needs the future backend sandbox to run."
  };
}

function composeHtmlPreview(html: string, cssFiles: WorkspaceFile[], jsFiles: WorkspaceFile[]) {
  const styles = cssFiles.map((file) => `<style data-path="${escapeHtml(file.path)}">\n${file.content}\n</style>`).join("\n");
  const scripts = jsFiles.map((file) => `<script data-path="${escapeHtml(file.path)}">\n${file.content}\n<\/script>`).join("\n");
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${styles}\n</head>`);
  else html = `${styles}\n${html}`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${scripts}\n</body>`);
  return `${html}\n${scripts}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
