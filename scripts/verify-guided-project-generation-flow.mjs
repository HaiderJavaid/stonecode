import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { normalizeGeneratedLearningContent } from "../server/learning-orchestrator/generation.mjs";

loadLocalEnv();
const baseUrl = argumentValue("--base-url") ?? "http://127.0.0.1:5174";
const target = new URL(baseUrl);
if (!isLoopback(target.hostname) && !process.argv.includes("--allow-remote")) throw new Error("Remote guided-project checks require --allow-remote.");
for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`${key} is required.`);
}

const suffix = randomUUID();
const email = `stonecode.guided-project.${suffix}@example.test`;
const password = `Stonecode-${randomUUID()}-9a!`;
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const browserClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = null;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Guided Project QA" }
  });
  if (createError) throw createError;
  userId = created.user?.id ?? null;
  assert.ok(userId);
  const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const token = signedIn.session?.access_token;
  assert.ok(token);

  const brief = {
    type: "guided_project",
    goal: "Build a browser Pomodoro timer with start, pause, reset, and status feedback",
    subject: "JavaScript browser timers",
    language: "JavaScript",
    platform: "web",
    desiredOutcome: "A working browser Pomodoro timer with visible controls and status",
    priorKnowledge: "I know basic variables and functions but have not built a timer",
    supportMode: "teaching_heavy"
  };
  const proposalResult = await apiJson("/api/learning/proposals", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief, idempotencyKey: `guided-project-proposal:${suffix}` })
  });
  assert.equal(proposalResult.proposal.type, "project");
  assert.ok(proposalResult.proposal.creditQuote.credits <= 10);
  const finalized = await apiJson(`/api/learning/proposals/${proposalResult.proposal.id}/finalize`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `guided-project-finalize:${suffix}` })
  });
  const job = await waitForJob(finalized.job.id, token);
  assert.equal(job.status, "succeeded", `${job.error_code ?? "generation_failed"}: ${job.error_message ?? "unknown error"}`);
  assert.ok(job.result_course_id);

  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id,experience_type,course_content")
    .eq("id", job.result_course_id)
    .eq("user_id", userId)
    .single();
  if (courseError) throw courseError;
  assert.equal(course.experience_type, "guided_project");
  const content = normalizeGeneratedLearningContent(course.course_content, { brief });
  const blocks = content.module.blocks;
  const features = blocks.slice(1, -1);
  assert.ok(blocks.length >= 4 && blocks.length <= 8);
  assert.equal(blocks[0].kind, "theory");
  assert.equal(blocks.at(-1).kind, "theory");
  assert.ok(features.length >= 2 && features.length <= 6);
  assert.ok(features.every((block) => block.kind === "workshop"));
  assert.ok(features.every((block) => block.steps.filter((step) => step.type === "workshop").length >= 4));
  const codingSteps = features.flatMap((block) => block.steps.filter((step) => step.type === "workshop"));
  assert.ok(codingSteps.length >= 8 && codingSteps.length <= 30);
  for (let index = 1; index < codingSteps.length; index += 1) {
    assert.equal(codingSteps[index].starterCode, codingSteps[index - 1].resultCode);
  }
  console.log(JSON.stringify({
    passed: true,
    jobId: job.id,
    courseId: course.id,
    featureBlocks: features.length,
    codingSteps: codingSteps.length
  }, null, 2));
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => null);
}

async function waitForJob(jobId, token) {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const result = await apiJson(`/api/generation-jobs/${jobId}`, token);
    if (["succeeded", "failed"].includes(result.job.status)) return result.job;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Guided Project generation did not finish within five minutes.");
}

async function apiJson(path, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(new URL(path, target), { ...init, headers, signal: AbortSignal.timeout(90_000) });
  const payload = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${path} failed with HTTP ${response.status}: ${payload?.error ?? "unknown error"}`);
  return payload;
}

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function argumentValue(name) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(hostname).toLowerCase());
}
