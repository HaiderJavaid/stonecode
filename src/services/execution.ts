import { supabase } from "@/lib/supabaseClient";
import { RunResult } from "@/services/codeRunner";

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
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error(error?.message ?? "Authentication is required to run code remotely.");
  const response = await fetch("/api/execution/run", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Remote execution failed.");
  return toRunResult(payload.result as SandboxExecutionResult);
}

function toRunResult(result: SandboxExecutionResult): RunResult {
  const logs: RunResult["logs"] = [];
  if (result.stdout?.trim()) logs.push(...result.stdout.trimEnd().split("\n").map((text) => ({ type: "log" as const, text })));
  if (result.stderr?.trim()) logs.push(...result.stderr.trimEnd().split("\n").map((text) => ({ type: "error" as const, text })));
  if (!logs.length) logs.push({ type: "info", text: result.ok ? "Run completed without output." : "Execution stopped without output." });
  return { ok: result.ok, logs, durationMs: result.durationMs };
}
