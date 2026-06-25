# Onboarding, Course Home, and Exercises Design

## Goal

Make course creation feel guided, give every finalized course a useful home screen, and add a separate practice lane for users who want to code immediately.

## Product Model

Stonecode has two related challenge sources:

- **Course challenges** are embedded in syllabus lessons, unlimited, and required where specified for course progress.
- **Independent exercises** use the same skills but different scenarios and angles. They are generally harder, more varied, and subject to plan limits.

Both use one shared challenge result model for XP and activity tracking. Only course challenges affect course completion.

## Onboarding Flow

The setup conversation begins with “What do you want to learn today?” and gathers:

1. Learning objective.
2. Current experience level.
3. Preferred outcome, project, or practical use case.

After enough context exists, the assistant proposes a draft course containing:

- course title and summary;
- languages and technologies;
- topic tags;
- ordered syllabus sections;
- representative project and challenge outcomes.

The learner may continue chatting to amend the proposal. Finalize remains available once a valid draft exists and creates the course shell from the latest proposal.

The first implementation uses deterministic local responses and structured draft data. AI-backed generation is a later replacement behind the same data shape.

## Course Home

Opening a finalized course first shows a course home surface rather than immediately opening a lesson.

The top overview contains:

- course title and short summary;
- overall course progress;
- current section and last activity;
- compact language and topic tags.

Primary actions are:

- **Start project** before workspace files exist, or **Resume learning** afterward;
- **Exercises** for independent practice related to this course;
- **Course roadmap** for syllabus navigation.

Course details become part of the overview instead of a separate primary action.

## Course Roadmap

The roadmap is generated from the real course syllabus. Each section shows its title, summary, progress state, and challenge presence.

Roadmap sections act as navigation:

- completed and current sections can always be opened;
- later sections are visible and navigable;
- navigating backward does not reset progress;
- there are no placement tests or artificial topic locks.

The current static lesson sequence will be adapted into structured syllabus sections until AI-generated course content exists.

## Independent Exercises

Independent Exercises is a direct-practice mode for learners who want to skip lessons and start coding.

Exercises remain relevant to the selected course but must not duplicate its lesson challenges. They should change the scenario, constraints, data, or practical framing. Suitable formats include:

- feature implementation;
- bug diagnosis and repair;
- refactoring;
- terminal coding tasks;
- API/data transformation;
- accessibility and responsive UI fixes;
- realistic small business or product scenarios.

The first implementation uses curated mock exercises. AI generation and server-validated grading come later.

## Exercise Interaction

Each independent exercise presents:

- scenario and acceptance criteria;
- language, topic, difficulty, and XP;
- editable code or workspace context;
- Run, Hint, and Skip controls;
- result feedback.

Rules:

- A learner gets one hint interaction per exercise.
- Hint opens a focused AI-style chat for one submitted question.
- After the hint response, the hint composer locks for that exercise.
- Run may be used repeatedly until the answer succeeds.
- Before success, Skip replaces the current exercise with another relevant scenario.
- Independent Skip can be used once per local calendar day.
- After success, Skip becomes Next.
- Failed runs and skips do not consume completion allowance.

## Plan Limits

Plan limits apply only to successful independent exercise completions. Course challenges remain unlimited.

For the Free plan:

- two successful independent exercise completions per local calendar day;
- one independent exercise skip per local calendar day;
- one hint interaction per exercise.

The UI must show remaining completions and skip availability. Initial limits may be represented in local state for interaction design, but they are not authoritative until enforced server-side.

Paid-plan quantities will come from subscription configuration rather than being embedded throughout UI components.

## Tracking Model

Every successful challenge eventually records:

- user and challenge identifiers;
- source: `course` or `independent`;
- source course and syllabus section when applicable;
- language and topic;
- difficulty and awarded XP;
- completion date and timestamp;
- attempt count;
- whether the hint was used.

Course challenge completion updates course and section progress. Independent completion does not.

Both sources contribute to:

- total XP;
- per-language and per-topic statistics;
- daily activity counts;
- the future GitHub/LeetCode-style profile heatmap.

Heatmap UI and durable challenge persistence are explicitly outside the first UI implementation, but the challenge types should preserve these fields.

## Component Boundaries

- `CourseSetupCard` owns the setup conversation and structured draft preview.
- `CourseHome` owns overview metadata and primary navigation.
- `CourseRoadmap` renders syllabus state and selects a lesson section.
- `IndependentExercisePanel` owns the direct-practice interaction.
- `challengeData` defines shared challenge types and initial mock exercises.
- `exerciseSession` owns daily allowance, skip, hint, attempt, and completion state.
- Existing tutor lesson UI continues to own course challenges.

`CourseCard` becomes orchestration rather than containing every view implementation.

## Error and Empty States

- Finalize remains disabled until a draft course exists.
- If course creation fails, the setup conversation and proposal remain intact.
- If no independent exercise matches the course, show a retryable unavailable state.
- If the daily completion limit is reached, preserve the current work but disable successful advancement until reset or plan upgrade.
- If the daily skip is spent, disable Skip and explain when it resets.
- Run failures retain the learner’s code and increment attempts.

## First Implementation Scope

Included:

- guided multi-step local onboarding;
- structured course proposal with syllabus, languages, and tags;
- course overview;
- real roadmap navigation over current lesson data;
- independent exercise mock flow;
- local daily completion, skip, hint, attempt, and XP interaction state;
- responsive styling in the existing stone-textured visual system.

Deferred:

- AI course generation;
- AI exercise generation;
- production code sandbox;
- server-side grading;
- durable XP/challenge activity schema;
- server-enforced daily limits;
- profile heatmap and language analytics.

## Verification

- Typecheck and production build pass.
- Existing tutor verifier scripts remain green.
- New pure session-state verifier covers Free plan completion, skip, hint, and reset behavior.
- Rendered QA covers onboarding, course home, roadmap navigation, successful exercise completion, used hint, spent skip, and reached daily limit.
- Existing login, course creation, Start project, workspace, file tree, and tutor flows remain functional.
