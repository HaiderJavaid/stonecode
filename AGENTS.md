# Stonecode Agent Instructions

## Read Order

Future chats, agents, and developers must read these first:

1. `docs/HANDOFF.yaml`
2. `docs/README.md`
3. `docs/PROJECT.md`
4. `docs/TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/project-architecture.md`
7. `docs/superpowers/plans/2026-06-18-stonecode-mvp.md`

## Product

Stonecode is a paid-beta AI programming tutor for self-taught beginners with a persistent IDE-style learning workspace.

The core UX:

- Dashboard starts empty for new users.
- Add learning course opens a full-height setup chat.
- Finalize creates a course shell.
- Start project initializes folders plus `README.md`.
- Course workspace opens with left file tree, center IDE, right AI tutor chat.
- Course state continues without starting a new chat.

## Working Rules

- Build in stages.
- Preserve the stone-textured prototype direction unless the product lead approves a change.
- Keep the center IDE, left file tree, and right tutor/course panel as the core layout.
- Prefer focused components over one large app file.
- Update docs when product state changes.
- Verify rendered UI after frontend changes.
- Ask permission before using agents. Include name, role, task, model, and estimated cost/tokens.
- Do not commit or push unless explicitly asked.

## Current Stage

Production SaaS foundation is active, with verified Supabase persistence, server-side Free plan course limits, Stripe subscription sync, and authenticated tutor streaming.

Supabase Auth is connected. Supabase-backed course/file/folder/chat/progress persistence is verified against the live project, including `workspace_folders`.

Current branch: `main`.

Next product priority: persist XP/streak/badge progression and define structured, model-generated tutor exercise blocks and grading.

## Verification

Before marking a stage done:

- Run `npm run build`.
- Run `npm run typecheck`.
- Run relevant verifier scripts such as `npm run verify:tutor-flow`, `npm run verify:response-stream`, and `npm run verify:usage-summary` after tutor changes.
- Run the local app.
- Verify the main flow: login -> empty dashboard -> add learning course -> finalize -> Start project -> folders/README appear -> learning chat opens -> file tree drag/drop works.
