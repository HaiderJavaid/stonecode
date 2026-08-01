import Stripe from "stripe";
import { grantMonthlyProCredits } from "../credits/credit-store.mjs";
import {
  extractCheckoutSessionState,
  extractStripeSubscriptionState,
  patchCheckoutSessionState,
  upsertSubscriptionState
} from "../stripe-subscriptions.mjs";

export function createStripeClient(env = process.env) {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
}

export function readStripePriceId(plan, env = process.env) {
  return plan === "pro" ? env.STRIPE_PRO_PRICE_ID ?? null : null;
}

export async function readStripeCustomerId(client, userId) {
  const { data, error } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.stripe_customer_id ?? null;
}

export async function readOrCreateStripeCustomer(client, stripe, user) {
  const existingCustomerId = await readStripeCustomerId(client, user.id);
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id }
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

export async function syncStripeEventToSubscription(client, event) {
  const subscriptionState = extractStripeSubscriptionState(event);
  if (subscriptionState) {
    await upsertSubscriptionState(client, subscriptionState);
    await grantProCycle(client, subscriptionState);
    return;
  }
  const checkoutState = extractCheckoutSessionState(event);
  if (checkoutState) await patchCheckoutSessionState(client, checkoutState);
}

export function shouldReconcileStripeSubscription(record) {
  if (record?.plan !== "pro" || record?.status !== "active" || !record?.stripe_subscription_id) return false;
  if (!record.current_period_end) return true;
  const periodEnd = Date.parse(record.current_period_end);
  return !Number.isFinite(periodEnd) || periodEnd <= Date.now();
}

export async function reconcileStripeSubscription(client, userId, record, env = process.env) {
  const stripe = createStripeClient(env);
  if (!stripe) return record;
  const stripeSubscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);
  const state = extractStripeSubscriptionState({
    type: "customer.subscription.updated",
    data: { object: stripeSubscription }
  }, env);
  if (!state || state.userId !== userId) throw new Error("Stripe subscription ownership did not match the authenticated user.");
  await upsertSubscriptionState(client, state);
  await grantProCycle(client, state);
  return {
    ...record,
    plan: state.plan,
    status: state.status,
    current_period_end: state.currentPeriodEnd
  };
}

async function grantProCycle(client, state) {
  if (state.plan !== "pro" || state.status !== "active" || !state.currentPeriodStart || !state.currentPeriodEnd) return;
  await grantMonthlyProCredits(client, {
    userId: state.userId,
    periodStart: state.currentPeriodStart,
    periodEnd: state.currentPeriodEnd
  });
}
