# AI Course Generation Rules

## Universal Learning Entry

Discovery first resolves a server-validated `LearningBrief` for `course`, `short_course`, `exercise`, or `guided_project`. Only `course` uses the full course generator below. Short courses stay bounded and teach slowly, exercises remain independent practice, and guided projects are one complete workshop module: introduction theory, 10–20 continuous guided coding steps, then final theory recap. The confirmed type is immutable; a changed goal creates a linked new conversation.

For `course` and `guided_project`, discovery must capture relevant prior knowledge conversationally before assessment. Assessment is optional, offered only after the goal is resolved, and capped at three questions. Skipping must proceed to review using the declared starting point.

Guided-project generation must not repeat complete files inside every step. Return the initial workspace once, then one exact find/replace edit (or explicit create-file edit) per coding step. Server normalization expands these compact edits into the full starter/result/workspace state required by the IDE.

For `exercise`, discovery must resolve why the learner is practising, whole-language versus selected-topic scope, topics, count, difficulty, and the coding/MCQ mix. Default vague requests to ten exercises and a 70 percent coding proposal. Confirmation lists exact topics and exact counts and remains editable. Generated exercise sessions contain only one-step MCQ or independent coding problems—never theory, workshops, refreshers, or guided answer code.

This is the human-editable rulebook for Stonecode course generation.

Edit this file when you want to change how AI creates assessments, courses, modules, theory, workshops, labs, quizzes, and projects.

The code should treat this as the product rulebook. The long `server/course-generation.mjs` file is implementation plumbing.

## Big Goal

Stonecode should generate a self-sustaining programming tutor course.

The course should:

- teach slowly.
- assess prerequisite knowledge first when needed.
- generate a connected syllabus.
- teach one concept at a time.
- include exercises, quizzes, workshops, labs, and projects along the way.
- secretly lead toward a final project.
- make workshops and labs feel connected, not random.
- avoid generic filler.

## Course Shape

The visible course structure is fixed:

```txt
Course
-> Modules
-> Topics
-> Blocks
-> Steps
```

Do not change this hierarchy unless the product owner explicitly asks.

## Initial Generation Rule

Generate the full course outline, but only fully write Module 1 at first.

Module 1 must be high quality before generating later modules.

The first loaded course step should be a substantive, friendly course introduction before formal teaching, not only a tutor greeting.

It should use a few short paragraphs to include:

- what the course will help the learner do.
- common real-world use cases.
- one useful or interesting practical fact.
- a smooth bridge into the first concept.

Every later topic/chapter should also open with orientation: what problem it solves, how it connects to the course goal or project, and what the learner will understand or build. Theory begins with explanation and a mental model before bullets. Substantial new topics should include a useful analogy and explicitly map it back to code or runtime behavior.

Modules 2 and later should stay as locked outline shells until needed.

Reason:

- saves tokens.
- makes debugging easier.
- lets us perfect one module before repeating the system.

## Subject Support

Stonecode supports programming and software-related learning only.

Courses are generated fresh for each learner. Do not select from a hard-coded course library. Code may hard-code curriculum contracts, language capabilities, assessment policy, validation, and safe execution rules, but not fixed lesson content.

Allowed examples:

- JavaScript fundamentals
- React
- Next.js
- C++
- C++ game development
- C# / Unity scripting
- Python automation
- backend APIs
- full-stack web development
- data science with code
- SQL/database programming
- Kotlin, Swift, and Dart application development
- Go and Rust systems development
- R and Julia data programming
- Fortran, COBOL, and BASIC fundamentals

Unavailable examples:

- cooking
- fitness
- music
- history
- non-programming language learning
- finance/trading not focused on coding

If unavailable, say Stonecode currently supports programming, software, scripting, and code-related courses only.

## Conversational Course Discovery

Before assessment planning, the AI should discover what course the learner actually needs.

Discovery should:

- open with a friendly AI-generated greeting and one question about what the learner wants to learn or build.
- attach 2 to 6 contextual suggested answers to every clarification question.
- keep free typing available at every discovery turn.
- accept a precise target immediately, such as JavaScript fundamentals.
- clarify vague outcomes such as make a game, build a website, create an app, learn backend, or build AI.
- ask only one main question per turn.
- clarify only choices that materially change the curriculum: intended outcome, product type, platform, or technology choice.
- recommend plain-language paths when the learner does not know which language or framework to use.
- continue until the target is specific enough for assessment planning and course generation.

Suggested answers should answer the current question directly. They are shortcuts, not a hard-coded course catalog and not restrictions on what the learner may type.

Do not fabricate claims about live trends or what other users learned this week. The UI may describe broad examples as popular starting points, but real trend claims require real aggregated product data.

Do not ask for a numeric/self-rated level, learning style, pace, Leetcode preference, or design preference. Do ask conversationally what relevant concepts or projects the learner already knows; an optional prerequisite check may refine that evidence later.

## Assessment Planning

Assessment should be dynamic based on what the learner wants to learn.

Assessment policy is fixed:

- A standalone programming-language course starts from foundations without assessment.
- A framework or library course may offer an optional targeted prerequisite assessment.
- An advanced language specialization may offer an optional check of that language's foundations.
- A broad applied path such as web, backend, mobile, games, automation, or data science may offer an optional targeted prerequisite assessment.

Do not always check HTML, CSS, and JavaScript.

Examples:

- React should check JavaScript, HTML, and CSS basics.
- Next.js should check JavaScript, React, and request/response basics.
- C++ game development should check C++ syntax, variables, and functions.
- Unity scripting should check C# syntax, variables, functions, and component thinking.
- C++ fundamentals should not require prerequisite assessment; start from foundations.

Assessment exists to decide what prerequisite modules and bridges the course needs.

For an advanced, framework, library, game, web, data, or applied course, assessment also decides whether Module 1 should be a targeted refresher. A refresher must cover only base-language skills used by the requested course. Example: a Pygame refresher may cover the Python functions, loops, collections, imports, and classes needed for Pygame; it must not become a generic full Python course. Skip the refresher when assessment proves those prerequisites.

Do not use assessment to ask:

- preferred learning style.
- user level labels.
- project type.
- Leetcode preference.
- design preference.

## Adaptive Assessment Behavior

Start with an entry/mid prerequisite question.

If the learner is wrong or presses "I don't know":

- drop difficulty one level.
- stay in the same prerequisite area.
- find the lowest point where the learner can answer.

Do not keep asking harder questions after a miss.

Assessment questions should be beginner-friendly but diagnostic.

MCQ options should:

- have exactly 4 choices.
- have only one correct answer.
- use plausible wrong answers.
- be similar length and grammar.
- avoid obvious joke answers.
- avoid making the correct answer look longer or smarter.
- rotate the correct answer position.

## Assessment Review

After assessment, produce:

- strengths.
- gaps.
- suggested modules.

Do not generate course content during assessment review.

The review should become binding input for the generated course.

If the learner missed prerequisites, early module content must bridge those gaps.

## Hidden Course Blueprint

Every generated course should have a hidden course blueprint.

This blueprint is not a visible new UI hierarchy.

It should define:

- final project.
- mini-projects.
- concept sequence.
- prerequisite bridges.
- module goals.

Every workshop, lab, project, quiz, and theory block should connect to this hidden blueprint.

The course should feel like everything is building toward something, not a random list of lessons.

## Final Project Rule

Each learning program should secretly lead to a final project.

The final project should be realistic for the subject and learner level.

Examples:

- JavaScript fundamentals: small interactive console or browser app.
- React: small component-based app.
- Next.js: small routed app with basic data flow.
- C++ game development: tiny console/game-loop style project.
- Unity scripting: simple interactive scene behavior.
- Python automation: small automation helper script.

The course should not dump the final project at the start.

Instead:

- theory teaches needed ideas.
- workshops build small pieces.
- labs practice variants.
- quizzes check understanding.
- project blocks combine pieces later.

## Module Rule

Module count is not fixed.

The AI should choose the natural number of modules for the subject.

Module 1 should:

- start at the right prerequisite level.
- teach slowly.
- include enough theory before practice.
- include at least one practical workshop/lab/project block.
- prove the generation system works before later modules are loaded.

Later modules should:

- be planned in outline.
- stay locked.
- be generated later using the same rules once Module 1 quality is proven.

## Topic Rule

Each topic should start with theory before quizzes, workshops, labs, or projects.

Do not force every topic into the same pattern.

Valid topic rhythms:

- theory -> quick MCQ -> workshop.
- theory -> example -> workshop -> lab.
- theory -> quiz -> review.
- theory -> workshop -> lab -> recap.

Invalid rhythms:

- workshop before teaching the syntax.
- lab before the learner has seen the pattern.
- quiz with concepts not yet taught.
- every topic using the exact same template.

## Practice Progression Rule

Practical work follows a teaching ladder:

```txt
theory/example
-> guided workshop
-> independent lab
-> later milestone project
-> final project near the end of the course
```

This is a dependency rule, not a fixed template for every topic.

The arrows do not mean the blocks must be adjacent. Theory, examples, quizzes, reviews, more workshops, and topic transitions may sit between a workshop and its later lab.

- A workshop is hands-on teaching. It comes before independent code practice and teaches the pattern through atomic edits.
- A lab is a small checkpoint exam and test of transfer. It may appear later after the learner completed a relevant workshop, and it must reuse concepts and patterns already taught there. It does not need to immediately follow that workshop.
- A milestone project is a larger cumulative exam that combines several previously practiced ideas. The AI chooses the natural checkpoint, but only after multiple relevant workshops and at least one lab have established readiness.
- The final project is the course's main exam. It belongs near the end, after its required capabilities were taught and practiced.
- A topic does not need every block type. It may stop after theory, a quick check, or a workshop when independent assessment would be premature.
- A course may contain multiple labs and multiple milestone projects. Their count and placement are dynamic and should follow curriculum readiness, not a fixed quota.

Never use thorough theory alone as permission to create an independent lab. If the learner has not practiced the pattern with guided code changes, generate a workshop first.

## Block Types

Allowed block kinds:

- theory
- quiz
- workshop
- lab
- project
- review

Do not invent new block kinds unless the frontend supports them.

## Theory Blocks

Theory blocks teach.

They may include:

- theory steps.
- analogy steps.
- example steps.
- summary steps.
- optional single MCQ checks.

They must include real teaching before any MCQ.

Never create a theory block whose steps are only MCQs.

Theory blocks are flexible.

Use as many theory, analogy, example, and summary steps as the topic naturally needs.

Do not force exactly one theory step or exactly one MCQ.

Theory should:

- start with a plain mental model.
- explain why the concept exists.
- introduce technical names gradually.
- use tiny examples.
- use fenced code snippets with correct language tags when teaching syntax.
- explain new code tokens before the learner uses them.

Theory should not:

- ask open-ended learner work inside theory markdown.
- dump a full chapter at once.
- use generic filler.
- introduce unrelated future concepts.

## Quiz Blocks

Quiz blocks are exam-style checkpoints.

Quiz blocks should:

- contain only MCQ steps.
- usually have 4 to 10 MCQs.
- test recently taught material.
- use plausible distractors.
- rotate correct answers.

Single quick MCQs should live inside theory blocks, not separate quiz blocks.

## Workshop Blocks

Workshops are guided tutorials, not exams.

A workshop should:

- build a concrete mini-feature or mini-function.
- decide whether it is a scratch build or a repair/add-feature task. Scratch source begins blank or minimal; only repair/add-feature work preloads existing implementation code.
- use as many steps as the deliverable naturally needs.
- continue the same file/build unless clearly justified.
- ask for one atomic code action per step.
- usually ask for one line or one tiny change.
- require a real code change on every coding step; running, opening, inspecting, or confirming code is verification after the edit and never a standalone step.
- combine only tightly related units such as several imports or paired dimensions.
- explain what to write and why before asking the learner to continue.
- introduce the workshop deliverable compactly on Step 1 only.
- explain only the exact new line or micro-change relevant to the current step.
- carry starter code forward.
- connect to the hidden final project.

Workshop steps should feel like freeCodeCamp-style screens.

Each workshop step should include:

- what we are building.
- quick context: what the learner is learning and why it is useful.
- immediate action: what code to add/change now.
- a small syntax hint when relevant.
- a short `codeExplanation` for only the line or micro-change added now.
- 2 to 3 `suggestedQuestions` relevant to this exact step.
- acceptance criteria.
- a stable step id.
- the previous step id in `buildsOnStepId`, except Step 1.
- concept ids for what this edit practices.
- `starterCode`, meaning the exact file before the learner acts.
- `expectedChange`, meaning one exact micro-edit.
- `resultCode`, meaning the exact file after that micro-edit.

The final one or two workshop steps are different:

- it is a non-coding `summary` step.
- it explains what the completed code does and how the main parts connect.
- it explains where the pattern is useful.
- it invites the learner to ask follow-up questions before continuing.

For workshop continuity, each previous `resultCode` must exactly equal the next `starterCode`. Never preload a step's own `resultCode` into the editor.

## Practical Workspace Views

Every workshop, lab, or project step may control the center workspace with:

- `workspaceView`: `code`, `preview`, or `terminal`.
- `requiresPreview`: the learner must compare visible behavior.
- `requiresTerminal`: the learner must run or inspect output/errors/logs.
- `workspaceFiles`: the complete small project snapshot, including real relative folder paths, contents, purpose, and whether each file is editable.

Visual web, canvas, animation, and game work must keep a visible scene available. Scratch scenes grow from the learner's edits; bug-fix work starts with the broken scene and feature work may start with a minimal working baseline. Native projects use an HTML scene reference linked with `<meta name="stonecode-source" content="...">`, clearly labeled as synchronized learning representation; it must never claim to execute the native program.

If a saved lightweight visual step has no preview file, the client may deterministically repair it from the current source. This applies to simple web/Canvas, 2D drawing/game libraries, charts, and small UI representations. It does not require Terminal or AI. Unity, Unreal, Godot, Roblox Studio, CryEngine, GameMaker, Blender, and comparable full external engines must remain Code-only and must not receive a synthetic scene.

For browser projects, HTML is the Visual entrypoint. Local CSS and browser JavaScript must be explicitly linked from HTML with correct relative `href` and `src` paths. Visual must not silently inject unrelated workspace files. Selecting a linked CSS/JavaScript file may show its connected HTML entrypoint; selecting an unlinked asset should show connection guidance instead of a fake preview.

The first browser-visual step may open `preview`. A native scratch step opens Code for the required edit while keeping Visual and Terminal available. Later micro-edits can open `code` while still requiring a Visual comparison. Terminal-focused steps may open `terminal` after a code edit when output, compiler errors, tests, or logs verify that edit.

The tutor must reason across all listed files, folders, imports, assets, tests, and styles. It must not flatten a generated project or diagnose a multi-file problem from only the active file.

Do not:

- force exactly 4 steps.
- compress a real build into 1 or 2 vague steps.
- turn a workshop into "build this yourself".
- reset starter code to an unrelated example.
- introduce syntax that was not taught yet.
- repeat generic language syntax on every step.
- explain the whole starter file or show a starter excerpt on every step.

## Lab Blocks

Labs are independent practice after teaching.

A lab should:

- usually be one step.
- appear only after a relevant guided workshop.
- reuse the same pattern and concept set as an earlier relevant workshop.
- act as a small checkpoint exam after some learning distance; reviews, quizzes, theory, and other workshops may appear between the workshop and lab.
- use a different variant with less guidance.
- avoid new concepts.
- have clear starter code.
- have concrete acceptance criteria.

Labs should test transfer, not guessing.

## Project Blocks

Project blocks are for larger applied work.

Use project blocks only when the learner has enough foundation.

For a normal milestone project, readiness means the learner has completed multiple relevant workshops and at least one independent lab. A project must not be the learner's first or second practical coding experience.

A course may contain several milestone projects when the subject naturally has several cumulative checkpoints. These are not the final project. The final project remains the main course exam near the end.

Project blocks should:

- define a concrete deliverable.
- connect to the final project.
- include milestones or acceptance criteria.
- stay small enough for the current IDE workspace.

## Review Blocks

Review blocks close or reflect.

Review blocks may include:

- summary steps.
- reflection steps.

Reflection prompts must include a short recap or clue before asking the learner to answer.

## Code Exercise Rules

Workshop, lab, and project steps must include:

- language.
- file path.
- starter code.
- context.
- prompt.
- acceptance criteria.
- requiresPreview when visual checking is needed.

Use language-appropriate starter code.

Examples:

- JavaScript: `main.js`
- TypeScript: `main.ts`
- Python: `main.py`
- Java: `Main.java`
- C++: `main.cpp`
- C#: `Program.cs`
- HTML: `index.html`
- CSS: `styles.css`

Never use JavaScript starter code for a non-JavaScript course.

## Beginner Syntax Rule

Assume zero syntax knowledge unless assessment proves otherwise.

Explain new syntax the first time it appears:

- keywords.
- variable names.
- strings.
- quotes.
- parentheses.
- braces.
- semicolons.
- indentation.
- operators.
- output calls.
- function calls.

When teaching syntax, use fenced code snippets with the correct language tag.

Examples:

```js
const message = "hello";
console.log(message);
```

```csharp
string message = "hello";
Console.WriteLine(message);
```

Explain what each new word, symbol, and punctuation mark does before asking the learner to edit similar code.

## RAG Rules

Use retrieved context as grounding.

Current RAG sources include:

- hidden project spine pattern.
- workshop atomic-step pattern.
- lab transfer pattern.
- theory-before-code pattern.
- generated block quality rubric.
- selected official docs records for React, Next.js, MDN JavaScript, C++, C#, and Unity.

RAG should improve grounding, not add random noise.

Use only relevant chunks.

Do not retrieve future answer keys into learner-visible prompts.

## Quality Rules

Generated content should be rejected or repaired when:

- module 1 has no practical block.
- loaded topic has no theory.
- loaded topic has no interactive block.
- workshop is too short.
- quiz has fewer than 4 MCQs.
- theory is too thin.
- exercise context is too thin.
- exercise prompt is too vague.
- acceptance criteria are missing.
- starter code language is wrong.
- internal prompt text leaks into learner-facing content.
- a lab appears before any relevant workshop.
- a project appears before multiple workshops and an independent lab establish readiness.

## Things To Avoid

Avoid:

- fixed module count.
- fixed workshop step count.
- generic "beginner confusion" filler.
- unrelated examples.
- sudden hard projects.
- labs before teaching.
- quizzes before teaching.
- project work with no project spine.
- pretending user has skill that assessment did not prove.

## Current Debugging Rule

When debugging course generation, perfect Module 1 first.

Do not spend tokens generating modules 2, 3, or 4 until Module 1 quality is good.

Once Module 1 is good, later modules should use the same rules.

## Repair And Failure Rule

- Retry incomplete structured generation with a bounded larger output budget.
- Repair only warned topics and blocks. Never rewrite unrelated valid blocks during repair.
- Run independent topic repairs concurrently and stop after two passes.
- Structural, progression, syntax-teaching, missing-action, continuity, and code-delta failures remain blocking.
- After repair, a wording-only workshop-context warning may remain without discarding an otherwise valid course.
- If blocking failures remain, keep the assessment review available for retry. Do not create or save a generic recovery course.
