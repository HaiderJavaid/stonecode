import assert from "node:assert/strict";
import {
  buildCheckoutMetadata,
  extractStripeSubscriptionState,
  normalizeStripePlan,
  normalizeStripeStatus
} from "../server/stripe-subscriptions.mjs";

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

const subscriptionState = extractStripeSubscriptionState(
  {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_123",
        customer: "cus_123",
        status: "active",
        metadata: { user_id: "user_123", plan: "basic" },
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

console.log("stripe subscription sync checks passed");
