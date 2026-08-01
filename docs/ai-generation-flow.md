# AI Generation Flow

## Current Flow

1. `POST /api/learning/discovery-turn`
   - Conversationally resolves goal, relevant experience, depth, and preferences.
   - Returns contextual answer suggestions while free typing remains available.
   - Never asks onboarding knowledge tests.

2. `POST /api/learning/proposals`
   - Validates the normalized brief, plan allowance, technology scope, runtime capability, and proposal daily limit.
   - Generates and persists an editable `LearningProposalV1`.
   - Calculates a deterministic server-owned credit quote.

3. `PATCH /api/learning/proposals/:id`
   - Applies validated learner edits.
   - Recomputes the deterministic quote from normalized scope.

4. `POST /api/learning/proposals/:id/finalize`
   - Revalidates ownership, active-path entitlement, quote, and available balance.
   - Reserves credits atomically.
   - Creates an idempotent queued generation job.

5. Netlify background worker
   - Claims the job.
   - Generates the approved Course, Guided Project, or Exercise Pack.
   - For a Course, constrains an outline to the exact proposal and generates every module through a separate bounded call.
   - Validates technology, structure, counts, progression, files, surfaces, and optional visual cues.
   - Persists the course and settles the reservation on success.
   - Persists failure and releases the reservation on failure.

6. `GET /api/generation-jobs/:id`
   - Lets the client poll, refresh, and resume without duplicating work or charges.

## Runtime And RAG Gate

A proposal is creatable only when its resolved technology has editor support, an enabled matching manifest, grading support, an approved browser/Judge0 runtime, and an enabled isolated RAG corpus. Normal retrieval excludes draft corpora.

## Legacy Compatibility

Old assessment and direct-generation endpoints remain callable for saved clients but are no longer used by current setup UI. Observe calls for two releases before removal. Legacy `short_course` remains readable; current creation normalizes it to Course.

## Failure Guarantees

- Proposal generation does not spend creation credits.
- Finalization is idempotent.
- Generation retry cannot double-reserve or double-settle.
- Failed/expired jobs release reservations.
- Deleting a completed path does not refund credits.
- Invalid or generic fallback content is not persisted as success.
- A Course with missing modules, fewer than six meaningful steps in a module, or a delivered scope above its approved quote band is not persisted or settled.
