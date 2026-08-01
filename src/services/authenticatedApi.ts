import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type ApiErrorPayload = {
  error?: string;
  code?: string;
  traceId?: string;
  [key: string]: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly payload: ApiErrorPayload | null;

  constructor(message: string, { status = 500, code = "api_request_failed", payload = null }: {
    status?: number;
    code?: string;
    payload?: ApiErrorPayload | null;
  } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

let refreshPromise: Promise<Session | null> | null = null;

export async function authenticatedFetch(path: string, init: RequestInit = {}, action = "complete this request"): Promise<Response> {
  const session = await readUsableSession(action);
  let response = await fetchWithSession(path, init, session);
  if (response.status !== 401) return response;

  const refreshed = await refreshSession(action);
  response = await fetchWithSession(path, init, refreshed);
  if (response.status === 401) {
    throw new ApiRequestError("Your session expired. Please sign in again.", {
      status: 401,
      code: "session_expired"
    });
  }
  return response;
}

export async function authenticatedJson<T>(path: string, init: RequestInit = {}, action = "complete this request"): Promise<T> {
  const response = await authenticatedFetch(path, init, action);
  const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
  if (!response.ok) {
    const baseMessage = payload?.error ?? `Failed to ${action}.`;
    const message = payload?.traceId ? `${baseMessage} Reference: ${payload.traceId}` : baseMessage;
    throw new ApiRequestError(message, {
      status: response.status,
      code: typeof payload?.code === "string" ? payload.code : "api_request_failed",
      payload
    });
  }
  return payload as T;
}

async function readUsableSession(action: string): Promise<Session> {
  if (!supabase) throw new ApiRequestError("Supabase is not configured.", { status: 503, code: "supabase_unavailable" });
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session) return refreshSession(action);
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000;
  if (expiresAtMs && expiresAtMs <= Date.now() + 30_000) return refreshSession(action);
  return session;
}

async function refreshSession(action: string): Promise<Session> {
  if (!supabase) throw new ApiRequestError("Supabase is not configured.", { status: 503, code: "supabase_unavailable" });
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return data.session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  try {
    const session = await refreshPromise;
    if (!session?.access_token) throw new Error(`Authentication is required to ${action}.`);
    return session;
  } catch (error) {
    throw new ApiRequestError(error instanceof Error ? error.message : `Authentication is required to ${action}.`, {
      status: 401,
      code: "session_expired"
    });
  }
}

function fetchWithSession(path: string, init: RequestInit, session: Session) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(path, { ...init, headers });
}
