import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { launchTechnologyIds, learningDomainCatalog } from "../shared/stonecode-product.mjs";

loadLocalEnv();
const baseUrl = argumentValue("--base-url") ?? "http://127.0.0.1:5174";
const target = new URL(baseUrl);
if (!isLoopback(target.hostname) && !process.argv.includes("--allow-remote")) {
  throw new Error("Remote authenticated smoke checks require --allow-remote.");
}
for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`${key} is required.`);
}

const suffix = randomUUID();
const email = `stonecode.auth-smoke.${suffix}@example.test`;
const password = `Stonecode-${randomUUID()}-9a!`;
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const browserClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
let userId = null;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Auth Smoke" }
  });
  if (createError) throw createError;
  userId = created.user?.id ?? null;
  assert.ok(userId);

  const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const token = signedIn.session?.access_token;
  assert.ok(token);

  const [credits, subscription, runtime, discovery, accountExport] = await Promise.all([
    apiJson("/api/credits", token),
    apiJson("/api/subscription", token),
    apiJson("/api/runtime/capabilities", token),
    apiJson("/api/learning/discovery-turn", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], turn: 0 })
    }),
    apiJson("/api/account/export", token)
  ]);

  assert.equal(credits.credits.available, 10);
  assert.equal(subscription.subscription.plan, "free");
  const available = runtime.capabilities.technologies.filter((technology) => technology.available).map((technology) => technology.id).sort();
  assert.deepEqual(available, [...launchTechnologyIds].sort());
  const availableDomains = runtime.capabilities.domains.filter((domain) => domain.available).map((domain) => domain.id).sort();
  assert.deepEqual(availableDomains, learningDomainCatalog.map((domain) => domain.id).sort());
  assert.equal(discovery.discovery.status, "clarifying");
  assert.match(discovery.discovery.reply, /welcome to Stonecode/i);
  assert.ok(discovery.discovery.suggestions.includes("Build a project"));
  assert.equal(accountExport.schemaVersion, "stonecode-account-export/v1");
  assert.equal(accountExport.account.id, userId);

  const deletion = await apiJson("/api/account", token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" })
  });
  assert.equal(deletion.deleted, true);
  const { data: deletedUser } = await admin.auth.admin.getUserById(userId);
  assert.equal(deletedUser.user, null);
  userId = null;

  console.log(JSON.stringify({
    passed: true,
    authenticatedEndpoints: 6,
    registrationCredits: credits.credits.available,
    plan: subscription.subscription.plan,
    availableTechnologies: available,
    availableDomains,
    discoveryStatus: discovery.discovery.status
  }, null, 2));
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => null);
}

async function apiJson(path, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(new URL(path, target), { ...init, headers, signal: AbortSignal.timeout(30_000) });
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
