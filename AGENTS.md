# Stonecode Agent Instructions

## Read Order

Future chats, agents, and developers must read these first:

1. `docs/HANDOFF.yaml`
2. `docs/README.md`
3. `docs/PROJECT.md`
4. `docs/TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/project-architecture.md`
7. `docs/superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`
8. `docs/superpowers/plans/2026-06-18-stonecode-mvp.md`

## Product

Stonecode is a paid-beta AI programming tutor for self-taught beginners with a persistent IDE-style learning workspace.

The current target UX:

- Dashboard starts empty for new users.
- Add learning course opens a full-height setup chat.
- Setup asks subject/outcome, asks whether the user is ready for assessment, then runs adaptive assessment exercises one by one.
- Course generation waits until assessment completes, then creates a personalized freeCodeCamp-style course.
- Target course hierarchy is Course -> Modules -> Topics -> Blocks -> Steps.
- First generated structure appears in the left panel's course tab; files/folders remain in a separate left-panel tab.
- Start project initializes one reusable whiteboard file, not folders or `README.md`.
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

Current branch: `setting-page-redesign`.

Next product priority: apply pending Supabase migrations and run authenticated v2 course-generation QA: subject -> assessment -> review -> generated module tree -> theory/quiz/workshop/lab progression.

## Verification

Before marking a stage done:

- Run `npm run build`.
- Run `npm run typecheck`.
- Run relevant verifier scripts such as `npm run verify:tutor-flow`, `npm run verify:response-stream`, and `npm run verify:usage-summary` after tutor changes.
- Run the local app.
- Verify the target main flow: login -> empty dashboard -> add learning course -> subject -> ready-for-assessment prompt -> assessment exercises with Skip -> assessment review -> course auto-generates -> course tab modules render -> file tab still works -> theory step opens -> MCQ gates Next -> editor lab uses active whiteboard file.
