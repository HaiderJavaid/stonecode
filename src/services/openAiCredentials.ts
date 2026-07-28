export type OpenAiCredentialStatus = {
  configured: boolean;
  provider: "openai";
  lastFour: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
};

export const emptyOpenAiCredential: OpenAiCredentialStatus = {
  configured: false,
  provider: "openai",
  lastFour: null,
  verifiedAt: null,
  updatedAt: null
};

export async function loadOpenAiCredential(accessToken: string): Promise<OpenAiCredentialStatus> {
  return requestOpenAiCredential(accessToken, { method: "GET" });
}

export async function saveOpenAiCredential(accessToken: string, apiKey: string): Promise<OpenAiCredentialStatus> {
  return requestOpenAiCredential(accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: apiKey.trim() })
  });
}

export async function removeOpenAiCredential(accessToken: string): Promise<OpenAiCredentialStatus> {
  const response = await fetch("/api/ai-credentials/openai", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to remove OpenAI key.");
  return emptyOpenAiCredential;
}

async function requestOpenAiCredential(
  accessToken: string,
  init: Pick<RequestInit, "method" | "headers" | "body">
): Promise<OpenAiCredentialStatus> {
  const response = await fetch("/api/ai-credentials/openai", {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Failed to load OpenAI connection.");
  return (payload?.credential ?? emptyOpenAiCredential) as OpenAiCredentialStatus;
}
