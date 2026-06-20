import { useState } from "react";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";

type WorkspaceTreeNode =
  | {
      type: "folder";
      path: string;
      depth: number;
      label: string;
    }
  | {
      type: "file";
      path: string;
      depth: number;
      label: string;
      index: number;
    };

export function WorkspaceFileTree({
  files,
  folders,
  selectedFileIndex,
  onSelectFile,
  onMoveFile,
  onMoveFolder
}: {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  selectedFileIndex: number;
  onSelectFile: (index: number) => void;
  onMoveFile: (fileIndex: number, folderPath: string) => void;
  onMoveFolder: (folderPath: string, targetFolderPath: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const folderPaths = new Set<string>();

  folders.forEach((folder) => folderPaths.add(folder.path));
  files.forEach((file) => {
    const parts = file.path.split("/");
    parts.slice(0, -1).forEach((_, index) => {
      folderPaths.add(parts.slice(0, index + 1).join("/"));
    });
  });

  const nodes: WorkspaceTreeNode[] = [
    ...Array.from(folderPaths).map((path) => ({
      type: "folder" as const,
      path,
      depth: path.split("/").length - 1,
      label: path.split("/").at(-1) ?? path
    })),
    ...files.map((file, index) => ({
      type: "file" as const,
      path: file.path,
      depth: file.path.split("/").length - 1,
      label: file.path.split("/").at(-1) ?? file.path,
      index
    }))
  ].sort((first, second) => {
    const firstPath = first.path;
    const secondPath = second.path;
    if (firstPath === secondPath) return first.type === "folder" ? -1 : 1;
    const firstParts = firstPath.split("/");
    const secondParts = secondPath.split("/");
    const maxLength = Math.max(firstParts.length, secondParts.length);

    for (let index = 0; index < maxLength; index += 1) {
      const firstPart = firstParts[index];
      const secondPart = secondParts[index];
      if (firstPart === undefined) return first.type === "folder" ? -1 : 1;
      if (secondPart === undefined) return second.type === "folder" ? 1 : -1;
      if (firstPart !== secondPart) return firstPart.localeCompare(secondPart);
    }

    return first.type === "folder" ? -1 : 1;
  });

  return (
    <>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <div
            className={`folder-row${dropTarget === node.path ? " is-drop-target" : ""}`}
            draggable
            key={`folder-${node.path}`}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(node.path);
            }}
            onDragLeave={(event) => {
              event.stopPropagation();
              setDropTarget(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(node.path);
            }}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-stonecode-tree", JSON.stringify({ type: "folder", path: node.path }));
              event.dataTransfer.setData("text/plain", node.path);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(null);
              const dragged = readDraggedNode(event);
              if (!dragged) return;
              if (dragged.type === "file") onMoveFile(dragged.index, node.path);
              if (dragged.type === "folder") onMoveFolder(dragged.path, node.path);
            }}
            style={{ "--tree-depth": node.depth } as React.CSSProperties}
          >
            <span className="tree-icon is-folder" aria-hidden="true">dir</span>
            {node.label}
          </div>
        ) : (
          <button
            className={`file-button${node.index === selectedFileIndex ? " is-selected" : ""}`}
            draggable
            key={`file-${node.path}`}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-stonecode-tree", JSON.stringify({ type: "file", index: node.index }));
              event.dataTransfer.setData("text/plain", node.path);
            }}
            onDragEnd={() => setDropTarget(null)}
            onClick={() => onSelectFile(node.index)}
            style={{ "--tree-depth": node.depth } as React.CSSProperties}
            type="button"
          >
            <span className={`tree-icon ${getFileIconClass(node.label)}`} aria-hidden="true">{getFileIcon(node.label)}</span>
            {node.label}
          </button>
        )
      )}
    </>
  );
}

type DraggedTreeNode =
  | { type: "file"; index: number }
  | { type: "folder"; path: string };

export function readDraggedNode(event: React.DragEvent): DraggedTreeNode | null {
  try {
    const raw = event.dataTransfer.getData("application/x-stonecode-tree");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraggedTreeNode;
    if (parsed.type === "file" && typeof parsed.index === "number") return parsed;
    if (parsed.type === "folder" && typeof parsed.path === "string") return parsed;
  } catch {
    return null;
  }
  return null;
}

function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower === "readme.md") return "i";
  if (lower === "vite.config.ts") return "bolt";
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "md") return "down";
  if (extension === "ts" || extension === "tsx") return "ts";
  if (extension === "js" || extension === "jsx") return "js";
  if (extension === "json") return "{}";
  if (extension === "css") return "#";
  if (extension === "html") return "<>";
  return "file";
}

function getFileIconClass(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower === "readme.md") return "is-readme";
  if (lower === "vite.config.ts") return "is-vite";
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "md") return "is-md";
  if (extension === "ts" || extension === "tsx") return "is-ts";
  if (extension === "js" || extension === "jsx") return "is-js";
  if (extension === "json") return "is-json";
  if (extension === "css") return "is-css";
  if (extension === "html") return "is-html";
  return "is-file";
}
