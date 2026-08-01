# AI Course Generation Rules

This is Stonecode's human-editable curriculum rulebook. Code owns schemas, capability checks, prices, credit reservations, runtime limits, validation, and persistence. AI proposes and teaches within those boundaries.

## Universal Learning Entry

New learning has exactly three product modes:

- Course: a compact or deep structured curriculum.
- Guided Project: one continuous build taught step by step.
- Exercise Pack: focused MCQ/coding practice.

Legacy `short_course` records remain readable. New short requests generate as compact Courses.

Discovery is conversational planning, not a knowledge test. A learner may start from any entry point: a project idea, programming language, computing domain, feature, end goal, Course, Guided Project, or Exercise Pack. Gather only information that changes the result: mode, domain, concrete goal or outcome, supported technology/platform or subject, relevant experience, desired depth/guidance, preferred focus, deliverable, and branch-specific exercise/project preferences. Every question offers contextual suggested answers while free typing remains possible. A domain focus question may use multi-select choices; other questions remain single-select.

The learner's first message says what they want to learn or build. Accept checklist details in any order and infer completed fields from the full transcript. If one message already supplies the mode, technology, outcome, prior experience, guidance depth, and relevant branch preferences, proceed directly to the editable proposal. Otherwise ask only for missing information. Course discovery may ask which practical project should anchor the learning when that choice changes the syllabus.

Keep discovery short. Ask at most six to seven useful clarification questions before proposal. Do not polish optional preferences when the required checklist is already answered.

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

For a Course, generate the approved outline and every promised module inside the persisted background job. Generate modules as separate bounded model calls so one oversized response cannot silently drop later modules. Save and settle Stones only after the complete module count and delivered step scope match the approved proposal and quote band. A partial Course is a failed generation: save nothing and release the reservation.

Every delivered module contains complete teaching and guided practice and is available when the Course opens. The first step is a substantive welcome and course orientation, not a repeated product greeting.

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

Teach before testing. A workshop is the first practical use of a new pattern. A lab follows relevant guided practice. A larger project follows multiple useful workshops and at least one transfer exercise when the scope needs it.

MCQs reinforce the exact topic and examples immediately preceding them; they do not assess prerequisites or ask generic study-strategy questions. Use distinct tracing, debugging, prediction, or scenario prompts rather than paraphrasing the same question. Distractors must represent plausible misconceptions, stay similar in length, and rotate correct answer positions. Explanations teach the topic after either answer without shaming the learner.

## Guided Project Rules

A Guided Project is one coherent deliverable, organized into feature-sized workshop blocks rather than one giant coding block or a miniature multi-module Course.

Generate exactly:

1. a compact 1–3-step orientation/refresher based on declared background;
2. two to six workshop blocks, each representing one concrete major feature and containing 4–10 connected coding micro-steps;
3. 8–30 coding micro-steps across the complete project;
4. a 1–2-step finished-code recap with no test.

Return the initial workspace once, then one deterministic edit per coding step. Preserve exact file continuity within and across feature blocks. Each step teaches one small delta and its reason before the learner applies it; never provide a lump-sum solution for copying. Do not add independent labs, quizzes, or unrelated theory.

## Exercise Pack Rules

Exercise discovery resolves whole-language vs selected topics, motivation, count (5–25), difficulty, and coding/MCQ mix. Generated packs contain exactly the approved count and only independent coding or MCQ problems—no theory modules, workshops, or answer dumps.

Coding problems should prefer realistic debugging, missing-feature, transformation, validation, or data tasks. Starter code may be incomplete or broken. Keep solution code private until the product explicitly reveals it.

## Workspace Surfaces

Code is always available. Request Output only for real browser-rendered HTML/CSS/JavaScript or an approved pinned browser library. Request Terminal only for actual console/Judge0 execution. Never create a Whiteboard/Visual surface or a fake browser representation of native code.

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

Repair the smallest affected topic/block where possible. Preserve unrelated valid content. After bounded repair failure, return an actionable generation failure so the credit reservation can be released. Never save generic fallback or partial content as if it were the requested course. The final module count must exactly match the approved proposal; each Course module must contain at least six meaningful learner steps, and the delivered total must remain inside the approved quote band.

Semantic relevance checks must consider teaching earlier in the same block, preceding topic teaching, block context, code, and declared concepts. Weak word overlap alone is not proof that programming content is unrelated and must not block an otherwise valid course. After one smallest-scope AI repair, regenerate only the affected loaded module before retrying the complete job.
