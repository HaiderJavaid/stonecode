# Stonecode Session

## Date

2026-06-21

## Latest Direction

Stonecode remains a focused paid-beta SaaS for self-taught beginners with a persistent IDE-style learning workspace.

Current UI focus: keep the accepted auth intro/login zoom while optimizing dashboard animation performance without losing the stone-textured feel.

## Branch State

- Current branch: `work/auth-transition-from-06`.
- Base checkpoint: `checkpoint/06-persistent-terminal-reveal`.
- Latest committed base: `9c5e457 Keep auth terminal persistent through reveal`.
- Current working tree has uncommitted auth and dashboard animation optimization edits.
- User explicitly requested no git commit/push during this wrap-up.
- Existing stash: `stash@{0}: wip auth transition experiments 2026-06-21`.

## Checkpoint Branches

- `checkpoint/00-initial-stonecode`
- `checkpoint/01-supabase-persistence`
- `checkpoint/02-auth-transition-docs`
- `checkpoint/03-auth-onboarding-transition`
- `checkpoint/04-smooth-auth-dashboard`
- `checkpoint/05-global-auth-terminal`
- `checkpoint/06-persistent-terminal-reveal`

## Latest Work

- Compared checkpoint 05 and checkpoint 06.
- Created `work/auth-transition-from-06` from checkpoint 06 for safe UI edits.
- Kept auth terminal content aligned with the default dashboard code so the box does not visibly reload.
- Added dashboard logout button for local testing.
- Tuned login panel exit, box zoom, brightness overlay fade, and dashboard panel slide-in timing.
- Right dashboard panel now slides from the right.
- User accepted the intro through login zoom as visually perfect.
- Restored the delayed load-in fade with the original delay using a cheap overlay and opacity-only card fade.
- Added `useTypedText` to throttle typewriter updates with `requestAnimationFrame`.
- Stopped inactive course cards from running lesson typewriter updates.
- Cached assistant markdown rendering during typing updates.
- Reduced dashboard animation paint cost by removing large dashboard blur/filter/blend hotspots and lowering moving active-card shadow cost.
- Right panel reveal was changed to a full offscreen-right CSS slide (`calc(100% + 36px)`) with `120ms` delay and `620ms` duration.
- A later experiment that delayed the panel slide with a two-`requestAnimationFrame` `auth-panel-ready` class was reverted at user request.
- Supabase-backed persistence code exists for courses, workspace files/folders, chat messages, and progress with local fallback.

## Current Risks

- Right panel/add-course area still needs deeper stutter diagnosis; user reports it can read like a fade because frames drop during the reveal window.
- Remaining dashboard component animations still need deeper manual flow review.
- In-app Browser fails with a sandbox metadata error; rendered QA used Playwright CLI fallback.
- Live Supabase database may still need the latest schema migration, especially `workspace_folders`.
- Stripe routes need env vars, auth/customer mapping, and webhook persistence.
- `/api/tutor` is not auth-gated or usage-tracked yet.

## Verification

Latest code verification during wrap-up:

- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Static animation guards passed.
- Playwright CLI screenshots captured desktop and mobile dashboard states through a temporary local auth bypass that was removed.
- Latest wrap-up verification on 2026-06-21 reran `npm run typecheck`, `npm run build`, and `git diff --check`; all passed.

No commit or push.

## Next Work

1. Diagnose/fix right panel reveal stutter after zoom; do not change the accepted intro/login zoom.
2. Continue optimizing remaining dashboard component animations.
3. If current visual state is accepted, commit only when the user asks.
4. Apply/verify Supabase schema migration in the live project.
5. Continue backend SaaS foundation: Stripe persistence, plan enforcement, tutor auth, and usage events.
