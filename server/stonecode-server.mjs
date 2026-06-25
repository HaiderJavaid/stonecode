import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canCreateActiveCourse, normalizePlanTier, resolvePlanLimit } from "./plan-limits.mjs";
import { formatSubscriptionState } from "./subscription-state.mjs";
import { createSseEventParser } from "./response-stream.mjs";
import {
  extractTutorStreamDelta,
  isTutorStreamDone,
  isTutorStreamFailed,
  requestTutorStream,
  resolveTutorProviderConfig
} from "./llm-providers.mjs";
import {
  buildCheckoutMetadata,
  extractCheckoutSessionState,
  extractStripeSubscriptionState,
  patchCheckoutSessionState,
  upsertSubscriptionState
} from "./stripe-subscriptions.mjs";
import { formatUsageSummary } from "./usage-events.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isDev = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const port = Number(readCliOption("--port") ?? process.env.PORT ?? 5174);
const host = readCliOption("--host") ?? process.env.HOST ?? "127.0.0.1";
const maxRequestBytes = 180_000;

loadLocalEnv();

const tutorInstructions = `You are Stonecode, an AI programming tutor inside a persistent IDE workspace.
Reply in concise Markdown. Be practical and course-aware.
Use the provided workspace context as source of truth.
Support theory explanations, chat-answer exercises, multiple-choice exercises, terminal coding exercises, and visual explanations.
When a learner asks for clarification about the current topic, answer directly and invite one focused follow-up.
When the answer belongs to a clearly upcoming course topic, say that it will be covered there, give only the minimum bridge needed now, and keep the learner on the current step.
Use fenced \`\`\`diagram or \`\`\`css blocks when a visual canvas or styled example will explain the concept better than prose.
When showing code, use fenced code blocks.
You may edit workspace files directly when the user asks for a file change.
To edit a file, include one fenced block per file using exactly this format:
\`\`\`STONECODE_FILE_EDIT
{"path":"README.md","content":"full replacement file content"}
\`\`\`
The JSON must be raw valid JSON. Do not escape the whole JSON object, do not prefix it with \\n, and do not wrap it in a normal markdown code fence.
Only use paths from the workspace or sensible new relative paths. The app applies these blocks after your reply streams.
The user cannot type into the terminal. You can trigger the IDE terminal's safe runner yourself. When the user asks you to run, test, execute, or check the current file, include exactly:
\`\`\`STONECODE_RUN_ACTIVE_FILE
\`\`\`
This runs the active file in an isolated browser worker. Do not tell the user to type node index.js. Do not say you cannot execute the active file. Only decline arbitrary shell commands such as npm, git, rm, curl, installs, filesystem shell access, or network commands because this terminal is not a shell.
Mention which files you changed in normal Markdown, but do not show the full file content outside the edit block unless teaching requires it.
Prefer small, teachable next steps over full rewrites.`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

let vite;
if (isDev) {
  const { createServer } = await import("vite");
  vite = await createServer({
    appType: "spa",
    root,
    server: { middlewareMode: true }
  });
}

const server = createHttpServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/tutor")) {
      await handleTutorRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/courses")) {
      await handleCourseRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/subscription")) {
      await handleSubscriptionRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/usage")) {
      await handleUsageRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/billing/checkout")) {
      await handleCheckoutRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/billing/portal")) {
      await handleBillingPortalRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/stripe/webhook")) {
      await handleStripeWebhook(request, response);
      return;
    }

    if (vite) {
      vite.middlewares(request, response);
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
});

server.listen(port, host, () => {
  console.log(`Stonecode server ready at http://${host}:${port}`);
});

async function handleTutorRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const body = await readJsonBody(request);
  const context = body?.context;
  if (!isTutorContext(context)) {
    sendJson(response, 400, { error: "Invalid tutor context." });
    return;
  }

  const providerConfig = resolveTutorProviderConfig(process.env);
  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  if (providerConfig.error) {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "blocked"
    });
    sendJson(response, 503, { error: providerConfig.error });
    return;
  }

  const upstreamResponse = await requestTutorStream({
    config: providerConfig,
    context,
    instructions: tutorInstructions
  });

  if (!upstreamResponse.ok) {
    const upstreamJson = await upstreamResponse.json().catch(() => null);
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "failed"
    });
    sendJson(response, upstreamResponse.status, {
      error: upstreamJson?.error?.message ?? `${providerConfig.provider} request failed.`
    });
    return;
  }

  if (!upstreamResponse.body) {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: "failed"
    });
    sendJson(response, 502, { error: `${providerConfig.provider} response stream was empty.` });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let streamStatus = "failed";
  let hasReplyText = false;
  const parser = createSseEventParser((event) => {
    const delta = extractTutorStreamDelta(providerConfig.provider, event);
    if (delta) {
      hasReplyText = true;
      response.write(encoder.encode(delta));
      return;
    }

    if (isTutorStreamDone(providerConfig.provider, event)) {
      streamStatus = hasReplyText ? "success" : "failed";
      return;
    }

    if (isTutorStreamFailed(providerConfig.provider, event)) {
      streamStatus = "failed";
    }
  });

  try {
    for await (const chunk of upstreamResponse.body) {
      const decodedChunk = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      parser.push(decodedChunk);
    }

    const tail = decoder.decode();
    if (tail) parser.push(tail);
    if (hasReplyText) streamStatus = "success";
  } catch {
    streamStatus = "failed";
  } finally {
    await recordUsageEvent(admin, {
      userId: user.id,
      courseId: context.courseId,
      model: providerConfig.model,
      status: streamStatus
    });
    response.end();
  }
}
async function handleCourseRequest(request, response) {
  if (request.method === "POST") {
    await handleCreateCourseRequest(request, response);
    return;
  }

  if (request.method === "DELETE") {
    await handleResetCoursesRequest(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function handleSubscriptionRequest(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const { data, error } = await admin
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { subscription: formatSubscriptionState(data) });
}

async function handleUsageRequest(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const { data, error } = await admin
    .from("usage_events")
    .select("status,created_at")
    .eq("user_id", user.id)
    .eq("event_type", "tutor_message")
    .order("created_at", { ascending: false });

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { usage: formatUsageSummary(data ?? []) });
}

async function handleCreateCourseRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const body = await readJsonBody(request);
  const draft = body?.course;
  if (!isCourseDraft(draft)) {
    sendJson(response, 400, { error: "Invalid course draft." });
    return;
  }

  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  const plan = await readUserPlan(admin, user.id);
  const { count, error: countError } = await admin
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (countError) {
    sendJson(response, 500, { error: countError.message });
    return;
  }

  const activeCourseCount = count ?? 0;
  const limit = resolvePlanLimit(plan);
  if (!canCreateActiveCourse(plan, activeCourseCount)) {
    sendJson(response, 403, {
      error: `Active course limit reached for ${plan} plan.`,
      plan,
      activeCourseCount,
      activeCourseLimit: limit.activeCourseLimit
    });
    return;
  }

  const { data, error } = await admin
    .from("courses")
    .insert({
      user_id: user.id,
      title: draft.title,
      subject: draft.subject,
      mode: draft.mode,
      checkpoint: draft.checkpoint,
      description: draft.description,
      progress: draft.progress
    })
    .select("*")
    .single();

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, {
    course: data,
    plan,
    activeCourseCount: activeCourseCount + 1,
    activeCourseLimit: limit.activeCourseLimit
  });
}

async function handleResetCoursesRequest(request, response) {
  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const { data, error } = await admin
    .from("courses")
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id");

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  sendJson(response, 200, { archivedCount: data?.length ?? 0 });
}

async function readAuthenticatedUser(request, response) {
  const authToken = readBearerToken(request);
  if (!authToken) {
    sendJson(response, 401, { error: "Authentication is required." });
    return null;
  }

  const admin = await createSupabaseAdminClient(response);
  if (!admin) return null;

  const { data: userData, error: userError } = await admin.auth.getUser(authToken);
  const user = userData?.user;
  if (userError || !user) {
    sendJson(response, 401, { error: userError?.message ?? "Invalid authentication token." });
    return null;
  }

  return { admin, user };
}

async function handleCheckoutRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const plan = normalizePlanTier(body?.plan ?? "basic");
  const priceId = readStripePriceId(plan);
  const successUrl = body?.successUrl ?? process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = body?.cancelUrl ?? process.env.STRIPE_CANCEL_URL;

  if (!priceId || !successUrl || !cancelUrl) {
    sendJson(response, 400, { error: "Stripe price and redirect URLs are required." });
    return;
  }

  const profileError = await upsertServerProfile(admin, user);
  if (profileError) {
    sendJson(response, 500, { error: profileError.message });
    return;
  }

  const customerId = await readOrCreateStripeCustomer(admin, stripe, user);
  const metadata = buildCheckoutMetadata(user.id, plan);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    metadata,
    subscription_data: {
      metadata
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true
  });

  sendJson(response, 200, { url: session.url });
}

async function handleBillingPortalRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const auth = await readAuthenticatedUser(request, response);
  if (!auth) return;
  const { admin, user } = auth;

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const returnUrl = body?.returnUrl ?? process.env.STRIPE_PORTAL_RETURN_URL;
  const customerId = await readStripeCustomerId(admin, user.id);

  if (!customerId || !returnUrl) {
    sendJson(response, 400, { error: "Stripe customer and return URL are required. Start checkout before opening billing portal." });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });

  sendJson(response, 200, { url: session.url });
}

async function handleStripeWebhook(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    sendJson(response, 503, { error: "STRIPE_WEBHOOK_SECRET is not configured." });
    return;
  }

  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    sendJson(response, 400, { error: "Missing Stripe signature." });
    return;
  }

  const rawBody = await readRawBody(request);
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    const admin = await createSupabaseAdminClient(response);
    if (!admin) return;
    await syncStripeEventToSubscription(admin, event);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid Stripe webhook."
    });
    return;
  }

  sendJson(response, 200, { received: true });
}

async function createStripeClient(response) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    sendJson(response, 503, { error: "STRIPE_SECRET_KEY is not configured." });
    return null;
  }

  const { default: Stripe } = await import("stripe");
  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover"
  });
}

function readStripePriceId(plan) {
  if (plan === "pro") return process.env.STRIPE_PRO_PRICE_ID;
  return process.env.STRIPE_BASIC_PRICE_ID;
}

async function readStripeCustomerId(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.stripe_customer_id ?? null;
}

async function readOrCreateStripeCustomer(client, stripe, user) {
  const existingCustomerId = await readStripeCustomerId(client, user.id);
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: {
      user_id: user.id
    }
  });

  const { error } = await client.from("subscriptions").upsert({
    user_id: user.id,
    plan: "free",
    status: "free",
    stripe_customer_id: customer.id,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;

  return customer.id;
}

async function syncStripeEventToSubscription(client, event) {
  const subscriptionState = extractStripeSubscriptionState(event);
  if (subscriptionState) {
    await upsertSubscriptionState(client, subscriptionState);
    return;
  }

  const checkoutState = extractCheckoutSessionState(event);
  if (checkoutState) {
    await patchCheckoutSessionState(client, checkoutState);
  }
}

async function createSupabaseAdminClient(response) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 503, { error: "Supabase service role is not configured on the server." });
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function upsertServerProfile(client, user) {
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    updated_at: new Date().toISOString()
  });
  return error;
}

async function readUserPlan(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return "free";
  if (data.status !== "active" && data.status !== "trialing") return "free";
  return normalizePlanTier(data.plan);
}

async function recordUsageEvent(admin, { userId, courseId, model, status }) {
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    course_id: typeof courseId === "string" && courseId ? courseId : null,
    event_type: "tutor_message",
    model: typeof model === "string" ? model : null,
    input_tokens: null,
    output_tokens: null,
    status
  });

  if (error) {
    console.error("Failed to record usage event", error.message);
  }
}

function isTutorContext(context) {
  return Boolean(
    context &&
      (typeof context.courseId === "string" || context.courseId === null) &&
      typeof context.courseTitle === "string" &&
      typeof context.courseSubject === "string" &&
      typeof context.checkpoint === "string" &&
      Array.isArray(context.fileTree) &&
      typeof context.userMessage === "string"
  );
}

function isCourseDraft(draft) {
  return Boolean(
    draft &&
      typeof draft.title === "string" &&
      draft.title.trim() &&
      typeof draft.subject === "string" &&
      draft.subject.trim() &&
      (draft.mode === "fundamentals" || draft.mode === "project" || draft.mode === "leetcode" || draft.mode === "mixed") &&
      typeof draft.checkpoint === "string" &&
      draft.checkpoint.trim() &&
      typeof draft.description === "string" &&
      Number.isInteger(draft.progress) &&
      draft.progress >= 0 &&
      draft.progress <= 100
  );
}

function readBearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxRequestBytes) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : null);
      } catch {
        rejectBody(new Error("Invalid JSON body."));
      }
    });

    request.on("error", rejectBody);
  });
}

function readRawBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let length = 0;

    request.on("data", (chunk) => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > maxRequestBytes) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      resolveBody(Buffer.concat(chunks));
    });

    request.on("error", rejectBody);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function serveStatic(request, response) {
  const distRoot = join(root, "dist");
  const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(distRoot, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distRoot, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key]) return;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}

function readCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
