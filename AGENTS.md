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

Production SaaS foundation is active.

Supabase Auth is connected. Active course/file/chat/progress data still uses localStorage. Next priority is moving the finalized empty-course/setup flow into Supabase persistence, then adding server-side plan limits and AI usage tracking.

## Verification

Before marking a stage done:

- Run `npm run build`.
- Run `npm run typecheck`.
- Run the local app.
- Verify the main flow: login -> empty dashboard -> add learning course -> finalize -> Start project -> folders/README appear -> learning chat opens -> file tree drag/drop works.
