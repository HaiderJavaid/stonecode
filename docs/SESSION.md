# Stonecode Session

## Date

2026-06-22

## Latest Direction

Stonecode remains a focused paid-beta SaaS for self-taught beginners with a persistent IDE-style learning workspace.

Current focus: production SaaS foundation and billing validation without enabling live AI API usage yet.

## Branch State

- Current branch: `main`.
- Latest pushed commit before this checkpoint: `ac85eb9 Smooth auth dashboard reveal`.
- Local checkpoint branch exists: `checkpoint/07-supabase-persistence-verifier` at `80f53b7`.
- Existing stash: `stash@{0}: wip auth transition experiments 2026-06-21`.

## Latest Work

- Added authenticated `GET /api/subscription` and dashboard/settings subscription-state UI.
- Added `npm run verify:subscription-state`.
- Added authenticated Stripe checkout customer reuse/creation with user and plan metadata.
- Added authenticated billing portal lookup from saved `stripe_customer_id`.
- Added Stripe webhook sync mapping for checkout/session and subscription lifecycle events into `subscriptions`.
- Added Billing settings buttons for Basic checkout, Pro checkout, and Billing portal.
- Added `npm run verify:stripe-subscription-sync`.
- Added `docs/STRIPE_SETUP.md`.
- Stripe CLI was installed and authenticated to the StoneCode sandbox.
- Stripe listener was run against `http://127.0.0.1:5174/api/stripe/webhook`.
- Local `.env` was updated with the real Stripe CLI webhook secret; `.env` remains uncommitted.
- Live Stripe smoke checks passed: checkout endpoint returns a Stripe Checkout URL, portal endpoint returns a Stripe Billing URL, and CLI-triggered webhook events return 200.

## Current Risks

- Full browser checkout with test card still needs user/manual verification.
- `/api/tutor` is not auth-gated or usage-tracked yet.
- AI-backed setup generation remains intentionally untouched to save AI credits.

## Verification

Latest verification:

- `npm run verify:supabase` passed.
- `npm run verify:course-reset` passed.
- `npm run verify:plan-limits` passed.
- `npm run verify:subscription-state` passed.
- `npm run verify:stripe-subscription-sync` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- Unauthenticated checkout/portal requests return 401.
- Authenticated checkout/portal live Stripe endpoint smoke checks passed.
- Stripe CLI webhook trigger forwards to the app and returns 200.

## Next Work

1. User should complete Basic checkout in browser with Stripe test card `4242 4242 4242 4242`.
2. Verify dashboard/settings switch to Basic after checkout webhook.
3. Auth-gate `/api/tutor` and record `usage_events`, without enabling live AI calls until approved.
4. Continue manual login-to-dashboard animation QA.
