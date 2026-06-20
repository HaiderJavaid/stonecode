# Stonecode Session

## Date

2026-06-20

## Latest Direction

Stonecode is now planned as a focused paid beta SaaS for self-taught beginners.

Chosen stack:

- Vite + React + TypeScript.
- Supabase Auth/Postgres.
- Stripe billing.
- OpenAI tutor endpoint.

## Latest Work

- Added `react-router-dom`.
- Added `src/App.tsx` with routes for landing, auth, dashboard, course workspace, settings, legal, and support pages.
- Refactored the old monolithic workspace into components/hooks:
  - `CourseWorkspace`
  - `DashboardPage`
  - `CourseCard`
  - `FilePanel`
  - `WorkspaceFileTree`
  - `RunTerminal`
  - `useCourseWorkspace`
  - `useTutorChat`
  - `useTerminalRunner`
- Preserved localStorage workspace behavior.
- Added Supabase client/schema scaffolding.
- Connected Supabase Auth forms, protected app/settings/course routes, and sign-out.
- Changed first-login product behavior: no default seed courses; users add a learning course through a guided setup card with favorite suggestions.
- Finalize now creates a course shell only; Start project creates folders plus `README.md` and opens the learning chat.
- Setup is now rendered outside the course-list stack, hides the launcher while active, and expands as a full-height learning-chat card.
- Setup suggestions no longer include a heading; they reveal after the assistant typing animation finishes.
- Setup assistant text, built-in lesson assistant text, and tutor replies now pause briefly before typing.
- File tree now uses VS Code-style colored glyph icons and drag/drop movement with root/folder drop zones and nested visual sorting.
- Added Stripe checkout, portal, and webhook route scaffolds.
- Updated docs to production SaaS direction.

## Current Risks

- Database persistence is scaffolded, but active app still uses localStorage.
- Guided setup generation is local deterministic logic, not AI-backed yet.
- Stripe routes need env vars, auth/customer mapping, and webhook persistence.
- `/api/tutor` is not auth-gated or usage-tracked yet.
- OpenAI quota previously returned 429.

## Next Work

1. Move courses/files/chat/progress to Supabase.
2. Persist setup/finalize/Start project flow in Supabase.
3. Replace local setup generator with AI-backed course plan and README generation.
4. Persist Stripe webhook events into `subscriptions`.
5. Auth-gate `/api/tutor` and record `usage_events`.
