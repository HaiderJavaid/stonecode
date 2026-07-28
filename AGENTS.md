# Stonecode Agent Instructions

## Read Order

Future chats, agents, and developers must read these first:

1. `docs/HANDOFF.yaml`
2. `docs/README.md`
3. `docs/PROJECT.md`
4. `docs/TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/project-architecture.md`
7. `docs/AI_COURSE_GENERATION_RULES.md`
8. `docs/superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`
9. `docs/superpowers/plans/2026-06-18-stonecode-mvp.md`

## Product

Stonecode is a paid-beta AI programming tutor for self-taught beginners with a persistent IDE-style learning workspace.

The current target UX:

- Dashboard starts empty for new users.
- Add learning course opens a full-height setup chat.
- Setup begins with AI-generated conversational discovery. Every question includes contextual suggested answers while free typing remains available. Course/project discovery captures prior knowledge, then offers an optional prerequisite assessment of at most three questions near the end.
- Skipping assessment proceeds to editable review using the declared background. Confirmed experiences generate as course, short course, pure exercise, or guided project; guided project is one workshop module with intro theory, 10–20 build steps, and recap theory.
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

Next product priority: authenticated QA for all four experience types, optional assessment skip/take paths, guided-project v2 rendering, and full course theory/quiz/workshop/lab progression.

## Verification

Before marking a stage done:

- Run `npm run build`.
- Run `npm run typecheck`.
- Run relevant verifier scripts such as `npm run verify:tutor-flow`, `npm run verify:response-stream`, and `npm run verify:usage-summary` after tutor changes.
- Run `npm run verify:execution-sandbox` after execution or generated-code grading changes.
- Run the local app.
- Verify the target main flow: login -> empty dashboard -> add learning -> AI discovery with suggestions/free typing -> resolved target and prior knowledge -> optional assessment offer -> skip or up to three questions -> editable review -> generate -> correct type navigation/files/chat -> refresh persistence.
