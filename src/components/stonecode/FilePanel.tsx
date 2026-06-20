import { useState } from "react";
import { Course } from "@/data/courses";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { readDraggedNode, WorkspaceFileTree } from "@/components/stonecode/WorkspaceFileTree";

export function FilePanel({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  selectedFileIndex,
  selectedFile,
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
  selectedFileIndex: number;
  selectedFile: WorkspaceFile | null;
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
      <div className="file-panel-head">
        <span>Files</span>
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
        <WorkspaceFileTree
          files={activeFiles}
          folders={activeFolders}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onSelectFile={onSelectFile}
          selectedFileIndex={selectedFileIndex}
        />
      </div>
    </aside>
  );
}
