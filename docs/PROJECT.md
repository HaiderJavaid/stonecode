# Stonecode Project

## Purpose

Stonecode is a production-oriented AI computing tutor for self-taught beginners. It combines conversational curriculum design, a persistent IDE, guided instruction, verified practice, and progression.

## Current Experience

1. Register and enter Free automatically.
2. Start Course, Guided Project, or Exercise Pack discovery.
3. Answer contextual questions about goal, background, scope, and preferences; free typing is always available.
4. Edit the proposed syllabus/project/exercise list and review the deterministic Stone quote.
5. Finalize, reserve Stones, and resume a persisted background generation job.
6. For Courses, persist only after every approved module is generated and passes quote-to-delivery validation; partial generation releases the reservation.
7. Open a saved path on its overview/progress home, then Start/Resume into the three-panel workspace with modules/files, Code/Output/Terminal, and grounded tutor chat.
8. Apply or reject structured tutor patches, run/check work, receive optional chat visuals, and preserve progress.
9. Publish eligible generated paths to Marketplace or clone an immutable template for one Stone.

## Plans

- Free: $0, 10 permanent registration Stones, 1 active path, 50 tutor replies/month, 5 AI images/month, 20 Judge0 actions/day.
- Pro: $9/month, 100 expiring Stones/billing cycle, 10 active paths, 500 tutor replies/month, 50 AI images/month, 100 Judge0 actions/day.
- Browser execution is unlimited. Stones are not charged for tutoring, grading, execution, or visuals.

## Technology Boundary

The reviewed catalog retains 22 technologies and six pinned browser libraries. The expansion target exposes all 21 runnable technologies and keeps Julia hidden until Judge0 provides it. Stonecode also supports four reviewed computing domains: Computer/IT Fundamentals, Internet/Web Fundamentals, Algorithms & Data Structures, and Math for Programmers. Algorithms/math and every practical Project/Exercise path require a selected runnable technology; conceptual IT/internet Courses do not invent execution.

Runtime visibility is server-authoritative. Editor support alone is insufficient: enabled manifest, grading, runtime discovery, and approved isolated RAG are also required.

## Persistence And Providers

- Supabase Auth and user-owned course/workspace/chat/progress data.
- Supabase credit ledger, learning proposals, generation jobs, technology/RAG records, tutor visuals, and Marketplace snapshots.
- Stripe subscription state and active Pro billing-cycle grants.
- OpenAI Responses/Image APIs through Stonecode-owned server configuration.
- Judge0 for approved headless console execution; browser sandbox for reviewed web output.
- Netlify background function for generation jobs.

## Current State

The expansion is implemented locally behind the existing flags. Static checks cover 21 technologies × three modes plus 12 valid domain/mode combinations. The 2026-08-01 learning-domain migration is applied; the database still has five enabled and 17 rejected technology manifests, with four domain manifests pending review and no approved domain corpora yet. Source review/evaluation, the Luna cache-write migration, live Stripe/alerts/sign-offs, paid generation QA, and post-deploy QA remain.

Local dashboard UX now includes an authenticated remaining-Stones widget with corrected stacked Stonecode marks, compact newest-first dated cards with one-line titles, balanced outer content padding, and inline progress, a bounded scrolling card list, synchronized reversible expansion, one contextual Back action plus X close, home-first reopening with the default dashboard IDE preserved until Resume or file selection, and a reversible delayed Marketplace transition. The runtime Terminal uses a legible charcoal stone surface, refined monospace output, and existing progress-green semantic accents. Proposal creation uses the compact `Generate` + Stone mark + quote pattern.

Current branch: `codex/reactbits-side-rays-bg`.

Do not commit, push, deploy, or apply a live migration without explicit approval.
