# Stonecode Session

## Date

2026-07-03

## Current State

Branch: `setting-page-redesign`.

The local dirty tree contains the current v2 generated-course milestone:

- OpenAI-only tutor/course/grader routing.
- Assessment-first setup: subject -> readiness -> adaptive assessment -> review -> generated course.
- Assessment MCQs include prerequisite checks plus course-shaping language/library/tool preference questions.
- Course-shaping MCQs are not graded right/wrong and do not trigger follow-up penalties.
- Assessment follow-ups now de-escalate after skipped/wrong prerequisite answers and check readiness signals instead of piling on harder questions.
- Assessment questions now choose a clear signal first: learner intention, readiness, prerequisite gap, syntax bridge, debugging mindset, or required module coverage.
- The assessment skip control is learner-facing as `I don't know`.
- Assessment generation now includes a server-side stabilizer: after `I don't know`, repeated weak prerequisite prompts are replaced with bridge/course-shaping questions.
- `course-content/v2` hierarchy: Course -> Modules -> Topics -> Blocks -> Steps.
- Generated block kinds are explicit: `theory`, `quiz`, `workshop`, `lab`, `project`, `review`.
- Theory blocks use slow intro -> consistent analogy -> example -> optional single MCQ checks.
- Quiz blocks are exam-style MCQ-only checkpoints with multiple questions, not one-off checks.
- Workshop blocks are guided editor actions that build step by step with many tiny FreeCodeCamp-style steps.
- Workshop length is variable based on the mini-feature or mini-project. Two-step workshops are rejected during generated-content normalization.
- Lab blocks are independent practice, usually one step, after workshop or strong teaching.
- Labs should usually use the same project pattern as the preceding workshop, but as a different variant with less guidance.
- Left panel defaults to generated course Modules view; Files remains a separate tab.
- Module detail renders chapters/topics, blocks, and compact numbered step tiles.
- Step tiles navigate directly to the matching right-panel lesson conversation.
- Module 1 is generated/unlocked for QA; modules 2+ stay locked shell buttons.
- Lesson progress now tracks the current block and Next labels distinguish section, block, topic, and module boundary.
- Workshop/lab/project exercises include context plus dynamic MVP checklists.
- Workshop prompts now require tutorial-style steps: what is being built, why, what code to write, syntax reminders/examples, and what the starter code does before independent labs.
- Course generation and tutor prompts now assume zero programming/syntax knowledge unless assessment proves otherwise, explaining every new code word, symbol, punctuation mark, and line before requiring the learner to use it.
- Lesson rendering now strips leaked internal/prompt text from generated markdown/prompts.
- Workshop rendering now adds language-aware syntax reminders and starter-code explanations, including Java `public class Main`, `main`, `System.out.println`, braces, strings, returns, and semicolons.
- C# workshop rendering now repairs older saved C# courses that were mis-normalized as C, so they show `Program.cs`, `Console.WriteLine`, and C# syntax notes instead of `printf`.
- Workshop starter files now auto-load once per step; the manual `Load starter in editor` action is removed. The editor action is `Check`, then `Submit and next` after the checklist passes.
- Generated code exercise grading now uses generated acceptance criteria on the client checklist and server progression API, including stricter output-call and function-call counts.
- Old saved fallback workshop context such as `input-rule-output loop` is replaced at display time with clearer language-aware context.
- Visual exercises can set `requiresPreview` so the lesson tells the learner to inspect the Visual view before submitting.
- Generated exercise normalization replaces obvious JavaScript starter code when the course language is C++, Java, Python, or another non-JS language.
- The MVP checklist can be collapsed/restored from the chat dock.
- The left Modules tree tracks the active lesson, auto-expands the active module/topic/block, and highlights the current step.
- Shared editor language registry drives syntax modes, generated filenames, visual preview support, and browser-run capability.
- Browser Run remains JavaScript-only; non-JS languages edit correctly but need a future backend sandbox to execute.
- The editor has a frosted Code/Visual toggle for HTML/CSS/browser-JS preview.
- Right-panel Course Roadmap was removed.
- AI/generated code exercises reuse or rename the active IDE whiteboard file instead of creating folders/README/new JS files.

## Verified

Latest passing checks:

- `npm run verify:generated-course-content`
- `npm run verify:tutor-flow`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Rendered QA:

- Chrome QA on `http://127.0.0.1:5174/courses/bb762e12-0e37-4afb-8d3a-976b2542ffe9`.
- Verified Modules tab active by default.
- Verified module button at top, no stretched blank grid gap.
- Verified module -> chapter -> block expansion.
- Verified step tiles render as compact 28x28 numbered squares without text leakage.
- Browser QA on `http://127.0.0.1:5174/courses/ce4f8c0c-9af7-44c9-a90d-bc41af88f12e`.
- Verified saved C# workshop displays `Program.cs`, `Console.WriteLine`, C# syntax explanations, no `printf`, and no manual starter-load button.
- Verified C# workshop `Check` no longer passes one-output starter code for a two-output/function-call-twice checklist.
- Console showed React Router future-flag warnings only.

## Risks

- Live Supabase still needs pending migrations applied and verified, especially generated course content and progression/hint columns.
- Full authenticated v2 flow still needs real-user rendered QA from dashboard course setup through generated course completion.
- Current saved QA course only had one generated module, so next QA should create a fresh v2 course after the new generation rules.
- Worktree is intentionally dirty with many milestone changes and untracked files.
- Vite dev server port conflicts can create websocket noise; use a stable existing port or restart cleanly before QA.
- Generated code-exercise grading still needs stronger server-side rubrics/tests.

## Next

1. Apply pending Supabase migrations.
2. Run authenticated QA: login -> add learning course -> subject -> assessment with Skip -> review -> generate course -> Modules tree -> theory -> quiz -> workshop -> lab -> refresh persistence.
3. Create a fresh generated course to verify full module count and block-kind arrangement.
4. Add task-based OpenAI model router env roles: low, medium, high, reasoning, grader, embedding.
5. Add static-first RAG abstraction for curriculum patterns and rubrics.
6. Harden generated code-exercise grading server-side.
7. Finish dashboard polish: focus-return reanimation, account/settings buttons, summary clamp, progress derived from real course state.
