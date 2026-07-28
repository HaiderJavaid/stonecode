# Stonecode Decisions

## Accepted

### Verified Account And AI Provider Onboarding

Keep login/signup content minimal. On desktop the panels mirror each other: login enters/exits on the right and signup enters/exits on the left; the staged first-load reveal remains, while panel-to-panel switches have no delay. Mobile recenters them. Signup keeps identity, password confirmation, and terms in one compact form, then opens a centered eight-digit Supabase email-code modal. After verified OTP, let the learner choose Free or Pro. Free may browse the dashboard without a key, but every AI-backed action requires a server-verified encrypted OpenAI key and reopens the setup prompt when missing. Pro completes Stripe checkout before dashboard entry; only active/trialing subscription state bypasses key setup.

Reason: verification, billing, and provider setup should be explicit without blocking a learner from inspecting the product, while paid entitlement must remain server-authoritative.

### Deterministic Simple Visual Repair

Repair missing Visual support at lesson-load time for lightweight 2D and web-oriented code. The repair adds a source-linked browser preview and recomputes its scene from the current editor source, so saved workshops improve without regeneration, OpenAI, or Terminal execution. Supported profiles include browser Canvas/CSS, Python visual libraries, lightweight C/C++ 2D libraries, Java/.NET 2D APIs, and simple mobile UI representations.

Full external engines and scene editors—Unity, Unreal, Godot, Roblox Studio, CryEngine, GameMaker, and Blender—remain Code-only. The deterministic view is always labeled an educational approximation, never native runtime output.

Reason: beginner workshops need immediate visible feedback without making paid sandbox execution an MVP dependency or pretending Stonecode can embed heavyweight editors.

### Optional Assessment And One-Module Guided Projects

Discovery captures the learner's relevant prior knowledge before any assessment offer. Course and guided-project assessment is optional, appears near the end of discovery, and is capped at three questions. Skipping uses the learner's declared background and proceeds to the editable review.

Workshop and guided project are the same experience. New guided projects use `guided-project-content/v2`: one module with a compact 1–3-step orientation/refresher, one continuous 10–20-step workshop that completes the deliverable, and a 1–2-step non-assessment recap. Existing milestone-based v1 projects remain compatible. Pure practice is a standalone conversation and is not linked from course home.

The AI returns the initial project workspace once plus one compact deterministic edit per workshop step. The server applies those edits and hydrates the full starter code, result code, and workspace snapshot expected by the IDE. Exact replacements are preferred; bounded stale-anchor recovery prevents one whitespace mismatch from discarding an otherwise valid project.

Reason: discovery should understand the learner before testing them, and a requested build should feel like one coherent teaching workshop rather than a miniature course roadmap.

### Conversational Practice And Skill Achievements

Exercise discovery must resolve practice scope, motivation, topics, count, difficulty, and coding/MCQ mix before confirmation. Vague practice defaults to ten exercises and an AI-proposed mostly-coding split; the learner sees exact counts in a compact editable review. Exercise sessions contain only independent MCQ or coding problems, never theory or workshops.

Progression attributes each verified exercise to one primary skill plus an optional parent language and domain tags. Skill-distribution percentages use solved counts, while base-language mastery uses XP without doubling total XP. XP is difficulty weighted: MCQ 5/10/15 and coding 20/35/50.

Achievement titles are configurable badges rather than levels. The initial catalog is Frontend Developer, Backend Engineer, Game Developer, Mobile Developer, and Full-stack Developer. Specialist titles require a related completed course or guided project plus domain and language XP; Full-stack additionally requires the frontend/backend achievements and 1,000 combined XP. Short courses and exercise sessions do not satisfy the program-completion gate.

Reason: practice should reflect the learner's real goal, progress should show technologies rather than arbitrary difficulty slices, and titles must represent both learning completion and verified skill evidence.

### Universal Learning Conversations

Use one AI discovery entrypoint for `course`, `short_course`, `exercise`, and `guided_project`. Discovery may change the proposed type, but the type becomes immutable after the learner confirms and creates the record. Every type reuses the persistent course container, workspace, tutor chat, files, and progress; `experience_type` is the durable discriminator while `mode` remains compatibility data.

Courses keep the existing personalized generator behind an optional late assessment. Short courses teach one bounded concept slowly. Exercise sessions default to ten adaptive problems and do not consume active-program limits. Guided projects use one complete workshop module with introduction and recap theory around 10–20 guided coding steps.

Reason: the product needs one conversational learning surface without forcing every request into a full course or one oversized generation response.

### Dynamic Course Generation And Language Scope

Generate every course fresh for the learner. Do not maintain a hard-coded course catalog. Keep the curriculum hierarchy, pedagogy contracts, assessment policy, language capability profiles, validation, execution adapters, and grading rules deterministic around the AI.

Standalone programming-language fundamentals skip prerequisite assessment. Frameworks, libraries, advanced specializations, and applied paths require prerequisite assessment. Initial generation creates the full outline and fully loads Module 1 only; the learner still presses Finalize after review.

Reason: Stonecode should teach broadly without turning unconstrained model output into the product architecture.

### Conversational Course Discovery

Run an AI-generated discovery conversation before assessment planning. Each AI clarification asks one curriculum-relevant question and returns contextual clickable suggested answers, while the learner can always type a different response. Broad goals such as making a game or website are refined into a specific course target; learners do not need to know a programming language in advance.

Suggestions may be described as popular starting points, but the product must not claim live weekly learner trends without real aggregated data.

Reason: beginners often know what they want to build but not which language, framework, platform, or course name they need.

### Generated Course Repair And Failure

Retry incomplete structured output with a bounded larger token budget. Repair only warned topics/blocks, preserve unrelated valid content, and cap repair at two passes. Structural, progression, syntax-teaching, and concrete-action failures block saving; a wording-only context warning may remain after repair. If the course is still invalid, keep the assessment review available and return an actionable error instead of creating recovery course content.

Reason: one weak sentence or malformed repair wrapper must not destroy a valid course, while genuinely unusable teaching or practice must still be rejected.

### Audience

Target self-taught beginners first.

Reason: simpler curriculum, clearer value, and lower support risk for a paid beta.

### Launch Scope

Ship a focused paid beta before a full public SaaS.

Reason: validate willingness to pay before building marketplace/admin-heavy surfaces.

### SaaS Stack

Use Supabase Auth/Postgres + Stripe.

Reason: fastest solo path to auth, database, row security, subscriptions, and billing portal.

### Frontend

Keep Vite + React + TypeScript.

Reason: current workspace UI works and does not need a framework migration yet.

### Visual Direction

Preserve the stone-textured IDE direction.

Reason: the product should feel like a distinctive learning workspace, not a generic SaaS dashboard.

### Auth Transition Direction

The login screen and dashboard should feel like one continuous scene.

Reason: the center black code box and background should behave as persistent visual elements; login panel, dashboard chrome, and brightness overlays should animate around them without a visible reload.

### Animation Performance Direction

Keep the visual timing and stone-textured feel, but avoid animating large filters, blend modes, and heavy moving shadows.

Reason: the accepted intro and dashboard motion should stay cinematic while the browser mostly composites transform/opacity layers.

### AI Orchestration

Use direct provider adapters for MVP instead of LangChain or LangGraph.

Reason: simpler streaming, tool execution, cost control, and traceability. Keep app logic narrow around the OpenAI Responses API for the paid-beta path.

### Dev AI Provider

Use the OpenAI API for tutor, course generation, and AI grading.

Reason: the product AI path should match production behavior during local QA. Legacy router-based testing is no longer the active provider path.

### Code Execution

Keep browser Worker execution only for beginner lesson snippets.

Reason: full untrusted project execution needs a backend/container sandbox later.

### Tutor Response Model

Tutor steps may be theory, chat-answer exercises, multiple-choice exercises, terminal coding exercises, or visual canvas/code explanations.

Reason: different concepts need different interaction surfaces, while one linear Next/Prev flow keeps course progress understandable.

### Exercise Progression

Exercise XP is attributed to the exercise language/category and scales by difficulty. UI metadata may be shown before backend award persistence exists.

Reason: learners need visible progression context now, but XP awards must eventually be server-validated.

### Progression Awards V1

Award XP only for server-verified independent exercises, server-graded course MCQs, and AI-graded course chat exercises. Theory, canvas, course completion, and terminal exercises do not award XP yet. First Steps is the only shipped badge and may be equipped as the profile title.

Reason: progression must be idempotent and defensible before expanding the badge catalog or trusting terminal completion.

### Settings and Progression Surface

Use the dashboard stone surface system as the global visual language for settings: opaque dashboard-style background, matching left navigation, progression cards in the middle, and environment/sync cards on the right.

Reason: settings should feel like part of the main app shell instead of a transparent overlay or separate product.

### Course Challenges Versus Independent Exercises

Course challenges are unlimited, syllabus-integrated, and may affect course completion. Independent exercises use different scenarios and angles, are subject to plan-based daily completion and skip limits, and do not affect course completion.

Reason: learners can either follow the teaching path or jump directly into harder practical coding without allowing practice quotas to block the course.

### Independent Exercise Interaction

Each independent exercise permits one hint question, repeatable Run attempts, and one account-wide daily Skip. A successful Run changes Skip to Next. Free users may complete two independent exercises per local calendar day in the initial product model.

Reason: this gives direct-practice users enough help and variety while keeping AI generation and grading cost controllable.

### Upcoming Topic Questions

Answer current-topic clarification directly. If the question belongs to a clearly upcoming topic, identify that section, provide only the minimum bridge, and return to the current step.

Reason: preserve curiosity without derailing the planned learning sequence.

### Generated Tutor Messages

Lesson intro messages are generated by the AI tutor on first open, persisted with a stable generated key, and rendered immediately on future opens without retyping. Independent exercise hints use the same tutor flow and are limited to one hint per exercise per day.

Reason: the course should feel like one continuous AI tutor workspace while keeping repeated opens cheap and preventing unlimited hint spending.

### Generated Course Content V1

Course setup asks AI-backed clarification/assessment questions, then generates and previews a roadmap before finalizing. V1 saves the roadmap plus first-chapter content, locks future sections, lazily fills later chapters when unlocked, renders generated MCQs from schema, separates theory/check/code blocks into distinct lesson steps, and routes code exercises through the middle editor instead of chat.

Reason: learners should see the plan before committing, while upfront AI cost/latency stays bounded.

Status: superseded as the product target by Course Content V2 below. Keep V1 compatibility for existing saved courses.

### Course Content V2

Replace the current generated-course flow with assessment-first personalized course generation. The user chooses a subject, confirms readiness for prerequisite assessment, completes adaptive MCQ/writing/code assessment steps with Skip available, receives a strengths/weaknesses/suggested-modules review, then presses Finalize to generate a personalized freeCodeCamp-style full course structure.

Target hierarchy: Course -> Modules -> Topics -> Blocks -> Steps. Blocks now carry an explicit `kind`: `theory`, `quiz`, `workshop`, `lab`, `project`, or `review`.

`theory` blocks contain teaching steps only: theory, analogy, example, summary, and optional single-MCQ checks. The generator should not force every topic into the same concept -> analogy -> example -> quiz -> review sequence; it may combine concept and analogy, split subtopics, or move examples wherever the concept teaches best. It should assume zero programming/syntax knowledge unless assessment proves otherwise, and explain new code words, symbols, punctuation, and lines before requiring use. One-off MCQ checks stay inside theory blocks. `quiz` blocks are exam-style checkpoints with multiple MCQ steps. `workshop` blocks are guided editor actions where each step builds on the previous one. Their length should match the mini-feature or guided mini-project; two-step workshops are rejected by normalization. `lab` blocks are small independent checkpoint exams, usually one step, and may appear later only after a relevant guided workshop; intervening theory, quizzes, reviews, topic transitions, and workshops are allowed. Milestone `project` blocks are larger cumulative exams that combine prior skills only after multiple workshops and at least one lab establish readiness. Courses may contain multiple labs and milestone projects dynamically, while the distinct final project is the main exam near the end. `workshop`, `lab`, and `project` steps must include context and concrete MVP acceptance criteria. `review` blocks can hold answer-in-chat or summary steps, and answer-in-chat prompts must include a short recap or clue before asking the learner to write.

Workshops are tutorials, not exams. Scratch builds begin from a blank file or minimal unavoidable shell and Step 1 makes the first meaningful edit; only bug-fix/add-feature work preloads existing code and a scene. Every coding step makes one semantic micro-edit (tightly related imports/constants may be grouped), shows the exact delta, and explains only that new code; run/inspect-only steps are invalid. Each step offers relevant suggested questions and free-form tutor chat. The end contains only 1–2 non-coding summaries. Native visual projects use a source-linked synchronized HTML scene clearly labeled as a learning representation; Terminal remains the real native runtime.

Workshop chat reuses the theory dock: two or three quick actions, then the same follow-up composer. Grading/checking feedback is an assistant message above that dock, not another nested control panel. Inline diagnostics are file-scoped and appear only in the matching editor file.

In a multi-file exercise, Check always grades the step's declared `filePath`, not whichever tab the learner last selected. This keeps validation and inline feedback attached to the intended file while learners inspect related project files.

Assessment review suggested modules and course-shaping preferences are binding planning inputs for generation. Assessment questions should choose a clear diagnostic intent first: learner intention, readiness, prerequisite gap, syntax bridge, debugging mindset, or required module coverage. The final course should visibly include, merge, or naturally rename those recommendations instead of drifting into a generic module list.

For advanced/applied courses, assessment gates a narrow target-specific refresher module. Generate it only when prerequisite evidence is weak, and teach only base-language concepts needed by the requested target.

Generated MCQs should not be easy to game. Distractors must be plausible, similarly specific, and similar length, and prerequisite MCQ correct answers should be distributed across A/B/C/D instead of defaulting to the first options.

Reason: course quality depends on prerequisite gaps. Assessment exists to customize modules and lessons, not to label the user by level or ask for learning mode/project preferences. Stonecode should insert only the minimal prerequisite modules required for the target subject instead of generating a generic chapter sequence.

Only Module 1 should be fully loaded and clickable during initial generation. Modules 2+ stay visible as locked outline shells until module unlocking/lazy generation is implemented.

### Course Workspace Navigation V2

The left panel should have `Course` and `Files` tabs. The Course tab lists modules, then expandable topic/block/step nodes with locked/upcoming steps greyed out. Clickable step tiles navigate the right-panel lesson conversation for that exact generated step. The Files tab keeps the current files/folders view. File/folder actions move from the top toolbar into per-item triple-dot dropdown menus.

The right panel remains the tutor/course panel, but the Course Roadmap button and roadmap function should be removed.

Reason: curriculum navigation belongs beside the workspace tree, while file actions should stay attached to each file/folder item.

### Course Lesson Gating

Theory sections are learner-led teaching surfaces only. They can use concept explanation, analogy, examples, recap, and continuity into the next topic, but the exact shape should vary with the topic. MCQ, written, and editor exercises live in separate sections. Next unlocks after theory text finishes typing, after MCQ/writing grading returns, or after an editor exercise passes.

The lesson progress bar should represent progress within the current block, not the whole course. Next labels should identify the next boundary: section, block, or topic. The app should not auto-advance across modules; learners manually click the next module.

The left Modules tree should follow the active lesson: auto-open the active module/topic/block and highlight the current numbered step as the learner moves through the course.

Reason: beginners need a clear separation between learning and assessment, while course-required tasks must still prove progress before advancing.

Workshop editor checks use the existing lesson navigation controls. Before a workshop code step passes, the right navigation button reads `Check`; after passing, it becomes `Next section`. There is no separate submit/next control. The MVP checklist is optional help, hidden by default behind a small chevron, and must not explain internal UI mechanics to the learner.

Theory opens with course/topic orientation and explanatory prose before bullet summaries. New substantial concepts should use a useful analogy and explicitly map it back to code or runtime behavior. Short tutor follow-ups stay conversational and must not repeat the full structured lesson response template.

### IDE Whiteboard

Starting a course creates one reusable whiteboard file only. AI file edits and generated code exercises should replace and rename the active file instead of creating folders, README files, or a fresh JavaScript file for every step.

Reason: the MVP course workspace should stay focused on learning flow rather than project scaffolding noise.

### Editor Language Support

The editor should use one shared language registry for syntax mode, generated default filename, visual preview support, and browser-run capability. Browser Run is JavaScript-only for MVP. HTML is the Visual entrypoint; CSS and browser JavaScript participate only when explicitly linked by relative `href`/`src`. Selecting a linked asset previews its connected HTML entrypoint, while unlinked or missing files show clear guidance. C++, Java, Python, Go, Rust, C#, Ruby, Swift, PHP, SQL, shell, YAML, XML, Vue/Svelte-style files should edit with correct syntax/file naming, but execution requires a future backend sandbox.

Reason: generated exercises must not silently become JavaScript when the learner is studying another language, while the app should not pretend the browser worker can compile or execute languages it cannot run.

### Optional Remote Code Execution

Stonecode does not require Judge0 or another paid sandbox for the MVP. Browser JavaScript remains locally runnable; HTML/CSS/browser JavaScript use Visual preview; other languages remain editable and receive static/AI feedback. Their Terminal Run path uses the provider-neutral boundary and returns a clear unavailable result unless a self-hosted or paid sandbox is configured later.

Reason: broad-language teaching and guided practice should not depend on a per-submission vendor before product demand and execution economics are proven.

### Freemium Landing And User-Supplied OpenAI

Keep the established public-page section order and stone visual direction. Position Stonecode around personalized programming understanding rather than DSA, LeetCode, or unsupported popularity claims.

Public pricing has two choices: Free and Pro. Free has the same learning-mode and complete-path access as Pro, but AI requests use a user-supplied OpenAI key encrypted server-side with AES-256-GCM. Pro is positioned at $9 per person per month and uses included Stonecode AI capacity without API-key setup. The legacy internal Basic tier remains readable for existing subscription records but is no longer offered in the landing page or billing settings. The production Stripe Pro price must match the public $9 price before launch.

Reason: beginners should experience the complete learning loop before paying while Stonecode avoids funding unrestricted Free generation. The landing must only claim behavior enforced by the product.

### Promotional Media Delivery

Promotional media must be captured from the real routed Stonecode components with deterministic scripted data. The earlier synthetic UI renderer is retired from the landing. Each feature is recorded separately, beginning with dashboard → adaptive discovery → assessment; unfinished slots use a real dashboard still. Landing videos lazy-load near the viewport, retain a poster fallback, expose pause controls, and stay static when reduced motion is requested.

Reason: reproducible coded motion keeps messaging and visual language consistent while real product capture is prepared for later editorial upgrades.

### Unified Account-Onboarding Surfaces

Verification, plan choice, and API-key setup must use the dashboard's shared neutral `--stone-*` surfaces, borders, and typography. Do not introduce a separate green onboarding palette. Successful email verification immediately starts the same dashboard IDE zoom used by sign-in. Plan choice and the Free OpenAI-key gate are deferred until the learner invokes an AI-backed learning or generation action; ordinary dashboard entry remains unblocked.

Reason: account onboarding is part of the product workspace, not a separate visual brand. New learners should reach the product immediately, while AI cost/provider setup appears only at the moment it becomes relevant.

### Auth-Dark Workspace Wall

Dashboard and course-workspace walls use a slightly brighter continuation of the sign-in page's dark vignette without the former grain/grid layers. During auth handoff, fade the login vignette only to the workspace target darkness instead of transparent so no bright intermediate frame appears. Keep stone texture on functional panels and cards, and leave the original application SideRays treatment unchanged.

Reason: a quieter wall improves panel separation while the shared ray preset keeps landing-to-product lighting coherent.

### Stable Auth IDE Handoff And Full Learning Lane

Use one shared editor surface, texture, opacity, radius, shadow, and viewport-aligned lighting token set for the auth preview IDE, empty dashboard editor, and active CodeMirror shell; keep the lighting behind code/text, switch lighting ownership on the route frame, and transition only geometry. Drive the successful-login card through an explicit rightward exit keyframe. Keep the dashboard learning list stretched from the launcher to the Settings entry, and let an empty account use that entire middle lane as one black card with centered guidance and a Start learning action.

Reason: the auth zoom should feel like one editor moving into place, and the learning lane should not look prematurely clipped or unfinished.

Signing out from Settings reverses that same composition: finish closing Settings, shrink the full-size IDE back to its login position, then slide the login panel into view. Authentication state changes behind the shared transition surface so routing does not flash.

The transition surface begins with the dashboard's exact wall vignette. On sign-out, the darker auth lighting crossfades across the full reverse IDE zoom; it must never appear through a delayed single-frame opacity switch.

### Shared Settings Shell And App Mark

Settings must keep the dashboard's exact plain workspace wall before, during, and after route transitions. Its blur layer is transparent and must not alter tint or saturation. The Settings left rail mounts the real shared `StoneSurface` + `file-panel` card so its texture, radius, border, and shadow cannot drift from Dashboard.

The diamond mark shown above signup verification is the canonical Stonecode app logo. Authentication and shared workspace/file-panel branding reuse one component for that mark, while the browser favicon uses the same geometry and surface treatment.

Reason: navigating to account controls should feel like opening a workspace layer, not loading a differently themed page, and one shared logo implementation prevents brand drift.

## Pending

- Production host.
- Stripe pricing IDs.
- Supabase project.
- Backend/container sandbox provider.
- RAG ingestion format.
- Final production model router defaults for low/medium/high/reasoning/grader/embedding.
- Direct AI file-edit control model, including scope, undo/history, and terminal command limits.
- Final exact timing/easing for remaining dashboard component animations.
- Final app navigation model for dashboard/workspace/settings/support/legal routes.
- Exact XP formula, streak rules, and badge taxonomy.
- Stronger server-validated generated code-exercise grading rules.
- Which unlockables are earned by progression versus subscription tier.
- Whether shared/published courses belong in paid beta or post-beta.
- Monetization model for future freemium path: subscription-only, usage credits, microtransactions, creator marketplace, or hybrid.
