# Stonecode Decisions

## Accepted

### Audience

Target self-taught beginners first.

Reason: simpler curriculum, clearer value, and lower support risk for a paid beta.

### Launch Scope

Ship a focused paid beta before a full public SaaS.

Reason: validate willingness to pay before building marketplace/admin-heavy surfaces.

### SaaS Stack

Use Supabase Auth/Postgres + Stripe.

Reason: fastest solo path to auth, database, row security, subscriptions, and billing portal.

### Frontend

Keep Vite + React + TypeScript.

Reason: current workspace UI works and does not need a framework migration yet.

### Visual Direction

Preserve the stone-textured IDE direction.

Reason: the product should feel like a distinctive learning workspace, not a generic SaaS dashboard.

### Auth Transition Direction

The login screen and dashboard should feel like one continuous scene.

Reason: the center black code box and background should behave as persistent visual elements; login panel, dashboard chrome, and brightness overlays should animate around them without a visible reload.

### Animation Performance Direction

Keep the visual timing and stone-textured feel, but avoid animating large filters, blend modes, and heavy moving shadows.

Reason: the accepted intro and dashboard motion should stay cinematic while the browser mostly composites transform/opacity layers.

### AI Orchestration

Use direct provider adapters for MVP instead of LangChain or LangGraph.

Reason: simpler streaming, tool execution, cost control, and traceability. Keep app logic provider-agnostic enough to route through OpenAI or OpenRouter.

### Dev AI Provider

Use OpenRouter free models for local tutor testing when OpenAI quota is unavailable.

Reason: keeps the tutor path testable without spending OpenAI credits while preserving the OpenAI path for later paid/prod use.

### Code Execution

Keep browser Worker execution only for beginner lesson snippets.

Reason: full untrusted project execution needs a backend/container sandbox later.

### Tutor Response Model

Tutor steps may be theory, chat-answer exercises, multiple-choice exercises, terminal coding exercises, or visual canvas/code explanations.

Reason: different concepts need different interaction surfaces, while one linear Next/Prev flow keeps course progress understandable.

### Exercise Progression

Exercise XP is attributed to the exercise language/category and scales by difficulty. UI metadata may be shown before backend award persistence exists.

Reason: learners need visible progression context now, but XP awards must eventually be server-validated.

### Course Challenges Versus Independent Exercises

Course challenges are unlimited, syllabus-integrated, and may affect course completion. Independent exercises use different scenarios and angles, are subject to plan-based daily completion and skip limits, and do not affect course completion.

Reason: learners can either follow the teaching path or jump directly into harder practical coding without allowing practice quotas to block the course.

### Independent Exercise Interaction

Each independent exercise permits one hint question, repeatable Run attempts, and one account-wide daily Skip. A successful Run changes Skip to Next. Free users may complete two independent exercises per local calendar day in the initial product model.

Reason: this gives direct-practice users enough help and variety while keeping AI generation and grading cost controllable.

### Upcoming Topic Questions

Answer current-topic clarification directly. If the question belongs to a clearly upcoming topic, identify that section, provide only the minimum bridge, and return to the current step.

Reason: preserve curiosity without derailing the planned learning sequence.

## Pending

- Production host.
- Stripe pricing IDs.
- Supabase project.
- Backend/container sandbox provider.
- RAG ingestion format.
- Final production AI provider/model.
- Direct AI file-edit control model, including scope, undo/history, and terminal command limits.
- Final exact timing/easing for remaining dashboard component animations.
- Final app navigation model for dashboard/workspace/settings/support/legal routes.
- Exact XP formula, streak rules, and badge taxonomy.
- Server-validated interactive tutor response schema and grading rules.
- Which unlockables are earned by progression versus subscription tier.
- Whether shared/published courses belong in paid beta or post-beta.
- Monetization model for future freemium path: subscription-only, usage credits, microtransactions, creator marketplace, or hybrid.
