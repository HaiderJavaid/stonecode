import { useState } from "react";
import { Course } from "@/data/courses";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { readDraggedNode, WorkspaceFileTree } from "@/components/stonecode/WorkspaceFileTree";

export function FilePanel({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  planName,
  selectedFileIndex,
  selectedFile,
  userEmail,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onSelectFile,
  onMoveFile,
  onMoveFolder
}: {
  active: boolean;
  activeCourse: Course | null;
  activeFiles: WorkspaceFile[];
  activeFolders: WorkspaceFolder[];
  planName: string;
  selectedFileIndex: number;
  selectedFile: WorkspaceFile | null;
  userEmail: string;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: () => void;
  onDeleteFile: () => void;
  onSelectFile: (index: number) => void;
  onMoveFile: (fileIndex: number, folderPath: string) => void;
  onMoveFolder: (folderPath: string, targetFolderPath: string) => void;
}) {
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);

  return (
    <aside className={`file-panel${active ? " is-visible" : ""}`} aria-label="Stonecode files" aria-hidden={!active}>
      <div className="file-panel-brand">
        <div className="file-panel-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="3" />
            <path d="M10 8.6 7.7 12 10 15.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            <path d="M14 8.6 16.3 12 14 15.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </div>
        <strong>stonecode</strong>
      </div>
      <div className="file-panel-head">
        <span>Project</span>
        <strong>{activeCourse?.subject ?? "Courses"}</strong>
      </div>
      {activeCourse && (
        <div className="file-actions" aria-label="File actions">
          <button onClick={onCreateFile} type="button">New</button>
          <button onClick={onCreateFolder} type="button">Folder</button>
          <button disabled={!selectedFile} onClick={onRenameFile} type="button">Rename</button>
          <button disabled={!selectedFile || activeFiles.length <= 1} onClick={onDeleteFile} type="button">Delete</button>
        </div>
      )}
      <div
        className={`file-tree${isRootDropTarget ? " is-root-drop-target" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsRootDropTarget(true);
        }}
        onDragLeave={() => setIsRootDropTarget(false)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsRootDropTarget(false);
          const dragged = readDraggedNode(event);
          if (!dragged) return;
          if (dragged.type === "file") onMoveFile(dragged.index, "");
          if (dragged.type === "folder") onMoveFolder(dragged.path, "");
        }}
      >
        <div className="tree-root-label">/</div>
        <WorkspaceFileTree
          files={activeFiles}
          folders={activeFolders}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onSelectFile={onSelectFile}
          selectedFileIndex={selectedFileIndex}
        />
      </div>

      <div className="file-panel-footer">
        <div className="file-panel-status">
          <span>Git status</span>
          <strong>main</strong>
          <small>Workspace synced</small>
        </div>
        <div className="file-panel-user">
          <div className="file-panel-user-avatar" aria-hidden="true">{userEmail[0]?.toUpperCase() ?? "S"}</div>
          <div>
            <strong>{userEmail}</strong>
            <span>{planName}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
