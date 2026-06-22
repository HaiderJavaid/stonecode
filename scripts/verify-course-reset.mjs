import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();

const supabaseUrl = requiredEnv("VITE_SUPABASE_URL");
const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const port = Number(process.env.STONECODE_VERIFY_PORT ?? 5187);
const origin = `http://127.0.0.1:${port}`;
const email = `stonecode.reset.${Date.now()}@gmail.com`;
const password = `Reset-test-${Date.now()}!`;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let serverProcess;
let userId;

try {
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createUserError) throw createUserError;
  userId = createdUser.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    updated_at: new Date().toISOString()
  });
  if (profileError) throw profileError;

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const token = authData.session?.access_token;
  assert.ok(token, "expected auth token");

  const { error: insertError } = await admin.from("courses").insert([
    createCourseRow(userId, "Reset Test One"),
    createCourseRow(userId, "Reset Test Two")
  ]);
  if (insertError) throw insertError;

  const beforeCount = await readActiveCourseCount(userId);
  assert.equal(beforeCount, 2);

  serverProcess = spawn(process.execPath, ["server/stonecode-server.mjs", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore"
  });

  await waitForServer(origin);

  const resetResponse = await fetch(`${origin}/api/courses`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const resetText = await resetResponse.text();
  assert.equal(resetResponse.status, 200, resetText);
  const resetPayload = JSON.parse(resetText);
  assert.equal(resetPayload.archivedCount, 2);

  const afterCount = await readActiveCourseCount(userId);
  assert.equal(afterCount, 0);

  console.log("course reset endpoint checks passed");
} finally {
  if (serverProcess) serverProcess.kill();
  if (userId) {
    await admin.from("courses").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => null);
  }
}

function createCourseRow(ownerId, title) {
  return {
    user_id: ownerId,
    title,
    subject: "Verification",
    mode: "mixed",
    checkpoint: "reset-check",
    description: "Temporary reset verifier course.",
    progress: 0
  };
}

async function readActiveCourseCount(ownerId) {
  const { count, error } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .eq("status", "active");

  if (error) throw error;
  return count ?? 0;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function loadLocalEnv() {
  const envPath = new URL("../.env", import.meta.url);
  try {
    const envText = Buffer.from(readFileSync(envPath)).toString("utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}
