# Project Architecture

## Current Stack

- Vite
- React
- TypeScript
- React Router
- CodeMirror 6
- Node HTTP app server
- Supabase client/schema scaffold
- Stripe server endpoint scaffold
- OpenAI Responses API adapter for tutor streaming

## Current Entry Points

- `src/main.tsx` mounts `App`.
- `src/App.tsx` owns routes.
- `src/components/stonecode/StonecodePrototype.tsx` is the routed workspace shell.
- `server/stonecode-server.mjs` serves the app and API routes.

## Active Product Routes

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/dashboard`
- `/courses/:courseId`
- `/settings/profile`
- `/settings/account`
- `/settings/billing`
- `/settings/usage`
- `/privacy`
- `/terms`
- `/support`

## Workspace Source Map

- `CourseWorkspace`: file panel + IDE + terminal surface + Code/Visual editor preview toggle.
- `DashboardPage`: course launcher/cards.
- `CourseCard`: course details/progress/tutor panel.
- `FilePanel` and `WorkspaceFileTree`: course tree navigation and file navigation.
- `RunTerminal`: browser Worker run output for browser-runnable JavaScript only.
- `editorLanguages`: shared editor language registry for syntax loading, generated file defaults, visual preview support, and run capability.
- `useCourseWorkspace`: active course, files, folders, local persistence.
- `useTutorChat`: tutor requests, chat messages, AI file-edit parsing, and AI run triggers.
- `useTerminalRunner`: safe active-file browser Worker execution state.
- `CourseHome`: finalized-course overview and primary navigation.
- `IndependentExercisePanel`: direct-practice interaction.
- `exerciseSession`: local daily allowance and per-exercise state until backend enforcement exists.

Independent exercise session state currently uses the account-wide localStorage key `stonecode.exerciseSession.v1`. This is interaction scaffolding, not a security or billing boundary.

## Current Data Flow

```txt
Supabase Auth
-> useCourseWorkspace
-> Supabase-backed course/files/folders/chat/progress storage
-> local fallback only when Supabase is unavailable
-> CodeMirror editor
-> browser Worker terminal for JavaScript / visual preview for HTML, CSS, and browser JavaScript
-> useTutorChat
-> /api/tutor
-> LLM provider adapter
-> OpenAI Responses API
-> optional AI file edit blocks applied to workspace state
-> optional active-file browser Worker run trigger
-> usage_events
```

## Target Data Flow

```txt
Supabase Auth
-> authenticated routes
-> Supabase courses/files/chat/progress
-> server-side plan limit checks
-> authenticated /api/tutor
-> direct workspace file edits with undo
-> safe active-file terminal run
-> usage_events
-> Stripe subscriptions
```

## API Routes

- `POST /api/tutor`
- `POST /api/course-generation/preview`
- `POST /api/course-generation/chapter`
- `POST /api/course-generation/commit`
- `POST /api/courses`
- `DELETE /api/courses`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/stripe/webhook`

Billing and tutor provider routes require env vars before live use. Tutor calls use `OPENAI_API_KEY` and optional `OPENAI_MODEL`.
