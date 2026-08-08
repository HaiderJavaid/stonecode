# AI Course Generation Rules

This is Stonecode's human-editable curriculum rulebook. Code owns schemas, capability checks, prices, credit reservations, runtime limits, validation, and persistence. AI proposes and teaches within those boundaries.

## Universal Learning Entry

New learning has exactly three product modes:

- Course: a compact or deep structured curriculum.
- Guided Project: one continuous build taught step by step.
- Exercise Pack: focused MCQ/coding practice.

Legacy `short_course` records remain readable. New short requests generate as compact Courses.

Discovery is conversational planning, not a knowledge test. A learner may start from any entry point: a project idea, programming language, computing domain, feature, end goal, Course, Guided Project, or Exercise Pack. Ground the opening in available profile, recent-learning, and transcript context; do not reuse a fixed greeting. Gather only information that changes the result: mode, domain, concrete goal or outcome, supported technology/platform or subject, relevant experience, desired depth, preferred focus, deliverable, and branch-specific exercise/project preferences. Every question offers contextual suggested answers while free typing remains possible. A domain focus question may use multi-select choices; other questions remain single-select.

The learner's first message says what they want to learn or build. Accept checklist details in any order, persist the structured draft between turns, and infer completed fields from the full transcript. A broad request to learn a language must ask whether the learner wants a Course, Guided Project, or Exercise Pack before proposal. Ask relevant experience and meaningful focus areas. Framework requests such as React ask about related HTML, CSS, and JavaScript experience; when foundations are missing, recommend a foundation-first Course while allowing the learner to continue with the requested framework. Skip that branch when the learner already explicitly requested a foundation-first path. If one message already supplies the mode, technology, outcome, prior experience, desired depth, and relevant branch preferences, proceed directly to the editable proposal. Otherwise ask only for missing information. Course discovery may ask which practical project should anchor the learning when that choice changes the syllabus. Only Guided Project discovery asks whether the build should be Basic or Advanced; this answer changes feature count, coding-step scope, architecture, validation, and edge-case depth. Do not ask generic “balanced theory or step-by-step hand-holding” questions.

Keep discovery purposeful. Ask at most eight useful clarification questions before proposal. Do not rush past mode, relevant experience, prerequisites, or plan-shaping preferences, and do not polish optional preferences after the required checklist is answered.

Do not ask quiz, syntax, code-tracing, or prerequisite-test questions during discovery. Quizzes, coding exercises, labs, and grading belong inside the generated learning path.

Before creation, return an editable concrete syllabus, project sequence, or exercise list. The server calculates the credit quote. Do not invent or alter prices, balances, plan limits, or availability.

## Technology Scope

Generate only for server-approved learning-domain and technology capabilities. The retained catalog has 22 technologies; expose 21 runtime-backed technologies and keep Julia hidden while Judge0 lacks it. Database availability remains authoritative and an unavailable choice must be handled conversationally before proposal.

Supported domains are Programming, Computer/IT Fundamentals, Internet/Web Fundamentals, Algorithms & Data Structures, and Math for Programmers. Algorithms/math require an explicit runnable technology. Computer/IT and Internet/Web may omit technology only for conceptual Courses. Their conceptual steps use theory, analogies, examples, quizzes, reflections, reviews, and tutor diagrams; never emit fake files, code execution, Output, or Terminal steps.

Reviewed browser libraries are React, Vue, Svelte, D3, Chart.js, and p5.js at the exact pinned versions supplied in the prompt. Never substitute `latest`, another CDN URL, an import map, npm installation, or an unreviewed dependency.

Exclude:

- external engines such as Unity, Unreal, Godot, Roblox, GameMaker, or Blender;
- native GUI/mobile frameworks and emulators;
- server-dependent frameworks;
- arbitrary package installation;
- Assembly or unreviewed runtimes.

Offer the nearest useful plain-code browser or console alternative when a request is outside scope. Never pretend a deterministic diagram is native program output.

## Complete Course Delivery Rule

For a Course, generate the approved outline and every promised module inside a persisted, checkpointed background job. Generate modules as separate bounded model calls so one oversized response cannot silently drop later modules. Module 1 and Module 2 form the launch package (or every module when the Course has only one): both must pass the same RAG, structure, scope, and quality checks as final delivery before the Course is persisted, shown as 100% ready, and Stones are settled. Later modules continue from durable checkpoints and never regenerate an already approved module after interruption.

The persisted Course always contains the complete approved module outline. Only approved module bodies are navigable. A module remains grey only while its generation checkpoint is not ready; every ready module is enabled so the learner can audit or revisit it in any order. An actively generating module exposes only a compact loading indicator. The first step is a substantive welcome and course orientation, not a repeated product greeting.

The fixed hierarchy is:

```txt
Course
-> Modules
-> Topics
-> Blocks
-> Steps
```

Do not add weeks, duration, pace, completion-time estimates, or hidden planning notes.

## Course Direction

Every Course needs a clear learning direction:

- state what the learner will understand or build;
- order prerequisites before dependent ideas using the declared background;
- connect theory to later practice;
- keep examples within the approved runtime;
- end with meaningful independent application.

Assume no knowledge beyond what the learner explicitly declared. Explain unfamiliar words, tokens, punctuation, APIs, and runtime behavior before requiring them.

## Hidden Course Blueprint

Design a hidden project/capability spine before writing modules. Workshops, labs, and projects should build reusable pieces toward that spine without exposing internal planning. The final application must feel earned by earlier practice.

Do not repeat the same concept → analogy → example → quiz template for every topic. Match the number and kind of steps to the idea.

Do not repeat one fixed non-theory cadence across three consecutive topics. Use inline checks, guided workshops, narrow bug fixes, missing-feature tasks, and small labs where each best fits the concept. A standalone quiz needs at least four genuinely distinct checks. Early and middle labs stay narrow and easy/medium; hard or comprehensive labs belong in the final third after multiple workshops and smaller transfer exercises.

## Block Contracts

Allowed block kinds are `theory`, `quiz`, `workshop`, `lab`, `project`, and `review`.

- Theory may contain theory, analogy, example, summary, and an optional small MCQ check.
- Quiz contains only low-stakes, topic-grounded reinforcement questions.
- Workshop is guided connected coding.
- Lab is less-guided transfer practice after relevant teaching and a workshop.
- Project combines several previously practiced capabilities.
- Review consolidates prior learning without introducing a large new dependency.

A block must not silently mix incompatible step types.

## Theory Blocks

Start a new topic with plain-language orientation: the problem it solves, why it matters, and how it connects to the learner's goal. Use short paragraphs before lists. Use one consistent analogy only when it improves understanding, and explicitly map it back to code/runtime behavior.

The first Course lesson uses 3–6 short paragraphs a 10-year-old can follow: what the subject is, why people use it, what learners can build, one memorable fact or analogy, and why the first topic comes first. Introduce technical names only after the simple mental model.

Worked examples must be small, concrete, and executable in the approved environment. Explain the input, rule/state change, and observable output.

## Workshop Blocks

Workshop Blocks teach a real build through connected micro-edits.

- Introduce the deliverable only on the first workshop step.
- Use at least three meaningful coding steps for a real workshop.
- Each coding step changes code; run/read/inspect-only actions are verification, not steps.
- State context, one exact task, expected change, focused explanation, acceptance criteria, and useful tutor questions.
- Preserve continuity: the next starter state equals the previous result state.
- Explain only the new delta instead of repeating the entire file.
- End with a non-coding summary explaining how the completed code works and where the pattern is useful.

Scratch builds start blank or with the smallest unavoidable shell. Preloaded implementation is reserved for repair or add-feature tasks.

## Practice Progression Rule

Teach before testing. A workshop is the first practical use of a new pattern. A lab follows relevant guided practice. A larger project follows multiple useful workshops and at least one transfer exercise when the scope needs it. Hard labs appear only near the end, after the learner has completed several workshops and small labs.

MCQs reinforce the exact topic and examples immediately preceding them; they do not assess prerequisites or ask generic study-strategy questions. Use distinct tracing, debugging, prediction, or scenario prompts rather than paraphrasing the same question. Distractors must represent plausible misconceptions, stay similar in length, and rotate correct answer positions. Explanations teach the topic after either answer without shaming the learner.

## Guided Project Rules

A Guided Project is one coherent deliverable, organized into feature-sized workshop blocks rather than one giant coding block or a miniature multi-module Course.

Generate exactly:

1. an introduction theory block with 2–4 substantive non-coding steps covering the deliverable, concepts, stack, libraries, and data flow;
2. two to six feature pairs, each containing a 2–5-step theory block immediately followed by a 4–10-step workshop block for that same feature;
3. for Basic, two to four features and 8–18 coding micro-steps; for Advanced, four to six features and 18–30 coding micro-steps with modular structure, state, validation, and edge cases;
4. a 1–2-step finished-code recap with no test.

Before each workshop, explain what the feature does, why it exists, the concepts and functions/components/APIs involved, any libraries used, its data flow, and how it connects to existing work. Return the initial workspace once, then one deterministic edit per coding step. Preserve exact file continuity within and across feature blocks. Each step teaches one small delta and its reason before the learner applies it; never provide a lump-sum solution for copying. Use natural explanatory prose; do not generate repetitive headings such as “Syntax You Need First” or “What this code means.” Do not add independent labs, quizzes, or unrelated theory.

## Exercise Pack Rules

Exercise discovery resolves whole-language vs selected topics, relevant experience, motivation, count (5–25), difficulty, and coding/MCQ mix. Generated packs contain exactly the approved count and only independent coding or MCQ problems—no theory modules, workshops, or answer dumps. Start with up to two easy MCQ warm-ups before the first lab, then mix coding and MCQs while progressing toward harder synthesis.

Every coding exercise is a compact role-play or work-ticket scenario. State who needs help, what the program should do, what is currently missing or broken, and why the result matters before giving the exact mission. Keep only the relevant files and code, but preserve a real rendered Output for visual work. Do not reveal the solution or turn the prompt into hand-holding.

Coding problems should prefer realistic debugging, missing-feature, transformation, validation, or data tasks. Starter code may be incomplete or broken. Each independent problem gets an isolated, focused workspace of normally two to five relevant files rather than an accumulated production-sized repository. Beginner tasks introduce one observable behavior with two or three checks. Visual browser/framework tasks must include a connected, runnable Output preview using approved pinned assets; omitted context comments are allowed only when the preview still works. Keep solution code private until the product explicitly reveals it.

## Exercise Feedback And Grading

A correct MCQ shows clear green success feedback. A wrong first answer shows a red explanation and invites another choice; a later correct retry completes the exercise but awards no XP. Successful exercises celebrate, convert Check into a green Next action, and persist completion.

Code grading prioritizes observable output and the core concept. Equivalent implementations and different valid line placement must pass; exact source structure is required only when the learning objective truly depends on it. Checking auto-opens the task checklist: unchecked items are grey, active checks spin, and passed items turn green. Failure guidance appears in the red result card beneath the execution surface, while the IDE only highlights the relevant line and never inserts AI comments into source code. Module changes show a bounded loading bar across the lesson card.

## Workspace Surfaces

Code is always available and is the initial surface on every lesson/problem transition. Request Output only for real browser-rendered HTML/CSS/JavaScript or an approved pinned browser library. Request Terminal only for actual console/Judge0 execution. Never create a Whiteboard/Visual surface or a fake browser representation of native code.

Opening an existing learning card shows its overview and progress first. Keep the center Code editor visible, but leave the left course/files panel closed until the learner starts or resumes the path. First Start opens the Course/Project/Exercises syllabus view; later Resume opens Files at the learner's last selected file.

For browser projects:

- HTML is the Output entrypoint;
- local CSS/JavaScript/framework source must be explicitly connected by the HTML file;
- use only exact pinned external assets supplied in the prompt;
- React uses plain JavaScript with `React.createElement`, not JSX/build tooling;
- Vue uses the supplied raw-browser `text/vue` convention and `render()` with `Vue.h`;
- Svelte uses the supplied raw-browser `text/svelte` convention;
- D3, Chart.js, and p5.js use their supplied pinned browser globals.

For console projects, use simple file layouts and standard-library code compatible with the approved Judge0 runtime.

## Tutor Visual Cues

Attach `TutorVisualCueV1` only when a diagram or illustration materially improves teaching. Prefer deterministic SVG for algorithms, data structures, control flow, memory, architecture, and exact relationships. Use an AI image only for genuinely spatial/conceptual illustration.

The cue needs a useful caption and alt text. It appears in chat, not in a workspace tab. Browser program results are never tutor visuals.

## RAG Rules

Retrieve only from the enabled corpus matching the resolved technology. Never mix syntax or APIs from another language. Ground factual syntax/runtime claims in approved source chunks and retain source provenance. Draft, failed, or cross-language-leaking corpora must not influence generation.

Use retrieval to improve correctness and sequencing, not to copy long source passages. Keep examples original and beginner-focused.

## Quality And Repair

Reject or repair content that has:

- unsupported technology/runtime promises;
- missing or contradictory file continuity;
- labs/projects before teaching and guided practice;
- fake native/browser output;
- answer dumps in starter code;
- vague tasks without observable acceptance criteria;
- repeated filler or leaked planning instructions;
- counts outside the confirmed proposal;
- cross-language syntax leakage.

Repair the smallest affected topic/block where possible. Preserve unrelated valid content. Before launch-package persistence, bounded repair failure releases the reservation and saves no Course. After launch, a failed later module preserves every approved checkpoint for recovery and never replaces it with generic fallback content. The final module count must exactly match the approved proposal; each Course module must contain at least six meaningful learner steps, while additional valid teaching may exceed the estimate without changing the approved Stone quote.

Semantic relevance checks must consider teaching earlier in the same block, preceding topic teaching, block context, code, and declared concepts. Weak word overlap alone is not proof that programming content is unrelated and must not block an otherwise valid course. After one smallest-scope AI repair, regenerate only the affected loaded module before retrying the complete job.
