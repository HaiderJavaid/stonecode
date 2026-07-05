import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const lessonData = read("src/components/stonecode/lessonData.ts");
const courseCard = read("src/components/stonecode/CourseCard.tsx");
const workspace = read("src/hooks/useCourseWorkspace.ts");
const courseWorkspace = read("src/components/stonecode/CourseWorkspace.tsx");
const fileTree = read("src/components/stonecode/WorkspaceFileTree.tsx");
const courseHome = read("src/components/stonecode/CourseHome.tsx");
const filePanel = read("src/components/stonecode/FilePanel.tsx");
const stoneEditor = read("src/components/stonecode/StoneEditor.tsx");
const editorLanguages = read("src/services/editorLanguages.ts");
const independentExercises = read("src/components/stonecode/IndependentExercisePanel.tsx");
const progressionService = read("src/services/progression.ts");
const progressionServer = read("server/stonecode-server.mjs");
const setup = read("src/components/stonecode/CourseSetupCard.tsx");
const supabaseStorage = read("src/services/supabaseCourseStorage.ts");
const tutorChat = read("src/hooks/useTutorChat.ts");
const corePrompt = read("src/ai/prompts/core-system-prompt.md");
const rolesPrompt = read("src/ai/prompts/roles.md");
const behaviorPrompt = read("src/ai/prompts/tutor-behavior.md");
const onboardingPrompt = read("src/ai/prompts/onboarding-flow.md");
const toolPrompt = read("src/ai/prompts/tool-use-policy.md");
const safetyPrompt = read("src/ai/prompts/safety.md");
const server = read("server/stonecode-server.mjs");
const tutorContext = read("src/ai/buildTutorContext.ts");

for (const kind of ["theory", "chat-exercise", "multiple-choice", "terminal-exercise", "canvas"]) {
  expect(lessonData.includes(`kind: "${kind}"`), `missing tutor lesson kind: ${kind}`);
}

for (const extension of ["py", "java", "cpp", "cs", "go", "rs", "php", "rb", "swift", "sql", "vue", "svelte"]) {
  expect(fileTree.includes(`"${extension}"`) || fileTree.includes(`=== "${extension}"`), `missing file icon mapping: ${extension}`);
}

expect(courseCard.includes("resolveCourseLessonSteps"), "course card must resolve generated course lessons before static fallback lessons");
expect(courseCard.includes("Step {blockStepIndex + 1} / {blockStepCount} in this block"), "missing generated block progress copy");
expect(courseCard.includes("lesson-options"), "missing multiple-choice controls");
expect(courseCard.includes("Submit and next"), "code exercises must become submit-and-next after passing");
expect(courseCard.includes("loadedCodeExerciseKeysRef"), "code exercise starter files must auto-load once per step");
expect(!courseCard.includes("Load starter in editor"), "course workshop UI must not expose manual starter loading");
expect(courseCard.includes("event.key === \"Enter\" && !event.shiftKey"), "Enter should submit while Shift+Enter inserts a line");
expect(courseCard.includes("requestSubmit()"), "chat Enter handler should submit the form");
expect(workspace.includes("target instanceof HTMLTextAreaElement"), "card keyboard handler must ignore chat textareas");
expect(courseHome.includes("Exercises"), "course home must expose independent exercises");
expect(!courseHome.includes("Course roadmap"), "course home must not expose the removed roadmap button");
expect(filePanel.includes("Modules"), "file panel must expose the modules tab");
expect(filePanel.includes("Files"), "file panel must expose the files tab");
expect(filePanel.includes("CourseModuleTree"), "file panel must render course modules in the left panel");
expect(filePanel.includes("module-title-button"), "module list must render compact title-only module buttons");
expect(filePanel.includes("module-tree-branch"), "module detail must render chapters/blocks/steps as a tree");
expect(filePanel.includes("onSelectLesson"), "course tree steps must navigate to the matching lesson conversation");
expect(filePanel.includes("activeLessonIndex"), "course tree must receive the active lesson index");
expect(filePanel.includes("is-current"), "course tree must highlight the active step/topic");
expect(filePanel.includes("disabled={!module.unlocked}"), "locked module shell buttons must not be clickable");
expect(filePanel.includes("lessonIndex: course.syllabus.find"), "course tree must resolve generated steps to syllabus lesson indexes");
expect(courseWorkspace.includes("onLessonNavigate"), "workspace must pass lesson navigation from the left course tree");
expect(courseCard.includes("blockStepCount"), "lesson panel progress must be based on current block steps");
expect(courseCard.includes("Next block"), "lesson next button must identify block boundaries");
expect(courseCard.includes("Next topic"), "lesson next button must identify topic boundaries");
expect(courseCard.includes("Module complete"), "lesson flow must stop before auto-entering another module");
expect(courseWorkspace.includes("editor-preview-toggle"), "editor must expose a frosted code/visual preview toggle");
expect(courseWorkspace.includes("buildEditorPreview"), "editor preview must render from workspace files");
expect(stoneEditor.includes("loadEditorLanguageExtension"), "StoneEditor must use the shared language support loader");
expect(editorLanguages.includes("resolveEditorLanguage"), "editor language registry must resolve language support from path/name");
expect(editorLanguages.includes("defaultFilePath"), "editor language registry must provide default file paths for generated exercises");
expect(editorLanguages.includes("canRunInBrowser"), "editor language registry must expose browser run support");
expect(editorLanguages.includes("C++"), "editor language registry must include C++");
expect(editorLanguages.includes("Java"), "editor language registry must include Java");
expect(independentExercises.includes('source: "independent"'), "independent exercise progress must use the shared server progression source");
expect(independentExercises.includes("mutateExerciseProgression"), "independent limits must be persisted through the progression API");
expect(supabaseStorage.includes("normalizePersistedLessonView"), "unsupported exercise panel view must not be written to course_progress");
expect(independentExercises.includes("Hint used today"), "exercise hint composer must lock after today's use");
expect(independentExercises.includes("ai-chat-panel"), "independent exercises must reuse the course chat panel layout");
expect(independentExercises.includes("requestExerciseHint"), "independent exercise hints must use AI tutor streaming");
expect(independentExercises.includes("requestExerciseTemplate"), "independent exercise EXP templates must use AI tutor streaming");
expect(independentExercises.includes("buildExerciseTemplatePlaceholder"), "exercise EXP templates must have a local placeholder fallback");
expect(independentExercises.includes('aria-label="Fill exercise answer template"'), "EXP button must be available only in the independent exercise chat");
expect(!courseCard.includes("xp-template-button"), "course lesson tags must not render the EXP/XP template button");
expect(independentExercises.includes("activeCode"), "independent exercises must grade the active middle editor code");
expect(progressionService.includes("hint_used_on"), "exercise hint client state must include hint_used_on");
expect(progressionServer.includes("hint_used_on"), "exercise hint availability must be scoped to today");
expect(setup.includes("Assessment review"), "course setup must render assessment review before generation");
expect(setup.includes("requestAssessmentPlan"), "course setup must use AI assessment planning");
expect(!setup.includes("resolveSetupAssessmentPlan"), "course setup must not use local regex assessment planning");
expect(server.includes('/api/course-generation/assessment-plan'), "server must expose AI assessment plan route");
expect(server.includes("buildCourseBlueprintPrompt"), "server course generation must create a hidden course blueprint");
expect(server.includes("retrieveRagContext"), "server must retrieve RAG context for generation/tutor calls");
expect(setup.includes("requestGeneratedCourseFromAssessment"), "course setup must generate directly from assessment");
expect(setup.includes("I don&apos;t know"), "assessment skip control must be learner-facing as I don't know");
expect(corePrompt.includes("The learner is always the primary programmer"), "core prompt must preserve learner-primary rule");
expect(corePrompt.includes("Do not claim files were inspected"), "core prompt must prevent fake workspace claims");
expect(rolesPrompt.includes("Primary Tutor"), "roles prompt must define tutor role");
expect(rolesPrompt.includes("Progress Keeper"), "roles prompt must define progress role");
expect(rolesPrompt.includes("Cost And Safety Monitor"), "roles prompt must define cost/safety role");
expect(behaviorPrompt.includes("Ask one onboarding question at a time"), "behavior prompt must preserve one-question onboarding");
expect(behaviorPrompt.includes("Do not paste full solution code by default"), "behavior prompt must prevent answer dumps");
expect(behaviorPrompt.includes("Do not force the same shape every time"), "behavior prompt must avoid rigid generated lesson templates");
expect(behaviorPrompt.includes("Do not introduce yourself as Stonecode"), "behavior prompt must avoid repeated product-name tutor intros");
expect(behaviorPrompt.includes("Assume the learner has no programming, coding, or syntax knowledge"), "tutor prompt must teach from zero knowledge");
expect(behaviorPrompt.includes("explain every new token"), "tutor prompt must explain new code syntax before use");
expect(behaviorPrompt.includes("do not compress a real guided build into two broad steps"), "workshops must not collapse into two vague steps");
expect(lessonData.includes("moduleIndex === 0 && topicIndex === 0 && stepIndex === 0"), "generated course welcome must only appear on the first course step");
expect(lessonData.includes("stepIndex === 0 && !startsWithHeading"), "new topics must begin with topic heading when needed");
expect(lessonData.includes("## What we are building"), "workshops/labs must show concrete build context");
expect(lessonData.includes("## Step ${stepIndex + 1}"), "workshop screens must render numbered step headings");
expect(lessonData.includes("## Syntax you need first"), "workshops must teach syntax before asking for code");
expect(lessonData.includes("## Your exact move"), "workshops must give precise next editor action");
expect(lessonData.includes("## What the code means"), "workshops must explain starter code before asking for edits");
expect(lessonData.includes("public class Main"), "Java workshop rendering must explain Java starter code");
expect(lessonData.includes("System.out.println"), "Java workshop rendering must explain Java output syntax");
expect(lessonData.includes("Console.WriteLine"), "C# workshop rendering must explain C# output syntax");
expect(courseCard.includes("outputCount >= 2"), "client checklist must not pass two-output criteria from line count alone");
expect(courseCard.includes("countCallsToDefinedFunctions"), "client checklist must verify repeated function calls when criteria ask for them");
expect(lessonData.includes("normalizeGeneratedExerciseStep"), "saved generated exercises must be repaired for display when language metadata is wrong");
expect(lessonData.includes("cleanLearnerText"), "lesson rendering must strip leaked prompt/internal-planning text");
expect(onboardingPrompt.includes("Do not ask for user level, preferred learning mode, project type"), "onboarding prompt must avoid preference-style setup");
expect(toolPrompt.includes("STONECODE_FILE_EDIT"), "tool prompt must document file edit block");
expect(toolPrompt.includes("STONECODE_RUN_ACTIVE_FILE"), "tool prompt must document active file runner");
expect(safetyPrompt.includes("Do not execute arbitrary shell commands"), "safety prompt must block shell execution");
expect(server.includes("buildTutorInstructions()"), "server must load tutor prompt pack");
expect(server.includes('readPrompt("core-system-prompt.md")'), "server must load core prompt file");
expect(server.includes("acceptanceCriteria: exercise.acceptanceCriteria"), "server code grading must receive generated acceptance criteria");
expect(server.includes("gradeCodeCriterion"), "server code grading must evaluate generated checklist criteria");
expect(server.includes("countOutputCalls"), "server code grading must count language-specific output calls");
expect(server.includes("countCallsToDefinedFunctions"), "server code grading must verify repeated function calls when criteria ask for them");
expect(tutorContext.includes("courseSyllabus"), "tutor context must include syllabus");
expect(tutorContext.includes("courseMode"), "tutor context must include course mode");
expect(tutorContext.includes('"exercise_template"'), "tutor context must identify exercise template requests");
expect(tutorContext.includes("currentCourseStep"), "tutor context must include a focused current generated step");
expect(tutorContext.includes("resolveCurrentCourseStepContext"), "tutor context must resolve module/topic/block context");
expect(tutorContext.includes("blockKind"), "current course step context must include block kind");
expect(tutorContext.includes("previousStepSummary"), "current course step context must include previous step summary");
expect(tutorChat.includes("sectionId: lesson.sectionId"), "lesson intro requests must pass generated section id into tutor context");
expect(tutorChat.includes("blockKind: lesson.blockKind"), "lesson intro requests must pass generated block kind into tutor context");
expect(courseCard.includes("requestLessonIntro"), "course resume must generate the first lesson intro through AI");
expect(courseCard.includes("lesson-intro:"), "generated lesson intros must use stable generated keys");
expect(courseCard.includes("useProgression"), "course exercises must hydrate completed state from progression attempts");
expect(courseCard.includes("markLessonExerciseCompleted"), "course exercises must stay completed after returning to the step");
expect(courseCard.includes("criteriaCollapsed"), "editor exercise checklist must be collapsible");
expect(courseCard.includes("Hide checklist"), "editor exercise checklist must have hide control");
expect(courseCard.includes("Show checklist"), "editor exercise checklist must be restorable");
expect(courseCard.includes("requiresPreview"), "visual exercises must surface preview requirements in the lesson UI");
expect(courseCard.includes("lesson.blockId && typeof lesson.blockStepIndex === \"number\""), "generated v2 exercise keys must use block id and step index");
expect(courseCard.includes("attempt.exercise_key === `${course.id}:${exerciseKey}`"), "course exercise completion hydration must handle persisted course-prefixed keys");
expect(courseCard.includes("Next topic"), "course flow must use Next topic wording at topic/chapter boundaries");
expect(supabaseStorage.includes("generated_key"), "chat persistence must store generated message keys");
expect(supabaseStorage.includes("message_kind"), "chat persistence must store generated message kinds");

console.log("tutor flow checks passed");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
