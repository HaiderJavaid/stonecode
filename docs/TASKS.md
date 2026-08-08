# Stonecode Tasks

## Production Revamp — Implemented Locally

- [x] Add canonical product contracts, feature flags, Free/Pro entitlements, and deterministic creation quotes.
- [x] Add append-only credit grants/ledger/reservations/allocations with expiry order, retry safety, settlement, and release.
- [x] Grant 10 permanent registration credits and idempotent 100-credit active Pro billing-cycle grants.
- [x] Replace onboarding tests with short conversational discovery, contextual suggested answers, any-entry-point intake, and editable Course/Guided Project/Exercise Pack proposals.
- [x] Add persisted asynchronous generation jobs and Netlify background worker entrypoint.
- [x] Keep legacy `short_course` readable while normalizing new compact requests to Course.
- [x] Add runtime manifests and dynamic Judge0 discovery for the 22-language catalog.
- [x] Add isolated, versioned RAG corpus/source/chunk/evaluation records and seed/evaluate scripts for all 22 technologies.
- [x] Ingest and approve documentation for all 22 technologies and reach 1.00 top-five fixture relevance with zero cross-language leakage; enable all 21 runtime-backed technologies and leave Julia hidden pending runtime.
- [x] Gate visible technologies on editor, manifest, grading, runtime, provenance, relevance, and leakage checks.
- [x] Replace regex tutor mutations with strict structured patches plus Apply/Reject/Undo.
- [x] Add lazy private tutor-chat visuals with SVG-first rendering, image caps, caching, fallbacks, and accessible zoom/pan viewer.
- [x] Limit workspace surfaces to dynamic Code/Output/Terminal and remove fake native previews/Whiteboard tabs.
- [x] Pin and sandbox React, Vue, Svelte, D3, Chart.js, and p5.js browser assets; block arbitrary remote preview dependencies.
- [x] Add permanent owned-course deletion with XP preservation and themed confirmation UI.
- [x] Add route-backed Marketplace publishing, immutable snapshots, search, stars, reports, moderation state, unpublish, and one-credit clone.
- [x] Integrate Marketplace into the persistent dashboard scene with a top route switcher, neutral landing-derived surfaces, fully offscreen staggered Dashboard exits, a 500ms transition pause, and a separate Marketplace title/listings card composition.
- [x] Polish dashboard learning cards with compact one-line dated rows, balanced outer content padding and inline progress, newest-first ordering, an independently scrolling list, corrected Stone marks, synchronized reversible expansion, one contextual Back action, and X close; simplify proposal creation to Generate + Stone quote and restyle Terminal with the charcoal stone system plus semantic progress-green accents.
- [x] Remove active BYO OpenAI key UI/services and leave the old route as a compatibility `410`.
- [x] Record actual model, tokens, latency, feature, status, and cost category across AI/runtime paths.
- [x] Update Free/Pro public pricing and product copy.
- [x] Route-split public/authenticated surfaces and heavy vendors; production build has no JavaScript chunk over 500 kB.
- [x] Add atomic per-user usage counters and a hard global Judge0 circuit breaker migration.
- [x] Upgrade to supported Vite 7/React Router 7, add ESLint flat config, remove applicable dependency advisories, and pin Node 22.12 for Netlify.
- [x] Pass local typecheck, lint with zero errors, production build, all non-live verifiers, and rendered landing/login/browser-runtime QA.
- [x] Pass a 200-request/20-concurrency local feature-endpoint smoke load check; authenticated production load remains gated on deployment approval.
- [x] Add share metadata plus a 1200x630 preview asset, authenticated dashboard Stones balance, concise typing dots, any-order discovery completion, and home-first course reopening with the default dashboard IDE preserved until Resume/file selection.
- [x] Integrate Marketplace into the persistent workspace with slow symmetric stagger/pause transitions; animate lesson-card expansion and restore green list progress bars.
- [x] Explicitly reject and disable the 17 non-launch technologies/sources; production now exposes only Python, JavaScript, TypeScript, HTML, and CSS.
- [x] Centralize authenticated browser API calls with near-expiry refresh and one 401 retry; add transient Supabase auth recovery on the server.
- [x] Repair Stripe item-level billing-period parsing, active-Pro credit self-reconciliation, and server-owned redirect URLs.
- [x] Extract HTTP authentication and Stripe operations into focused backend domain modules.
- [x] Repair Exercise Pack generation with exact-count code/MCQ batches, strict one-problem normalization, targeted batch retry, and final mix validation.
- [x] Make first Start open the syllabus, later Resume restore Files/last file, split Guided Projects into feature-sized microstep blocks, and enforce topic-grounded non-assessment MCQs.
- [x] Canonicalize discovery question/suggestion turns and ignore stale browser responses so chips cannot lag behind the visible question.
- [x] Preserve contextual discovery wording only when its structured field matches the canonical question; answer capability questions directly from the server-authoritative 21-language catalog using bullet lists and aligned chips.
- [x] Ground asynchronous generation in the approved language-isolated RAG corpus and persist retrieval provenance.
- [x] Add retry-aware generation job heartbeats and versioned per-job token/API-cost/Stone economics accounting.
- [x] Add authenticated account export, typed permanent account deletion with Stripe cancellation, request trace IDs, readiness/liveness endpoints, alert-webhook support, and production security headers.
- [x] Add actionable support contact/diagnostic IDs, expand beta privacy/terms coverage, and document release/rollback/incident/backup operations.
- [x] Replace fragile whole-Course quality repair with one smallest-scope repair, one affected-module regeneration, and at most one fresh validation retry; fix false-positive same-block MCQ/exercise grounding checks and keep wording uncertainty advisory.
- [x] Enforce quote-to-delivery parity: Course proposals normalize to at least six learner steps per module, background generation writes every approved module separately, and persistence/settlement reject partial or out-of-band Courses.
- [x] Make discovery openings learner-contextual, remove the generic guidance-style branch, require Basic/Advanced only for Guided Projects, vary Course practice cadence, teach project features before workshops, tolerate equivalent code, and add checklist/retry/celebration/module-loading feedback with overflow-safe generation UI.

## Required Before Production Enablement

- [x] Switch the default OpenAI text model and Netlify Production selector to GPT-5.6 Luna with reasoning effort none; add Luna cache-read/cache-write pricing tests.
- [x] Use Fast mode for finalized Course, Guided Project, and Exercise Pack generation/repair calls, retain Standard proposal generation, account for actual Fast-tier pricing, preserve larger valid modules, and prevent scope failures from restarting every completed module.
- [x] Implement two-module progressive Course launch with unchanged per-module quality gates, durable resume checkpoints, setup 100% at launch readiness, background append/refresh, generation-readiness locks, and an active-generation spinner; enable every module after its checkpoint is ready.
- [x] Persist discovery drafts between turns; fix spaced TypeScript resolution; require mode selection for broad language requests; add relevant experience and framework-foundation routing without rushing or repeating.
- [x] Make Exercise Packs progressive, isolate focused multi-file workspaces, require real framework Output, highlight important constraints, and reset every lesson transition to Code.
- [x] Start Exercise Packs with MCQ warm-ups, require substantial role-play coding tickets, repair C++ main.cpp workspace selection, add child-friendly language orientation, and block hard labs before the final third.
- [x] Fall back to compatible full-course generation when the pending progressive-generation columns are absent, instead of exposing a schema-cache error.
- [x] Prevent model-produced Course/Project proposal count errors from reaching users: normalize quote totals locally, bound excess outline items, retry malformed proposals once, preserve larger generated Guided Projects, and certify all 21 runnable technologies.
- [ ] Apply `2026-08-01-gpt-5-6-luna-cache-accounting.sql` through an authenticated Supabase migration path.
- [x] Apply `2026-08-02-progressive-course-generation.sql`; live PostgREST column reads confirm the progressive schema is active (manually applied 2026-08-08).
- [x] Implement the 21-technology launch catalog, domain-aware contracts, runtime capabilities, multi-select focus UI, generalized file/runtime surfaces, conceptual Course rules, isolated domain RAG tooling, and 75-path dry certification.
- [x] Apply `2026-08-01-learning-domains-and-expanded-catalog.sql`; four domain manifests now exist pending review.
- [x] Repair account-deletion cascade blockers for fresh installs and in the pending 2026-08-01 migration; add regression coverage.
- [ ] Ingest/review/evaluate all four domain corpora.
- [ ] After migration, rerun authenticated account deletion with a reserved generation job to verify the cascade repair against Supabase.
- [x] Re-open and individually verify hash/chunks/license/attribution for the 17 rejected language sources; re-evaluate all 22 corpora, enable 21 manifests through `approve:learning-capability`, and mark Julia `approved_pending_runtime`.
- [ ] Obtain legal clearance for the recorded Dev.java reference-use terms or replace/re-ingest/re-evaluate the Java source before production deployment.
- [x] Run live 18-language Judge0 runtime smoke; fix exact C/R matching, FreeBASIC syntax, and pin the reviewed R runtime that meets the CPU ceiling.
- [ ] Rerun JavaScript/HTML/CSS rendered Output smoke after deployment.
- [ ] Run paid live generation certification for 63 technology paths and 12 valid domain paths after explicit external-spend approval.

- [x] Apply `2026-07-29-production-revamp-foundation.sql` to the configured Supabase project and verify its tables, catalog, and private visual bucket.
- [x] Review and apply `2026-07-30-atomic-usage-and-operator-limits.sql`; all four atomic RPCs pass readiness checks.
- [x] Historical state: approve/evaluate five beta corpora and explicitly reject/disable the other 17; the expansion now requires fresh source approval before changing those flags.
- [x] Confirm every enabled launch corpus retains at least 90% relevance and zero leakage.
- [x] Restore the RapidAPI key, subscribe to Judge0 CE, validate 71 discovered runtimes, and leave Julia hidden because it is absent.
- [x] Configure StoneCode sandbox Stripe for Deploy Preview billing QA: $9/month Pro test price, production webhook URL in test mode, default Customer Portal cancellation/plan changes, local `.env`, and Netlify `deploy-preview`/`branch-deploy` Stripe vars.
- [ ] Configure live production Stripe credentials/webhook after a live Stonecode Stripe account is activated; do not use sandbox credentials in Netlify Production.
- [ ] Configure the remaining Netlify Production environment. As of 2026-08-02 only `NODE_VERSION` and `OPENAI_MODEL` are present.
- [x] Review and apply `2026-07-31-ai-cost-and-job-hardening.sql`; paid expanded generation QA still requires explicit spend approval.
- [x] Run authenticated local discovery-to-proposal QA for Course, Guided Project, and Exercise Pack, including deterministic quotes and rejected-language recovery with zero browser errors.
- [x] Run self-cleaning authenticated local proposal-to-finalization QA for a 10-problem Exercise Pack and a multi-feature Guided Project.
- [x] Add a reusable authenticated API smoke test that creates and removes its own temporary Supabase user.
- [ ] Run deployed finalization/refresh-resume/retry/failure-release QA for all three modes.
- [ ] QA Free/Pro grants, Stripe renewal idempotency, expiry order, path limits, monthly caps, and daily Judge0 caps against staging.
- [ ] QA structured tutor Apply/Reject/Undo, traversal/ownership attacks, visual authorization/cache/fallback, deletion, and Marketplace lifecycle.
- [ ] Run responsive/mobile, accessibility, authenticated rate-limit, concurrency, load, and production observability checks.
- [x] Configure the local support inbox as `hjv.ventures@gmail.com`; copy it to the hosted environment at release time.
- [ ] Configure an operational alert webhook and complete legal-counsel review for the operating entity/jurisdiction.
- [x] Add a hard global Judge0 operator circuit breaker; apply its migration and add provider cost alerts before paid traffic.
- [ ] Review and sign off the temporary React Router RSC advisory exception in `docs/SECURITY_NOTES.md`, then upgrade when the patched stable package is published.
- [ ] Roll out flags one at a time with metrics and rollback instructions.

## Architecture Follow-up

- [x] Extract shared client authentication, server HTTP authentication, and Stripe operations into focused modules.
- [ ] Continue extracting legacy-compatible HTTP handlers from `server/stonecode-server.mjs` into domain routers after launch behavior is frozen.
- [ ] Split prompt construction, normalization, validation, and repair out of `server/course-generation.mjs` while preserving its compatibility exports.
- [ ] Observe legacy assessment/generation routes for two releases; remove only after zero calls.
- [ ] Remove the legacy `user_ai_credentials` table in a separately reviewed migration after compatibility observation.
- [ ] Regenerate marketing media from the updated browser-only scripts if those assets will ship.

## Post-launch Product Backlog

- [ ] Add one-off Stone packs with dedicated Stripe one-time prices, idempotent grant fulfillment, refund/dispute reversal rules, receipts, regional tax handling, purchase limits, and abuse monitoring. Keep this disabled during current staging; test checkout remains the Pro subscription flow.

Do not commit, push, deploy, or apply live migrations without explicit approval.
