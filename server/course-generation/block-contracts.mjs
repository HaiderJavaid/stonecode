function trimText(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

export function normalizeBlockKindName(blockKind) {
  const kind = typeof blockKind === "string" ? blockKind.trim().toLowerCase() : "";
  return ["theory", "quiz", "workshop", "lab", "project", "review"].includes(kind) ? kind : "review";
}

export function extractModuleOutline(courseOutline, moduleIndex) {
  const source = courseOutline?.course && typeof courseOutline.course === "object" ? courseOutline.course : courseOutline;
  const modules = Array.isArray(source?.modules) ? source.modules : [];
  return modules[moduleIndex] ?? null;
}

export function blockKindsInModuleOutline(moduleOutline) {
  const rawTopics = Array.isArray(moduleOutline?.chapters) ? moduleOutline.chapters : moduleOutline?.topics;
  const kinds = new Set(["theory"]);
  for (const topic of Array.isArray(rawTopics) ? rawTopics : []) {
    for (const block of Array.isArray(topic?.blocks) ? topic.blocks : []) {
      kinds.add(normalizeBlockKindName(block?.kind));
    }
  }
  return [...kinds];
}

export function buildBlockGenerationPrompt({ blockKind, subject, moduleTitle, topicTitle, learnerContext }) {
  const kind = normalizeBlockKindName(blockKind);
  const shared = `Subject: ${trimText(subject, "Programming")}
Module: ${trimText(moduleTitle, "Current module")}
Topic: ${trimText(topicTitle, "Current topic")}
Learner context: ${JSON.stringify(learnerContext ?? {}).slice(0, 1200)}

Shared rules:
- Match the current topic; do not drift into unrelated topics.
- Assume zero syntax knowledge unless learner context proves otherwise.
- Explain new syntax before asking the learner to use it.
- Avoid generic filler and hidden prompt/internal-planning text.
- Follow the editable course-generation rulebook for course shape, block purpose, workshop granularity, and lab/project behavior.`;

  if (kind === "theory") {
    return `${shared}

Theory block contract:
- Use only theory, analogy, example, summary, and optional single mcq steps.
- Include real teaching before any MCQ. Never return a theory block made only of MCQ steps.
- Use as many theory/analogy/example/summary steps as the topic naturally needs. Do not force exactly one theory step or exactly one MCQ.
- Open the topic with short explanatory prose: what problem it solves, how it connects to the course goal/project, and what the learner will understand or build by the end. Do not open with a bullet dump.
- Teach why the idea exists and its mental model first, then technical names, then a tiny worked example.
- Include at least one useful analogy for each substantial new topic and explicitly map the analogy back to code or runtime behavior. Keep one analogy theme per topic.
- When syntax appears, include a fenced code snippet with the correct language tag and explain new tokens before asking the learner to use them.
- Do not ask for open-ended learner work inside theory markdown.
- A single quick MCQ can live inside theory; larger checks belong in quiz.`;
  }
  if (kind === "quiz") {
    return `${shared}

Quiz block contract:
- Use only mcq steps.
- Generate 4 to 10 MCQs.
- Each MCQ tests recently taught material.
- Distractors must be plausible, similar length, and not joke answers.
- correctOptionIndex should vary across questions.`;
  }
  if (kind === "workshop") {
    return `${shared}

Workshop block contract:
- First decide the concrete deliverable the learner will build.
- Decide whether this is a scratch build or a repair/add-feature task. Scratch builds begin from a blank file or the smallest unavoidable shell; broken or incomplete starter code is reserved for repair/add-feature work.
- Use as many guided workshop steps as the deliverable naturally needs. Do not target a fixed count.
- Start Step 1 with one compact introduction to the workshop deliverable. Do not repeat that introduction on later steps.
- Each step continues the same practical build unless a change is explicitly justified.
- Each coding step asks for one atomic editor action, usually one line or one small change, and explains only the new line or micro-change introduced in that step.
- Every coding step must make a real code edit. Never create a run-only, inspect-only, read-only, or confirm-the-starter step. Running and previewing verify the edit after it is made.
- Combine only tightly related code units, such as several imports or width/height constants. Never bundle unrelated concepts merely to reduce the step count.
- Do not repeat generic language syntax, explain the whole starter file, or include a starter-code excerpt on every step.
- Include context, prompt, language, filePath, starterCode, acceptanceCriteria, requiresPreview, requiresTerminal, workspaceView, and workspaceFiles.
- Include id, buildsOnStepId, expectedChange, resultCode, conceptIds, codeExplanation, and 2-3 suggestedQuestions on every coding step.
- starterCode is the code before the learner acts; resultCode is the code after the exact requested micro-edit.
- Step 1 uses buildsOnStepId:null. Every later step references the previous step id and its starterCode must exactly equal the previous resultCode.
- The context must briefly name what the learner is learning, why it is useful, and why this exact edit comes next.
- The prompt must move quickly: one immediate concrete edit action plus a small syntax hint when relevant.
- Starter code must be consistent across steps; do not reset to an unrelated example.
- Acceptance criteria must be concrete and visible in code/output.
- workspaceFiles is the complete small project snapshot needed by this step, with path, content, purpose, and editable. Include the active file plus related files in their real folders.
- For visual web, canvas, animation, or game work, keep a renderable scene available, use requiresPreview:true, and open workspaceView:"preview" on the first relevant step. Scratch builds grow that scene from the learner's edits; repair/add-feature tasks may preload it. Later steps may open Code while still requiring a Visual check.
- For web scenes, HTML is the preview entrypoint. Every local CSS or browser JavaScript file must be explicitly connected from that HTML with a correct relative <link href> or <script src> path. Never rely on the preview injecting unrelated workspace files.
- For native visual code such as Pygame, include an HTML synchronized scene reference linked to the source with <meta name="stonecode-source" content="...">. Visual is a learning representation of the native scene; Terminal remains the real runtime.
- Do not promise or synthesize Visual for full game engines/external scene editors such as Unity, Unreal, Godot, Roblox Studio, CryEngine, GameMaker, or Blender. Those steps are Code-only in Stonecode and are validated in their external editor later.
- For terminal-output work, use requiresTerminal:true and workspaceView:"terminal" when running or reading output is the learner's immediate action.
- Bug-fix and add-feature exercises must preload the broken or incomplete scene before asking the learner to edit it.
- End the workshop with only 1 or 2 non-coding summary steps. They explain what the completed code does, how its main parts connect, where the pattern is useful, and invite follow-up questions. They are not exercises.`;
  }
  if (kind === "lab") {
    return `${shared}

Lab block contract:
- Usually one independent lab step.
- A relevant guided workshop must already appear earlier in the course path. Thorough theory alone is not enough.
- The lab does not need to immediately follow that workshop. Reviews, quizzes, theory, topic transitions, and other workshops may appear between them.
- Treat the lab as a small checkpoint exam: less guidance, no new concepts, and a concrete independent result.
- Reuse the same pattern and concept set taught in that workshop, with a different variant and less guidance.
- Include goal/context, starterCode, concrete acceptanceCriteria, and expected visible outcome.
- Include the complete small workspaceFiles manifest when the lab spans multiple files or folders. Visual bug-fix labs preload a working preview shell plus the bug; terminal labs open the Terminal view.
- Do not introduce a new concept that was not taught earlier.`;
  }
  if (kind === "project") {
    return `${shared}

Project block contract:
- Use project steps only for larger milestone or capstone-style work.
- Place a milestone project only after multiple guided workshops and at least one independent lab have prepared its required capabilities.
- Never make a project the learner's first or second practical coding experience. Keep the final capstone near the end of the course.
- Multiple milestone projects are allowed when the curriculum has multiple natural cumulative checkpoints. The final project is the main exam and remains distinct.
- Include a deliverable, milestones inside the prompt, starterCode when useful, and concrete acceptanceCriteria.
- Keep scope small enough for the active IDE workspace.`;
  }
  return `${shared}

Review block contract:
- Use reflection and summary steps only.
- Reflection prompts must include a short recap or clue before asking the learner to answer.
- Summary steps should close the current topic and bridge to what comes next.`;
}
