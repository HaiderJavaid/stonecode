# Personalized FreeCodeCamp-Style Course Generation Implementation Plan

> Historical plan, superseded on 2026-07-29 by `docs/PROJECT.md`, `docs/DECISIONS.md`, and `docs/AI_COURSE_GENERATION_RULES.md`. Keep only for implementation history; do not restore onboarding knowledge tests, Whiteboard/Visual tabs, or legacy generation routes from this document.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Stonecode course onboarding and generation so courses are personalized from prerequisite assessment results and organized like freeCodeCamp: Course -> Modules -> Topics -> Block Types -> Steps.

**Architecture:** Keep Stonecode's persistent IDE-first course workspace. Replace the current fixed chapter/section/block generation rules with a personalized curriculum planner, prerequisite gap detector, model router, and retrieval-backed content generator. Generate the full course structure early, fill the first module immediately, and lazily add or deepen later modules only when assessment or learner progress proves it is necessary.

**Tech Stack:** Vite, React, TypeScript, Node server, Supabase, OpenAI Responses API, existing `/api/course-generation/*`, existing `/api/tutor`, optional Supabase pgvector for RAG.

---

## Product Definition

Stonecode should not generate a fixed sequence such as `lecture -> workshop -> lab -> review -> quiz` for every topic.

Use this hierarchy:

```txt
Course
  Module
    Topic
      Block
        Steps
```

Use these product terms in UI and schema:

- **Course:** The full learning path the user created.
- **Module:** A major curriculum area, similar to a freeCodeCamp chapter/module.
- **Topic:** A focused lesson inside a module.
- **Block Type:** A teaching or assessment surface inside a topic.
- **Steps:** Atomic content units inside a block.

Every topic must include at least:

- `theory`
- `mcq`

Optional block types:

- `workshop`: guided step-by-step build.
- `lab`: independent challenge, debugging challenge, or tiny function.
- `project`: bigger applied task.
- `reflection`: explain in own words.
- `analogy`: simpler explanation.
- `recap`: condensed theory.

The block order must be generated based on the concept, prerequisite gaps, and course goal:

```txt
theory -> mcq -> theory -> mcq
theory -> mcq -> workshop -> theory -> mcq -> lab
recap -> mcq -> hard_lab -> reflection
theory -> theory -> mcq -> workshop
theory -> mcq -> analogy -> theory -> mcq
```

Do not force every topic to include workshop/lab/project.

---

## Existing Code Context

Read these files first:

```txt
docs/HANDOFF.yaml
docs/README.md
docs/PROJECT.md
docs/TASKS.md
docs/DECISIONS.md
docs/project-architecture.md
docs/ai-tutor-behavior.md
server/course-generation.mjs
server/llm-providers.mjs
server/stonecode-server.mjs
src/data/courses.ts
src/services/courseGeneration.ts
src/components/stonecode/CourseSetupCard.tsx
src/components/stonecode/CourseCard.tsx
src/components/stonecode/lessonData.ts
src/ai/prompts/*.md
```

Current generated content is `course-content/v1`:

```txt
GeneratedCourseContent
  chapters[]
    sections[]
      blocks[]
```

Target generated content should become `course-content/v2`:

```txt
GeneratedCourseContent
  modules[]
    topics[]
      blocks[]
        steps[]
```

Add backward compatibility so existing v1 courses still render.

---

## Target Schema

Add these TypeScript types in `src/data/courses.ts` or a new focused file such as `src/data/generatedCourseContent.ts`.

```ts
export type CourseContentSchemaVersion = "course-content/v1" | "course-content/v2";

export type GeneratedCourseContentV2 = {
  schemaVersion: "course-content/v2";
  title: string;
  subject: string;
  description: string;
  learnerProfile: LearnerProfileSnapshot;
  personalizationSummary: string;
  languages: string[];
  tags: string[];
  generationDepth: "full_structure_first_module" | "full_course";
  modules: GeneratedCourseModule[];
};

export type LearnerProfileSnapshot = {
  statedGoal: string;
  targetOutcome: string;
  readinessForTarget: "missing_prereqs" | "needs_bridging" | "ready" | "advanced_for_start";
  strengths: string[];
  gaps: string[];
  insertedPrerequisites: string[];
  skippedPrerequisites: string[];
};

export type GeneratedCourseModule = {
  id: string;
  title: string;
  summary: string;
  order: number;
  reason: string;
  source: "core" | "prerequisite" | "remediation" | "extension" | "project";
  topics: GeneratedCourseTopic[];
};

export type GeneratedCourseTopic = {
  id: string;
  title: string;
  summary: string;
  order: number;
  learningGoal: string;
  prerequisites: string[];
  difficulty: "easy" | "medium" | "hard";
  blocks: GeneratedCourseBlockV2[];
};

export type GeneratedCourseBlockV2 =
  | TheoryBlock
  | McqBlock
  | WorkshopBlock
  | LabBlock
  | ProjectBlock
  | ReflectionBlock
  | AnalogyBlock
  | RecapBlock;

export type TheoryBlock = {
  type: "theory";
  title: string;
  steps: TheoryStep[];
};

export type TheoryStep = {
  id: string;
  title: string;
  markdown: string;
  checksUnderstanding?: boolean;
};

export type McqBlock = {
  type: "mcq";
  title: string;
  steps: McqStep[];
};

export type McqStep = {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  misconceptionTags: string[];
};

export type WorkshopBlock = {
  type: "workshop";
  title: string;
  language: string;
  filePath: string;
  steps: WorkshopStep[];
};

export type WorkshopStep = {
  id: string;
  instruction: string;
  starterCode?: string;
  expectedChange: string;
  hint: string;
  acceptanceCriteria: string[];
};

export type LabBlock = {
  type: "lab";
  title: string;
  labKind: "independent" | "debugging" | "tiny-function";
  language: string;
  filePath: string;
  prompt: string;
  starterCode: string;
  userStories: string[];
  acceptanceCriteria: string[];
  tests?: string[];
  difficulty: "easy" | "medium" | "hard";
};

export type ProjectBlock = {
  type: "project";
  title: string;
  language: string;
  filePath: string;
  brief: string;
  milestones: string[];
  acceptanceCriteria: string[];
  rubric: string[];
};

export type ReflectionBlock = {
  type: "reflection";
  title: string;
  prompt: string;
  rubric: string;
};

export type AnalogyBlock = {
  type: "analogy";
  title: string;
  markdown: string;
};

export type RecapBlock = {
  type: "recap";
  title: string;
  markdown: string;
  keyTakeaways: string[];
};
```

Validation rules:

- Every course has at least one module.
- Every module has at least one topic.
- Every topic has at least one `theory` block and one `mcq` block.
- MCQ blocks must contain multiple MCQ steps.
- Theory blocks may contain one or many theory steps.
- Workshop blocks must contain as much steps as possible ranging 5-15 steps with some are 20 steps.
- Lab blocks are usually one independent task and do not require nested steps.
- Project blocks are only for broader applied tasks.
- File paths must be simple and safe: no absolute paths, no `..`, no shell paths.
- Generated code exercises must reuse the active IDE file unless the user explicitly starts a project.

---

## Onboarding And Assessment Flow

Replace the current setup flow with this staged flow:

```txt
1. Ask desired subject.
2. Reply like: "Oh, so you want to learn Machine Learning? Let's see if you already have the necessary skills for this. Are you ready?"
3. If ready, dynamically load assessment exercises in the exercise UI.
4. Assessment exercises may be MCQ, writing, or code/editor checks.
5. Every assessment exercise has a Skip option for unknown answers.
6. Detect strengths, gaps, and missing prerequisites.
7. Show a short assessment review: strong areas, weak areas, and suggested modules/lessons to include.
8. Immediately generate and save the full personalized course structure.
9. Show modules in the left panel Course tab by default.
```

Do not ask for learning mode, user level, project type, Leetcode preference, preferred pace, or design preference during setup.

Do not show a separate course preview and do not ask for final confirmation after the assessment review. The assessment review itself explains why modules are included; course generation follows immediately.

Assessment must be adaptive:

- Start broad and easy.
- Increase or decrease difficulty based on answer quality.
- Ask no more than 5-9 questions unless the learner asks for deeper prerequisite diagnosis.
- If the user says "not sure", mark the concept as weak and explain briefly.
- Do not punish uncertainty; use it as a module-customization signal.
- Ask one question at a time.
- Do not generate the course until assessment completes.
- Assessment customizes the course. It is not a user-level quiz and should not label the learner in the UI.

Assessment output shape:

```ts
type AssessmentResult = {
  subject: string;
  requestedCourse: string;
  readinessForTarget: "missing_prereqs" | "needs_bridging" | "ready" | "advanced_for_start";
  confidence: number;
  strengths: string[];
  gaps: string[];
  suggestedModules: string[];
  requiredPrerequisites: PrerequisiteInsertion[];
  recommendedDepth: "gentle" | "normal" | "accelerated";
  assessmentTrace: AssessmentTurn[];
};

type PrerequisiteInsertion = {
  moduleTitle: string;
  reason: string;
  requiredFor: string[];
  depth: "minimal" | "normal";
  mustAvoidFullCourse: boolean;
};

type AssessmentTurn = {
  question: string;
  userAnswer: string;
  result: "correct" | "partial" | "incorrect" | "unsure";
  conceptTags: string[];
  followUpReason: string;
};
```

Important personalization rule:

```txt
Insert only necessary prerequisite material, not full prerequisite courses.
```

Example:

```txt
User wants Next.js + TypeScript but fails basic HTML.
Do not add a full HTML course.
Add a minimal module:
"HTML Essentials for React and Next.js"
Topics:
- elements and attributes
- forms and inputs
- semantic page structure
- links/images
```

For ML:

```txt
Weak Python user:
insert "Python Data Basics for ML".

Strong Python user:
skip Python refresher and start with data preparation/workflow.
```

---

## RAG Systems

Implement retrieval as small focused systems. Do not dump all retrieved context into every request.

### 1. Curriculum Pattern RAG

Purpose:

- Teach the model Stonecode's freeCodeCamp-style structure.
- Retrieve examples of good course/module/topic/block layouts.

Sources:

- Internal Stonecode examples.
- Extracted freeCodeCamp structural notes, not copied course content.
- Block pattern examples: theory+MCQ, workshop steps, lab user stories, review, recap, project.

Retrieve when:

- Generating full course structure.
- Generating a module.
- Repairing invalid course JSON.

Chunk shape:

```ts
type CurriculumPatternChunk = {
  id: string;
  kind: "course-pattern" | "module-pattern" | "topic-pattern" | "block-pattern";
  subjectArea: string;
  level: string;
  blockSequence: string[];
  notes: string;
};
```

### 2. Prerequisite Graph RAG

Purpose:

- Decide what minimum prerequisite knowledge is required.
- Insert only necessary prerequisite modules.

Sources:

- Curated prerequisite graph.
- Subject dependency maps.
- Assessment concept tags.

Retrieve when:

- Assessment ends.
- User asks to change subject.
- Learner repeatedly fails a topic.

Chunk shape:

```ts
type PrerequisiteChunk = {
  id: string;
  targetSubject: string;
  targetTopic: string;
  prerequisiteConcept: string;
  minimumDepth: "minimal" | "normal";
  avoidTeaching: string[];
  diagnosticQuestions: string[];
};
```

### 3. Learner Profile RAG

Purpose:

- Personalize tone, pacing, prerequisite insertion, and difficulty.

Sources:

- Assessment result.
- Course progress.
- Failed MCQs.
- Lab attempts.
- Hints used.
- Skipped topics.

Retrieve when:

- Generating the next tutor reply.
- Generating or adapting exercises.
- Deciding if remediation is needed.

Chunk shape:

```ts
type LearnerProfileMemory = {
  userId: string;
  courseId: string;
  strengths: string[];
  weakConcepts: string[];
  preferredStyle: string[];
  pace: "slow" | "normal" | "fast";
  recentFailures: string[];
  recentSuccesses: string[];
};
```

### 4. Course Content RAG

Purpose:

- Keep tutor conversation aligned with current generated course.
- Prevent jumping ahead.

Sources:

- Current course structure.
- Current module/topic/block.
- Previous completed blocks.
- Locked future modules summaries only.

Retrieve when:

- `/api/tutor` request.
- Lesson intro.
- Exercise hint.
- Chat answer grading.

Rules:

- Retrieve current topic fully.
- Retrieve previous topic summary.
- Retrieve future topics only as titles/summaries.
- Never reveal future answer keys.

### 5. Exercise Bank RAG

Purpose:

- Generate exercises in the same style without repeating exact tasks.

Sources:

- Stonecode-created exercises.
- Difficulty-labeled challenge patterns.
- Debugging challenge templates.
- User-story lab templates.

Retrieve when:

- Generating workshop/lab/project blocks.
- Replacing a too-easy or too-hard exercise.

Chunk shape:

```ts
type ExercisePatternChunk = {
  id: string;
  language: string;
  difficulty: "easy" | "medium" | "hard";
  skillTags: string[];
  blockType: "workshop" | "lab" | "project";
  pattern: string;
  antiPatterns: string[];
};
```

### 6. Rubric RAG

Purpose:

- Grade chat answers, reflections, labs, and projects consistently.

Sources:

- Block-specific rubrics.
- Common misconception tags.
- Pass/fail examples.

Retrieve when:

- Grading reflection/chat exercise.
- Generating feedback.
- Deciding remediation.

### 7. Official Docs RAG

Purpose:

- Ground framework/library facts.

Sources:

- Official docs only for modern libraries/frameworks.
- Version metadata.

Retrieve when:

- Topic requires unstable/current framework behavior.
- Examples use framework APIs.

Rules:

- Use official documentation only.
- Include doc version/date in internal metadata.
- Do not browse at runtime unless an explicit retrieval pipeline supports it.

### 8. Style RAG

Purpose:

- Keep continuous learning conversation consistent.

Sources:

- Stonecode tutor prompt files.
- User preference memory.
- Good tutor response examples.

Retrieve when:

- Streaming tutor conversation.
- Lesson intro.
- Hints.

---

## Model Picker

Add a model router instead of one global `OPENAI_MODEL`.

Environment variables:

```txt
OPENAI_MODEL_LOW=
OPENAI_MODEL_MEDIUM=
OPENAI_MODEL_HIGH=
OPENAI_MODEL_REASONING=
OPENAI_MODEL_GRADER=
OPENAI_MODEL_EMBEDDING=
```

Fallback:

```txt
If a role env var is missing, use OPENAI_MODEL.
If OPENAI_MODEL is missing, use the existing app default.
```

Model selection table:

| Feature | Model Class | Why |
|---|---|---|
| Subject onboarding reply | low/medium | Short conversational turn |
| Adaptive assessment question generation | high/reasoning | Needs diagnosis and follow-up strategy |
| Assessment result synthesis | high/reasoning | Determines prerequisite insertion |
| Full course structure generation | high/reasoning | Highest planning risk |
| First module full content generation | high/reasoning | Must set course quality |
| Later module generation | medium/high | Use high for hard topics, medium for easy topics |
| Streaming tutor chat | low/medium | Continuous style, low latency |
| Lesson intro | low/medium | Contextual teaching, not deep planning |
| Theory step expansion | medium | Needs clarity, not heavy reasoning |
| Simple MCQ generation | low/medium | Cheap and structured |
| Hard MCQ / misconception diagnosis | high | Needs careful distractors |
| Workshop generation | medium | Multi-step procedural task |
| Easy lab generation | medium | Needs tests/user stories |
| Hard lab/project generation | high/reasoning | More complex correctness/rubric |
| Hint generation | low/medium | Short and bounded |
| Reflection grading | medium | Semantic judgment |
| Code exercise grading | high/reasoning | Correctness and edge cases |
| RAG query rewriting | low | Cheap transformation |
| RAG chunk summarization | low/medium | Background job |
| Safety/policy classifier | low/medium | Short classification |

Routing function:

```ts
type ModelRole =
  | "low"
  | "medium"
  | "high"
  | "reasoning"
  | "grader"
  | "embedding";

type ModelTask =
  | "setup_reply"
  | "assessment_question"
  | "assessment_synthesis"
  | "course_structure"
  | "module_content"
  | "tutor_chat"
  | "lesson_intro"
  | "theory_step"
  | "mcq_simple"
  | "mcq_hard"
  | "workshop"
  | "lab_easy"
  | "lab_hard"
  | "project"
  | "hint"
  | "reflection_grade"
  | "code_grade"
  | "rag_query"
  | "rag_summary";

export function chooseModelRole(task: ModelTask, difficulty?: "easy" | "medium" | "hard"): ModelRole {
  if (task === "course_structure" || task === "assessment_synthesis") return "reasoning";
  if (task === "assessment_question") return "high";
  if (task === "code_grade" || task === "lab_hard" || task === "project") return "grader";
  if (task === "mcq_hard") return "high";
  if (task === "module_content" && difficulty === "hard") return "high";
  if (task === "workshop" || task === "lab_easy" || task === "theory_step") return "medium";
  if (task === "tutor_chat" || task === "lesson_intro" || task === "hint") return "low";
  if (task === "rag_query") return "low";
  return "medium";
}
```

Server changes:

- Replace `resolveTutorProviderConfig(env)` with `resolveProviderConfig(env, task, difficulty)`.
- Record selected model in `usage_events.model`.
- Include `model_role` and `model_task` if schema supports it later.
- Add cost metadata in response where useful, but do not show raw provider internals to learners.

---

## Prompt Contracts

### Assessment Question Prompt

```txt
You are Stonecode's prerequisite assessment tutor.

Goal:
Ask exactly one short assessment exercise that helps customize the requested course by finding necessary prerequisite modules and useful lessons.

Inputs:
- subject
- previous assessment turns
- known strengths
- known gaps
- prerequisite graph snippets

Rules:
- Ask one question only.
- Use multiple choice for early/basic checks.
- Use short free-response only when multiple choice cannot reveal understanding.
- If the learner is unsure, explain the answer briefly and mark the concept as weak.
- Do not ask for user level, learning mode, project preference, or Leetcode preference.
- Do not generate a course.
- Do not shame the learner.
- Prefer prerequisite concepts that are necessary for the target subject.

Return JSON:
{
  "replyMarkdown": "string",
  "conceptTags": ["string"],
  "expectedAnswer": "string",
  "gradingRubric": "string",
  "difficulty": "easy|medium|hard",
  "questionType": "mcq|short_answer"
}
```

### Assessment Synthesis Prompt

```txt
You are Stonecode's curriculum customization planner.

Create an assessment result from the transcript.

Rules:
- Identify the prerequisite skills needed for the requested subject.
- Insert only minimum necessary prerequisite modules.
- Do not insert a full prerequisite course unless absolutely required.
- Explain every inserted prerequisite with "requiredFor".
- Summarize strengths, weak areas, and suggested modules.

Return JSON matching AssessmentResult.
```

### Course Structure Prompt

```txt
You are Stonecode's freeCodeCamp-style curriculum architect.

Generate a full personalized course structure as JSON.

Hierarchy:
Course -> Modules -> Topics -> Blocks -> Steps.

Required:
- Every topic must contain at least one theory block.
- Every topic must contain at least one mcq block.
- Workshop, lab, project, reflection, analogy, and recap are optional.
- Block order must depend on concept complexity and learner level.
- Do not force lecture/workshop/lab/review/quiz sequence.
- Insert prerequisite modules only when the assessment proves they are needed.
- For prerequisites, teach only what is necessary for the target subject.
- Generate the full course structure early.
- Fully fill the first module.
- Later modules may include topic/block outlines and empty step arrays if generationDepth is "full_structure_first_module".
- Do not create or require a separate preview step.

Return only valid JSON matching course-content/v2.
```

### Module Content Prompt

```txt
Generate full content for one module of an existing course-content/v2 course.

Rules:
- Preserve module/topic ids.
- Fill all topic blocks with steps.
- Every topic must still include theory and mcq.
- Keep examples aligned with learner profile and previous modules.
- Avoid repeating earlier labs.
- Use simple active-file paths.
- Do not generate folder-heavy projects unless the block type is project.
```

### Tutor Chat Prompt Addition

Add to `src/ai/prompts/tutor-behavior.md`:

```txt
When course-content/v2 is present, follow Module -> Topic -> Block -> Step order.
Do not flatten a topic into one long answer.
For theory blocks, teach the current step only.
For MCQ blocks, ask or grade one MCQ step at a time.
For workshop blocks, guide one workshop step at a time.
For lab/project blocks, review the learner's actual attempt before giving stronger hints.
Do not skip prerequisite modules inserted by assessment unless the learner explicitly asks to skip.
If the learner repeatedly fails a topic, recommend a minimal remediation topic rather than regenerating the full course.
```

---

## Guardrails

### Curriculum Guardrails

- Do not generate a fixed block template for every topic.
- Do not add unnecessary prerequisite courses.
- Do not skip MCQ checks.
- Do not put answer keys where the learner can see them.
- Do not reveal future locked assessments.
- Do not generate huge chapters as one response.
- Do not generate workshop/lab/project unless it serves the topic.
- Do not use "theory" as a UI-only label without real teaching steps.

### Assessment Guardrails

- Ask one assessment question at a time.
- Make the assessment feel supportive.
- If the learner is uncertain, mark the concept weak and continue.
- Stop assessment once prerequisite/module customization is clear.
- Do not ask endless questions to maximize confidence.
- Do not generate course before assessment completes.
- Do not ask for final confirmation after assessment review.
- Assessment review must be followed by immediate full course generation.

### Tutor Guardrails

- Learner is primary programmer.
- Do not paste full solutions by default.
- Use the active IDE file as a whiteboard.
- Hints should be one next move, not the full answer.
- Review actual answer/code before grading.
- Keep current topic order unless learner asks to detour.
- Save progress only at checkpoints.

### RAG Guardrails

- Retrieve only relevant chunks.
- Never retrieve answer keys for visible learner prompts.
- Keep future locked content summarized.
- Official docs RAG must use official sources only.
- Store source ids and retrieval reason for debugging.
- Avoid over-retrieval; context should stay small.

### Model Guardrails

- High/reasoning models are for planning, assessment synthesis, hard grading, and hard exercise creation.
- Low/medium models are for continuous tutor conversation, hints, simple MCQs, and style-preserving replies.
- Always validate JSON from generation models.
- If high model fails, fallback must produce safe minimal structure, not malformed content.
- Record usage event for every model call.

### Security Guardrails

- No arbitrary shell execution.
- No untrusted backend code execution.
- Active-file browser worker only for beginner snippets.
- Sanitize generated file paths.
- Preserve auth checks on all course generation routes.
- Do not trust client-submitted rubrics or answer keys without server validation.

---

## Implementation Tasks

### Task 1: Add V2 Types And Normalizers

**Files:**

- Modify: `src/data/courses.ts`
- Modify: `server/course-generation.mjs`
- Test/Create: `server/course-generation-v2.test.mjs` or add verifier script if no test runner exists

- [ ] Add `course-content/v2` TypeScript types.
- [ ] Add server normalizers for modules, topics, blocks, and steps.
- [ ] Keep v1 normalizers unchanged for existing users.
- [ ] Add validation for compulsory `theory` and `mcq` per topic.
- [ ] Add safe file path normalization.

Acceptance:

```txt
Valid v2 content normalizes.
Topic without theory fails.
Topic without mcq fails.
Unsafe file path is cleaned.
Existing v1 course still renders.
```

### Task 2: Add Model Router

**Files:**

- Modify: `server/llm-providers.mjs`
- Modify: `server/stonecode-server.mjs`

- [ ] Replace one-model config with task-based model selection.
- [ ] Add env support for low/medium/high/reasoning/grader/embedding.
- [ ] Record chosen model in usage events.
- [ ] Keep `OPENAI_MODEL` fallback.

Acceptance:

```txt
setup reply uses low/medium.
assessment synthesis uses high/reasoning.
course structure uses high/reasoning.
tutor chat uses low/medium.
hard lab/code grading uses grader/high.
```

### Task 3: Add Adaptive Assessment State

**Files:**

- Modify: `src/components/stonecode/CourseSetupCard.tsx`
- Modify: `src/services/courseGeneration.ts`
- Modify: `server/stonecode-server.mjs`
- Modify: `server/course-generation.mjs`

- [ ] Add assessment transcript state.
- [ ] Add `/api/course-generation/assessment-question`.
- [ ] Add `/api/course-generation/assessment-synthesis`.
- [ ] Ask "Let's see if you already have the necessary skills for this. Are you ready?" before assessment.
- [ ] Stop assessment once prerequisite/module customization is clear.

Acceptance:

```txt
User can answer adaptive assessment questions one by one.
System marks skipped/unsure answers as prerequisite gaps.
Course generation waits until synthesis completes, then starts immediately.
```

### Task 4: Generate Personalized Full Structure

**Files:**

- Modify: `server/course-generation.mjs`
- Modify: `server/stonecode-server.mjs`
- Modify: `src/services/courseGeneration.ts`

- [ ] Build `buildPersonalizedCourseStructurePrompt`.
- [ ] Include assessment result, prerequisite snippets, curriculum pattern snippets, and learner goal.
- [ ] Generate full course structure.
- [ ] Fully fill first module.
- [ ] Leave later modules as outlines if needed.

Acceptance:

```txt
Weak Python ML user gets Python Data Basics prerequisite.
Strong Python ML user skips Python Data Basics.
Every topic has theory + MCQ.
Workshop/lab/project appears only when useful.
```

### Task 5: Render V2 Course Structure

**Files:**

- Modify: `src/components/stonecode/lessonData.ts`
- Modify: `src/components/stonecode/CourseCard.tsx`
- Modify: `src/components/stonecode/CourseRoadmap.tsx` if present
- Modify: `src/components/stonecode/CourseHome.tsx` if present

- [ ] Convert modules/topics/blocks/steps into lesson navigation.
- [ ] Show module and topic grouping.
- [ ] Render current block step-by-step.
- [ ] Gate MCQ progression.
- [ ] Gate lab/project progression by grading state.

Acceptance:

```txt
Learner sees Module -> Topic -> current block.
Theory step does not dump whole topic.
MCQ appears as checkpoint.
Workshop advances step by step.
Lab uses active editor.
```

### Task 6: Add RAG Retrieval Layer

**Files:**

- Create: `server/rag/retrieve.mjs`
- Create: `server/rag/curriculum-patterns.mjs`
- Create: `server/rag/prerequisites.mjs`
- Create: `server/rag/rubrics.mjs`
- Modify: `server/course-generation.mjs`
- Modify: `server/stonecode-server.mjs`

- [ ] Start with static curated JSON chunks if pgvector is not ready.
- [ ] Add interfaces so pgvector can replace static retrieval later.
- [ ] Retrieve only needed chunks per task.
- [ ] Log retrieval ids server-side in development.

Acceptance:

```txt
Course generation receives curriculum pattern chunks.
Assessment synthesis receives prerequisite chunks.
Tutor chat receives current topic and learner memory only.
No future answer keys are retrieved.
```

### Task 7: Add Grading And Remediation Hooks

**Files:**

- Modify: `server/stonecode-server.mjs`
- Modify: `server/llm-providers.mjs`
- Modify: `src/components/stonecode/CourseCard.tsx`

- [ ] Grade MCQ locally when answer key is present.
- [ ] Grade reflection/chat exercises with medium/grader model.
- [ ] Grade hard labs/code exercises with grader/high model.
- [ ] Track failed concept tags.
- [ ] Recommend minimal remediation topic after repeated failures.

Acceptance:

```txt
Failed MCQ updates weak concept memory.
Repeated failures suggest one minimal remediation topic.
Course does not regenerate completely.
```

### Task 8: Verification

Run:

```bash
npm run typecheck
npm run build
npm run verify:generated-course-content
npm run verify:tutor-flow
npm run verify:response-stream
npm run verify:usage-summary
```

Manual QA:

```txt
login
empty dashboard
add learning course
choose Machine Learning for fun
assessment path for weak Python
assessment review includes prerequisite module suggestions
course generates immediately
start project
theory step renders
MCQ checkpoint gates next
workshop step renders one step at a time
lab uses active IDE file
refresh persists course state
```

Repeat with strong Python answers:

```txt
no Python refresher module
starts directly with ML workflow/data preparation
```

---

## Mock Expected Outputs

### Weak Python User: Machine Learning For Fun

```txt
Course: Machine Learning for Fun

Module 0: Python Data Basics for ML
  Topic: Python Values and Variables
    Theory: variables, strings, numbers, booleans, print, type
    MCQ: 5 checks
    Workshop: profile summary script
    Lab: fix broken variables
  Topic: Lists, Dictionaries, and Rows
    Theory: list, dict, dataset row
    MCQ: 6 checks
    Workshop: tiny animal dataset
    Lab: update rows
  Topic: Functions for Prediction Logic
    Theory: parameters, return values, reusable logic
    MCQ: 5 checks
    Workshop: rule-based predictor

Module 1: What Machine Learning Is
  Topic: Rules vs Learning
    Theory
    MCQ
    Analogy
    Workshop
  Topic: Features and Labels
    Theory
    MCQ
    Lab

Module 2: First Dataset
Module 3: First Prediction Model
Module 4: Classification
Module 5: Overfitting
Module 6: Fun ML Project
```

### Strong Python User: Machine Learning For Fun

```txt
Course: Machine Learning for Fun

Module 1: ML Mental Model
  Topic: Learning From Data
    Theory
    MCQ
    Lab
  Topic: ML Workflow
    Theory
    MCQ
    Workshop

Module 2: Data Preparation
  Topic: Pandas for ML Tables
    Theory
    MCQ
    Workshop
  Topic: Missing and Categorical Data
    Theory
    MCQ
    Lab

Module 3: Regression
Module 4: Classification
Module 5: Validation and Overfitting
Module 6: Feature Engineering
Module 7: Unsupervised Learning
Module 8: Final Applied Project
```

---

## Agent Implementation Prompt

Use this prompt when handing the task to another AI coding agent:

```txt
You are implementing Stonecode's personalized freeCodeCamp-style course generation.

Read first:
- AGENTS.md
- docs/HANDOFF.yaml
- docs/README.md
- docs/PROJECT.md
- docs/TASKS.md
- docs/DECISIONS.md
- docs/project-architecture.md
- docs/ai-tutor-behavior.md
- docs/superpowers/plans/2026-06-30-personalized-freecodecamp-course-generation.md

Goal:
Implement course generation where onboarding assessment personalizes the full course structure immediately after assessment review. The structure must be Course -> Modules -> Topics -> Block Types -> Steps. Each topic requires theory and MCQ. Workshop, lab, project, reflection, analogy, and recap are optional and must be inserted only when useful.

Do not implement a fixed lecture/workshop/lab/review/quiz pattern.

Must build:
1. course-content/v2 schema and normalizer.
2. Backward compatibility for course-content/v1.
3. Adaptive assessment question and synthesis endpoints.
4. Personalized course structure generation using assessment results.
5. Model router with low/medium/high/reasoning/grader roles.
6. RAG abstraction for curriculum patterns, prerequisites, learner profile, course content, exercise bank, rubrics, docs, and style.
7. V2 rendering in the left-panel Course tab and tutor lesson flow.
8. Guardrails and verification.

Model routing:
- high/reasoning for assessment synthesis and full course structure.
- high/reasoning for hard labs/projects/code grading.
- medium for workshops, theory expansion, normal labs.
- low/medium for continuous tutor chat, hints, and lesson intros.
- low for RAG query rewriting and summarization.

RAG:
- Start with static curated chunks if vector search is not present.
- Keep interfaces vector-ready.
- Never retrieve answer keys into visible learner prompts.
- Current topic can be retrieved fully.
- Future locked content only as summaries.

Validation:
- Every topic must have theory and MCQ.
- File paths safe.
- No hidden answer key leak.
- Existing courses still render.

Run:
- npm run typecheck
- npm run build
- npm run verify:generated-course-content
- npm run verify:tutor-flow
- npm run verify:response-stream
- npm run verify:usage-summary

Do not commit or push unless the user explicitly asks.
```

---

## Self-Review Checklist

- The plan preserves Stonecode's existing course workspace.
- The plan avoids a fixed block sequence.
- The plan uses the user's preferred terms.
- The plan makes theory and MCQ compulsory per topic.
- The plan makes workshop/lab/project/reflection/analogy/recap optional.
- The plan includes weak vs strong Python ML examples.
- The plan includes RAG systems and retrieval guardrails.
- The plan includes model picker behavior.
- The plan includes implementation tasks and verification.
