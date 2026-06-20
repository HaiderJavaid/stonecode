import { RunLog } from "@/services/codeRunner";

export function RunTerminal({
  filePath,
  logs,
  isRunning,
  onRun,
  onClear
}: {
  filePath: string;
  logs: RunLog[];
  isRunning: boolean;
  onRun: () => void;
  onClear: () => void;
}) {
  return (
    <div className="run-terminal" aria-label="Code terminal">
      <div className="run-terminal-head">
        <span>{filePath}</span>
        <div>
          <button disabled={isRunning} onClick={onRun} type="button">
            {isRunning ? "Running" : "Run"}
          </button>
          <button onClick={onClear} type="button">Clear</button>
        </div>
      </div>
      <div className="run-terminal-output">
        {logs.map((log, index) => (
          <p className={`is-${log.type}`} key={`${log.type}-${index}-${log.text}`}>
            {log.text}
          </p>
        ))}
      </div>
    </div>
  );
}
