export async function createBillingSession({
  accessToken,
  cancelUrl,
  plan,
  returnUrl,
  successUrl
}: {
  accessToken: string;
  cancelUrl: string;
  plan: "basic" | "pro";
  returnUrl: string;
  successUrl: string;
}) {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plan, successUrl, cancelUrl, returnUrl })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) throw new Error(payload?.error ?? "Failed to open Stripe checkout.");
  return payload.url as string;
}
