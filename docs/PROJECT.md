# Stonecode Project

## Product

Stonecode is a subscription AI programming tutor for self-taught beginners.

The core value is a persistent course workspace:

- dashboard starts empty for new users.
- user adds what they want to learn.
- guided setup chat asks what the user wants and offers favorite ideas.
- finalize creates the course shell only.
- Start project creates folders plus `README.md`, then opens the learning chat.
- course opens into file tree, IDE, terminal, and tutor panel.
- files, chat, progress, and tutor context restore per course.
- beginner-safe guidance over generic chatbot answers.

## Paid Beta Target

Launch scope: focused paid beta.

Required before selling:

- Supabase login/signup/password reset.
- user-bound courses, files, chat, progress, and settings.
- Stripe checkout, billing portal, subscription sync, and plan limits.
- authenticated tutor endpoint with usage tracking.
- apply/reject approval before AI file edits.
- basic support, privacy, and terms pages.

## Current State

Done:

- Vite + React + TypeScript app.
- stone-textured IDE direction.
- routed app shell with required placeholder pages.
- course dashboard/workspace flow.
- localStorage persistence.
- CodeMirror editor.
- browser Worker lesson runner.
- server-side OpenAI tutor endpoint.
- Supabase schema scaffold.
- Supabase login/signup/password reset and route guard.
- empty dashboard plus local guided course setup flow.
- Start project initializes only folders and `README.md`.
- setup renders outside the course-list stack and uses the same full-height learning chat layout as course conversations.
- file tree supports VS Code-style colored glyphs and local drag/drop moves.
- Stripe checkout/portal/webhook route scaffolds.

Not done:

- database-backed persistence.
- AI-backed course setup generation for course shell and README content.
- Stripe webhook persistence.
- server-side plan enforcement.
- AI usage tracking.
- streaming tutor replies.
- production code sandbox.

## Direction

Refactor toward a SaaS product without losing the IDE-first experience. Do not replace the product with a marketing dashboard. The dashboard and course workspace remain the primary app surfaces.
