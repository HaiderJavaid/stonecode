# Project Architecture

## Stack

- Vite, React, TypeScript, React Router, CodeMirror 6
- Node HTTP API with a Netlify catch-all adapter/background function
- Supabase Auth, Postgres, RLS, RPCs, and private storage
- Stripe subscriptions
- OpenAI Responses/Image APIs
- Judge0 headless execution plus sandboxed browser Output

## Entry Points

- `src/main.tsx`: browser root/providers/router.
- `src/App.tsx`: route shell and lazy route boundaries.
- `src/components/stonecode/StonecodePrototype.tsx`: authenticated dashboard/workspace/settings shell.
- `server/stonecode-server.mjs`: HTTP compatibility coordinator.
- `netlify/functions/api.mjs`: production API adapter.
- `netlify/functions/generate-learning-background.mjs`: asynchronous generation worker.

## Routes

- Public/auth: `/`, `/login`, `/signup`, `/forgot-password`, `/onboarding`, `/privacy`, `/terms`, `/support`.
- Product: `/dashboard`, `/courses/:courseId`, `/marketplace`.
- Settings: `/settings/overview`, `/settings/profile`, `/settings/billing`, `/settings/usage`, `/settings/security`, `/settings/support`.

## Server Domains

- HTTP/authentication: `server/http/authentication.mjs`, `src/services/authenticatedApi.ts`, the HTTP composition shell, and Netlify adapters.
- AI providers/telemetry/economics: `server/llm-providers.mjs`, `server/usage-events.mjs`, `server/billing/ai-costs.mjs`.
- Discovery/proposals/generation: `server/learning-orchestrator/`.
- Curriculum contracts/validation: `server/course-generation/`, with `server/course-generation.mjs` as a legacy export coordinator.
- Credits/billing: `server/credits/`, `server/billing/stripe-service.mjs`, `server/stripe-subscriptions.mjs`, `server/subscription-state.mjs`, `server/plan-limits.mjs`.
- Runtime/execution: `server/runtime/`, `server/execution/`.
- Tutor/tools/visuals: `server/tutor/`, `src/ai/`.
- RAG: `server/rag/`, `scripts/seed-rag-corpus.mjs`, `scripts/evaluate-rag-corpora.mjs`.
- Marketplace: `server/marketplace/`.
- Courses/progression: course storage APIs, `server/progression-store.mjs`, `server/progression.mjs`.
- Shared contracts: `shared/stonecode-product.mjs` and its TypeScript declarations.

The HTTP shell retains legacy-compatible route handlers, while trust-sensitive authentication and Stripe operations plus all new product rules live in focused domain modules. Further handler extraction is a maintainability follow-up after launch behavior is frozen, not a missing product trust boundary.

## Learning Creation Flow

```txt
authenticated discovery turn
-> server-normalized LearningBriefV2
-> capability and plan checks
-> editable LearningProposalV1 + deterministic quote
-> credit reservation + generation_jobs row
-> Netlify background worker
-> validated Module 1 + Module 2 checkpoints
-> persisted launch-ready course + credit settlement
-> remaining validated module checkpoints appended server-side

failure/expiry
-> release reservation
-> persisted failed job for safe retry
```

The setup client polls `GET /api/generation-jobs/:id` until `launch_ready_at` is present, then opens the Course and clears the setup job. While the Course is open, the workspace polls the same durable job to recover stale work and refresh newly appended modules. Idempotency keys plus per-module JSONB checkpoints prevent duplicate Courses and completed-module regeneration.

## Credits

Credit accounts contain grant buckets. Registration grants are permanent; Pro billing-cycle grants expire. Reservation allocation spends expiring grants first. Ledger entries are append-only and all reserve/settle/release operations are server-owned and idempotent.

Creation quotes are deterministic in `shared/stonecode-product.mjs`; the model cannot set price.

Generation usage records every provider attempt, including retries and repairs, with the actual model, input/cached/output/reasoning tokens, latency, and a versioned estimated text cost. Job aggregates compare spend with Stones charged and nominal subscription-funded Stone allocation. This is operating telemetry, not learner billing.

Course generation first produces an outline constrained to the exact approved proposal, then generates each module in a separate bounded provider call. Every module receives deterministic scope checks, isolated RAG grounding, quality validation, and focused repair before checkpointing. Once the first two modules are durable, the worker inserts the full locked outline, settles the reservation, and continues later modules. A pre-launch failure remains atomic; a post-launch interruption preserves approved modules and resumes at the first missing module.

## Runtime Capability Flow

```txt
technologyCatalog
+ enabled matching technology_manifests row
+ editor/grading metadata
+ browser runtime or discovered Judge0 language
+ enabled RAG corpus with relevance/provenance/leakage pass
-> available technology

learningDomainCatalog
+ enabled matching learning_domain_manifests row (except derived programming)
+ enabled domain RAG corpus with relevance/provenance/leakage pass
+ required default runtime availability
-> available learning domain
```

The database exposes 21 runtime-backed technologies. Julia remains hidden and disabled with `approved_pending_runtime`; its approved corpus is ready for a future runtime. Capability questions bypass the model and render the server-authoritative roster as a structured bullet list.

Browser Output uses an `allow-scripts` iframe, injected CSP, exact pinned asset URLs, blocked arbitrary remote styles/scripts/imports, and no connect access. React uses plain `React.createElement`; Vue and Svelte have reviewed raw-browser conventions. D3, Chart.js, and p5.js use exact pinned globals.

## Tutor Trust Boundary

The request client may provide conversational context, but the server reloads owned course/files/progress/entitlements. OpenAI tool calls must match strict schemas. Patch application validates ownership, normalized relative path, existing file scope, patch size/shape, and entitlement. Applied/rejected/undone states persist in chat tool payloads.

Tutor visuals are generated lazily from optional `TutorVisualCueV1`. Deterministic SVG is preferred. AI images consume plan image allowance. Assets are private and served only after course-ownership authorization; failures fall back without blocking the step.

## Marketplace And Deletion

Marketplace publishing stores immutable content versions separately from editable listing metadata. Stars/reports are user-owned records. Clone reserves and settles one credit and creates an independent private course. Unpublish does not delete versions.

Private course deletion authorizes ownership, removes course-owned rows and private visual objects, and relies on progression foreign keys that preserve lifetime XP. Published versions and clones survive source deletion.

Authenticated account export returns user-owned application records. Permanent account deletion requires typed confirmation, cancels an active Stripe subscription first, removes private tutor assets, and then deletes the Auth user so foreign-key cascades remove owned data.

## Data Migrations

`supabase/migrations/2026-07-29-production-revamp-foundation.sql` contains the production revamp tables, constraints, RLS, credit RPCs, catalog seeds, storage, and compatibility changes. It was applied successfully to the configured Supabase project on 2026-07-29.

`supabase/migrations/2026-07-30-atomic-usage-and-operator-limits.sql` adds atomic per-user plan counters and the global Judge0 circuit breaker. It was applied successfully to the configured Supabase project on 2026-07-29, and all four atomic RPCs pass readiness checks.

`supabase/migrations/2026-07-31-ai-cost-and-job-hardening.sql` adds job heartbeats, extended token/cost columns, job economics aggregation, a 90-minute reservation window, and a retry-limited atomic claim RPC. It is applied to the configured Supabase project.

`supabase/migrations/2026-08-01-learning-domains-and-expanded-catalog.sql` adds domain manifests, dual technology/domain corpus scoping, domain leakage fixtures, stricter corpus-gated RLS, and domain-aware vector retrieval. It is applied to the configured Supabase project.

`supabase/migrations/2026-08-01-gpt-5-6-luna-cache-accounting.sql` adds cache-write token fields to usage and generation-job economics. It is prepared locally and has not been applied.

`supabase/migrations/2026-08-02-progressive-course-generation.sql` adds launch/background timestamps, durable generation checkpoints, the launch/finalize RPC split, and monotonic highest-lesson progress for prerequisite module locking. It is prepared locally and has not been applied.

## Feature Flags

`FEATURE_CREDITS_V1`, `FEATURE_LEARNING_PROPOSALS_V1`, `FEATURE_RUNTIME_CATALOG_V1`, `FEATURE_STRUCTURED_TUTOR_TOOLS`, `FEATURE_CHAT_VISUALS_V1`, `FEATURE_DYNAMIC_SURFACES`, and `FEATURE_MARKETPLACE_V1` default off unless explicitly enabled.

## Production Gate

Static 75-path capability/generation contracts pass. Fresh approval of 22 language and four domain corpora, the 2026-08-01 migration, live runtime/generation certification, hosted support/alerts, live Stripe, external legal/security review, and explicit commit/push/direct-production approval remain.
