export const curatedRagChunks = [
  {
    id: "stonecode-project-spine",
    sourceType: "stonecode-curriculum",
    kind: "project-spine",
    title: "Hidden project spine",
    content: "Every generated course should secretly lead to one final project. Each module contributes a capability, each workshop builds a mini-function or behavior, each lab practices a variant, and the final project combines those pieces without feeling random."
  },
  {
    id: "stonecode-workshop-atomic-steps",
    sourceType: "stonecode-curriculum",
    kind: "block-pattern",
    blockKind: "workshop",
    title: "Atomic workshop steps",
    content: "A workshop is a guided tutorial, not an exam. Each screen asks for one small editor action, usually one line or one tiny change. Explain new syntax before use, keep the same file/build, and let the deliverable decide the step count."
  },
  {
    id: "stonecode-lab-transfer",
    sourceType: "stonecode-curriculum",
    kind: "block-pattern",
    blockKind: "lab",
    title: "Lab transfer pattern",
    content: "A lab comes after teaching or a workshop. It should reuse the same concept and project pattern with a different variant and less guidance. Do not introduce brand-new syntax inside a lab."
  },
  {
    id: "stonecode-theory-before-code",
    sourceType: "stonecode-curriculum",
    kind: "block-pattern",
    blockKind: "theory",
    title: "Theory before code",
    content: "Theory should introduce the mental model, name the concept, and explain the first code tokens before the learner must type them. Tiny examples are better than broad abstract descriptions for beginners."
  },
  {
    id: "stonecode-quality-rubric",
    sourceType: "stonecode-curriculum",
    kind: "quality-rubric",
    title: "Generated block quality rubric",
    content: "Reject generic filler. Blocks must name the current topic, match the learner readiness, avoid untaught concepts, connect to the hidden course project spine, and contain enough detail to render directly."
  }
];

export function selectCuratedRagChunks({ subject = "", task = "course-generation", limit = 8 } = {}) {
  const lower = String(subject).toLowerCase();
  const scored = curatedRagChunks.map((chunk) => {
    let score = chunk.sourceType === "stonecode-curriculum" ? 2 : 0;
    const haystack = `${chunk.title} ${chunk.content}`.toLowerCase();
    for (const token of lower.split(/[^a-z0-9+#]+/).filter(Boolean)) {
      if (haystack.includes(token)) score += 2;
    }
    if (task.includes("workshop") && chunk.blockKind === "workshop") score += 3;
    if (task.includes("lab") && chunk.blockKind === "lab") score += 3;
    if (task.includes("blueprint") && chunk.kind === "project-spine") score += 4;
    return { chunk, score };
  });
  return scored
    .filter(({ chunk, score }) => chunk.sourceType === "stonecode-curriculum" || score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, limit)
    .map((item) => item.chunk);
}
