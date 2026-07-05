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
        <span>{filePath}</span>
        <div>
          <button disabled={isRunning || !canRun} onClick={onRun} type="button">
            {isRunning ? "Running" : "Run"}
          </button>
          <button onClick={onClear} type="button">Clear</button>
        </div>
      </div>
      <div className="run-terminal-output">
        {!canRun && runNote && <p className="is-info">{runNote}</p>}
        {logs.map((log, index) => (
          <p className={`is-${log.type}`} key={`${log.type}-${index}-${log.text}`}>
            {log.text}
          </p>
        ))}
      </div>
    </div>
  );
}
