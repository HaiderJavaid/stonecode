# Stonecode Project

## Product

Stonecode is a subscription AI programming tutor for self-taught beginners.

The core value is a persistent course workspace:

- dashboard starts empty for new users.
- user starts one AI conversation and chooses a full course, short course, coding practice, or guided project.
- discovery asks only missing questions with contextual suggestions and free typing, captures prior knowledge for courses/projects, then offers an optional late assessment before confirmation.
- every confirmed experience receives its own persistent workspace, files, tutor context, and progress.
- course hierarchy is Course -> Modules -> Topics -> Blocks -> Steps.
- left panel has Modules and Files tabs; Modules shows expandable modules/topics/blocks/steps, step tiles navigate the lesson conversation, and Files keeps the existing file tree.
- Start project creates one reusable whiteboard file, then opens the learning workspace.
- course opens into curriculum/file left panel, IDE, terminal, and tutor panel.
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

Active implementation direction:

- Verified account onboarding now flows compact signup -> branded eight-digit email code -> immediate sign-in-style IDE zoom -> dashboard. Plan choice and the encrypted OpenAI-key gate are deferred until the learner starts an AI-backed learning or generation action. The auth page preserves its staged first-load reveal; login/signup switches use immediate mirrored directional transitions. Mobile recenters without horizontal overflow.
- Free key setup is dismissible for dashboard browsing, but all AI-backed entry points remain gated until the existing server credential API verifies and encrypts a key. Active/trialing paid subscriptions never receive the prompt.
- Dashboard and course-workspace backgrounds use a slightly brighter continuation of the sign-in vignette with no grain/grid. The auth handoff fades only to the workspace target darkness to avoid a bright flash; original application rays remain unchanged, while stone texture stays on panels and cards.
- The auth preview IDE uses the dashboard editor's exact surface, border, shadow, and code lighting through the zoom handoff. The dashboard learning list fills the lane down to Settings, with a full-height centered empty-state card and inline Start learning action.

- `course-content/v2` personalized generation is implemented locally from `docs/superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md`.
- Universal learning orchestration now dispatches confirmed briefs to course, short-course, exercise, or guided-project generators while keeping existing course generation behind the course branch.
- Practice discovery now resolves purpose, whole-language versus topic scope, exact count, and coding/MCQ split; the default is ten exercises with a mostly-coding proposal and an editable compact review.
- Generated exercise sessions are pure independent practice with exact validated MCQ/code counts and no theory or workshop blocks.
- Progression now models a primary technology, parent language, topics, and domains per verified exercise. The Settings solved chart uses skill percentages while Language XP remains the base-language view.
- Configurable title badges now cover Frontend Developer, Backend Engineer, Game Developer, Mobile Developer, and Full-stack Developer using completed-program plus verified-XP gates.
- Guided project and workshop are one experience: a single generated project module with a 1–3-step project orientation/refresher, one continuous 10–20-step micro-edit build, and a 1–2-step finished-code recap.
- Prerequisite assessment is optional, offered only after conversational discovery has captured the learner's goal, stack, outcome, and prior knowledge; it is capped at three questions.
- Courses are generated fresh per learner; deterministic code defines the curriculum contract rather than storing a hard-coded course library.
- Standalone language fundamentals do not need assessment. Frameworks, libraries, advanced specializations, and applied paths may offer the optional prerequisite check.
- Course discovery resolves vague outcome-first requests into specific teachable targets before applying that assessment policy.
- Initial generation fills Module 1 only, and the learner keeps the explicit Finalize action.
- Finalized generated courses open with module/topic/block/step navigation in the left panel Modules tab, not the old Course Roadmap button.
- Generated course block kinds are explicit: `theory`, `quiz`, `workshop`, `lab`, `project`, and `review`.
- Scratch workshops begin blank/minimal and teach one exact code delta per step; preloaded code is reserved for repair/add-feature tasks. Native visual builds carry a source-linked synchronized scene while Terminal remains the real runtime.
- Existing and future lightweight visual steps can receive a deterministic preview repair for browser Canvas, Pygame/Turtle/Tkinter/Matplotlib, raylib/SDL/SFML, Java/.NET 2D, and simple mobile UI representations. Visual recomputes from current source without Terminal; Unity-class external engines are excluded.
- Assessment MCQs can include course-shaping language/library/tool preferences; those answers customize the course and are not graded.
- Course generation now avoids a fixed concept -> analogy -> example template, keeps assessment recommendations visible in the generated modules, and normalizes MCQ answer positions away from A/B bias.
- Course generation now fully loads/unlocks module 1, leaves later modules as locked shell buttons, and requires exercise context/checklists tied to the just-taught topic.
- Course generation retries incomplete JSON, repairs warned topics concurrently without rewriting unrelated blocks, and returns to the assessment review on unrecoverable output instead of saving recovery content.
- Editor language support is centralized in `src/services/editorLanguages.ts`; syntax/file defaults cover JS/TS/Python/HTML/CSS/SQL/Java/C/C++/C#/Go/Rust/PHP/Ruby/Swift/shell/YAML/XML/Vue/Svelte-style files. Browser Run remains JavaScript-only until a backend sandbox exists.
- Course challenges remain unlimited and affect course completion.
- Independent exercises use different scenarios and do not affect course completion; the freemium boundary is three generated experiences per month rather than a daily completion limit.
- Free users connect an OpenAI key stored with server-side AES-256-GCM encryption. Basic and Pro continue through Stonecode-funded provider configuration.
- The public landing retains the existing section flow and stone direction while replacing DSA positioning, unsupported social proof, fake statistics, and placeholder media with the current personalized learning product.

Implemented on 2026-06-25:

- Three-step guided setup with an amendable structured proposal.
- Course home with summary, progress, languages, tags, and Start/Resume actions. Practice is a standalone conversation, not a nested course action.
- Roadmap navigation backed by the course syllabus.
- Curated independent JavaScript, CSS, and Python scenarios.
- Local account-wide exercise limits, one daily skip, one hint per exercise, repeatable Run, Next after success, and mock XP feedback.

Implemented locally on 2026-06-26:

- Shared opaque stone surfaces now drive workspace/dashboard cards and the settings left, middle, and right panels.
- Settings Overview is now a progression overview with profile quick details, solved exercises, First Steps, yearly XP heatmap, language filtering, language XP, course completions, streaks, title, and sync state.
- Added server-authoritative progression contracts for independent exercises, course MCQs, and AI-graded chat exercises.
- Added idempotent XP awards, persisted daily limits/hints/skips, First Steps title selection, section completion, and current-user progression reset.
- Added the `2026-06-26-add-progression.sql` migration. It is not applied to the live project yet.
- Fixed live progression API/schema mismatches discovered during QA: `user_badges.badge_key` handling, stale completion RPC removal, and `lesson_view="exercises"` persistence normalization.
- Added real AI tutor request kinds for first-open lesson intros and exercise hints, plus generated chat metadata and daily exercise hint dates.
- Reworked independent Exercises to use the same course chat panel layout and AI hint composer.
- Added AI course-generation preview endpoints, generated chapter/section/block content, generated MCQ/code exercise rendering, editor-submitted code exercises, locked future roadmap sections, and lazy chapter generation hooks.
- On 2026-06-30, product direction changed to personalized freeCodeCamp-style course generation with adaptive assessment before course creation.
- On 2026-07-02, v2 course generation, left-panel module tree UI, explicit block-kind rules, course-shaping assessment MCQs, OpenAI-only routing, and reusable IDE whiteboard behavior were implemented locally and verified with targeted commands.
- Later on 2026-07-02, the generated-course prompt was loosened to support varied theory structure, block-kind sanitation was added, repeated topic greetings were removed, and MCQ answer-position bias was reduced in prompts/fallbacks/normalization.
- On 2026-07-03, left-panel course step navigation, two-module generation, language-aware exercise files, block-level progress, dynamic editor checklists, and the Code/Visual editor toggle were added locally.

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
- Start project initializes only one reusable whiteboard file.
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
- Authenticated tutor calls, usage event tracking, streaming transport, and OpenAI Responses API routing.
- Direct AI file edits, last-edit undo, and safe active-file terminal execution from AI chat.
- Dashboard-integrated settings routes for overview, profile, billing, usage, security, and support.
- Public landing, support, privacy, and terms surfaces in the stone-textured visual system.
- Tutor panel now supports theory, chat-answer exercises, multiple choice, terminal exercises, and visual canvas/code blocks.
- Tutor exercises carry language, difficulty, and XP metadata; persistence and award rules remain future backend work.
- Tutor chat now accepts spaces, Enter submits, and Shift+Enter creates a new line.
- CodeMirror syntax support now lazy-loads JavaScript/TypeScript, Python, HTML, CSS, JSON, Markdown, SQL, Java, C/C++, C#, Go, Rust, PHP, Ruby, Swift, shell, YAML, XML, and Vue/Svelte-style markup.
- File tree icons cover common web, systems, scripting, JVM, database, and text formats.

Not done:

- Live-applied and verified generated course-content migration.
- Task-based model router and static-first RAG abstraction.
- Live-applied and verified XP/streak/badge/exercise persistence; implementation exists locally but migration is pending.
- Dashboard polish requested next: stop tab/window-focus refresh/reanimation, replace dropdown account controls with direct Settings Overview account buttons, clamp course-card summaries, and make course-card progress derive from real course state.
- Production hardening for generated exercise grading beyond the initial generated MCQ/editor submission flow.
- Better AI tool feedback and broader authenticated rendered QA for the v2 generated-course flow.
- production code sandbox.
- final rendered QA for the auth transition.
- authoritative server persistence and grading for independent exercise attempts, hints, skips, completions, and XP.
- profile activity heatmap and per-language challenge analytics.
- server-authoritative exercise generation, execution, grading, quotas, and XP awards.

## Direction

Refactor toward a SaaS product without losing the IDE-first experience. Do not replace the product with a marketing dashboard. The dashboard and course workspace remain the primary app surfaces.

## Current Branch State

- Active branch: `setting-page-redesign`.
- Base checkpoint: `checkpoint/06-persistent-terminal-reveal` at `9c5e457`.
- Do not commit or push unless explicitly asked.
