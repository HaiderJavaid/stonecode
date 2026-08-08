# Stonecode Docs

## Read Order

1. `HANDOFF.yaml`
2. `PROJECT.md`
3. `TASKS.md`
4. `DECISIONS.md`
5. `project-architecture.md`
6. `AI_COURSE_GENERATION_RULES.md`
7. `superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`
8. `superpowers/plans/2026-06-18-stonecode-mvp.md`

## Current Direction

Stonecode is an IDE-first AI computing tutor for self-taught beginners. New learning starts as Course, Guided Project, or Exercise Pack. Legacy `short_course` data remains readable but new compact learning generates as Course.

Discovery asks about the learner's goal, background, depth, and preferences. It does not test knowledge. The learner edits a concrete proposal and sees its deterministic Stone quote before creation. Finalization reserves Stones and queues a persisted background generation job. Courses open once two fully validated launch modules are durable; setup then reports 100% ready while later approved modules continue from server checkpoints. Navigation remains sequential, and finished modules are never regenerated on recovery.

The center workspace exposes only Code, Output, and Terminal. Browser results stay in Output. Console/Judge0 results stay in Terminal. Optional teaching diagrams/images appear inside tutor chat and open in an accessible enlarged viewer; there is no Whiteboard tab.

Free starts with 10 permanent registration Stones, one active path, 50 tutor replies/month, 5 AI images/month, and 20 Judge0 actions/day. Pro is $9/month with 100 expiring Stones/billing cycle, 10 active paths, 500 tutor replies/month, 50 AI images/month, and 100 Judge0 actions/day. Browser runs are unlimited. Stonecode does not accept user-supplied OpenAI keys.

The launch catalog now enables 21 runnable technologies; Julia remains hidden because the configured Judge0 lacks it. All 22 language corpora are reviewed and score 1.00 relevance with zero leakage. Programming is joined by Computer/IT Fundamentals, Internet/Web Fundamentals, Algorithms & Data Structures, and Math for Programmers; those four domain corpora remain pending review. Availability is server-authoritative and requires matching manifests plus approved isolated RAG, editor, grading, and runtime checks.

Marketplace publishing creates immutable versioned snapshots. Owners may unpublish separately from deleting their private source. Cloning costs one Stone.

## Local Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run verify:production-foundation
npm run verify:plan-limits
npm run verify:structured-tutor-tools
npm run verify:chat-visuals
npm run verify:marketplace
npm run verify:rag-corpora
npm run verify:rag-ingestion
npm run verify:local-load
npm run verify:authenticated-api
npm run verify:tutor-flow
npm run verify:response-stream
npm run verify:usage-summary
npm run verify:execution-sandbox
npm run verify:runtime-matrix
npm run verify:launch-matrix
```

Additional verifier scripts are listed in `package.json`. `verify:supabase` and authenticated QA touch configured external state; run them only against the intended environment.

## Production Gate

The local candidate is implemented but not deployed. Before enabling flags:

1. Apply the 2026-08-01 Luna accounting migration; ingest/review/evaluate four domains and enable their manifests. The 21 runnable technologies are enabled and Julia is approved but hidden pending runtime. Obtain legal clearance for the recorded Dev.java terms or replace that Java source.
2. Replace test billing credentials with live Stripe values, production webhook/portal URLs, support/alert routing, and legal/security/provider-alert sign-offs.
3. Run production-like local certification, including the paid 75-path live generation matrix only after explicit spend approval.
4. Obtain separate commit/push/deploy approval and deploy directly to Netlify Production.
5. Run automated smoke/metadata/billing/security checks immediately and roll back on a critical failure.

See `PRODUCTION_RUNBOOK.md`, `STRIPE_SETUP.md`, `JUDGE0_SETUP.md`, `RAG_OPERATIONS.md`, `SECURITY_NOTES.md`, and `HANDOFF.yaml` for operational detail.
