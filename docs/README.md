# Stonecode Docs

## Read Order

1. `HANDOFF.yaml`
2. `PROJECT.md`
3. `TASKS.md`
4. `DECISIONS.md`
5. `project-architecture.md`
6. `AI_COURSE_GENERATION_RULES.md`
7. `ROADMAP.md`
8. `SESSION.md`
9. `superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`
10. `superpowers/plans/2026-06-18-stonecode-mvp.md`

## Current Direction

Stonecode is moving from prototype to focused paid beta:

- audience: self-taught beginners.
- SaaS stack: Supabase + Stripe.
- core UX: persistent course workspace.
- required app pages now have routes.
- Supabase-backed workspace persistence is verified live, including `workspace_folders`.
- server-side Free plan course creation and reset behavior are enforced through `/api/courses`.
- Free accounts now have full learning-mode and complete-path access while routing AI through a server-encrypted user OpenAI key. Public pricing offers only Free and $9 Pro; the legacy internal Basic tier remains compatible with existing records.
- Signup now captures display name, password confirmation, and terms consent in one compact panel. A centered eight-digit email-code modal verifies the account, immediately starts the sign-in-style dashboard handoff, and defers plan/API-key choice until the first AI-backed learning action. Free users can browse but must connect a verified encrypted OpenAI key before AI actions, while active paid users bypass key setup.
- The canonical branded confirmation email is `supabase/templates/confirmation.html`; hosted installation and SMTP steps are in `AUTH_EMAIL_SETUP.md`.
- The public landing shares the dashboard/auth wall color, grain, grid, and vignette. Navigation, pricing cards, and other card surfaces reuse the login panel's frosted border, background, blur, radius, and shadow recipe. The angled live workspace uses rounded outer clipping; its center editor has no extra surrounding panel, matching the real Code/Visual/Terminal workspace structure.
- billing is wired for authenticated checkout, portal, and webhook subscription sync; it needs Stripe env values for live QA.
- tutor calls are auth-gated, usage-tracked, streamed, and run through the OpenAI Responses API with `OPENAI_API_KEY` and optional `OPENAI_MODEL`.
- tutor UI includes generated lesson intros, chat-answer exercises, MCQ, terminal exercise, visual canvas demo states, and AI exercise hints.
- setup is one universal AI conversation that resolves a course, short course, exercise session, or guided project before confirmation.
- exercise discovery asks only missing scope/purpose questions, defaults to ten problems, confirms exact coding/MCQ counts, and supports plan modification before generation.
- verified progress is grouped by primary skill and parent language; Settings shows a solved-count skill donut, language XP, and configurable achievement-title progress.
- Settings provides six compact in-app routes with a fixed desktop account rail, real usage/billing/security states, persisted display name/timezone, and bounded progression/course selectors.
- typed experiences persist in the existing course/workspace container via `experience_type`; old courses remain compatible.
- guided projects are the workshop experience: one module with introduction theory, a continuous 10–20-step build, and final theory recap.
- course/project discovery captures prior knowledge, then offers an optional assessment of at most three questions near the end.
- pure exercises are standalone conversations; course home does not expose a nested Exercises action.
- discovery uses AI-generated greetings, one focused clarification at a time, contextual suggested answers, and unrestricted free typing until the course target is specific.
- courses are generated fresh per learner; fundamentals normally skip assessment, while frameworks and applied paths may offer the optional prerequisite check.
- initial generation fills Module 1 only and keeps Finalize as the learner-controlled save action.
- incomplete generation responses retry with a bounded larger output budget; quality repair is topic-scoped and cannot rewrite unrelated valid blocks.
- generation failure keeps the assessment review available for retry instead of saving a generic recovery course.
- full-course hierarchy is Course -> Modules -> Topics -> Blocks -> Steps, with full structure generated after review and module 1 filled.
- left panel has Modules and Files tabs; course step tiles navigate the right-panel lesson conversation, and files/folders stay in Files with per-item overflow menus.
- generated block kinds are explicit: `theory`, `quiz`, `workshop`, `lab`, `project`, and `review`.
- assessment MCQs can include course-shaping language/library/tool preferences; those answers are not graded as right/wrong.
- assessment questions now diagnose learner intention, readiness, prerequisite gaps, syntax bridges, and required module coverage; the learner can answer `I don't know`.
- generated lessons assume zero syntax knowledge unless assessment proves otherwise; workshops are variable-length guided mini-projects, and too-short workshops are rejected during normalization.
- workshop screens are compact: one build introduction, step-specific code/explanation, relevant tutor questions, a final non-coding recap, and inline editor diagnostics after failed checks.
- center workspace uses full-height Code, Visual, and Terminal tabs; generated practical steps can preload multi-file scenes/projects and open the relevant view.
- saved lightweight visual exercises are repaired at lesson load with a deterministic source-linked 2D preview that updates from current editor code without Terminal or AI; full external engines remain Code-only.
- advanced/applied-course assessment adds a narrow target-specific refresher only when prerequisite evidence shows it is needed.
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
npm run verify:ai-credentials
npm run verify:stripe-subscription-sync
npm run verify:usage-summary
npm run verify:response-stream
npm run verify:tutor-flow
npm run verify:generated-course-content
npm run verify:learning-orchestrator
npm run verify:progression
npm run verify:execution-sandbox
```

`npm run lint` needs an ESLint 9 config before it can be required.

Stripe setup lives in `docs/STRIPE_SETUP.md`.
Judge0 multi-language execution setup lives in `docs/JUDGE0_SETUP.md`.

Free-plan BYO OpenAI credentials require the `user_ai_credentials` migration and a server-only 32-byte encryption key:

```bash
openssl rand -base64 32
# save the output as AI_CREDENTIAL_ENCRYPTION_KEY
```
