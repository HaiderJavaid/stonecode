import { createClient } from "@supabase/supabase-js";
import { normalizePlanTier } from "../plan-limits.mjs";

export async function readAuthenticatedUser(request, response, env = process.env) {
  const authToken = readBearerToken(request);
  if (!authToken) {
    sendJson(response, 401, { error: "Authentication is required.", code: "authentication_required" });
    return null;
  }

  const admin = createSupabaseAdminClient(response, env);
  if (!admin) return null;

  let userData;
  let userError;
  try {
    ({ data: userData, error: userError } = await admin.auth.getUser(authToken));
    if (userError && isTransientAuthError(userError)) {
      ({ data: userData, error: userError } = await admin.auth.getUser(authToken));
    }
  } catch {
    try {
      ({ data: userData, error: userError } = await admin.auth.getUser(authToken));
    } catch (retryError) {
      sendJson(response, 503, {
        error: "Authentication service is temporarily unavailable. Please retry.",
        code: "auth_service_unavailable"
      });
      console.error("Supabase authentication lookup failed", retryError instanceof Error ? retryError.message : retryError);
      return null;
    }
  }

  const user = userData?.user;
  if (userError || !user) {
    sendJson(response, 401, {
      error: userError?.message ?? "Invalid authentication token.",
      code: "authentication_invalid"
    });
    return null;
  }
  return { admin, user };
}

export function createSupabaseAdminClient(response, env = process.env) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 503, {
      error: "Supabase service role is not configured on the server.",
      code: "supabase_admin_unavailable"
    });
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function upsertServerProfile(client, user) {
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    updated_at: new Date().toISOString()
  });
  if (error) return error;

  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim().slice(0, 50)
    : "";
  if (displayName.length >= 2) {
    const { error: displayNameError } = await client
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("display_name", null);
    if (displayNameError) return displayNameError;
  }
  return null;
}

export async function readUserPlan(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return "free";
  return normalizePlanTier(data.plan);
}

export function isTransientAuthError(error) {
  const status = Number(error?.status);
  return status >= 500 || /fetch failed|network|timeout|ECONNRESET|temporarily unavailable/i.test(String(error?.message ?? ""));
}

function readBearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function sendJson(response, status, body) {
  const payload = status >= 400 && response.stonecodeRequestId && body && typeof body === "object" && !Array.isArray(body)
    ? { ...body, traceId: response.stonecodeRequestId }
    : body;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}
