# Stonecode Decisions

These decisions supersede older prototype behavior. Historical decisions remain available in Git history.

## Product Shape

Stonecode serves self-taught beginners through three generated modes: Course, Guided Project, and Exercise Pack. Legacy `short_course` records remain readable, but a new compact request is a smaller Course.

The persistent three-panel IDE remains the main product. Stone styling and the existing dashboard/workspace direction are preserved.

New product surfaces inherit the landing page's neutral charcoal, stone, and silver visual system unless the product lead explicitly approves another direction. Marketplace uses that shared background. Dashboard panels exit fully offscreen to the left with staggered timing, followed by a 500ms empty-scene pause before Marketplace enters. The Marketplace title stays outside its stone-glass listings card; publishing controls remain separate from the search, filters, and listings surface. Green remains available for existing semantic success, completion, and progress states; it is not a default page or feature theme.

## Discovery Before Generation

Setup is conversational discovery, not a knowledge test. Its opening and follow-up wording use available profile, recent-learning, and transcript context instead of a stock reply. It captures goal, relevant experience, desired depth, and preferences through contextual suggestions plus free typing. Knowledge quizzes, coding exercises, labs, and grading belong inside the learning path.

When a new computing domain needs scope selection, discovery may show one screenshot-style multi-select focus-area group. Every other suggestion turn remains single-select, and free typing always remains available.

Before creation, the learner receives an editable concrete proposal and deterministic Stone quote. Finalization reserves Stones, starts a persisted asynchronous job, settles on success, and releases on failure. Internal schemas retain `credit*` names for compatibility; all product UI calls the currency Stones.

Discovery accepts checklist answers in any order and carries a structured draft between turns so accepted answers cannot disappear or repeat. Broad language-learning requests explicitly choose Course, Guided Project, or Exercise Pack. Framework paths check relevant prerequisites and recommend foundations when needed, unless the learner already requested a foundation-first path. One complete first message goes directly to proposal; incomplete requests receive only contextual missing-field questions, capped at eight assistant discovery turns. The dashboard exposes the server-owned remaining Stone balance.

Generic theory-versus-hand-holding questions are removed because they did not materially shape Course output. Basic versus Advanced is required only for Guided Projects and controls feature count, coding-step scope, architecture, validation, and edge cases.

## Credits And Plans

Free receives 10 permanent registration Stones once and one active path. Pro costs $9/month and receives 100 expiring Stones each billing cycle plus ten active paths. Expiring Stones are spent before permanent Stones. There is no trial, daily refill, or BYO provider key. One-off Stone packs are a post-launch billing feature; they are not part of the current staging checkout.

Tutor replies, grading, execution, and visuals do not spend Stones; plan usage caps apply. Browser execution is unlimited. Deletion never refunds Stones. Marketplace cloning costs one Stone.

Stone quotes remain product prices, not direct token pass-through. Operations separately record actual model/token/retry cost per generation job and compare it with Stones charged and nominal Pro Stone allocation. Model routing or quote changes require measured quality/economics evidence; registration Stones remain a zero-revenue acquisition cost.

A Course quote covers the complete approved Course. Background generation writes and checkpoints modules in bounded calls without reducing content scope. Module 1 and Module 2 must each pass the full RAG, structure, scope, and quality gates before the Course is persisted, setup reports 100% ready, and Stones settle. Remaining modules append server-side from the first missing checkpoint. A pre-launch partial Course is never settled; a post-launch interruption preserves the validated launch package for recovery. Extra valid teaching does not change the approved Stone quote.

## Technology Scope

Teach plain source code and reviewed browser libraries only. Exclude external engines, native GUI frameworks, server-dependent frameworks, arbitrary package installation, Assembly, and unreviewed runtimes.

The catalog retains JavaScript, TypeScript, Python, Ruby, PHP, Java, C#, C++, C, Go, Rust, Swift, Kotlin, Dart, SQL, R, Julia, Fortran, COBOL, BASIC, HTML, and CSS. The 2026-08-01 expansion target exposes the 21 technologies supported by the runtime boundary; Julia stays hidden because Judge0 lacks it. The prior 17 rejection flags may be changed only after fresh hash/chunk/license/attribution review and re-evaluation—not by direct database flips.

Learning domains are Programming, Computer/IT Fundamentals, Internet/Web Fundamentals, Algorithms & Data Structures, and Math for Programmers. Algorithms/math always require a runnable technology. Computer/IT and Internet/Web may be conceptual only as Courses; Projects and Exercise Packs require a runnable technology. Conceptual Courses use theory, quizzes, reflections, reviews, and tutor diagrams without fake Code/Output/Terminal tasks.

Judge0 language resolution uses anchored names rather than substring matching, preventing short identifiers such as C and R from colliding with BASIC or Elixir. It selects the newest matching reviewed runtime except R, which is pinned to Judge0 R 4.0.0 because R 4.4 exceeds the production three-second CPU ceiling for a starter program.

Reviewed browser libraries use exact pinned assets for React, Vue, Svelte, D3, Chart.js, and p5.js. Output is sandboxed by iframe permissions, exact-URL filtering, and CSP. Arbitrary remote assets and network calls are blocked.

## Workspace And Visuals

Center surfaces are Code, Output, and Terminal. Code is always present. Output appears only for real browser-rendered work. Terminal appears only for console/Judge0 work. Hide the tab bar when Code is the sole surface.

Terminal keeps a deep charcoal stone base for code readability. Frosted depth stays neutral and restrained; the established learning-progress green is reserved for Run, prompt, status, and successful informational output rather than tinting the whole surface.

Opening a saved learning card lands on its overview/progress home. The left navigation stays closed until Start/Resume, while the center editor remains rendered throughout.

On first Start, the left panel opens the learning-path syllabus. Later Resume opens Files and restores the last selected file. Guided Projects pair substantive feature theory immediately before each of two to six connected feature workshops, then end with a recap. Courses vary workshops, inline checks, bug fixes, and small labs instead of repeating theory → MCQ → workshop; hard labs appear only near the end. Course MCQs are topic-specific reinforcement exercises, not assessments; repeated generic fallback questions are forbidden.

Exercise Packs progress from small Beginner warm-ups toward harder synthesis and may alternate code with MCQs. Each coding problem loads an isolated two-to-five-file workspace. Visual framework exercises must provide a real connected Output, while Code remains the default surface on every transition. Exercise checks are forgiving about valid implementation shape and line placement when output and the core concept are correct. Checking animates and opens the shared task checklist; failures explain the problem beneath the execution surface while the editor only highlights the relevant line. Correct work receives green feedback, completion celebration, and a green Next action. A corrected MCQ retry completes without XP.

Course module navigation is prerequisite-ordered. A module is clickable only when its validated content is ready and the learner has completed the previous module. Future modules remain grey; the currently generating module may show a compact circular indicator. Generation internals and developer error state are not exposed as learner-facing status copy.

There is no Whiteboard tab. Optional teaching diagrams/images are lazy tutor-chat attachments. Prefer deterministic SVG for exact diagrams; use AI raster images only when meaningful and within plan caps. A failure falls back to SVG or text and never blocks learning. Browser program output always stays in Output.

## Tutor Trust Boundary

The server resolves course ownership, files, progress, entitlements, and runtime capabilities. Tutor mutations are strict structured patches, never regex commands. The learner chooses Apply or Reject and can Undo an applied patch. Validate ownership, normalized path scope, patch shape, file size, rate limits, and plan entitlement before mutation.

## RAG Quality Gate

Each of the 22 technologies and four non-programming domains owns an independent versioned corpus with source provenance, ingestion status, chunk metadata, and retrieval fixtures. Enable only after at least 90% top-five relevance, complete provenance, and zero cross-language/domain leakage. Retrieval may combine exactly one approved domain corpus with exactly one approved technology corpus for a coding path; it never broadens to another language or domain.

## Marketplace And Deletion

Publishing snapshots an existing generated Course or Guided Project into an immutable version. Listing metadata remains editable; content versions do not. Source deletion does not remove published snapshots or clones. Unpublish is separate.

Private course deletion permanently removes owned course/files/folders/chat/progress/visual assets. Lifetime XP remains. Published snapshots and existing clones remain.

Permanent account deletion must cascade through the entire user-owned credit/proposal/job tree. Credit reservation, allocation, and generation-job ownership edges use `ON DELETE CASCADE`; `RESTRICT` is forbidden there because it can block deletion of an otherwise fully owned account.

## Architecture And Rollout

Domains are HTTP/auth, providers/tools, discovery/proposals/generation, validation, credits/billing, runtimes, tutor/visuals, RAG, Marketplace, and courses/progression. Client authentication is centralized in `src/services/authenticatedApi.ts`; server authentication and Stripe operations live in `server/http/` and `server/billing/`. `stonecode-server.mjs` and `course-generation.mjs` remain compatibility coordinators while legacy routes are observed.

Roll out behind `credits_v1`, `learning_proposals_v1`, `runtime_catalog_v1`, `structured_tutor_tools`, `chat_visuals_v1`, `dynamic_surfaces`, and `marketplace_v1`. Observe legacy endpoints for two releases and remove only after zero calls.

GPT-5.6 Luna is the default OpenAI text model. Requests explicitly use `reasoning.effort: none` to preserve the former non-reasoning baseline. Cost telemetry prices uncached input, cache reads, cache writes, and output independently. Its cache-write accounting migration must be applied before production generation.

No commit, push, deployment, or production migration occurs without explicit approval.
