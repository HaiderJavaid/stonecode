export type RunLog = {
  type: "log" | "error" | "info";
  text: string;
};

export type RunResult = {
  ok: boolean;
  logs: RunLog[];
  durationMs: number;
};

const RUN_TIMEOUT_MS = 1800;

function normalizeRunnableCode(code: string) {
  return code
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+/gm, "");
}

function createWorkerSource(code: string) {
  return `
    const format = (value) => {
      if (typeof value === "string") return value;
      try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    };

    const send = (type, values) => {
      self.postMessage({ type, text: values.map(format).join(" ") });
    };

    self.fetch = undefined;
    self.XMLHttpRequest = undefined;
    self.WebSocket = undefined;
    self.EventSource = undefined;
    self.importScripts = undefined;

    console.log = (...values) => send("log", values);
    console.info = (...values) => send("info", values);
    console.warn = (...values) => send("info", values);
    console.error = (...values) => send("error", values);

    try {
      const run = new Function('"use strict";\\n' + ${JSON.stringify(normalizeRunnableCode(code))});
      const result = run();
      if (result && typeof result.then === "function") {
        result
          .then((value) => {
            if (value !== undefined) send("log", [value]);
            self.postMessage({ type: "done" });
          })
          .catch((error) => {
            send("error", [error && error.stack ? error.stack : error]);
            self.postMessage({ type: "done" });
          });
      } else {
        if (result !== undefined) send("log", [result]);
        self.postMessage({ type: "done" });
      }
    } catch (error) {
      send("error", [error && error.stack ? error.stack : error]);
      self.postMessage({ type: "done" });
    }
  `;
}

export function runWorkspaceCode(code: string, timeoutMs = RUN_TIMEOUT_MS): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const logs: RunLog[] = [];
    const workerUrl = URL.createObjectURL(new Blob([createWorkerSource(code)], { type: "text/javascript" }));
    const worker = new Worker(workerUrl);
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      const durationMs = Math.round(performance.now() - start);
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        ok,
        logs: logs.length ? logs : [{ type: "info", text: "Run completed without output." }],
        durationMs
      });
    };

    const timer = window.setTimeout(() => {
      logs.push({ type: "error", text: `Execution stopped after ${timeoutMs}ms.` });
      finish(false);
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<RunLog | { type: "done" }>) => {
      if (event.data.type === "done") {
        finish(!logs.some((log) => log.type === "error"));
        return;
      }

      logs.push(event.data);
    };

    worker.onerror = (event) => {
      logs.push({ type: "error", text: event.message });
      finish(false);
    };
  });
}
