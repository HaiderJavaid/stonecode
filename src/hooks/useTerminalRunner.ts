import { useState } from "react";
import { runWorkspaceCode, type RunLog } from "@/services/codeRunner";
import { resolveEditorLanguage } from "@/services/editorLanguages";
import { WorkspaceFile } from "@/services/workspaceFiles";
import { runSandboxedWorkspaceFile } from "@/services/execution";

export function useTerminalRunner(selectedFile: WorkspaceFile | null) {
  const [terminalLogs, setTerminalLogs] = useState<RunLog[]>([
    { type: "info", text: "Terminal ready. Run uses the browser worker or the configured remote sandbox." }
  ]);
  const [isRunningCode, setIsRunningCode] = useState(false);

  async function runActiveFile() {
    if (!selectedFile || isRunningCode) return;
    const language = resolveEditorLanguage(selectedFile.path);
    if (!language.canRunInBrowser) {
      setIsRunningCode(true);
      setTerminalLogs([{ type: "info", text: `Remote sandbox: running ${selectedFile.path}...` }]);
      try {
        const result = await runSandboxedWorkspaceFile({ language: language.displayName, filePath: selectedFile.path, code: selectedFile.content });
        setTerminalLogs([
          { type: result.ok ? "info" : "error", text: `${result.ok ? "Finished" : "Stopped"} in ${result.durationMs}ms.` },
          ...result.logs
        ]);
      } catch (error) {
        setTerminalLogs([{ type: "error", text: error instanceof Error ? error.message : "Remote execution failed." }]);
      } finally {
        setIsRunningCode(false);
      }
      return;
    }
    setIsRunningCode(true);
    setTerminalLogs([{ type: "info", text: `Running ${selectedFile.path}...` }]);
    const result = await runWorkspaceCode(selectedFile.content);
    setTerminalLogs([
      { type: result.ok ? "info" : "error", text: `${result.ok ? "Finished" : "Stopped"} in ${result.durationMs}ms.` },
      ...result.logs
    ]);
    setIsRunningCode(false);
  }

  async function runFile(file: WorkspaceFile | null, label = "AI run") {
    if (!file || isRunningCode) return;
    const language = resolveEditorLanguage(file.path);
    if (!language.canRunInBrowser) {
      setIsRunningCode(true);
      setTerminalLogs([{ type: "info", text: `${label}: remote sandbox running ${file.path}...` }]);
      try {
        const result = await runSandboxedWorkspaceFile({ language: language.displayName, filePath: file.path, code: file.content });
        setTerminalLogs([
          { type: result.ok ? "info" : "error", text: `${result.ok ? "Finished" : "Stopped"} in ${result.durationMs}ms.` },
          ...result.logs
        ]);
      } catch (error) {
        setTerminalLogs([{ type: "error", text: error instanceof Error ? error.message : "Remote execution failed." }]);
      } finally {
        setIsRunningCode(false);
      }
      return;
    }
    setIsRunningCode(true);
    setTerminalLogs([{ type: "info", text: `${label}: running ${file.path}...` }]);
    const result = await runWorkspaceCode(file.content);
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
    runFile,
    clearTerminal
  };
}
