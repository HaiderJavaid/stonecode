import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCheckoutMetadata,
  extractStripeSubscriptionState,
  normalizeStripePlan,
  normalizeStripeStatus
} from "../server/stripe-subscriptions.mjs";
import {
  createStripeClient,
  readStripePriceId,
  shouldReconcileStripeSubscription
} from "../server/billing/stripe-service.mjs";

const env = {
  STRIPE_BASIC_PRICE_ID: "price_basic",
  STRIPE_PRO_PRICE_ID: "price_pro"
};

assert.deepEqual(buildCheckoutMetadata("user_123", "basic"), {
  user_id: "user_123",
  plan: "basic"
});

assert.equal(normalizeStripePlan("basic", "price_basic", env), "basic");
assert.equal(normalizeStripePlan("basic", "price_pro", env), "pro");
assert.equal(normalizeStripePlan("nonsense", "price_missing", env), "free");

assert.equal(normalizeStripeStatus("trialing"), "trialing");
assert.equal(normalizeStripeStatus("active"), "active");
assert.equal(normalizeStripeStatus("past_due"), "past_due");
assert.equal(normalizeStripeStatus("canceled"), "canceled");
assert.equal(normalizeStripeStatus("unpaid"), "free");
assert.equal(createStripeClient({}), null);
assert.equal(readStripePriceId("pro", env), "price_pro");
assert.equal(readStripePriceId("free", env), null);
assert.equal(shouldReconcileStripeSubscription({ plan: "pro", status: "active", stripe_subscription_id: "sub_123", current_period_end: null }), true);
assert.equal(shouldReconcileStripeSubscription({ plan: "free", status: "free", stripe_subscription_id: null, current_period_end: null }), false);

const subscriptionState = extractStripeSubscriptionState(
  {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        metadata: { user_id: "user_123", plan: "basic" },
        current_period_start: 1782086400,
        current_period_end: 1784678400,
        items: {
          data: [{ price: { id: "price_basic" } }]
        }
      }
    }
  },
  env
);

assert.deepEqual(subscriptionState, {
  userId: "user_123",
  plan: "basic",
  status: "active",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
  currentPeriodStart: "2026-06-22T00:00:00.000Z",
  currentPeriodEnd: "2026-07-22T00:00:00.000Z"
});

const deletedState = extractStripeSubscriptionState(
  {
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_123",
        customer: "cus_123",
        status: "canceled",
        metadata: { user_id: "user_123", plan: "pro" },
        items: {
          data: [{ price: { id: "price_pro" } }]
        }
      }
    }
  },
  env
);

assert.equal(deletedState.plan, "free");
assert.equal(deletedState.status, "canceled");

const itemPeriodState = extractStripeSubscriptionState(
  {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_item_period",
        customer: "cus_item_period",
        status: "active",
        metadata: { user_id: "user_123", plan: "pro" },
        items: {
          data: [{
            current_period_start: 1782086400,
            current_period_end: 1784678400,
            price: { id: "price_pro" }
          }]
        }
      }
    }
  },
  env
);
assert.equal(itemPeriodState.currentPeriodStart, "2026-06-22T00:00:00.000Z");
assert.equal(itemPeriodState.currentPeriodEnd, "2026-07-22T00:00:00.000Z");
assert.equal(itemPeriodState.plan, "pro");

const serverSource = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
assert.match(serverSource, /const successUrl = process\.env\.STRIPE_SUCCESS_URL/);
assert.match(serverSource, /const cancelUrl = process\.env\.STRIPE_CANCEL_URL/);
assert.match(serverSource, /const returnUrl = process\.env\.STRIPE_PORTAL_RETURN_URL/);
assert.doesNotMatch(serverSource, /body\?\.successUrl|body\?\.cancelUrl|body\?\.returnUrl/);

console.log("stripe subscription sync checks passed");
