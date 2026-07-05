# AI Generation Flow

This diagram shows the current assessment-to-course-generation path and the main files involved.

```mermaid
flowchart TD
  A["CourseSetupCard.tsx\nUser enters subject"] --> B["src/services/courseGeneration.ts\nrequestAssessmentQuestion"]
  B --> C["server/stonecode-server.mjs\n/api/course-generation/assessment-question"]
  C --> D["server/course-generation.mjs\nbuildAssessmentQuestionPrompt"]
  D --> E["server/llm-providers.mjs\nrequestCourseGenerationJson"]
  E --> F["OpenAI Responses API"]
  F --> G["normalizeAssessmentQuestion\nstabilizeAssessmentQuestion"]
  G --> H["CourseSetupCard.tsx\nstores transient answers"]

  H --> I["requestAssessmentReview"]
  I --> J["/api/course-generation/assessment-review"]
  J --> K["buildAssessmentReviewPrompt"]
  K --> E
  E --> L["AssessmentReview\nstrengths, gaps, suggestedModules"]

  L --> M["requestGeneratedCourseFromAssessment"]
  M --> N["/api/course-generation/from-assessment"]
  N --> O["buildLearnerGenerationContext\nreadiness, weak signals, preferences"]
  O --> P["retrieveStaticCourseGenerationContext\nstatic mini-RAG chunks"]
  P --> Q["buildAssessmentCourseOutlinePrompt\noutline phase"]
  Q --> E
  E --> R["Course outline JSON"]

  R --> S["buildAssessmentCourseContentPrompt\nloaded content phase"]
  S --> T["buildBlockGenerationPrompt\nblock contracts"]
  T --> E
  E --> U["normalizeGeneratedCourseContent\nshape normalization"]
  U --> V["course-generation-quality.mjs\nvalidateGeneratedCourseQuality"]

  V -->|blocking warnings| W["buildGeneratedCourseRepairPrompt\nrepair only bad blocks"]
  W --> E
  E --> X["normalize + validate repaired content"]
  V -->|no blocking warnings| Y["GeneratedCourseContentV2"]
  X --> Y
  X -->|still blocking| Z["createFallbackGeneratedCourseFromAssessment"]

  Y --> AA["src/data/courses.ts\ncreateLearningCourse + syllabus"]
  Z --> AA
  AA --> AB["src/services/supabaseCourseStorage.ts\ncreateSupabaseCourse"]
  AB --> AC["Supabase courses.course_content"]
  AC --> AD["FilePanel.tsx\nModules tree"]
  AC --> AE["lessonData.ts\nflatten steps for CourseCard"]
  AE --> AF["CourseCard.tsx\nlesson render + grading gates"]
```

## Runtime Tutor Context

```mermaid
flowchart TD
  A["CourseCard.tsx\nopens lesson"] --> B["useTutorChat.ts\nrequestLessonIntro / chat"]
  B --> C["buildTutorContext.ts\ncourse + files + focused currentCourseStep"]
  C --> D["/api/tutor"]
  D --> E["src/ai/prompts/*.md\nconversation prompt pack"]
  E --> F["OpenAI Responses API stream"]
  F --> G["useTutorChat.ts\nstream into chat"]
  G --> H["supabaseCourseStorage.ts\npersist generated message key"]
```

## QA Script

`npm run qa:generated-course-flow -- --subject "JavaScript fundamentals" --profile struggling`

The QA script runs:

1. AI assessment questions.
2. Simulated learner answers.
3. AI assessment review.
4. AI course outline.
5. AI loaded course content.
6. Server normalization.
7. Quality validation.
8. Repair pass when blocking warnings exist.
9. Artifact/report save under `output/qa/generated-course-flow/`.
