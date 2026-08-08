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
- Setup begins with AI-generated conversational discovery. Every question includes contextual suggested answers while free typing remains available. It gathers goal, relevant experience, depth, and preferences without knowledge tests.
- Editable review shows a concrete Course, Guided Project, or Exercise Pack proposal plus deterministic credit quote before asynchronous generation. Legacy `short_course` remains readable as compatibility data.
- Target course hierarchy is Course -> Modules -> Topics -> Blocks -> Steps.
- First generated structure appears in the left panel's course tab; files/folders remain in a separate left-panel tab.
- Center surfaces are dynamic Code, Output, and Terminal; there is no Whiteboard tab. Optional teaching visuals appear in tutor chat.
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

The production revamp and computing-domain expansion are implemented locally behind feature flags. The expansion adds a server-authoritative 21-technology launch catalog, four computing domains, guarded corpus approval, domain-isolated RAG, conceptual course support, focus-area multi-select discovery, and expanded certification scripts. Live starter execution passes all 18 Judge0-backed launch technologies.

Both 2026-07-29 migrations, the 2026-08-01 learning-domain migration, and the 2026-08-02 progressive-generation migration are applied, and Judge0 is active. All 22 language corpora are hash/chunk/license reviewed and score 1.00 relevance with zero leakage. The 21 runtime-backed technology manifests are approved/enabled; Julia is `approved_pending_runtime` and remains hidden. Four domain manifests/corpora remain pending review. The GPT-5.6 Luna cache-write accounting migration, live Stripe configuration, and deployment remain pending.

Current branch: `codex/reactbits-side-rays-bg`.

Next product priority: finish four domain corpora, apply the Luna cache-write migration through an authenticated Supabase path, and configure Netlify Production secrets, live Stripe, alerting, and sign-offs. Java's Dev.java reference-use terms require legal clearance or a replacement source before deployment. Then deploy under the approval granted on 2026-08-02 and run post-deploy billing, Marketplace, metadata, security, load, and rollback QA.

## Verification

Before marking a stage done:

- Run `npm run build`.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run relevant verifier scripts such as `npm run verify:tutor-flow`, `npm run verify:response-stream`, and `npm run verify:usage-summary` after tutor changes.
- Run `npm run verify:execution-sandbox` after execution or generated-code grading changes.
- Run the local app.
- Verify the target main flow: login -> empty dashboard -> add learning -> discovery with suggestions/free typing -> editable proposal/quote -> finalize -> background generation/resume -> correct navigation/files/chat/surfaces -> refresh persistence.
