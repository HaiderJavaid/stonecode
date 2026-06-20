# Stonecode Tasks

## Completed

- Prototype converted to React.
- Course workspace model added.
- Local persistence added for selected course, files, chat, and lesson state.
- CodeMirror IDE editor added.
- Server-side `/api/tutor` endpoint added.
- Browser Worker lesson runner added.
- Required SaaS routes added as placeholders.
- Major UI/state refactor started:
  - `src/App.tsx`
  - `CourseWorkspace`
  - `DashboardPage`
  - `FilePanel`
  - `WorkspaceFileTree`
  - `CourseCard`
  - `RunTerminal`
  - `useCourseWorkspace`
  - `useTutorChat`
  - `useTerminalRunner`
- Supabase schema scaffold added.
- Stripe checkout, billing portal, and webhook endpoints scaffolded.
- Supabase Auth provider, login/signup/reset forms, protected routes, and sign-out added.
- Empty dashboard and guided course setup flow added locally.
- Start project initializes only folders and `README.md`.

## Current Stage: Production SaaS Foundation

- [x] Connect Supabase Auth to login/signup/forgot-password pages.
- [x] Create authenticated route guard.
- [ ] Replace mock courses with user-owned Supabase courses.
- [x] Stop showing seed courses on first login.
- [x] Add guided local "what do you want to learn?" course setup.
- [x] Make finalize create a course shell without files.
- [x] Make Start project initialize folders and `README.md`.
- [x] Render setup outside the course-list stack and hide the launcher while setup is active.
- [x] Make setup use the full-height learning chat card behavior.
- [x] Add delayed typing animation to setup, lesson assistant text, and tutor replies.
- [x] Add VS Code-style colored file glyphs.
- [x] Add drag/drop file and folder moves with root/folder drop zones and nested visual sorting.
- [ ] Replace local setup finalization with AI-backed course generation.
- [ ] Persist workspace files to `workspace_files`.
- [ ] Persist chat to `chat_messages`.
- [ ] Persist progress to `course_progress`.
- [ ] Sync Stripe webhook events to `subscriptions`.
- [ ] Add Stripe billing portal customer mapping.
- [ ] Enforce Free/Basic/Pro limits server-side.
- [ ] Record AI usage in `usage_events`.
- [ ] Block unauthenticated `/api/tutor` calls.
- [ ] Add streaming tutor response transport.
- [ ] Add apply/reject AI edit flow.
- [ ] Add ESLint 9 config or remove lint script.

## Paid Beta QA

- [ ] signup/login/logout.
- [ ] create course.
- [ ] open course workspace.
- [ ] edit file and refresh restore.
- [ ] send tutor message.
- [ ] plan limit blocks extra active course.
- [ ] billing portal opens for subscribed user.
- [ ] privacy/terms/support pages exist.
