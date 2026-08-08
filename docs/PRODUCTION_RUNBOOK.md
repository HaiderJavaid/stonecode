# Stonecode Production Runbook

## Release gate

Never apply a production migration, commit, push, or deploy without the product owner's explicit approval.

Before a release:

1. Create a Supabase backup or confirm point-in-time recovery. Record the restore point and test restore access in a non-production project.
2. Apply migrations in filename order. The current pending migration is `supabase/migrations/2026-08-01-gpt-5-6-luna-cache-accounting.sql`; the learning-domain migration is already applied.
3. Configure the environment from `.env.example`. Production requires live Stripe credentials and HTTPS Stonecode return URLs; never copy sandbox Stripe credentials into Production.
4. Configure `VITE_SUPPORT_EMAIL`. Configure `STONECODE_ALERT_WEBHOOK_URL` for server error alerts. Keep `STONECODE_INTERNAL_JOB_SECRET` server-only and at least 32 random characters.
5. Run `npm run typecheck`, `npm run lint`, `npm run build`, and the verifier set below.
6. Create an approved Deploy Preview. Test the preview before promoting the same artifact to Production.

## Required local verification

```bash
npm run verify:production-foundation
npm run verify:learning-orchestrator
npm run verify:generated-course-content
npm run verify:launch-matrix
npm run verify:ai-costs
npm run verify:account-safety
npm run verify:atomic-usage-limits
npm run verify:structured-tutor-tools
npm run verify:chat-visuals
npm run verify:course-deletion
npm run verify:tutor-flow
npm run verify:response-stream
npm run verify:usage-summary
npm run verify:execution-sandbox
npm run check:production
```

`verify:launch-matrix` is a dry contract check. `verify:launch-matrix:live` makes paid AI requests across 15 language/mode combinations; run it only after the cost migration is applied and the owner approves the spend.

## Health and monitoring

- `GET /api/health/live`: process liveness only.
- `GET /api/health`: database and required provider configuration readiness. A degraded response is HTTP 503.
- Every API response has `X-Request-ID`. JSON errors include `traceId`.
- Unhandled server errors are emitted as structured JSON. If `STONECODE_ALERT_WEBHOOK_URL` is configured, the same redacted event is posted to that receiver.
- Check Netlify function failures/latency, Supabase database/storage/auth health, Stripe webhook failures, OpenAI spend/rate limits, and RapidAPI Judge0 usage/latency.
- Alert on generation failure rate, jobs running over 20 minutes, credit reservations over 90 minutes, 401/409/429/5xx spikes, Stripe webhook failures, and daily provider spend.

## Generation economics

The `2026-07-31` migration stores model token usage and estimated API cost in micro-USD per generation job. It also stores Stones charged and the nominal subscription-funded Stone allocation. Run:

```bash
npm run report:generation-economics
npm run report:generation-economics -- --limit=100
```

The report rolls the free proposal call and every generation/repair attempt into the resulting job. It shows cost per Stone, break-even Pro Stones, AI share of nominal Pro revenue, and nominal coverage using `$9 / 100 = $0.09` per subscription Stone. Registration Stones have zero nominal revenue. The comparison excludes Stripe fees, tax, images, Judge0, hosting, storage, support, and tutor usage, so it is not net margin.

Review pricing whenever the configured OpenAI model or provider pricing changes. Update `server/billing/ai-costs.mjs` with a new version instead of rewriting historical estimates.

## Preview and production QA

Verify on the real deployed origin:

1. Signup/login/recovery/logout and session expiry.
2. Discovery from sparse and complete prompts; suggestions match the visible question and finish within seven useful questions.
3. Course, Guided Project, and Exercise Pack quote, reservation, background generation, refresh/resume, and failure release.
4. All 21 enabled technologies: 18 Judge0 languages plus JavaScript/HTML/CSS browser execution, grading, and isolated RAG provenance. Confirm Julia remains unavailable.
5. Tutor patch Apply/Reject/Undo, traversal attempts, visual ownership/cache/fallback, and course/account deletion.
6. Free and Pro limits, live Stripe checkout, webhook sync, renewal idempotency, portal cancellation, and failed-payment behavior.
7. Marketplace lifecycle in a separate pass without changing its rollout state during unrelated hardening.
8. Keyboard, reduced-motion, mobile widths, screen-reader labels, refresh persistence, browser back/deep links, and error/reference support flow.
9. Authenticated concurrency/rate/load tests within provider budgets.
10. Verify the live HTML metadata and that the absolute 1200x630 social image returns HTTP 200.

## Incident response

1. Record timestamp, trace ID, route, user impact, feature flag state, deploy ID, and provider status. Never put secrets or full prompts into alerts.
2. Stop new damage using the narrowest relevant feature flag or provider circuit breaker. Do not delete data to recover service.
3. Release stranded credit reservations only through the idempotent credit functions after confirming no successful course exists.
4. For billing incidents, pause promotion and use Stripe's event log as the source of truth. Replay verified webhook events only after fixing the handler.
5. For suspected credential exposure, rotate the affected server key, update the host, invalidate sessions where applicable, and review provider logs.
6. Document cause, affected records, recovery, and preventive action.

## Rollback

- Application: redeploy the previous known-good immutable artifact and restore its compatible environment variables.
- Feature behavior: turn off only the affected feature flag when that is safer than a full rollback. Preserve Marketplace's current rollout value unless the incident concerns Marketplace.
- Database: migrations are forward-only. Do not reverse schema changes ad hoc. Restore from the recorded backup only for material corruption and only after owner approval.
- Billing: never roll back Stripe events. Reconcile database state from Stripe and use idempotent grant keys.

## Backup/restore drill

At least quarterly, restore the latest Supabase backup into an isolated project, run the schema/readiness checks, open a sampled course with files/chat/progress, verify private tutor visuals, and document recovery time and missing data. Never point the restored project at live Stripe webhooks or live background jobs.
