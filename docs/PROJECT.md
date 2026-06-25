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
- progression should eventually feel game-like: course/task completions grant XP, badges, levels, and unlockable learning help.
- later, completed courses may become reusable artifacts: users can publish, star/favorite, and replicate courses made by themselves or others.

## Paid Beta Target

Launch scope: focused paid beta.

Required before selling:

- Supabase login/signup/password reset.
- user-bound courses, files, chat, progress, and settings.
- Stripe checkout, billing portal, subscription sync, and plan limits.
- authenticated tutor endpoint with usage tracking.
- direct AI file edits with undo/history and safe execution limits.
- clear in-app navigation between dashboard, workspace, profile/account/billing/usage, and support/legal pages.
- basic support, privacy, and terms pages.

## Current State

Active implementation:

- Guided onboarding will collect objective, level, and practical outcome before proposing a structured syllabus.
- Finalized courses will open to a course home with progress, languages, tags, roadmap navigation, and an independent Exercises lane.
- Course challenges remain unlimited and affect course completion.
- Independent exercises use different scenarios, are locally limited by plan for the initial UI, and do not affect course completion.

Implemented on 2026-06-25:

- Three-step guided setup with an amendable structured proposal.
- Course home with summary, progress, languages, tags, and Start/Resume, Exercises, and roadmap actions.
- Roadmap navigation backed by the course syllabus.
- Curated independent JavaScript, CSS, and Python scenarios.
- Local account-wide exercise limits, one daily skip, one hint per exercise, repeatable Run, Next after success, and mock XP feedback.

Done:

- Vite + React + TypeScript app.
- stone-textured IDE direction.
- routed app shell with required placeholder pages.
- course dashboard/workspace flow.
- localStorage persistence.
- CodeMirror editor.
- browser Worker lesson runner.
- server-side provider-backed tutor endpoint.
- Supabase schema scaffold.
- Supabase login/signup/password reset and route guard.
- empty dashboard plus local guided course setup flow.
- Start project initializes only folders and `README.md`.
- setup renders outside the course-list stack and uses the same full-height learning chat layout as course conversations.
- file tree supports VS Code-style colored glyphs and local drag/drop moves.
- Authenticated Stripe checkout, billing portal customer mapping, and webhook subscription sync.
- Billing settings has Basic checkout, Pro checkout, and billing portal actions.
- Supabase-backed course, workspace file/folder, chat, and progress persistence code with local fallback.
- Live Supabase persistence verification passes, including `workspace_folders`.
- Server-side `/api/courses` creates courses with authenticated Free plan limits.
- Server-side `DELETE /api/courses` archives active user courses for Reset demo.
- Server-side `/api/subscription` loads authenticated Free/Basic/Pro plan state for dashboard/settings UI.
- Setup finalize now shows server errors instead of silently closing on failed course creation.
- Auth onboarding/login-to-dashboard transition polish is committed on `main`.
- Real Stripe checkout, portal, and webhook smoke QA passed; product lead manually verified Pro checkout.
- Authenticated tutor calls, usage event tracking, streaming transport, and OpenRouter dev/test provider routing.
- Direct AI file edits, last-edit undo, and safe active-file terminal execution from AI chat.
- Dashboard-integrated settings routes for overview, profile, billing, usage, security, and support.
- Public landing, support, privacy, and terms surfaces in the stone-textured visual system.
- Tutor panel now supports theory, chat-answer exercises, multiple choice, terminal exercises, and visual canvas/code blocks.
- Tutor exercises carry language, difficulty, and XP metadata; persistence and award rules remain future backend work.
- Tutor chat now accepts spaces, Enter submits, and Shift+Enter creates a new line.
- CodeMirror syntax support now lazy-loads JavaScript/TypeScript, Python, HTML, CSS, JSON, Markdown, SQL, Java, C/C++, and PHP.
- File tree icons cover common web, systems, scripting, JVM, database, and text formats.

Not done:

- AI-backed course setup generation for course shell and README content.
- Persisted XP awards, streaks, badge eligibility, and per-language/category progress.
- Production schema/protocol for model-generated MCQ choices and interactive tutor blocks.
- Better AI tool feedback and broader authenticated rendered QA.
- production code sandbox.
- final rendered QA for the auth transition.
- authoritative server persistence and grading for independent exercise attempts, hints, skips, completions, and XP.
- profile activity heatmap and per-language challenge analytics.
- server-authoritative exercise generation, execution, grading, quotas, and XP awards.

## Direction

Refactor toward a SaaS product without losing the IDE-first experience. Do not replace the product with a marketing dashboard. The dashboard and course workspace remain the primary app surfaces.

## Current Branch State

- Active branch: `main`.
- Base checkpoint: `checkpoint/06-persistent-terminal-reveal` at `9c5e457`.
- Do not commit or push unless explicitly asked.
