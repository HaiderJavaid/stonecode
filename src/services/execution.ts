import { RunResult } from "@/services/codeRunner";
import { authenticatedJson } from "@/services/authenticatedApi";

type SandboxExecutionResult = {
  ok: boolean;
  status: "passed" | "compile_error" | "runtime_error" | "timeout";
  stdout: string;
  stderr: string;
  durationMs: number;
};

export async function runSandboxedWorkspaceFile(input: {
  language: string;
  filePath: string;
  code: string;
  stdin?: string;
}): Promise<RunResult> {
  const payload = await authenticatedJson<{ result: SandboxExecutionResult }>("/api/execution/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  }, "run code remotely");
  return toRunResult(payload.result as SandboxExecutionResult);
}

function toRunResult(result: SandboxExecutionResult): RunResult {
  const logs: RunResult["logs"] = [];
  if (result.stdout?.trim()) logs.push(...result.stdout.trimEnd().split("\n").map((text) => ({ type: "log" as const, text })));
  if (result.stderr?.trim()) logs.push(...result.stderr.trimEnd().split("\n").map((text) => ({ type: "error" as const, text })));
  if (!logs.length) logs.push({ type: "info", text: result.ok ? "Run completed without output." : "Execution stopped without output." });
  return { ok: result.ok, logs, durationMs: result.durationMs };
}
