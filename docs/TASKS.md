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
- Supabase-backed course/file/folder/chat/progress persistence code added with local fallback.
- Empty dashboard and guided course setup flow added locally.
- Start project initializes only folders and `README.md`.
- Auth transition checkpoint branches created for comparing saved states.
- Current WIP branch `work/auth-transition-from-06` created from checkpoint 06.
- Login startup/load-in fade and zoom sequence accepted by product lead.
- First dashboard animation optimization pass completed without changing the accepted login zoom.
- Right panel/add-course reveal now mounts after auth zoom with a preload gap, waits for workspace readiness, then animates from the right.
- Course selection panel defers heavier chat/Markdown/typewriter content until the panel shell animation finishes.
- Live verifier script now proves `workspace_folders` is the only missing persistence table in the current Supabase project.

## Current Stage: Production SaaS Foundation

- [x] Connect Supabase Auth to login/signup/forgot-password pages.
- [x] Create authenticated route guard.
- [x] Replace mock courses with user-owned Supabase courses in code.
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
- [x] Persist workspace files to `workspace_files` in code.
- [x] Persist workspace folders to `workspace_folders` in code.
- [x] Persist chat to `chat_messages` in code.
- [x] Persist progress to `course_progress` in code.
- [ ] Apply live Supabase `workspace_folders` migration and rerun verifier.
- [x] Finish accepted startup/load-in fade through login zoom.
- [x] Diagnose right panel/add-course area reveal stutter after login zoom.
- [ ] Continue dashboard component animation optimization and real-session QA.
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
- [ ] seamless login-to-dashboard animation with no code-box refresh or brightness cut.
- [ ] create course.
- [ ] open course workspace.
- [ ] edit file and refresh restore.
- [ ] send tutor message.
- [ ] plan limit blocks extra active course.
- [ ] billing portal opens for subscribed user.
- [ ] privacy/terms/support pages exist.
