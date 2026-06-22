# Stonecode Session

## Date

2026-06-23

## Latest Direction

Stonecode remains a focused paid-beta SaaS for self-taught beginners with a persistent IDE-style learning workspace.

Current focus: provider-backed tutor streaming is live for dev/test; next product priority is direct AI file editing and terminal tool execution inside the IDE.

## Branch State

- Current branch: `main`.
- Latest local commit before push: see `git HEAD`.
- Local checkpoint branch exists: `checkpoint/07-supabase-persistence-verifier` at `80f53b7`.
- Existing stash: `stash@{0}: wip auth transition experiments 2026-06-21`.

## Latest Work

- Auth-gated `/api/tutor`, added usage event tracking, and exposed usage summary in settings.
- Added streaming tutor transport and fixed client stream reading so successful streams are not locked by JSON parsing.
- Added provider adapter for `LLM_PROVIDER=openai|openrouter`.
- Local dev/test now uses OpenRouter with `OPENROUTER_MODEL=openai/gpt-oss-20b:free` in ignored `.env`.
- Added `npm run verify:usage-summary` and `npm run verify:response-stream`.
- Updated project docs and handoff for current tutor state.

## Current Risks

- Direct AI file edits and terminal tool execution are not implemented yet.
- OpenRouter free models can rate-limit or change availability; switch `OPENROUTER_MODEL` to another `:free` model if needed.
- Existing settings/support/legal/profile routes are still not a coherent app-wide navigation flow.

## Verification

Latest verification:

- `npm run verify:supabase` passed.
- `npm run verify:course-reset` passed.
- `npm run verify:plan-limits` passed.
- `npm run verify:subscription-state` passed.
- `npm run verify:stripe-subscription-sync` passed.
- `npm run verify:usage-summary` passed.
- `npm run verify:response-stream` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- Authenticated `/api/tutor` temp-user smoke returned a streamed OpenRouter response on `http://127.0.0.1:5174`.

## Next Work

1. Add direct AI file editing and terminal tool execution inside the IDE.
2. Design undo/history and command safety limits for AI actions.
3. Continue app-wide navigation and real-session dashboard QA.
