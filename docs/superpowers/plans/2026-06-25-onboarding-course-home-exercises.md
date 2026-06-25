# Onboarding, Course Home, and Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement guided course setup, a structured course home and roadmap, and a mock independent exercise lane with local plan-limit behavior.

**Architecture:** Extend `Course` with syllabus metadata while retaining fallbacks for existing Supabase rows. Extract course-home, roadmap, and exercise panels from `CourseCard`. Keep independent exercise rules in pure TypeScript functions with a Node verifier; store the initial session locally in the existing course state.

**Tech Stack:** React 18, TypeScript, Vite, localStorage/Supabase-backed course state, Node verifier scripts.

---

### Task 1: Exercise Session Rules

**Files:**
- Create: `src/features/exercises/exerciseSession.ts`
- Create: `scripts/verify-exercise-session.mjs`
- Modify: `package.json`

- [x] Write a source-backed verifier covering two Free completions, one daily skip, one hint per exercise, failed attempts, and day reset.
- [x] Run `npm run verify:exercise-session` and confirm it fails because the module does not exist.
- [x] Implement pure session transitions and plan allowances.
- [x] Run `npm run verify:exercise-session` and confirm all checks pass.

### Task 2: Structured Course and Challenge Data

**Files:**
- Modify: `src/data/courses.ts`
- Modify: `src/components/stonecode/lessonData.ts`
- Create: `src/features/exercises/challengeData.ts`

- [x] Add syllabus, language, and tag types with safe defaults for old courses.
- [x] Map the current tutor steps into syllabus sections.
- [x] Add curated independent scenarios that differ from course lesson prompts.
- [x] Run `npm run typecheck`.

### Task 3: Guided Setup Proposal

**Files:**
- Modify: `src/components/stonecode/CourseSetupCard.tsx`
- Modify: `src/app/globals.css`

- [x] Replace the generic follow-up loop with objective, level, and outcome stages.
- [x] Render the latest structured proposal with languages, tags, and syllabus.
- [x] Keep amendment chat available and Finalize the latest proposal.
- [x] Run `npm run typecheck`.

### Task 4: Course Home and Roadmap

**Files:**
- Create: `src/components/stonecode/CourseHome.tsx`
- Create: `src/components/stonecode/CourseRoadmap.tsx`
- Modify: `src/components/stonecode/CourseCard.tsx`
- Modify: `src/components/stonecode/types.ts`
- Modify: `src/services/courseStorage.ts`
- Modify: `src/lib/database.types.ts`

- [x] Make the active course card open on overview actions.
- [x] Show summary, overall progress, languages, tags, and Start/Resume.
- [x] Render real syllabus sections and navigate by lesson index.
- [x] Preserve backward navigation without resetting progress.
- [x] Run `npm run typecheck`.

### Task 5: Independent Exercise Panel

**Files:**
- Create: `src/components/stonecode/IndependentExercisePanel.tsx`
- Modify: `src/components/stonecode/CourseCard.tsx`
- Modify: `src/components/stonecode/DashboardPage.tsx`
- Modify: `src/components/stonecode/StonecodePrototype.tsx`
- Modify: `src/services/subscriptionState.ts`
- Modify: `src/lib/planLimits.ts`
- Modify: `src/app/globals.css`

- [x] Add Exercises as a course-home action.
- [x] Implement code editing, mock Run validation, one hint, one daily skip, and Next-after-success.
- [x] Display remaining independent completions and skip availability.
- [x] Keep course lesson challenges outside these limits.
- [x] Run `npm run verify:exercise-session`, `npm run typecheck`, and `npm run build`.

### Task 6: Regression and Rendered QA

**Files:**
- Modify: `scripts/verify-tutor-flow.mjs`
- Modify: `docs/HANDOFF.yaml`
- Modify: `docs/PROJECT.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/project-architecture.md`

- [x] Extend tutor-flow checks for course home, roadmap, and exercises.
- [x] Run required verifier scripts, typecheck, and build.
- [x] Run the app and verify setup, course home, roadmap, hint lock, skip, success, and daily-limit states.
- [x] Record completed and deferred work in documentation.
