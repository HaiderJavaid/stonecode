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

### AI Orchestration

Use direct OpenAI SDK/API calls for MVP.

Reason: simpler streaming, tool approval, cost control, and traceability.

### Code Execution

Keep browser Worker execution only for beginner lesson snippets.

Reason: full untrusted project execution needs a backend/container sandbox later.

## Pending

- Production host.
- Stripe pricing IDs.
- Supabase project.
- Backend/container sandbox provider.
- RAG ingestion format.
