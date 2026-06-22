# Stripe Setup

## Stripe Dashboard

1. Create two recurring Prices:
   - Basic monthly
   - Pro monthly
2. Copy the Price IDs:
   - `price_...` for Basic
   - `price_...` for Pro
3. Enable Customer Portal in Stripe:
   - Billing -> Customer portal
   - Allow subscription cancellation and plan changes.

## Environment

Add these values to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_SUCCESS_URL=http://127.0.0.1:5174/settings/billing
STRIPE_CANCEL_URL=http://127.0.0.1:5174/settings/billing
STRIPE_PORTAL_RETURN_URL=http://127.0.0.1:5174/settings/billing
```

Use production URLs instead of localhost after deployment.

## Local Webhook

Install the Stripe CLI, then run:

```bash
stripe login
stripe listen --forward-to http://127.0.0.1:5174/api/stripe/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

## Expected Events

Listen for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Stonecode maps those events into `subscriptions`, which the dashboard reads through `/api/subscription`.
