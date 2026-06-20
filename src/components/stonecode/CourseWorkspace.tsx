import { defaultCourseCodeHtml } from "@/data/courses";
import { FilePanel } from "@/components/stonecode/FilePanel";
import { RunTerminal } from "@/components/stonecode/RunTerminal";
import { StoneEditor } from "@/components/stonecode/StoneEditor";
import { ActiveState } from "@/components/stonecode/types";
import { Course } from "@/data/courses";
import { RunLog } from "@/services/codeRunner";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";

export function CourseWorkspace({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  selectedFile,
  terminalLogs,
  isRunningCode,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onSelectFile,
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
  selectedFile: WorkspaceFile | null;
  terminalLogs: RunLog[];
  isRunningCode: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: () => void;
  onDeleteFile: () => void;
  onSelectFile: (index: number) => void;
  onMoveFile: (fileIndex: number, folderPath: string) => void;
  onMoveFolder: (folderPath: string, targetFolderPath: string) => void;
  onFileChange: (nextValue: string) => void;
  onRun: () => void;
  onClearTerminal: () => void;
}) {
  const codeText = selectedFile?.content ?? "";

  return (
    <>
      <FilePanel
        active={Boolean(active)}
        activeCourse={activeCourse}
        activeFiles={activeFiles}
        activeFolders={activeFolders}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onMoveFile={onMoveFile}
        onMoveFolder={onMoveFolder}
        onRenameFile={onRenameFile}
        onSelectFile={onSelectFile}
        selectedFile={selectedFile}
        selectedFileIndex={active?.fileIndex ?? -1}
      />

      <section className="terminal" aria-label="Stone IDE simulator">
        {active && selectedFile ? (
          <div className="ide-workspace">
            <div className="editor-shell">
              <StoneEditor
                filePath={selectedFile.path}
                onChange={onFileChange}
                value={codeText}
              />
            </div>
            <RunTerminal
              filePath={selectedFile.path}
              isRunning={isRunningCode}
              logs={terminalLogs}
              onClear={onClearTerminal}
              onRun={onRun}
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
