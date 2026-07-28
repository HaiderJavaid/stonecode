# Project Architecture

## Current Stack

- Vite
- React
- TypeScript
- React Router
- CodeMirror 6
- Node HTTP app server
- Supabase client/schema scaffold
- Stripe server endpoint scaffold
- OpenAI Responses API adapter for tutor streaming
- Shared generated-course language capability registry with execution-mode metadata

## Current Entry Points

- `src/main.tsx` mounts `App`.
- `src/App.tsx` owns routes.
- `src/components/stonecode/StonecodePrototype.tsx` is the routed workspace shell.
- `server/stonecode-server.mjs` serves the app and API routes.

## Active Product Routes

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/onboarding`
- `/dashboard`
- `/courses/:courseId`
- `/settings/profile`
- `/settings/account`
- `/settings/billing`
- `/settings/usage`
- `/privacy`
- `/terms`
- `/support`

## Workspace Source Map

- `CourseWorkspace`: file panel + IDE shell with switchable Code/Visual/Terminal tabs, lesson-driven initial view, dependency-aware HTML preview for linked CSS/JavaScript, and `stonecode-source` linkage from synchronized native scenes to their source file.
- `DashboardPage`: course launcher/cards.
- `CourseCard`: course details/progress/tutor panel.
- `FilePanel` and `WorkspaceFileTree`: course tree navigation and file navigation.
- `RunTerminal`: full-height Terminal tab; browser Worker output for JavaScript and configured remote-sandbox output for other runnable languages.
- `editorLanguages`: shared editor language registry for syntax loading, generated file defaults, visual preview support, and run capability.
- `editorDiagnostics`: pure workshop code-delta comparison used to place non-mutating CodeMirror error comments after failed checks.
- `simpleVisualPreview`: deterministic visual-profile detection, external-engine exclusion, saved-step preview repair, and lightweight 2D scene synthesis from current source code.
- `server/course-generation/language-capabilities`: server assessment intent, language families, safe filenames/starters, and future sandbox execution contracts.
- `server/learning-orchestrator/contracts.mjs`: learning-brief normalization, missing-field validation, and deterministic routing policy.
- `server/learning-orchestrator/generation.mjs`: type-specific prompts and schema normalization; new guided projects use one-module v2 while legacy v1 milestone continuation remains isolated for saved records.
- Guided-project v2 transport is compact: one initial `workspaceFiles` manifest plus per-step find/replace edits. Normalization clears scratch source files, rejects no-op/run-only steps, enforces the Pygame import/init/dimensions foundation order, compacts intro/recap prose, creates native synchronized scene files, and expands full IDE snapshots before persistence.
- `server/skill-taxonomy.mjs`: deterministic primary-skill/parent-language/domain resolution, XP values, and configurable achievement-title rules.
- Progression persistence records primary skill, parent language, topics, domains, and exercise kind in attempts and the idempotent XP ledger.
- `useCourseWorkspace`: active course, files, folders, multi-file generated exercise loading, and persistence.
- `useTutorChat`: tutor requests grounded in the complete file/folder project context, chat messages, AI file-edit parsing, and AI run triggers.
- `useTerminalRunner`: safe active-file browser Worker execution state.
- `CourseHome`: finalized-course overview and primary navigation.
- `IndependentExercisePanel`: direct-practice interaction.
- `exerciseSession`: local daily allowance and per-exercise state until backend enforcement exists.

Independent exercise session state currently uses the account-wide localStorage key `stonecode.exerciseSession.v1`. This is interaction scaffolding, not a security or billing boundary.

## Current Data Flow

```txt
Supabase Auth
-> useCourseWorkspace
-> Supabase-backed course/files/folders/chat/progress storage
-> local fallback only when Supabase is unavailable
-> CodeMirror editor
-> browser Worker terminal for standalone JavaScript / HTML-entrypoint Visual preview for explicitly linked CSS and browser JavaScript
-> source-linked deterministic Visual repair for supported lightweight native/2D code; no Terminal or AI call required
-> useTutorChat
-> /api/tutor
-> LLM provider adapter
-> OpenAI Responses API
-> optional AI file edit blocks applied to workspace state
-> optional active-file browser Worker run trigger
-> usage_events
```

## Target Data Flow

```txt
Supabase Auth
-> authenticated routes
-> Supabase courses/files/chat/progress
-> server-side plan limit checks
-> authenticated /api/tutor
-> direct workspace file edits with undo
-> safe active-file terminal run
-> usage_events
-> Stripe subscriptions
```

## API Routes

- `POST /api/tutor`
- `GET|PUT|DELETE /api/ai-credentials/openai`
- `POST /api/course-generation/preview`
- `POST /api/course-generation/discovery-turn`
- `POST /api/course-generation/chapter`
- `POST /api/course-generation/commit`
- `POST /api/learning/discovery-turn`
- `POST /api/learning/assessment-plan`
- `POST /api/learning/assessment-question`
- `POST /api/learning/assessment-review`
- `POST /api/learning/generate`
- `POST /api/learning/project/milestone` (legacy guided-project v1 continuation only)
- `GET /api/execution/capabilities`
- `POST /api/execution/run`
- `POST /api/courses`
- `DELETE /api/courses`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/stripe/webhook`

Billing and tutor provider routes require env vars before live use. Tutor calls use `OPENAI_API_KEY` and optional `OPENAI_MODEL`.

Free-plan tutor and generation calls instead use the current user's OpenAI key from `user_ai_credentials`. The secret is AES-256-GCM encrypted with `AI_CREDENTIAL_ENCRYPTION_KEY`, is only readable through the server service role, and is never returned by the credential API.

Signup confirmation uses Supabase `verifyOtp` with an eight-digit email code, then immediately starts the authenticated sign-in-style transition to `/dashboard`. The dashboard no longer opens plan or credential UI automatically. Free users encounter the encrypted OpenAI-key gate only when invoking Start learning or another AI-backed action; its Pro action opens `/onboarding`, which reads server subscription state, starts Stripe checkout, and polls webhook-backed subscription state before paid dashboard entry. The canonical hosted Supabase template is `supabase/templates/confirmation.html` and must expose `{{ .Token }}`.

Learning discovery calls return validated structured turns: status, conversational reply, contextual suggested answers, draft brief, and a resolved brief only when required goal and prior-knowledge fields are ready for optional assessment or confirmation.

Multi-language Run and generated-code grading use the provider-neutral `server/execution` boundary. Judge0 is the first adapter and requires `CODE_RUNNER_PROVIDER`, `JUDGE0_API_URL`, and provider authentication values. Browser JavaScript remains local; HTML/CSS remain Visual-preview content.
