import { useState } from "react";
import { runWorkspaceCode, type RunLog } from "@/services/codeRunner";
import { WorkspaceFile } from "@/services/workspaceFiles";

export function useTerminalRunner(selectedFile: WorkspaceFile | null) {
  const [terminalLogs, setTerminalLogs] = useState<RunLog[]>([
    { type: "info", text: "Terminal ready. Run executes the active file in an isolated browser worker." }
  ]);
  const [isRunningCode, setIsRunningCode] = useState(false);

  async function runActiveFile() {
    if (!selectedFile || isRunningCode) return;
    setIsRunningCode(true);
    setTerminalLogs([{ type: "info", text: `Running ${selectedFile.path}...` }]);
    const result = await runWorkspaceCode(selectedFile.content);
    setTerminalLogs([
      { type: result.ok ? "info" : "error", text: `${result.ok ? "Finished" : "Stopped"} in ${result.durationMs}ms.` },
      ...result.logs
    ]);
    setIsRunningCode(false);
  }

  function clearTerminal() {
    setTerminalLogs([{ type: "info", text: "Terminal cleared." }]);
  }

  return {
    terminalLogs,
    isRunningCode,
    runActiveFile,
    clearTerminal
  };
}
