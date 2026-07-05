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
- Start project initializes only one reusable whiteboard file.
- Auth transition checkpoint branches created for comparing saved states.
- Current WIP branch `work/auth-transition-from-06` created from checkpoint 06.
- Login startup/load-in fade and zoom sequence accepted by product lead.
- First dashboard animation optimization pass completed without changing the accepted login zoom.
- Right panel/add-course reveal now mounts after auth zoom with a preload gap, waits for workspace readiness, then animates from the right.
- Course selection panel defers heavier chat/Markdown/typewriter content until the panel shell animation finishes.
- Live verifier script now proves `workspace_folders` is the only missing persistence table in the current Supabase project.
- Course creation now goes through server-side `/api/courses`, which enforces Free active-course limits before inserting.
- Reset demo now archives active Supabase courses through `DELETE /api/courses` instead of only clearing local state.

## Current Stage: Production SaaS Foundation

### Active: Personalized Course Generation V2

- [x] Implement `course-content/v2` schema: Course -> Modules -> Topics -> Blocks -> Steps.
- [x] Keep backward compatibility for existing `course-content/v1` courses.
- [x] Add adaptive assessment setup flow: subject, ready-for-assessment prompt, then one assessment exercise at a time.
- [x] Add assessment exercise types: MCQ, writing, and code/editor checks, each with Skip.
- [x] Rename the learner-facing assessment skip action to `I don't know` while preserving skip behavior.
- [x] Add course-shaping assessment MCQs for language/library/tool preferences without grading them as right/wrong.
- [x] Make assessment MCQs choose a diagnostic intent before asking: learner intention, readiness, prerequisite gap, syntax bridge, debugging mindset, or required module coverage.
- [x] Add server-side assessment stabilization so skipped/repeated prerequisite loops turn into bridge/course-shaping questions.
- [x] Generate and save the course immediately after assessment review/synthesis completes.
- [x] Insert prerequisite modules based on assessment gaps and course-shaping preferences.
- [x] Generate full course structure and fully fill the first module.
- [x] Add explicit generated block kinds: `theory`, `quiz`, `workshop`, `lab`, `project`, and `review`.
- [x] Keep one-off MCQ checks inside theory blocks and reserve quiz blocks for multi-question exam-style checkpoints.
- [x] Require generated teaching to assume zero programming/syntax knowledge unless assessment proves otherwise.
- [x] Require generated code teaching to explain new tokens, punctuation, symbols, and lines before asking the learner to use them.
- [x] Reject generated workshops shorter than a real guided tutorial instead of rendering two-step workshops.
- [x] Render language-aware workshop syntax reminders and starter-code explanations from the actual starter code.
- [x] Strip leaked internal/prompt-planning text from rendered generated lessons.
- [x] Override old generic fallback workshop context at display time so existing saved courses improve after refresh.
- [ ] Add task-based OpenAI model router: low, medium, high, reasoning, grader, embedding.
- [ ] Add static-first RAG abstraction for curriculum patterns, prerequisites, learner profile, course content, exercise bank, rubrics, official docs, and style.
- [x] Replace left-panel toolbar with `Modules` and `Files` tabs.
- [x] Render Modules tab as expandable modules -> topics -> blocks -> steps, with locked/upcoming steps greyed out.
- [x] Make course tree step tiles navigate the right-panel lesson conversation.
- [x] Keep modules 2+ as locked shell buttons until module unlocking/lazy generation is implemented.
- [x] Add block-level lesson progress and Next section/block/topic/module-boundary labels.
- [x] Keep current files/folders tree in Files tab.
- [x] Move file/folder actions into per-item triple-dot dropdown menus.
- [x] Remove Course Roadmap button and function from the right panel.
- [ ] Verify new target flow end to end with authenticated QA.

### Previous: Onboarding and Practice Flow

- [x] Collect learning objective, level, practical outcome, and include/avoid preferences in setup chat.
- [x] Generate AI-backed onboarding replies before course preview, with local fallback.
- [x] Show a structured course proposal with syllabus, languages, and tags before Finalize.
- [x] Add a course home with summary, overall progress, tags, and primary actions.
- [x] Replace the placeholder progress path with real syllabus navigation.
- [x] Add independent course-related exercises with different scenarios from lesson challenges.
- [x] Add local Free-plan behavior: two independent completions/day, one skip/day, one hint/exercise.
- [x] Keep course challenges unlimited and separate from independent exercise limits.
- [x] Add an exercise-session verifier and rendered QA.
- [x] Update project documentation after implementation.

- [x] Connect Supabase Auth to login/signup/forgot-password pages.
- [x] Create authenticated route guard.
- [x] Replace mock courses with user-owned Supabase courses in code.
- [x] Stop showing seed courses on first login.
- [x] Add guided local "what do you want to learn?" course setup.
- [x] Make finalize create a course shell without files.
- [x] Make Start project initialize a reusable whiteboard file without folders or `README.md`.
- [x] Render setup outside the course-list stack and hide the launcher while setup is active.
- [x] Make setup use the full-height learning chat card behavior.
- [x] Add delayed typing animation to setup, lesson assistant text, and tutor replies.
- [x] Add VS Code-style colored file glyphs.
- [x] Add drag/drop file and folder moves with root/folder drop zones and nested visual sorting.
- [x] Replace local setup finalization with AI-backed course generation.
- [x] Separate generated theory, MCQ, writing, and code blocks into distinct course lesson steps.
- [x] Keep theory/chat sections learner-led, with writing checks in a separate answer form and MCQ/code checks gated by completion state.
- [x] Add one-time typing animation gating for course lesson text before exercise controls and Next unlock.
- [x] Stop daily independent exercise quota from blocking required course MCQ/writing/code XP awards.
- [x] Fix lesson-intro animation crash and accept legacy generated MCQ exercise keys from existing saved courses.
- [x] Add first-lesson tutor greeting and require multiple theory sections before new-topic assessments.
- [x] Replace setup preview flow with subject -> readiness -> skippable assessment -> review -> auto-generated course.
- [x] Add `course-content/v2` modules/topics/blocks/steps with v1 compatibility.
- [x] Move generated course navigation into the left panel Modules tab.
- [x] Keep files/folders in a separate Files tab and move actions into triple-dot menus.
- [x] Remove the right-panel Course Roadmap entry point.
- [x] Reuse/rename the active IDE file for generated code exercises and AI file edits.
- [x] Add shared editor language registry for syntax support, generated exercise filenames, run capability, and visual preview capability.
- [x] Add language-aware generated workshop/lab/project starter files for C++, Java, Python, Go, Rust, C#, Ruby, Swift, PHP, SQL, shell, and web files.
- [x] Replace mismatched JavaScript starter code when generated exercises target non-JS languages.
- [x] Add dynamic editor exercise MVP checklists from generated acceptance criteria.
- [x] Make editor exercise MVP checklists collapsible/restorable in the chat dock.
- [x] Make the left Modules tree auto-track and highlight the active course lesson step.
- [x] De-escalate assessment follow-up prompts after skipped/wrong prerequisite answers.
- [x] Add frosted Code/Visual editor toggle for HTML/CSS/browser-JS previews.
- [x] Add `requiresPreview` lesson support so visual exercises tell learners to inspect the Visual view before submitting.
- [x] Persist workspace files to `workspace_files` in code.
- [x] Persist workspace folders to `workspace_folders` in code.
- [x] Persist chat to `chat_messages` in code.
- [x] Persist progress to `course_progress` in code.
- [x] Apply live Supabase `workspace_folders` migration and rerun verifier.
- [x] Finish accepted startup/load-in fade through login zoom.
- [x] Diagnose right panel/add-course area reveal stutter after login zoom.
- [ ] Continue dashboard component animation optimization and real-session QA.
- [x] Sync Stripe webhook events to `subscriptions`.
- [x] Add Stripe billing portal customer mapping.
- [x] Enforce Free active-course limit server-side.
- [x] Load Basic/Pro subscription state into dashboard and enforce paid plan limits end to end.
- [x] Record AI usage in `usage_events`.
- [x] Block unauthenticated `/api/tutor` calls.
- [x] Add streaming tutor response transport.
- [x] Route AI tutor, generation, and grading through the OpenAI API.
- [x] Add direct AI file-edit flow with last-edit undo.
- [x] Add safe active-file terminal execution trigger for AI chat.
- [x] Design proper app-wide navigation and link existing routes into a coherent user flow.
- [x] Add profile/account entry points from dashboard/workspace.
- [x] Create initial content/pages for profile, account, billing, usage, support, privacy, and terms.
- [x] Add tutor theory, chat exercise, MCQ, terminal exercise, and canvas demo states.
- [x] Add tutor section progress, exercise language/difficulty/XP metadata, and clickable MCQ options.
- [x] Fix tutor composer spaces and Enter-to-send; keep Shift+Enter for new lines.
- [x] Expand file icons and lazy CodeMirror language modes beyond JS/TS.
- [x] Extract Codex programming-tutor behavior into app-owned production tutor prompt files.
- [x] Load tutor runtime instructions from `src/ai/prompts/` instead of a hardcoded server string.
- [x] Generate first-open lesson intro messages through the authenticated AI tutor flow.
- [x] Reuse the course chat panel layout for independent Exercises.
- [x] Route exercise hints through the AI tutor with one hint per exercise per day.
- [x] Implement XP awards by exercise language and difficulty with an idempotent server ledger.
- [x] Move independent exercise allowance, skip, hint, attempt, completion, and XP state from localStorage to server APIs.
- [ ] Apply and verify the progression migration against the live Supabase project.
- [x] Redesign Settings Overview as an opaque dashboard-style progression surface.
- [ ] Fix dashboard tab/window-focus refresh/reanimation when returning from another app/window.
- [ ] Replace dashboard/workspace dropdown account controls with direct Settings Overview account buttons.
- [ ] Clamp long course-card summaries so progress stays visible.
- [ ] Make course-card progress bar derive from real lesson/course progress.
- [x] Define model response schema for richer generated interactive tutor blocks and MCQ grading.
- [ ] Apply and verify the generated course-content migration against the live Supabase project.
- [ ] Run real authenticated v2 course-generation QA end to end.
- [ ] Harden generated code-exercise grading with server-side rubrics/tests beyond the MVP signal-based checker.
- [ ] Polish AI tool-run feedback, edit status, and error/loading states.
- [ ] Polish dashboard/workspace UI states and responsive behavior.
- [ ] Add ESLint 9 config or remove lint script.

## Deferred Until After Launch

- [ ] Design XP, levels, badges, and unlockable hints/exercises progression system.
- [ ] Persist user XP, badge awards, and course/task completion history.
- [ ] Let AI estimate XP and badge eligibility from task difficulty after completion.
- [ ] Design course publishing/replication model for user-created and AI-generated courses.
- [ ] Add star/favorite/replicate concepts for published courses.
- [ ] Decide whether freemium monetization should use subscriptions only, generation credits, hint packs, premium course replication, or a hybrid.

## Paid Beta QA

- [ ] signup/login/logout.
- [ ] seamless login-to-dashboard animation with no code-box refresh or brightness cut.
- [ ] create course.
- [ ] open course workspace.
- [ ] edit file and refresh restore.
- [ ] send tutor message.
- [ ] plan limit blocks extra active course.
- [x] billing portal opens for subscribed user with real Stripe env.
- [x] privacy/terms/support pages exist.
- [x] profile/account/billing/usage routes are discoverable from main app UI.
