import { normalizeGeneratedCourseContent } from "../course-generation.mjs";
import {
  normalizeLearningBrief,
  resolveExerciseMixCounts,
  subjectForLearningBrief
} from "./contracts.mjs";
import {
  normalizeExerciseDifficulty,
  normalizeSkillTopics,
  resolveSkillMetadata
} from "../skill-taxonomy.mjs";

export function buildLearningExperiencePrompt({ brief, assessmentReview, learnerProfile }) {
  const normalized = normalizeLearningBrief(brief);
  if (normalized.type === "short_course") return buildShortCoursePrompt(normalized, learnerProfile);
  if (normalized.type === "exercise") return buildExerciseSessionPrompt(normalized, learnerProfile);
  if (normalized.type === "guided_project") return buildGuidedProjectPrompt(normalized, assessmentReview, learnerProfile);
  throw new Error("Full courses must use the existing personalized course generator.");
}

export function buildLearningExperienceRepairPrompt({ originalPrompt, invalidOutput, validationError }) {
  return `${originalPrompt}

REPAIR REQUIRED
The previous JSON was rejected by Stonecode validation:
${escapeText(validationError || "Invalid generated learning experience.")}

Previous JSON:
${String(invalidOutput ?? "").slice(0, 14000)}

Return a complete replacement JSON document, not a patch or explanation.
- Obey every count and structure rule in the original request.
- For guided projects, return exactly one project module containing three ordered blocks: introduction theory, one 10-20 step workshop, and recap theory.
- Keep the complete architecture, continuous project files, and every required workshop field.
- Return JSON only.`;
}

export function buildGuidedProjectOutlineRepairPrompt({ brief, assessmentReview, generatedProject }) {
  const firstMilestone = generatedProject?.milestones?.[0] ?? {};
  return `Complete the missing future milestone outline for a Stonecode guided project.

Learning brief: ${JSON.stringify(brief ?? {}).slice(0, 1800)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1800)}
Architecture: ${JSON.stringify(generatedProject?.architecture ?? {}).slice(0, 1800)}
Already generated milestone 1: ${JSON.stringify({
    id: firstMilestone?.id,
    title: firstMilestone?.title,
    summary: firstMilestone?.summary
  })}

Return only:
{"futureMilestones":[
  {"id":"milestone-2","title":"...","summary":"..."},
  {"id":"milestone-3","title":"...","summary":"..."}
]}

Rules:
- Return 2 to 7 future milestones, excluding milestone 1.
- Together with milestone 1, they must describe the complete path to the requested deliverable.
- Keep every title and summary specific to this project, architecture, stack, and assessment.
- Do not generate topics, steps, code, explanations, or markdown.
- Return JSON only.`;
}

export function buildGuidedProjectStepExtensionPrompt({ brief, assessmentReview, generatedProject, missingStepCount }) {
  const firstMilestone = generatedProject?.milestones?.[0] ?? {};
  const existingWorkshopSteps = (firstMilestone?.topics ?? [])
    .flatMap((topic) => topic?.blocks ?? [])
    .flatMap((block) => block?.kind === "workshop" ? block?.steps ?? [] : [])
    .filter((step) => step?.type === "workshop");
  const lastStep = existingWorkshopSteps.at(-1) ?? {};
  const count = Math.max(1, Math.min(Number(missingStepCount) || 2, 4));
  return `Continue milestone 1 of a Stonecode guided project with strict JSON.

Learning brief: ${JSON.stringify(brief ?? {}).slice(0, 1800)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1800)}
Architecture: ${JSON.stringify(generatedProject?.architecture ?? {}).slice(0, 1800)}
Milestone 1: ${JSON.stringify({ id: firstMilestone?.id, title: firstMilestone?.title, summary: firstMilestone?.summary }).slice(0, 1200)}
Last valid workshop step: ${JSON.stringify(lastStep).slice(0, 7000)}

Return only:
{"steps":[/* exactly ${count} workshop step objects */]}

Rules:
- Return exactly ${count} additional atomic coding steps. Do not repeat any existing step or include a recap.
- Continue directly from the last valid resultCode and workspaceFiles.
- Every step must use type workshop and include id, language, filePath, context, prompt, starterCode, expectedChange, resultCode, codeExplanation, 2-3 suggestedQuestions, acceptanceCriteria, workspaceView, requiresPreview, requiresTerminal, and complete workspaceFiles.
- One micro-edit per coding step. Each resultCode becomes the next coding step's starterCode.
- Do not return milestone wrappers, topics, blocks, architecture, markdown fences, or explanation outside JSON.
- Return JSON only.`;
}

export function extendGuidedProjectFirstMilestone(generatedProject, extension, missingStepCount) {
  const steps = Array.isArray(extension?.steps) ? extension.steps : Array.isArray(extension?.extension?.steps) ? extension.extension.steps : [];
  const count = Math.max(1, Math.min(Number(missingStepCount) || 2, 4));
  if (steps.length < count) throw new Error(`Guided project step extension requires ${count} steps.`);
  const milestones = Array.isArray(generatedProject?.milestones) ? [...generatedProject.milestones] : [];
  const firstMilestone = milestones[0];
  if (!firstMilestone || !Array.isArray(firstMilestone.topics)) throw new Error("Guided project extension requires milestone 1 topics.");
  let target = null;
  firstMilestone.topics.forEach((topic, topicIndex) => {
    (topic?.blocks ?? []).forEach((block, blockIndex) => {
      const hasWorkshopSteps = Array.isArray(block?.steps) && block.steps.some((step) => step?.type === "workshop");
      if ((block?.kind === "workshop" || hasWorkshopSteps) && Array.isArray(block.steps)) target = { topicIndex, blockIndex };
    });
  });
  if (!target) throw new Error("Guided project extension requires an existing workshop block.");
  const topics = firstMilestone.topics.map((topic) => ({ ...topic, blocks: (topic?.blocks ?? []).map((block) => ({ ...block, steps: [...(block?.steps ?? [])] })) }));
  const block = topics[target.topicIndex].blocks[target.blockIndex];
  const recapIndex = block.steps.findIndex((step) => step?.type === "summary");
  const insertionIndex = recapIndex >= 0 ? recapIndex : block.steps.length;
  const continuationSteps = steps.slice(0, count).map((step) => ({ ...step, type: "workshop" }));
  block.steps.splice(insertionIndex, 0, ...continuationSteps);
  milestones[0] = { ...firstMilestone, topics };
  return { ...generatedProject, milestones };
}

export function completeGuidedProjectOutline(generatedProject, outline) {
  const rawFirstMilestone = Array.isArray(generatedProject?.milestones) ? generatedProject.milestones[0] : null;
  if (!rawFirstMilestone) throw new Error("Guided project repair requires a generated first milestone.");
  const normalizedFirstMilestone = normalizeGeneratedCourseContent({
    schemaVersion: "course-content/v2",
    title: generatedProject?.title,
    subject: generatedProject?.subject,
    description: generatedProject?.description,
    languages: generatedProject?.languages,
    tags: generatedProject?.tags,
    generationDepth: "full_structure_first_module",
    modules: [rawFirstMilestone]
  }).modules[0];
  const rawFuture = Array.isArray(outline?.futureMilestones)
    ? outline.futureMilestones
    : Array.isArray(outline?.milestones)
      ? outline.milestones
      : [];
  if (rawFuture.length < 2) throw new Error("Guided project outline repair requires at least two future milestones.");
  const futureMilestones = rawFuture.slice(0, 7).map((milestone, index) => {
    const order = index + 2;
    const title = text(milestone?.title, `Project milestone ${order}`).slice(0, 120);
    const summary = text(milestone?.summary, `Continue building ${generatedProject?.title || "the project"}.`).slice(0, 400);
    const id = slug(milestone?.id || `milestone-${order}-${title}`);
    return {
      id,
      title,
      summary,
      topics: [{
        id: `${id}-outline`,
        title,
        summary,
        blocks: [{
          id: `${id}-outline-review`,
          kind: "review",
          title: `${title} outline`,
          summary,
          steps: [{ type: "summary", markdown: `## ${title}\n\n${summary}` }]
        }]
      }]
    };
  });
  return { ...generatedProject, milestones: [normalizedFirstMilestone, ...futureMilestones] };
}

export function shouldUseFocusedProjectOutlineRepair({ brief, parsedContent, validationError }) {
  return brief?.type === "guided_project" &&
    Boolean(Array.isArray(parsedContent?.milestones) && parsedContent.milestones[0]) &&
    /milestone outline/i.test(String(validationError ?? ""));
}

export function normalizeGeneratedLearningContent(value, { brief, assessmentReview = null, loadedMilestoneIndex = 0 } = {}) {
  const normalizedBrief = normalizeLearningBrief(brief ?? value?.learningBrief ?? {});
  if (normalizedBrief.type === "course") return normalizeGeneratedCourseContent(value);
  if (normalizedBrief.type === "short_course") return normalizeShortCourse(value, normalizedBrief);
  if (normalizedBrief.type === "exercise") return normalizeExerciseSession(value, normalizedBrief);
  return normalizeGuidedProject(value, normalizedBrief, assessmentReview, loadedMilestoneIndex);
}

export function buildGuidedProjectMilestonePrompt({ content, milestoneIndex, workspaceFiles = [] }) {
  const milestone = content?.milestones?.[milestoneIndex];
  if (!milestone) throw new Error("Project milestone not found.");
  return `Generate one guided Stonecode project milestone as strict JSON.

Project: ${content.title}
Subject: ${content.subject}
Architecture: ${JSON.stringify(content.architecture ?? {}).slice(0, 1800)}
Assessment: ${JSON.stringify(content.assessmentReview ?? {}).slice(0, 1200)}
Milestone to fill: ${JSON.stringify(milestone).slice(0, 1600)}
Current workspace: ${JSON.stringify(workspaceFiles).slice(0, 6000)}

Return only:
{"milestone":{"id":"${milestone.id}","title":"${escapeText(milestone.title)}","summary":"...","topics":[...]}}

Rules:
- Preserve the milestone id and purpose.
- Generate 8 to 15 atomic guided workshop coding steps across its topics, plus non-coding recaps.
- Each workshop coding step has type workshop, id, buildsOnStepId, language, filePath, context, prompt, starterCode, expectedChange, resultCode, codeExplanation, 2-3 suggestedQuestions, acceptanceCriteria, workspaceView, requiresPreview, requiresTerminal, and complete workspaceFiles.
- Continue the current project files. Do not replace the project with a disconnected example.
- One micro-edit per step. Explain only the new code introduced in that step.
- Preload visual scenes and explicitly connect HTML/CSS/browser JavaScript when relevant.
- Do not reveal hidden planning or future answer keys.`;
}

export function mergeGuidedProjectMilestone(content, rawMilestone, milestoneIndex) {
  const milestones = content.milestones.map((milestone, index) => index === milestoneIndex ? rawMilestone : milestone);
  return normalizeGeneratedLearningContent({ ...content, milestones }, {
    brief: content.learningBrief,
    assessmentReview: content.assessmentReview,
    loadedMilestoneIndex: milestoneIndex
  });
}

function buildShortCoursePrompt(brief, learnerProfile) {
  return `Generate a focused Stonecode short course as strict JSON.

Learning brief: ${JSON.stringify(brief)}
Learner memory: ${JSON.stringify(learnerProfile ?? {}).slice(0, 1400)}

Return:
{
 "schemaVersion":"short-course-content/v1",
 "title":"...","subject":"...","description":"...","languages":["..."],"tags":["Short course"],
 "sections":[{"id":"...","title":"...","summary":"...","blocks":[{"id":"...","kind":"theory|quiz|workshop|review","title":"...","summary":"...","steps":[...]}]}]
}

Rules:
- Teach one bounded concept only as a smaller, slower full course. Use 2 to 4 focused sections rather than compressing explanations.
- Start each new idea with a mental model, clear prose, a useful analogy explicitly mapped back to code, and a worked tiny example.
- Include understanding checks and one small guided workshop with 6 to 10 atomic coding steps plus a final non-coding recap.
- Workshop steps carry the full Stonecode practical contract: type, id, buildsOnStepId, language, filePath, context, prompt, starterCode, expectedChange, resultCode, codeExplanation, suggestedQuestions, acceptanceCriteria, workspaceView, requiresPreview, requiresTerminal, workspaceFiles.
- Do not expand into a broad full course or unrelated prerequisites.
- Assume zero syntax knowledge unless learner memory proves otherwise.`;
}

function buildExerciseSessionPrompt(brief, learnerProfile) {
  const count = brief.exerciseCount ?? 10;
  const { codingCount, mcqCount } = resolveExerciseMixCounts(brief);
  return `Generate a Stonecode coding practice session as strict JSON.

Learning brief: ${JSON.stringify(brief)}
Learner memory: ${JSON.stringify(learnerProfile ?? {}).slice(0, 1800)}

Return:
{
 "schemaVersion":"exercise-session/v1",
 "title":"...","subject":"...","description":"...","languages":["..."],"tags":["Practice"],
 "strategy":"topic|random|weakness|adaptive","diagnosticCount":0,
 "problems":[{
   "id":"...","title":"...","summary":"scenario and goal","kind":"mcq|code","difficulty":"Beginner|Intermediate|Advanced",
   "primarySkill":"...","parentLanguage":"...","topicIds":["..."],
   "blocks":[{"id":"...","kind":"quiz|lab","title":"...","summary":"...","steps":[...]}]
 }]
}

Rules:
- Return exactly ${count} distinct coding problems.
- Return exactly ${codingCount} code problems and ${mcqCount} MCQ problems. Do not substitute reflections, workshops, theory, reviews, or projects.
- Difficulty strategy is ${brief.difficulty ?? "adaptive"}. Every problem must declare Beginner, Intermediate, or Advanced.
- Purpose: ${brief.motivation || brief.goal}. Scope: ${brief.practiceScope || "topics"}. Required topics: ${JSON.stringify(brief.topics ?? [])}.
- Distribute the problems across the confirmed topics. Keep every problem relevant to ${brief.subject || brief.language || brief.goal}.
- If the learner requested weaknesses and memory is insufficient, make the first two problems diagnostic and set diagnosticCount to 2.
- Every problem is one independent exercise with exactly one block and one step.
- MCQ problems use one quiz block containing one mcq step with prompt, four plausible options, correctOptionIndex, and a short explanation.
- Code problems use one lab block containing one lab step with language, filePath, scenario/context, prompt, starterCode, 2-5 acceptanceCriteria, workspaceView, requiresPreview, requiresTerminal, and complete workspaceFiles.
- Frame every code problem as a believable bug, missing feature, debugging task, data task, or small real-world requirement. State the scenario and acceptance criteria clearly.
- Starter code must have a purposeful defect or missing behavior. Avoid toy prompts such as merely "write a loop" unless the real scenario genuinely requires it.
- Do not expose solution code. Starter code may be incomplete or intentionally broken.
- Visual problems preload a visible scene; terminal problems open Terminal.`;
}

function buildGuidedProjectPrompt(brief, assessmentReview, learnerProfile) {
  const projectMode = inferGuidedProjectMode(brief);
  const externalEngineProject = isExternalEngineGuidedProject(brief);
  return `Generate one complete Stonecode guided project workshop as strict JSON.

Learning brief: ${JSON.stringify(brief)}
Assessment review: ${JSON.stringify(assessmentReview ?? {}).slice(0, 1600)}
Learner memory: ${JSON.stringify(learnerProfile ?? {}).slice(0, 1400)}
Project mode: ${projectMode}
Visual policy: ${externalEngineProject ? "external_engine_code_only" : "simple_visual_allowed"}

Return:
{
 "schemaVersion":"guided-project-content/v2",
 "title":"...","subject":"...","description":"...","languages":["..."],"tags":["Guided project"],
 "architecture":{"deliverable":"...","stack":["..."],"capabilities":["..."]},
 "workspaceFiles":[{"path":"main.py","content":"","purpose":"learner-built project source","editable":true}],
 "module":{"id":"guided-project","title":"...","summary":"...","blocks":[
   {"id":"project-introduction","kind":"theory","title":"Understand the project","summary":"...","steps":[/* theory, analogy and worked-example steps */]},
   {"id":"project-build","kind":"workshop","title":"Build the project","summary":"...","steps":[/* 10-20 workshop coding steps */]},
   {"id":"project-recap","kind":"theory","title":"How the finished project works","summary":"...","steps":[/* theory and summary steps */]}
 ]}
}

Rules:
- A guided project and a workshop are the same experience. Do not create course modules, topics, milestones, labs, quizzes, or independent tests.
- Return exactly one module and exactly three blocks in this order: introduction theory, main workshop, final recap theory.
- The introduction is orientation, not a lesson or test. Use only 1 to 3 explanation steps total: what the learner will build, why it is useful/where it is used, how the finished parts fit together, and only a narrow refresher proven necessary by the brief or assessment. Combine overlapping ideas.
- The workshop contains 10 to 20 atomic coding steps that finish the requested deliverable. Each coding step returns: type workshop, id, language, filePath, context, prompt, edit, expectedChange, codeExplanation, 2-3 suggestedQuestions, acceptanceCriteria, workspaceView, requiresPreview, and requiresTerminal.
- In scratch_build mode, source files start blank or with the smallest unavoidable shell. The learner writes the project from the first meaningful code unit. Never preload finished starter logic.
- In repair_or_feature mode only, preload the existing/broken implementation and its initial visual state before asking for fixes or additions.
- Every workshop step must change code. Never use a step only to run, inspect, confirm, read, or open an existing starter. Running/previewing is a verification action after the edit, not the edit itself.
- Teach in semantic micro-steps. One step may add a tightly related group such as several imports or width/height constants, but must not jump across unrelated concepts. Explain only the new code introduced by that step.
- For a scratch Pygame project, Step 1 adds the required imports (including import pygame), Step 2 calls pygame.init(), and Step 3 defines the related window dimensions before creating the display. Do not preload or combine these three foundations. Explain accurately that import is a Python keyword that loads a module/package; it is not a function.
- Keep output compact. Put the complete initial project in the top-level workspaceFiles once. Each step uses exactly one deterministic edit: "edit":{"find":"exact text currently in that file","replace":"replacement text"}. For a new file use "edit":{"operation":"create","replace":"complete new file content"}.
- Every find value must exactly match the file state produced by the preceding steps. Do not repeat starterCode, resultCode, or workspaceFiles inside steps; the server expands edits into those full IDE states.
- Each visual/native-game step also returns compact visualState: {"title":"...","status":"what this code now changes","viewport":{"width":800,"height":450,"background":"#..."},"objects":[{"kind":"rectangle|circle|text|line","x":0,"y":0,"width":0,"height":0,"radius":0,"color":"#...","label":"..."}]}. Stonecode turns it into a synchronized Visual scene.
- Full game engines and external visual editors such as Unity, Unreal, Godot, Roblox Studio, CryEngine, GameMaker, and Blender are Code-only inside Stonecode. For them, return no visualState, set requiresPreview false, and never claim the engine scene can render here.
- The final theory block uses only 1 or 2 explanation steps. It summarizes what was built, how the major code parts connect, what the learner now understands, and where the pattern is used. It contains no coding task, quiz, reflection, or exercise.
- One micro-edit per step. The server expands exact edit continuity and complete workspace files.
- Visual projects keep a synchronized scene available throughout the build. Terminal projects keep runnable files available, but a run-only action is never its own workshop step.
- supportMode teaching_heavy means slower explanations and embedded refreshers, not extra tests.
- Generate the complete project now. Return JSON only.`;
}

function normalizeShortCourse(value, brief) {
  const subject = value?.subject || subjectForLearningBrief(brief);
  const wrapper = normalizeGeneratedCourseContent({
    schemaVersion: "course-content/v2",
    title: value?.title,
    subject,
    description: value?.description,
    languages: value?.languages,
    tags: value?.tags,
    generationDepth: "full_course",
    assessmentReview: { strengths: ["Focused learning request"], gaps: [], suggestedModules: [] },
    modules: [{ id: "short-course", title: value?.title || subject, summary: value?.description, topics: value?.sections }]
  });
  return {
    schemaVersion: "short-course-content/v1",
    title: wrapper.title,
    subject: wrapper.subject,
    description: wrapper.description,
    languages: wrapper.languages,
    tags: uniqueStrings([...(wrapper.tags ?? []), "Short course"]),
    learningBrief: brief,
    generationDepth: "full_short_course",
    sections: wrapper.modules[0].topics
  };
}

function normalizeExerciseSession(value, brief) {
  const subject = value?.subject || subjectForLearningBrief(brief);
  const rawProblems = Array.isArray(value?.problems) ? value.problems.slice(0, brief.exerciseCount ?? 10) : [];
  if (rawProblems.length !== (brief.exerciseCount ?? 10)) throw new Error("Exercise generation returned the wrong problem count.");
  const { codingCount, mcqCount } = resolveExerciseMixCounts(brief);
  const problems = rawProblems.map((problem, index) => normalizePracticeProblem(problem, brief, index));
  const actualCodingCount = problems.filter((problem) => problem.kind === "code").length;
  const actualMcqCount = problems.filter((problem) => problem.kind === "mcq").length;
  if (actualCodingCount !== codingCount || actualMcqCount !== mcqCount) {
    throw new Error(`Exercise generation returned ${actualCodingCount} coding and ${actualMcqCount} MCQ problems; expected ${codingCount} and ${mcqCount}.`);
  }
  const strategy = ["topic", "random", "weakness", "adaptive"].includes(value?.strategy) ? value.strategy : inferExerciseStrategy(brief);
  return {
    schemaVersion: "exercise-session/v1",
    title: text(value?.title, `${subject} practice`).slice(0, 80),
    subject: text(subject, "Programming"),
    description: text(value?.description, `${problems.length} focused practice problems for ${subject}.`).slice(0, 400),
    languages: uniqueStrings(value?.languages).length ? uniqueStrings(value.languages) : uniqueStrings([brief.language || brief.framework || subject]),
    tags: uniqueStrings([...(value?.tags ?? []), "Practice"]),
    learningBrief: brief,
    generationDepth: "full_exercise_session",
    strategy,
    diagnosticCount: clampInteger(value?.diagnosticCount, 0, 2, /weak/i.test(brief.goal) ? 2 : 0),
    problems
  };
}

function normalizePracticeProblem(rawProblem, brief, index) {
  if (!Array.isArray(rawProblem?.blocks) || rawProblem.blocks.length !== 1 || !Array.isArray(rawProblem.blocks[0]?.steps) || rawProblem.blocks[0].steps.length !== 1) {
    throw new Error("Every practice problem must contain exactly one block and one step.");
  }
  const rawBlock = rawProblem.blocks[0];
  const rawStep = rawBlock.steps[0];
  const kind = rawProblem?.kind === "mcq" || rawStep?.type === "mcq" ? "mcq" : "code";
  if (kind === "mcq" && (rawBlock.kind !== "quiz" || rawStep?.type !== "mcq")) {
    throw new Error("MCQ practice problems must contain only one quiz question.");
  }
  if (kind === "code" && (rawBlock.kind !== "lab" || rawStep?.type !== "lab")) {
    throw new Error("Coding practice problems must contain only one independent lab.");
  }
  const skill = resolveSkillMetadata({
    framework: rawProblem?.primarySkill || brief.framework,
    language: rawProblem?.parentLanguage || brief.language,
    subject: brief.subject,
    platform: brief.platform,
    motivation: brief.motivation,
    goal: brief.goal
  });
  const title = text(rawProblem?.title, `Practice problem ${index + 1}`).slice(0, 120);
  const topicIds = normalizeSkillTopics(rawProblem?.topicIds?.length ? rawProblem.topicIds : [title, ...(brief.topics ?? [])]);
  const step = kind === "mcq" ? normalizePracticeMcq(rawStep) : normalizePracticeCode(rawStep, brief);
  return {
    id: slug(rawProblem?.id || `practice-${index + 1}-${title}`),
    title,
    summary: text(rawProblem?.summary, kind === "mcq" ? "Check your understanding." : "Solve one independent coding problem.").slice(0, 260),
    order: index,
    unlocked: index === 0,
    blocks: [{
      id: slug(rawBlock?.id || `practice-block-${index + 1}`),
      kind: kind === "mcq" ? "quiz" : "lab",
      title: text(rawBlock?.title, title).slice(0, 120),
      summary: text(rawBlock?.summary, rawProblem?.summary || title).slice(0, 260),
      order: 0,
      steps: [step]
    }],
    kind,
    difficulty: normalizeExerciseDifficulty(rawProblem?.difficulty || brief.difficulty),
    primarySkill: skill.primarySkill,
    parentLanguage: skill.parentLanguage,
    topicIds,
    domainIds: skill.domainIds
  };
}

function normalizePracticeMcq(step) {
  const options = uniqueStrings(step?.options).slice(0, 4);
  const correctOptionIndex = Number(step?.correctOptionIndex);
  if (!text(step?.prompt, "") || options.length !== 4 || !Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
    throw new Error("Practice MCQs require a prompt, four options, and one valid answer index.");
  }
  return {
    type: "mcq",
    prompt: text(step.prompt, "").slice(0, 500),
    options,
    correctOptionIndex,
    explanation: text(step?.explanation, "Review how the code or concept behaves.").slice(0, 500)
  };
}

function normalizePracticeCode(step, brief) {
  const language = text(step?.language, brief.language || brief.framework || "JavaScript").slice(0, 80);
  const filePath = text(step?.filePath, defaultPracticeFile(language)).slice(0, 180);
  const prompt = text(step?.prompt, "").slice(0, 900);
  const acceptanceCriteria = uniqueStrings(step?.acceptanceCriteria).slice(0, 5);
  if (!prompt || acceptanceCriteria.length < 2) throw new Error("Practice coding problems require a prompt and at least two acceptance criteria.");
  const starterCode = typeof step?.starterCode === "string" ? step.starterCode.slice(0, 12000) : "";
  const workspaceFiles = Array.isArray(step?.workspaceFiles) && step.workspaceFiles.length
    ? step.workspaceFiles.slice(0, 20).map((file) => ({
        path: text(file?.path, filePath).slice(0, 180),
        content: typeof file?.content === "string" ? file.content.slice(0, 12000) : "",
        purpose: typeof file?.purpose === "string" ? file.purpose.slice(0, 180) : undefined,
        editable: file?.editable !== false
      }))
    : [{ path: filePath, content: starterCode, editable: true }];
  return {
    type: "lab",
    language,
    filePath,
    context: text(step?.context, `Independent ${language} practice for ${brief.motivation || brief.goal}.`).slice(0, 700),
    prompt,
    starterCode,
    acceptanceCriteria,
    workspaceView: ["code", "preview", "terminal"].includes(step?.workspaceView) ? step.workspaceView : step?.requiresPreview ? "preview" : "code",
    requiresPreview: Boolean(step?.requiresPreview),
    requiresTerminal: Boolean(step?.requiresTerminal),
    workspaceFiles
  };
}

function defaultPracticeFile(language) {
  const label = String(language).toLowerCase();
  if (label.includes("python")) return "main.py";
  if (label.includes("typescript")) return "main.ts";
  if (label.includes("html")) return "index.html";
  if (label.includes("css")) return "styles.css";
  if (label.includes("sql")) return "query.sql";
  return "main.js";
}

function slug(value) {
  return text(value, "practice").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "practice";
}

function normalizeGuidedProject(value, brief, assessmentReview, loadedMilestoneIndex) {
  if (value?.schemaVersion === "guided-project-content/v2" || value?.module) {
    return normalizeGuidedProjectV2(value, brief, assessmentReview);
  }
  return normalizeGuidedProjectV1(value, brief, assessmentReview, loadedMilestoneIndex);
}

function normalizeGuidedProjectV2(value, brief, assessmentReview) {
  const subject = value?.subject || subjectForLearningBrief(brief);
  const projectMode = inferGuidedProjectMode(brief);
  const nativeVisualProject = isNativeVisualGuidedProject(brief);
  const externalEngineProject = isExternalEngineGuidedProject(brief);
  const rawModule = value?.module && typeof value.module === "object" ? value.module : null;
  if (!rawModule || !Array.isArray(rawModule.blocks) || rawModule.blocks.length !== 3) {
    throw new Error("Guided project requires exactly one module with three blocks.");
  }
  const initialWorkspaceFiles = normalizeCompactProjectWorkspaceFiles(value?.workspaceFiles, brief, {
    projectMode,
    nativeVisualProject,
    externalEngineProject
  });
  const preparedBlocks = rawModule.blocks.map((block, index) => {
    const rawSteps = Array.isArray(block?.steps) ? block.steps : [];
    if (index === 1) {
      return {
        ...block,
        kind: "workshop",
        steps: expandCompactProjectSteps(rawSteps, initialWorkspaceFiles, brief, {
          projectMode,
          nativeVisualProject,
          externalEngineProject
        })
      };
    }
    return {
      ...block,
      kind: "theory",
      steps: compactGuidedProjectTheorySteps(rawSteps, index === 0 ? "introduction" : "recap")
    };
  });
  const wrapper = normalizeGeneratedCourseContent({
    schemaVersion: "course-content/v2",
    title: value?.title,
    subject,
    description: value?.description,
    languages: value?.languages,
    tags: value?.tags,
    generationDepth: "full_course",
    assessmentReview: assessmentReview ?? value?.assessmentReview,
    modules: [{
      id: rawModule.id || "guided-project",
      title: rawModule.title || value?.title,
      summary: rawModule.summary || value?.description,
      topics: [{
        id: `${rawModule.id || "guided-project"}-build`,
        title: rawModule.title || value?.title,
        summary: rawModule.summary || value?.description,
        blocks: preparedBlocks
      }]
    }]
  });
  const module = wrapper.modules[0];
  const blocks = module?.topics?.[0]?.blocks ?? [];
  if (blocks.length !== 3 || blocks[0]?.kind !== "theory" || blocks[1]?.kind !== "workshop" || !["theory", "review"].includes(blocks[2]?.kind)) {
    throw new Error("Guided project blocks must be introduction theory, workshop, then recap theory.");
  }
  const guidedStepCount = blocks[1].steps.filter((step) => step.type === "workshop").length;
  if (guidedStepCount < 10 || guidedStepCount > 20) {
    throw new Error(`Guided project workshop requires 10 to 20 guided coding steps; received ${guidedStepCount}.`);
  }
  if (blocks[0].steps.some((step) => ["workshop", "lab", "project"].includes(step.type)) || blocks[2].steps.some((step) => ["workshop", "lab", "project"].includes(step.type))) {
    throw new Error("Guided project introduction and recap must not contain coding tasks.");
  }
  return {
    schemaVersion: "guided-project-content/v2",
    title: wrapper.title,
    subject: wrapper.subject,
    description: wrapper.description,
    languages: wrapper.languages,
    tags: uniqueStrings([...(wrapper.tags ?? []), "Guided project"]),
    learningBrief: brief,
    generationDepth: "full_project",
    assessmentReview: wrapper.assessmentReview,
    architecture: normalizeArchitecture(value?.architecture, brief),
    module: {
      id: module.id,
      title: module.title,
      summary: module.summary,
      blocks
    }
  };
}

function normalizeGuidedProjectV1(value, brief, assessmentReview, loadedMilestoneIndex) {
  const subject = value?.subject || subjectForLearningBrief(brief);
  const rawMilestones = Array.isArray(value?.milestones) ? value.milestones : [];
  const wrapper = normalizeGeneratedCourseContent({
    schemaVersion: "course-content/v2",
    title: value?.title,
    subject,
    description: value?.description,
    languages: value?.languages,
    tags: value?.tags,
    generationDepth: "full_structure_first_module",
    assessmentReview: assessmentReview ?? value?.assessmentReview,
    modules: rawMilestones
  });
  if (wrapper.modules.length < 3 || wrapper.modules.length > 8) {
    throw new Error(`Guided project requires a 3 to 8 milestone outline; received ${wrapper.modules.length}.`);
  }
  const milestones = wrapper.modules.map((milestone, index) => ({
    ...milestone,
    unlocked: index <= loadedMilestoneIndex,
    topics: milestone.topics.map((topic) => ({ ...topic, unlocked: index <= loadedMilestoneIndex }))
  }));
  for (const milestone of milestones.filter((_, index) => index <= loadedMilestoneIndex)) {
    const guidedStepCount = milestone.topics
      .flatMap((topic) => topic.blocks)
      .flatMap((block) => block.steps)
      .filter((step) => step.type === "workshop").length;
    if (guidedStepCount < 8 || guidedStepCount > 15) {
      throw new Error(`Loaded project milestone must contain 8 to 15 guided coding steps; received ${guidedStepCount}.`);
    }
  }
  return {
    schemaVersion: "guided-project-content/v1",
    title: wrapper.title,
    subject: wrapper.subject,
    description: wrapper.description,
    languages: wrapper.languages,
    tags: uniqueStrings([...(wrapper.tags ?? []), "Guided project"]),
    learningBrief: brief,
    generationDepth: milestones.every((milestone) => milestone.unlocked) ? "full_project" : "project_outline_first_milestone",
    assessmentReview: wrapper.assessmentReview,
    architecture: normalizeArchitecture(value?.architecture, brief),
    milestones
  };
}

function normalizeCompactProjectWorkspaceFiles(files, brief, { projectMode, nativeVisualProject }) {
  let normalized = (Array.isArray(files) ? files : [])
    .filter((file) => file && typeof file === "object" && text(file.path, ""))
    .slice(0, 20)
    .map((file) => ({
      path: text(file.path, "main.py").slice(0, 180),
      content: typeof file.content === "string" ? file.content.slice(0, 40000) : "",
      purpose: optionalCompactText(file.purpose, 180),
      editable: file.editable !== false
    }));
  const language = brief.language || brief.framework || "Python";
  if (!normalized.some((file) => file.editable !== false)) {
    normalized.unshift({ path: defaultPracticeFile(language), content: "", purpose: "Main project file", editable: true });
  }
  if (projectMode === "scratch_build") {
    normalized = normalized.map((file) => file.editable === false ? file : { ...file, content: "" });
  }
  if (nativeVisualProject) {
    const sourcePath = normalized.find((file) => file.editable !== false)?.path ?? defaultPracticeFile(language);
    const previewFile = buildNativeScenePreviewFile({
      title: brief.desiredOutcome || brief.goal,
      status: projectMode === "scratch_build"
        ? "The scene will grow as you add code in each workshop step."
        : "This is the starting scene before you repair or extend it."
    }, brief, sourcePath);
    normalized = [...normalized.filter((file) => file.path !== previewFile.path), previewFile];
  }
  return normalized;
}

function expandCompactProjectSteps(rawSteps, initialFiles, brief, { projectMode, nativeVisualProject, externalEngineProject }) {
  const files = new Map(initialFiles.map((file) => [file.path, { ...file }]));
  const codingSteps = rawSteps.filter((step) => step?.type !== "summary");
  if (codingSteps.length < 10 || codingSteps.length > 20) {
    throw new Error(`Guided project workshop requires 10 to 20 guided coding steps; received ${codingSteps.length}.`);
  }
  const expanded = codingSteps.map((step, index) => {
    const language = text(step?.language, brief.language || brief.framework || "Python");
    const filePath = text(step?.filePath, defaultPracticeFile(language)).slice(0, 180);
    const existing = files.get(filePath) ?? { path: filePath, content: "", purpose: "Project file", editable: true };
    const starterCode = typeof step?.starterCode === "string" ? step.starterCode : existing.content;
    const edit = step?.edit && typeof step.edit === "object" ? step.edit : null;
    let resultCode = typeof step?.resultCode === "string" && step.resultCode.trim() ? step.resultCode : "";
    if (!resultCode && edit) {
      const replacement = typeof edit.replace === "string" ? edit.replace : "";
      if (edit.operation === "create") {
        resultCode = replacement;
      } else {
        const find = typeof edit.find === "string" ? edit.find : "";
        resultCode = applyCompactProjectEdit(starterCode, find, replacement);
      }
    }
    if (!resultCode) throw new Error(`Guided project step ${index + 1} needs a deterministic edit or resultCode.`);
    if (resultCode.trim() === starterCode.trim()) {
      throw new Error(`Guided project step ${index + 1} must introduce a real code change.`);
    }
    files.set(filePath, { ...existing, content: resultCode, editable: true });
    if (nativeVisualProject) {
      const previewFile = buildNativeScenePreviewFile(step?.visualState ?? {
        title: brief.desiredOutcome || brief.goal,
        status: step?.expectedChange || step?.prompt || `Code step ${index + 1} is now represented in the scene.`
      }, brief, filePath);
      files.set(previewFile.path, previewFile);
    }
    return {
      ...step,
      type: "workshop",
      filePath,
      language,
      starterCode,
      resultCode,
      requiresPreview: externalEngineProject ? false : nativeVisualProject || Boolean(step?.requiresPreview),
      requiresTerminal: externalEngineProject ? false : nativeVisualProject || Boolean(step?.requiresTerminal),
      workspaceView: "code",
      workspaceFiles: [...files.values()].map((file) => ({ ...file }))
    };
  });
  validateScratchProjectFoundation(expanded, brief, projectMode);
  const recap = [...rawSteps].reverse().find((step) => step?.type === "summary");
  return recap ? [...expanded, recap] : expanded;
}

function applyCompactProjectEdit(source, find, replacement) {
  if (find && source.includes(find)) return source.replace(find, replacement);
  const trimmedFind = String(find ?? "").trim();
  if (trimmedFind && source.includes(trimmedFind)) return source.replace(trimmedFind, replacement);
  if (replacement && source.includes(replacement)) return source;

  const sourceLines = source.split("\n");
  const findLines = trimmedFind.split("\n").map((line) => line.trim()).filter(Boolean);
  const anchor = findLines[0];
  const anchorIndex = anchor ? sourceLines.findIndex((line) => line.trim() === anchor) : -1;
  if (anchorIndex >= 0) {
    const replacementLines = replacement.split("\n");
    sourceLines.splice(anchorIndex, Math.max(1, findLines.length), ...replacementLines);
    return sourceLines.join("\n");
  }

  const separator = source && !source.endsWith("\n") ? "\n" : "";
  return `${source}${separator}${replacement}${replacement && !replacement.endsWith("\n") ? "\n" : ""}`;
}

function optionalCompactText(value, max) {
  const normalized = text(value, "");
  return normalized ? normalized.slice(0, max) : undefined;
}

function inferGuidedProjectMode(brief) {
  const request = [brief?.goal, brief?.desiredOutcome, brief?.motivation].filter(Boolean).join(" ");
  return /\b(?:fix|debug|repair|troubleshoot|existing|starter|add (?:a )?feature|extend|improve|refactor)\b/i.test(request)
    ? "repair_or_feature"
    : "scratch_build";
}

function isNativeVisualGuidedProject(brief) {
  const request = [brief?.goal, brief?.subject, brief?.language, brief?.framework, brief?.platform, brief?.desiredOutcome]
    .filter(Boolean)
    .join(" ");
  if (isExternalEngineGuidedProject(brief)) return false;
  if (/\b(?:html|css|browser|web|react|vue|svelte|canvas|javascript|typescript)\b/i.test(request)) return false;
  return /\b(?:pygame|desktop game|game development|graphics|sprite|platformer)\b/i.test(request);
}

function isExternalEngineGuidedProject(brief) {
  const request = [brief?.goal, brief?.subject, brief?.language, brief?.framework, brief?.platform, brief?.desiredOutcome]
    .filter(Boolean)
    .join(" ");
  return /\b(?:unity(?:engine)?|unreal(?:\s+engine)?|godot|cryengine|roblox(?:\s+studio)?|gamemaker|game\s+maker|source\s+engine|blender)\b/i.test(request);
}

function compactGuidedProjectTheorySteps(rawSteps, phase) {
  const limit = phase === "introduction" ? 3 : 2;
  const fallback = phase === "introduction"
    ? "## Before you build\n\nYou will first orient yourself to the project, its useful outcome, and the few ideas the build depends on."
    : "## Project recap\n\nReview how the finished parts connect and where you can reuse this pattern.";
  const explanations = rawSteps
    .filter((step) => step && ["theory", "analogy", "example", "summary"].includes(step.type))
    .map((step) => text(step.markdown, ""))
    .filter(Boolean);
  if (!explanations.length) return [{ type: phase === "recap" ? "summary" : "theory", markdown: fallback }];

  const groups = Array.from({ length: Math.min(limit, explanations.length) }, () => []);
  explanations.forEach((markdown, index) => {
    const groupIndex = Math.min(groups.length - 1, Math.floor(index * groups.length / explanations.length));
    groups[groupIndex].push(markdown);
  });
  return groups.map((parts, index) => ({
    type: phase === "recap" && index === groups.length - 1 ? "summary" : "theory",
    markdown: parts.join("\n\n")
  }));
}

function validateScratchProjectFoundation(steps, brief, projectMode) {
  if (projectMode !== "scratch_build") return;
  const codingSteps = steps.filter((step) => step?.type === "workshop");
  if (!codingSteps.length || codingSteps[0].starterCode.trim()) {
    throw new Error("A scratch guided project must begin with a blank editable source file.");
  }

  const request = [brief?.goal, brief?.subject, brief?.framework, brief?.desiredOutcome].filter(Boolean).join(" ");
  if (!/\bpygame\b/i.test(request)) return;
  const first = codingSteps[0];
  const second = codingSteps[1];
  const third = codingSteps[2];
  if (!introducesCode(first, /\bimport\s+pygame\b/i) || /pygame\.init\s*\(/i.test(first.resultCode)) {
    throw new Error("A scratch Pygame project must add import pygame in Step 1 without initializing Pygame yet.");
  }
  if (!introducesCode(second, /pygame\.init\s*\(\s*\)/i)) {
    throw new Error("A scratch Pygame project must add pygame.init() in Step 2.");
  }
  if (!introducesCode(third, /\bwidth\b/i) || !introducesCode(third, /\bheight\b/i)) {
    throw new Error("A scratch Pygame project must define the related width and height values in Step 3.");
  }
}

function introducesCode(step, pattern) {
  return Boolean(step && pattern.test(step.resultCode) && !pattern.test(step.starterCode));
}

function buildNativeScenePreviewFile(visualState, brief, sourcePath) {
  const title = text(visualState?.title, brief?.desiredOutcome || brief?.goal || "Project scene").slice(0, 100);
  const status = text(visualState?.status, "The synchronized scene will update as the project grows.").slice(0, 220);
  const width = clampInteger(visualState?.viewport?.width, 240, 1200, 800);
  const height = clampInteger(visualState?.viewport?.height, 180, 800, 450);
  const background = safeSceneColor(visualState?.viewport?.background, "#101722");
  const objects = (Array.isArray(visualState?.objects) ? visualState.objects : [])
    .slice(0, 40)
    .map((object) => ({
      kind: ["rectangle", "circle", "text", "line"].includes(object?.kind) ? object.kind : "rectangle",
      x: finiteSceneNumber(object?.x, 0),
      y: finiteSceneNumber(object?.y, 0),
      width: finiteSceneNumber(object?.width, 80),
      height: finiteSceneNumber(object?.height, 40),
      radius: finiteSceneNumber(object?.radius, 18),
      color: safeSceneColor(object?.color, "#77d2a6"),
      label: text(object?.label, "").slice(0, 80)
    }));
  const scene = JSON.stringify({ width, height, background, objects }).replace(/</g, "\\u003c");
  const sourceReference = `../${String(sourcePath).replace(/^\/+/, "")}`;
  const content = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="stonecode-source" content="${escapeProjectHtml(sourceReference)}">
  <title>${escapeProjectHtml(title)}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090d13; color: #eef6f1; }
    main { width: min(94vw, 920px); }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
    h1 { margin: 0; font-size: 16px; }
    p { margin: 4px 0 0; color: #9eafa6; font-size: 12px; }
    .badge { border: 1px solid #355a49; border-radius: 999px; padding: 5px 9px; color: #a5e4c4; font-size: 11px; white-space: nowrap; }
    canvas { display: block; width: 100%; height: auto; border: 1px solid #29362f; border-radius: 10px; background: ${background}; }
  </style>
</head>
<body>
  <main>
    <header><div><h1>${escapeProjectHtml(title)}</h1><p>${escapeProjectHtml(status)}</p></div><span class="badge">Synchronized learning scene · not Python runtime</span></header>
    <canvas id="scene" width="${width}" height="${height}"></canvas>
  </main>
  <script>
    const scene = ${scene};
    const canvas = document.querySelector('#scene');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, scene.width, scene.height);
    ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
    for (const item of scene.objects) {
      ctx.fillStyle = item.color;
      ctx.strokeStyle = item.color;
      if (item.kind === 'circle') { ctx.beginPath(); ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2); ctx.fill(); }
      else if (item.kind === 'line') { ctx.beginPath(); ctx.moveTo(item.x, item.y); ctx.lineTo(item.x + item.width, item.y + item.height); ctx.stroke(); }
      else if (item.kind === 'text') { ctx.fillText(item.label, item.x, item.y); }
      else { ctx.fillRect(item.x, item.y, item.width, item.height); }
      if (item.label && item.kind !== 'text') { ctx.fillStyle = '#f4faf6'; ctx.fillText(item.label, item.x + 6, Math.max(14, item.y - 6)); }
    }
  <\/script>
</body>
</html>`;
  return {
    path: "preview/index.html",
    content,
    purpose: `Synchronized visual scene for ${sourcePath}`,
    editable: false
  };
}

function finiteSceneNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-2000, Math.min(2000, number)) : fallback;
}

function safeSceneColor(value, fallback) {
  const color = typeof value === "string" ? value.trim() : "";
  return /^(?:#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(color) ? color : fallback;
}

function escapeProjectHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeArchitecture(value, brief) {
  const stack = uniqueStrings(value?.stack ?? [brief.language, brief.framework].filter(Boolean));
  return {
    deliverable: text(value?.deliverable, brief.desiredOutcome || brief.goal),
    stack,
    capabilities: uniqueStrings(value?.capabilities).slice(0, 12)
  };
}

function inferExerciseStrategy(brief) {
  if (/weak/i.test(brief.goal)) return "weakness";
  if (brief.difficulty === "random") return "random";
  if (brief.difficulty === "adaptive") return "adaptive";
  return "topic";
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function text(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(Math.max(number, min), max) : fallback;
}

function escapeText(value) {
  return String(value ?? "").replace(/["\\]/g, "");
}
