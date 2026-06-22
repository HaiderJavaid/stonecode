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
- XP formula and badge taxonomy.
- Which unlockables are earned by progression versus subscription tier.
- Whether shared/published courses belong in paid beta or post-beta.
- Monetization model for future freemium path: subscription-only, usage credits, microtransactions, creator marketplace, or hybrid.
