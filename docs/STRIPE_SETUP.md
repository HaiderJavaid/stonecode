# Stripe Setup

## Stripe Dashboard

1. Create one recurring Pro Price at $9/month.
2. Copy its `price_...` ID.
3. Enable Customer Portal in Stripe:
   - Billing -> Customer portal
   - Allow subscription cancellation and plan changes.

## Current Sandbox

StoneCode sandbox (`acct_1Tl2p1CHp9RwgM8E`) is configured for Deploy Preview QA:

- Pro test price: `price_1TyTE2CHp9RwgM8EpwYe7zEH`
- Webhook endpoint: `we_1TyTGaCHp9RwgM8Ek123iwt1`
- Webhook URL: `https://stonecoded.netlify.app/api/stripe/webhook`
- Default Customer Portal config: `bpc_1Tl4AFCHp9RwgM8ESX9qkvMN`
- Netlify contexts updated: `deploy-preview`, `branch-deploy`

Do not use sandbox Stripe credentials in Netlify Production. Production still needs a live Stonecode Stripe account, live `sk_live_...`, live `price_...`, and live `whsec_...`.

## Environment

Add these values to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_SUCCESS_URL=http://127.0.0.1:5174/settings/billing
STRIPE_CANCEL_URL=http://127.0.0.1:5174/settings/billing
STRIPE_PORTAL_RETURN_URL=http://127.0.0.1:5174/settings/billing
```

Checkout and portal redirects are read only from server environment variables. The browser cannot override them. Keep localhost URLs for local development and configure production HTTPS URLs in the live environment.

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

Stonecode maps those events into `subscriptions`, which the dashboard reads through `/api/subscription`. An active Pro billing cycle also grants its 100 expiring credits idempotently. Legacy Basic records remain readable but cannot be purchased.
