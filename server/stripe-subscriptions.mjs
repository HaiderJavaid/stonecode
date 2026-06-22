import { normalizePlanTier } from "./plan-limits.mjs";

const stripeToDatabaseStatuses = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled"
};

export function buildCheckoutMetadata(userId, plan) {
  return {
    user_id: userId,
    plan: normalizePlanTier(plan)
  };
}

export function normalizeStripeStatus(status) {
  return stripeToDatabaseStatuses[status] ?? "free";
}

export function normalizeStripePlan(metadataPlan, priceId, env = process.env) {
  if (priceId && priceId === env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId && priceId === env.STRIPE_PRO_PRICE_ID) return "pro";
  const plan = normalizePlanTier(metadataPlan);
  return plan === "free" ? "free" : plan;
}

export function extractStripeSubscriptionState(event, env = process.env) {
  const subscription = event?.data?.object;
  if (!subscription || !event?.type?.startsWith("customer.subscription.")) return null;

  const status = normalizeStripeStatus(subscription.status);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = status === "canceled" || status === "free" ? "free" : normalizeStripePlan(subscription.metadata?.plan, priceId, env);
  const userId = subscription.metadata?.user_id;
  if (!userId) return null;

  return {
    userId,
    plan,
    status,
    stripeCustomerId: readStripeId(subscription.customer),
    stripeSubscriptionId: readStripeId(subscription.id),
    currentPeriodEnd: secondsToIso(subscription.current_period_end)
  };
}

export function extractCheckoutSessionState(event) {
  if (event?.type !== "checkout.session.completed") return null;
  const session = event.data?.object;
  const userId = session?.metadata?.user_id ?? session?.client_reference_id;
  if (!session || !userId) return null;

  return {
    userId,
    stripeCustomerId: readStripeId(session.customer),
    stripeSubscriptionId: readStripeId(session.subscription)
  };
}

export async function upsertSubscriptionState(client, state) {
  if (!state?.userId) return;

  const { error } = await client.from("subscriptions").upsert({
    user_id: state.userId,
    plan: state.plan ?? "free",
    status: state.status ?? "free",
    stripe_customer_id: state.stripeCustomerId ?? null,
    stripe_subscription_id: state.stripeSubscriptionId ?? null,
    current_period_end: state.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

export async function patchCheckoutSessionState(client, state) {
  if (!state?.userId) return;

  const update = {
    updated_at: new Date().toISOString()
  };
  if (state.stripeCustomerId) update.stripe_customer_id = state.stripeCustomerId;
  if (state.stripeSubscriptionId) update.stripe_subscription_id = state.stripeSubscriptionId;

  const { data: existing, error: readError } = await client
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", state.userId)
    .maybeSingle();

  if (readError) throw readError;

  const operation = existing
    ? client.from("subscriptions").update(update).eq("user_id", state.userId)
    : client.from("subscriptions").insert({
        user_id: state.userId,
        plan: "free",
        status: "free",
        ...update
      });

  const { error } = await operation;
  if (error) throw error;
}

function readStripeId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return null;
}

function secondsToIso(value) {
  if (!Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}
