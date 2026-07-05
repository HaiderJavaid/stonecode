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
  },
  {
    id: "official-react-docs",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "React official docs",
    url: "https://react.dev/learn",
    content: "Use React official docs for component, JSX, state, props, and effects grounding. React courses should assess JavaScript and component thinking before advanced framework behavior."
  },
  {
    id: "official-nextjs-docs",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "Next.js official docs",
    url: "https://nextjs.org/docs",
    content: "Use Next.js official docs for routing, rendering, data fetching, and app structure grounding. Next.js depends on JavaScript, React, and request/response basics."
  },
  {
    id: "official-mdn-javascript",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "MDN JavaScript guide",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    content: "Use MDN JavaScript documentation for variables, functions, control flow, objects, arrays, and browser language fundamentals."
  },
  {
    id: "official-cpp-reference",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "C++ reference",
    url: "https://en.cppreference.com/w/",
    content: "Use C++ reference material for syntax, standard library, strings, vectors, functions, and console output grounding. Beginner C++ courses should teach compile/run mental models slowly."
  },
  {
    id: "official-csharp-docs",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "Microsoft C# docs",
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/",
    content: "Use Microsoft C# docs for syntax, types, methods, classes, and Console.WriteLine grounding. Unity scripting courses depend on basic C# syntax, variables, methods, and object/component ideas."
  },
  {
    id: "official-unity-scripting",
    sourceType: "official-docs",
    kind: "official-reference",
    title: "Unity scripting manual",
    url: "https://docs.unity3d.com/Manual/scripting.html",
    content: "Use Unity official scripting docs for MonoBehaviour, GameObject, components, Start, Update, input, and simple scene scripting. Assess C# fundamentals before Unity-specific behavior."
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
    if (task.includes("assessment") && chunk.kind === "official-reference") score += 1;
    return { chunk, score };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, limit)
    .map((item) => item.chunk);
}
