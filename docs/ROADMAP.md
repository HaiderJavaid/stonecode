# Stonecode Roadmap

## Stage 1: Product Prototype

Status: done.

- React shell.
- stone IDE visual direction.
- course cards and workspace layout.

## Stage 2: Persistent Workspace

Status: done.

- course-scoped file tree.
- CodeMirror editor.
- local file/chat/progress persistence.
- tutor context builder.
- browser Worker lesson runner.

## Stage 3: SaaS Refactor

Status: active.

- component and hook split.
- real routing.
- required app/account/legal/support pages.
- Supabase/Stripe scaffolds.

## Stage 4: Auth + Persistence

Status: done.

- Supabase Auth.
- Postgres-backed courses, files, chat, progress.
- route protection.
- user data isolation.

## Stage 5: Billing + Limits

Status: done.

- Stripe checkout.
- billing portal.
- webhook subscription sync.
- server-side plan limits.
- subscription state loading in dashboard/settings.

## Stage 6: AI Production Safety

Status: active.

- authenticated tutor endpoint. Done.
- usage tracking. Done.
- streaming. Done.
- provider routing for OpenAI/OpenRouter. Done.
- direct AI file edits and terminal tool execution. Next.
- undo/history and safe command limits.
- evals and observability.

## Stage 7: Progression + Retention

Status: planned.

- completion tracking for tasks, lessons, and courses.
- AI-estimated XP based on difficulty, level, and demonstrated completion.
- collectible AI-generated badges tied to skills, streaks, projects, and milestones.
- learner levels that unlock more hints, exercises, review prompts, and guided challenges.
- visible profile/progress surfaces that make the subscription feel valuable beyond raw chat access.

## Stage 8: Course Library + Marketplace

Status: future option.

- let users publish finished courses as reusable course templates.
- allow other users to star, favorite, and replicate published courses into their own workspace.
- support both AI-generated courses and user-authored/shared courses.
- explore trust/safety and quality signals before public publishing: moderation, visibility controls, course previews, ratings, and report flow.
- evaluate monetization options after beta learning behavior is clearer: freemium limits, per-course generation credits, paid hint packs, premium replicated courses, or creator rewards.

## Stage 9: Paid Beta Launch

Status: planned.

- support/legal polish.
- app-wide navigation polish for dashboard, workspace, profile, billing, usage, support, privacy, and terms.
- mobile/responsive QA.
- deployment pipeline.
- production sandbox decision.
