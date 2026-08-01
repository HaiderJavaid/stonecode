# Dynamic Learning Assessment Flow

> Superseded on 2026-07-29 by the discovery → editable proposal → deterministic quote flow in `docs/AI_COURSE_GENERATION_RULES.md`. New generation supports Course, Guided Project, and Exercise Pack; `short_course` is compatibility-only.

**Goal:** Replace Stonecode's optional graded prerequisite assessment during onboarding with a dynamic conversational assessment that learns the user's goal, background, desired experience, scope, and preferences. Do not ask for course duration or generate week-based syllabi.

**Architecture:** Extend the server-owned `LearningBrief` with structured learner-profile and branch-specific planning fields. Discovery asks one material question at a time, attaches contextual suggested answers, skips facts already present in the initial prompt, and proceeds directly to editable review when the brief is complete. Existing assessment routes and persisted `assessmentReview` data remain readable for backward compatibility but are no longer used by new onboarding sessions.

## Product Flow

```txt
initial request
-> extract every explicit answer
-> determine experience type when explicit
-> ask only missing common profile questions
-> ask only missing branch-specific questions
-> editable plan review
-> generate confirmed experience
```

Common assessment fields:

- concrete learning/building goal.
- relevant programming background.
- familiarity with the target language, framework, or tool.
- desired experience type only when the prompt does not already specify course, short course, practice, or project.
- primary topic/outcome emphasis.
- preferred guidance difficulty: beginner-heavy, balanced, or challenge-heavy.

Branch rules:

- **Course:** assess target outcome, relevant background, target-stack familiarity, topic priorities, depth, guidance difficulty, and how much project practice to include.
- **Guided project:** skip the experience-type question; assess the exact project, core features/workflows, target users when relevant, stack, platform/device, visual direction, and learner background.
- **Exercise:** keep preference discovery for scope, topics, purpose, count, difficulty, and coding/MCQ mix. These are planning choices, not assessment exercises.
- **Short course:** assess the bounded outcome and current familiarity, then review.

Global rules:

- Ask one focused question per turn with two to four contextual suggestions and unrestricted free typing.
- Mark the recommended suggestion in copy when a sensible default exists.
- Never repeat information already stated or safely extracted from the transcript.
- Never ask the mode question after an explicit project/course/practice request.
- Do not show onboarding MCQ, writing, or code/editor assessment questions.
- Do not ask for pace, hours, weeks, duration, deadlines, or a schedule.
- Do not output week-based syllabus sections or estimated completion time.
- Keep lesson-level diagnostics, quizzes, workshops, labs, and grading unchanged after course creation.
- When the learner is unsure, propose a sensible default and preserve it in the review as an editable choice.

## Contracts And Compatibility

Extend `LearningBrief` with optional structured fields while keeping existing fields readable:

```ts
type GuidanceDifficulty = "beginner_heavy" | "balanced" | "challenge_heavy";
type CourseDepth = "foundation" | "systems" | "production";

type LearnerProfile = {
  programmingBackground?: string;
  targetExperience?: string;
  topicPriorities?: string[];
  guidanceDifficulty?: GuidanceDifficulty;
  courseDepth?: CourseDepth;
  mathBackground?: string;
};

type ProjectPreferences = {
  deliverable?: string;
  coreFeatures?: string[];
  workflows?: string[];
  targetUsers?: string;
  platform?: string;
  devicePriority?: string;
  designDirection?: string;
};
```

- Add `learnerProfile?: LearnerProfile` and `projectPreferences?: ProjectPreferences` to `LearningBrief`; preserve existing `priorKnowledge`, `topics`, `platform`, and `difficulty` during normalization.
- Change discovery `nextAction` to `clarify | confirm`; new sessions never return `assessment_offer` or `assessment_plan`.
- Replace new-session `AssessmentReview` synthesis with a deterministic/AI-assisted planning summary derived from the confirmed brief. Continue serializing the existing `assessmentReview` shape inside generated content until a later schema migration, so saved v1/v2 courses remain compatible.
- Keep `/api/learning/assessment-plan`, `/assessment-question`, and `/assessment-review` temporarily available for old clients, but remove their use from `CourseSetupCard`; mark them deprecated and delete only in a later compatibility cleanup.
- A modified answer invalidates only dependent branch fields and generated review content, not unrelated discovery answers.

## Implementation Order

1. **Rules and contracts**
   - Update `docs/AI_COURSE_GENERATION_RULES.md` and app-owned onboarding prompts to define conversational assessment as the sole onboarding assessment.
   - Extend `LearningBrief`, normalizers, transcript grounding, missing-field validation, and fallback suggestions in `server/learning-orchestrator/contracts.mjs` and `src/data/courses.ts`.
   - Remove all duration/week concepts from discovery and review contracts.

2. **Dynamic discovery routing**
   - Make explicit intent authoritative: `build` routes directly to guided-project questions; explicit full-course/practice/short-course prompts skip type selection.
   - Add branch-specific missing-field resolution and contextual recommended suggestions.
   - Stop discovery as soon as the required common and branch-specific fields are complete.

3. **Setup UI simplification**
   - Collapse `CourseSetupCard` to `discovery | review | generating`.
   - Remove the ready/assessment/gap-choice phases, assessment state, `AssessmentPanel`, and assessment service calls from new sessions.
   - Render the editable review from the complete brief: goal, starting point, stack, focus, depth/guidance, project preferences, and syllabus topics. Never render duration.

4. **Generation grounding**
   - Convert the learner profile into strengths, assumed gaps, prerequisite bridges, and suggested modules without claiming knowledge was proven by a quiz.
   - Update course, short-course, exercise, and guided-project prompts to treat self-reported background and confirmed preferences as binding inputs.
   - Generate natural module/topic structure without week labels, timelines, or completion estimates.

5. **Compatibility cleanup and verification**
   - Leave old saved assessment answers/reviews readable and resumable.
   - Stop writing new assessment-question records for onboarding.
   - Update verifier fixtures, promotional discovery capture, and authenticated browser QA for the new flow.

## Verification

- `Build a C# game project` skips experience-type selection and asks project, C# background, features, stack, platform, and design questions only as needed.
- `Plan a full C# game-development course` skips experience-type selection and asks background, target-stack familiarity, emphasis, depth, and guidance questions.
- `I want to learn game development` asks which experience type is desired, then follows only that branch.
- A complete request proceeds directly to editable review without an onboarding quiz offer.
- Suggestions are contextual, recommended defaults are visible, and free typing remains available.
- No new onboarding path calls assessment-plan/question/review endpoints.
- No review, syllabus title, module title, prompt, or generated content contains weeks, duration, pace, or completion estimates.
- Standalone exercise discovery still confirms purpose, topics, count, difficulty, and coding/MCQ mix without presenting a knowledge test.
- Lesson quizzes and editor checks still render and grade normally after generation.
- Existing saved courses with assessment answers/reviews still load, navigate, and persist.
- Run `npm run verify:learning-orchestrator`, `npm run verify:generated-course-content`, `npm run verify:tutor-flow`, `npm run typecheck`, and `npm run build`, then complete authenticated browser QA through all four experience types.

## Out Of Scope

- Measuring prerequisite knowledge with onboarding code, writing, or MCQ questions.
- Fixed course duration, weekly schedules, study-hour estimates, deadlines, or calendar planning.
- Changing lesson-level quizzes, workshops, labs, projects, grading, or progression.
- Removing legacy assessment APIs or saved data in the same change.
