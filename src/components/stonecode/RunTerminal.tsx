import { RunLog } from "@/services/codeRunner";

export function RunTerminal({
  canRun = true,
  filePath,
  logs,
  isRunning,
  onRun,
  onClear,
  runNote
}: {
  canRun?: boolean;
  filePath: string;
  logs: RunLog[];
  isRunning: boolean;
  onRun: () => void;
  onClear: () => void;
  runNote?: string;
}) {
  return (
    <div className="run-terminal" aria-label="Code terminal">
      <div className="run-terminal-head">
        <div className="run-terminal-identity">
          <span aria-hidden="true" className={`run-terminal-status${isRunning ? " is-running" : ""}`} />
          <strong>Terminal</strong>
          <span className="run-terminal-path" title={filePath}>{filePath}</span>
        </div>
        <div className="run-terminal-actions">
          <button aria-label={`Run ${filePath}`} className="run-terminal-run" disabled={isRunning || !canRun} onClick={onRun} type="button">
            {isRunning ? "Running" : "Run"}
          </button>
          <button aria-label="Clear terminal output" onClick={onClear} type="button">Clear</button>
        </div>
      </div>
      <div aria-live="polite" className="run-terminal-output" role="log">
        {canRun && logs.length === 0 && (
          <div className="run-terminal-empty">
            <span aria-hidden="true">›</span>
            <p>Ready to run <strong>{filePath}</strong></p>
          </div>
        )}
        {!canRun && runNote && (
          <p className="is-info">
            <span aria-hidden="true" className="run-terminal-line-mark">•</span>
            <span>{runNote}</span>
          </p>
        )}
        {logs.map((log, index) => (
          <p className={`is-${log.type}`} key={`${log.type}-${index}-${log.text}`}>
            <span aria-hidden="true" className="run-terminal-line-mark">{log.type === "error" ? "!" : log.type === "info" ? "•" : "›"}</span>
            <span>{log.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
