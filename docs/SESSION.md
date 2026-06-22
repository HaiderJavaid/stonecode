# Stonecode Session

## Date

2026-06-22

## Latest Direction

Stonecode remains a focused paid-beta SaaS for self-taught beginners with a persistent IDE-style learning workspace.

Current focus: production SaaS foundation without enabling live AI API usage yet.

## Branch State

- Current branch: `main`.
- Latest pushed commit before this checkpoint: `ac85eb9 Smooth auth dashboard reveal`.
- Local checkpoint branch exists: `checkpoint/07-supabase-persistence-verifier` at `80f53b7`.
- Existing stash: `stash@{0}: wip auth transition experiments 2026-06-21`.

## Latest Work

- Added live Supabase verifier: `npm run verify:supabase`.
- Added and applied `workspace_folders` migration; live persistence now verifies for courses, files, folders, chat, and progress.
- Added server-side plan helper and `npm run verify:plan-limits`.
- Moved Supabase-backed course creation through authenticated `POST /api/courses`.
- Enforced Free active-course limit server-side.
- Added authenticated `DELETE /api/courses` to archive active courses for Reset demo.
- Fixed Reset demo so archived remote courses do not return after refresh.
- Fixed setup finalize to keep the panel open and show server errors instead of silently closing.
- User manually verified Reset demo and finalize work after the dev server restart.

## Current Risks

- Dashboard still displays a temporary Free plan label until real subscription state is loaded.
- Basic/Pro limits are implemented in server rules but not verified end to end through Stripe subscription state.
- Stripe endpoints exist but still need env vars, auth customer mapping, and webhook persistence.
- `/api/tutor` is not auth-gated or usage-tracked yet.
- AI-backed setup generation remains intentionally untouched to save AI credits.

## Verification

Latest verification:

- `npm run verify:supabase` passed.
- `npm run verify:course-reset` passed.
- `npm run verify:plan-limits` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.
- User confirmed Reset demo/finalize behavior works in browser.

## Next Work

1. Load real subscription tier from `subscriptions` into dashboard state.
2. Verify Basic/Pro course limits end to end with seeded subscription rows.
3. Map Stripe webhook events into `subscriptions`.
4. Auth-gate `/api/tutor` and record `usage_events`, without enabling live AI calls until approved.
5. Continue manual login-to-dashboard animation QA.
