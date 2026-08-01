import { authenticatedJson } from "@/services/authenticatedApi";

export async function createBillingSession({
  plan
}: {
  plan: "pro";
}) {
  const payload = await authenticatedJson<{ url: string }>("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plan })
  }, "open Stripe checkout");
  if (!payload?.url) throw new Error("Failed to open Stripe checkout.");
  return payload.url as string;
}

export async function createBillingPortalSession() {
  const payload = await authenticatedJson<{ url: string }>("/api/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  }, "open the billing portal");
  if (!payload?.url) throw new Error("Failed to open the billing portal.");
  return payload.url;
}
