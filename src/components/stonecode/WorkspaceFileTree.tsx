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
            <span className="tree-icon is-folder" aria-hidden="true">
              <FolderIcon />
            </span>
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
            <span className={`tree-icon ${getFileIconClass(node.label)}`} aria-hidden="true">
              <FileGlyph fileName={node.label} />
            </span>
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
  if (extension === "py" || extension === "pyw") return "is-python";
  if (extension === "java" || extension === "kt" || extension === "kts") return "is-jvm";
  if (extension === "c" || extension === "h" || extension === "cpp" || extension === "cc" || extension === "cxx" || extension === "hpp") return "is-cpp";
  if (extension === "cs") return "is-csharp";
  if (extension === "go") return "is-go";
  if (extension === "rs") return "is-rust";
  if (extension === "php") return "is-php";
  if (extension === "rb") return "is-ruby";
  if (extension === "swift") return "is-swift";
  if (extension === "sql") return "is-sql";
  if (extension === "sh" || extension === "bash" || extension === "zsh") return "is-shell";
  if (extension === "yml" || extension === "yaml") return "is-yaml";
  if (extension === "xml") return "is-xml";
  if (extension === "vue") return "is-vue";
  if (extension === "svelte") return "is-svelte";
  if (extension === "txt" || extension === "log") return "is-text";
  if (lower.startsWith(".env")) return "is-env";
  return "is-file";
}

function FileGlyph({ fileName }: { fileName: string }) {
  const lower = fileName.toLowerCase();
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (lower === "readme.md") return <span className="tree-badge">MD</span>;
  if (lower === "vite.config.ts") return <span className="tree-badge">V</span>;
  if (extension === "ts" || extension === "tsx") return <span className="tree-badge">TS</span>;
  if (extension === "js" || extension === "jsx") return <span className="tree-badge">JS</span>;
  if (extension === "json") return <span className="tree-badge">{"{}"}</span>;
  if (extension === "css") return <span className="tree-badge">#</span>;
  if (extension === "html") return <span className="tree-badge">{"<>"}</span>;
  if (extension === "md") return <span className="tree-badge">MD</span>;
  if (extension === "py" || extension === "pyw") return <span className="tree-badge">PY</span>;
  if (extension === "java") return <span className="tree-badge">J</span>;
  if (extension === "kt" || extension === "kts") return <span className="tree-badge">KT</span>;
  if (["c", "h", "cpp", "cc", "cxx", "hpp"].includes(extension ?? "")) return <span className="tree-badge">C+</span>;
  if (extension === "cs") return <span className="tree-badge">C#</span>;
  if (extension === "go") return <span className="tree-badge">GO</span>;
  if (extension === "rs") return <span className="tree-badge">RS</span>;
  if (extension === "php") return <span className="tree-badge">PHP</span>;
  if (extension === "rb") return <span className="tree-badge">RB</span>;
  if (extension === "swift") return <span className="tree-badge">SW</span>;
  if (extension === "sql") return <span className="tree-badge">SQL</span>;
  if (extension === "sh" || extension === "bash" || extension === "zsh") return <span className="tree-badge">$_</span>;
  if (extension === "yml" || extension === "yaml") return <span className="tree-badge">YML</span>;
  if (extension === "xml") return <span className="tree-badge">XML</span>;
  if (extension === "vue") return <span className="tree-badge">V</span>;
  if (extension === "svelte") return <span className="tree-badge">S</span>;
  if (extension === "txt" || extension === "log") return <span className="tree-badge">TXT</span>;
  if (lower.startsWith(".env")) return <span className="tree-badge">ENV</span>;
  return <FileIcon />;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M2.5 5.5h5l1.4 1.8H17a1.5 1.5 0 0 1 1.5 1.5v5.7A1.5 1.5 0 0 1 17 16H3a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 3 5.5Z" fill="currentColor" opacity="0.22" />
      <path d="M2.5 5.5h5l1.4 1.8H17a1.5 1.5 0 0 1 1.5 1.5v5.7A1.5 1.5 0 0 1 17 16H3a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 3 5.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M5 2.5h6l4 4V17a1 1 0 0 1-1 1H5A1.5 1.5 0 0 1 3.5 16.5V4A1.5 1.5 0 0 1 5 2.5Z" fill="currentColor" opacity="0.16" />
      <path d="M11 2.5v4h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M5 2.5h6l4 4V17a1 1 0 0 1-1 1H5A1.5 1.5 0 0 1 3.5 16.5V4A1.5 1.5 0 0 1 5 2.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}
