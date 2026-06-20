import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isDev = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const port = Number(readCliOption("--port") ?? process.env.PORT ?? 5174);
const host = readCliOption("--host") ?? process.env.HOST ?? "127.0.0.1";
const maxRequestBytes = 180_000;

loadLocalEnv();

const tutorInstructions = `You are Stonecode, an AI programming tutor inside a persistent IDE workspace.
Reply in concise Markdown. Be practical and course-aware.
Use the provided workspace context as source of truth.
When showing code, use fenced code blocks.
Do not claim you edited files unless an explicit tool result says so.
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

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured on the server." });
    return;
  }

  const body = await readJsonBody(request);
  const context = body?.context;
  if (!isTutorContext(context)) {
    sendJson(response, 400, { error: "Invalid tutor context." });
    return;
  }

  const upstreamResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions: tutorInstructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(context)
            }
          ]
        }
      ],
      max_output_tokens: 700
    })
  });

  const upstreamJson = await upstreamResponse.json().catch(() => null);
  if (!upstreamResponse.ok) {
    sendJson(response, upstreamResponse.status, {
      error: upstreamJson?.error?.message ?? "OpenAI request failed."
    });
    return;
  }

  const reply = extractOutputText(upstreamJson);
  if (!reply) {
    sendJson(response, 502, { error: "OpenAI response did not include text output." });
    return;
  }

  sendJson(response, 200, { reply });
}

async function handleCheckoutRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const priceId = body?.priceId ?? process.env.STRIPE_BASIC_PRICE_ID;
  const successUrl = body?.successUrl ?? process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = body?.cancelUrl ?? process.env.STRIPE_CANCEL_URL;

  if (!priceId || !successUrl || !cancelUrl) {
    sendJson(response, 400, { error: "Stripe price and redirect URLs are required." });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
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

  const stripe = await createStripeClient(response);
  if (!stripe) return;

  const body = await readJsonBody(request);
  const customerId = body?.customerId;
  const returnUrl = body?.returnUrl ?? process.env.STRIPE_PORTAL_RETURN_URL;

  if (!customerId || !returnUrl) {
    sendJson(response, 400, { error: "Stripe customer and return URL are required." });
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
    stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
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
  return new Stripe(stripeSecretKey);
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload?.output)) return "";

  return payload.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function isTutorContext(context) {
  return Boolean(
    context &&
      typeof context.courseTitle === "string" &&
      typeof context.courseSubject === "string" &&
      typeof context.checkpoint === "string" &&
      Array.isArray(context.fileTree) &&
      typeof context.userMessage === "string"
  );
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
