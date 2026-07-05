# Stonecode Docs

## Read Order

1. `HANDOFF.yaml`
2. `PROJECT.md`
3. `TASKS.md`
4. `DECISIONS.md`
5. `project-architecture.md`
6. `ROADMAP.md`
7. `SESSION.md`
8. `superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`
9. `superpowers/plans/2026-06-18-stonecode-mvp.md`

## Current Direction

Stonecode is moving from prototype to focused paid beta:

- audience: self-taught beginners.
- SaaS stack: Supabase + Stripe.
- core UX: persistent course workspace.
- required app pages now have routes.
- Supabase-backed workspace persistence is verified live, including `workspace_folders`.
- server-side Free plan course creation and reset behavior are enforced through `/api/courses`.
- billing is wired for authenticated checkout, portal, and webhook subscription sync; it needs Stripe env values for live QA.
- tutor calls are auth-gated, usage-tracked, streamed, and run through the OpenAI Responses API with `OPENAI_API_KEY` and optional `OPENAI_MODEL`.
- tutor UI includes generated lesson intros, chat-answer exercises, MCQ, terminal exercise, visual canvas demo states, and AI exercise hints.
- current course setup/generation flow is assessment-first `course-content/v2`.
- hierarchy is Course -> Modules -> Topics -> Blocks -> Steps, with full structure generated after adaptive assessment and modules 1 and 2 filled.
- left panel has Modules and Files tabs; course step tiles navigate the right-panel lesson conversation, and files/folders stay in Files with per-item overflow menus.
- generated block kinds are explicit: `theory`, `quiz`, `workshop`, `lab`, `project`, and `review`.
- assessment MCQs can include course-shaping language/library/tool preferences; those answers are not graded as right/wrong.
- assessment questions now diagnose learner intention, readiness, prerequisite gaps, syntax bridges, and required module coverage; the learner can answer `I don't know`.
- generated lessons assume zero syntax knowledge unless assessment proves otherwise; workshops are variable-length guided mini-projects, and too-short workshops are rejected during normalization.
- file icons and lazy editor syntax modes cover common web, scripting, JVM, systems, database, and documentation formats through a shared language registry.
- browser Run is JavaScript-only for now; non-JS languages are editable with correct syntax/file generation and need the future backend sandbox to execute.
- current work is on `setting-page-redesign`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run verify:supabase
npm run verify:course-reset
npm run verify:plan-limits
npm run verify:subscription-state
npm run verify:stripe-subscription-sync
npm run verify:usage-summary
npm run verify:response-stream
npm run verify:tutor-flow
npm run verify:generated-course-content
npm run verify:progression
```

`npm run lint` needs an ESLint 9 config before it can be required.

Stripe setup lives in `docs/STRIPE_SETUP.md`.
