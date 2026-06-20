export type TopicKey =
  | "rendering"
  | "structures"
  | "async"
  | "design"
  | "algorithms"
  | "systems";

export type TopicFile = {
  name: string;
  codeHtml: string;
};

export type Topic = {
  key: TopicKey;
  title: string;
  label: string;
  description: string;
  progress: number;
  chatHint: string;
  light: number;
  files: TopicFile[];
};

export const topics: Topic[] = [
  {
    key: "rendering",
    title: "Rendering Pipeline",
    label: "Rendering",
    description: "Static stone layers, low-key light, clean render path.",
    progress: 92,
    chatHint: "Ask about render loops, shadows, or texture cost.",
    light: 1.08,
    files: [
      {
        name: "surface.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> surface = <span class="fn">createStoneIDE</span>({
<span class="muted">02</span>   theme: <span class="str">"basement-shadow"</span>,
<span class="muted">03</span>   texture: <span class="str">"grainy basalt wall"</span>,
<span class="muted">04</span>   lighting: <span class="fn">staticLowKey</span>({ angle: <span class="num">-18</span>, spread: <span class="str">"soft"</span> }),
<span class="muted">05</span>   surface: <span class="str">"engraved basalt"</span>
<span class="muted">06</span> });`
      },
      {
        name: "lighting.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">export function</span> <span class="fn">staticLowKey</span>(source) {
<span class="muted">02</span>   <span class="kw">const</span> shadow = source.angle * <span class="num">0.18</span>;
<span class="muted">03</span>   <span class="kw">return</span> { spread: source.spread, shadow };
<span class="muted">04</span> }`
      },
      {
        name: "engrave.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">function</span> <span class="fn">renderFrame</span>(time) {
<span class="muted">02</span>   <span class="kw">const</span> light = <span class="fn">trackAmbientSource</span>(time);
<span class="muted">03</span>   surface.<span class="fn">shade</span>(light).<span class="fn">engraveGlyphs</span>();
<span class="muted">04</span>   <span class="kw">return</span> <span class="fn">requestAnimationFrame</span>(renderFrame);
<span class="muted">05</span> }`
      }
    ]
  },
  {
    key: "structures",
    title: "Data Structures",
    label: "Structures",
    description: "Maps, sets, tries, queues, graphs, and caches.",
    progress: 78,
    chatHint: "Ask which structure fits the current problem.",
    light: 1.12,
    files: [
      {
        name: "graph.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">class</span> <span class="fn">LearningGraph</span> {
<span class="muted">02</span>   nodes = <span class="kw">new</span> <span class="fn">Map</span>();
<span class="muted">03</span>   edges = <span class="kw">new</span> <span class="fn">Set</span>();
<span class="muted">04</span>   <span class="fn">connect</span>(topic, prerequisite) {
<span class="muted">05</span>     <span class="kw">const</span> key = <span class="str">\`\${topic}:\${prerequisite}\`</span>;
<span class="muted">06</span>     <span class="kw">return</span> this.edges.<span class="fn">add</span>(key);
<span class="muted">07</span>   }
<span class="muted">08</span> }`
      },
      {
        name: "queue.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> queue = [];
<span class="muted">02</span> queue.<span class="fn">push</span>(<span class="str">"tries"</span>, <span class="str">"graphs"</span>);
<span class="muted">03</span> <span class="kw">const</span> next = queue.<span class="fn">shift</span>();
<span class="muted">04</span> <span class="fn">study</span>(next);`
      },
      {
        name: "cache.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> cache = <span class="kw">new</span> <span class="fn">WeakMap</span>();
<span class="muted">02</span> <span class="kw">export const</span> memo = (node) =&gt;
<span class="muted">03</span>   cache.<span class="fn">get</span>(node) ?? <span class="fn">compute</span>(node);`
      }
    ]
  },
  {
    key: "async",
    title: "Async Runtime",
    label: "Async",
    description: "Frame throttling, pointer smoothing, resize guards.",
    progress: 84,
    chatHint: "Ask about promises, workers, and frame budget.",
    light: 1.1,
    files: [
      {
        name: "runtime.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> scheduler = <span class="fn">createRuntime</span>({
<span class="muted">02</span>   budget: <span class="num">16.7</span>,
<span class="muted">03</span>   strategy: <span class="str">"yield-early"</span>
<span class="muted">04</span> });`
      },
      {
        name: "lesson.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">async function</span> <span class="fn">loadLesson</span>(id) {
<span class="muted">02</span>   <span class="kw">const</span> lesson = <span class="kw">await</span> cache.<span class="fn">read</span>(id);
<span class="muted">03</span>   <span class="kw">await</span> scheduler.<span class="fn">paint</span>(lesson);
<span class="muted">04</span>   <span class="kw">return</span> lesson.progress;
<span class="muted">05</span> }`
      },
      {
        name: "worker.ts",
        codeHtml: `<span class="muted">01</span> worker.<span class="fn">postMessage</span>({ type: <span class="str">"compile"</span> });
<span class="muted">02</span> worker.onmessage = ({ data }) =&gt; {
<span class="muted">03</span>   ui.<span class="fn">commit</span>(data.result);
<span class="muted">04</span> };`
      }
    ]
  },
  {
    key: "design",
    title: "Design Systems",
    label: "Design",
    description: "Stone tokens, engraved type, dramatic contrast.",
    progress: 71,
    chatHint: "Ask how tokens map into production UI.",
    light: 1.14,
    files: [
      {
        name: "tokens.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> tokens = {
<span class="muted">02</span>   radius: <span class="num">13</span>,
<span class="muted">03</span>   surface: <span class="str">"#101111"</span>,
<span class="muted">04</span>   engraving: <span class="str">"inset-text-shadow"</span>,
<span class="muted">05</span>   density: <span class="str">"compact"</span>
<span class="muted">06</span> };`
      },
      {
        name: "card.ts",
        codeHtml: `<span class="muted">01</span> <span class="fn">composeCard</span>(tokens)
<span class="muted">02</span>   .<span class="fn">withProgress</span>()
<span class="muted">03</span>   .<span class="fn">withActions</span>()
<span class="muted">04</span>   .<span class="fn">withChat</span>();`
      },
      {
        name: "type.css",
        codeHtml: `<span class="muted">01</span> .engraved {
<span class="muted">02</span>   color: <span class="str">rgba(230,230,220,.58)</span>;
<span class="muted">03</span>   text-shadow: <span class="str">0 -1px 1px #000</span>;
<span class="muted">04</span> }`
      }
    ]
  },
  {
    key: "algorithms",
    title: "Algorithms",
    label: "Algorithms",
    description: "Search, sorting, memoization, and pathfinding.",
    progress: 66,
    chatHint: "Ask for complexity hints or dry-run examples.",
    light: 1.16,
    files: [
      {
        name: "pathfinding.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">function</span> <span class="fn">choosePath</span>(graph, start, goal) {
<span class="muted">02</span>   <span class="kw">const</span> open = <span class="kw">new</span> <span class="fn">PriorityQueue</span>();
<span class="muted">03</span>   open.<span class="fn">push</span>(start, <span class="num">0</span>);
<span class="muted">04</span>   <span class="kw">while</span> (open.size) {
<span class="muted">05</span>     <span class="kw">const</span> node = open.<span class="fn">pop</span>();
<span class="muted">06</span>     <span class="kw">if</span> (node === goal) <span class="kw">return</span> <span class="fn">trace</span>(node);
<span class="muted">07</span>   }
<span class="muted">08</span> }`
      },
      {
        name: "sort.ts",
        codeHtml: `<span class="muted">01</span> items.<span class="fn">sort</span>((a, b) =&gt;
<span class="muted">02</span>   a.priority - b.priority
<span class="muted">03</span> );`
      },
      {
        name: "memo.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> memoize = (fn) =&gt; {
<span class="muted">02</span>   <span class="kw">const</span> seen = <span class="kw">new</span> <span class="fn">Map</span>();
<span class="muted">03</span>   <span class="kw">return</span> (x) =&gt; seen.<span class="fn">get</span>(x) ?? fn(x);
<span class="muted">04</span> };`
      }
    ]
  },
  {
    key: "systems",
    title: "Systems Thinking",
    label: "Systems",
    description: "Ready to become a stone-surface IDE shell.",
    progress: 88,
    chatHint: "Ask how modules, state, and IO connect.",
    light: 1.12,
    files: [
      {
        name: "stonecode.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">const</span> ide = <span class="fn">composeSystem</span>({
<span class="muted">02</span>   editor: <span class="str">"stone-terminal"</span>,
<span class="muted">03</span>   mentor: <span class="str">"ai-chat"</span>,
<span class="muted">04</span>   progress: <span class="str">"topic-cards"</span>,
<span class="muted">05</span>   storage: <span class="str">"local-session"</span>
<span class="muted">06</span> });`
      },
      {
        name: "sync.ts",
        codeHtml: `<span class="muted">01</span> ide.<span class="fn">resume</span>()
<span class="muted">02</span>   .<span class="fn">syncProgress</span>()
<span class="muted">03</span>   .<span class="fn">render</span>();`
      },
      {
        name: "modules.ts",
        codeHtml: `<span class="muted">01</span> <span class="kw">export</span> { editor, cards, mentor };
<span class="muted">02</span> <span class="kw">export default</span> <span class="fn">stonecode</span>;`
      }
    ]
  }
];

export const defaultCodeHtml = `<span class="muted">01</span> <span class="kw">const</span> surface = <span class="fn">createStoneIDE</span>({
<span class="muted">02</span>   theme: <span class="str">"basement-shadow"</span>,
<span class="muted">03</span>   texture: <span class="str">"grainy basalt wall"</span>,
<span class="muted">04</span>   lighting: <span class="fn">staticLowKey</span>({ angle: <span class="num">-18</span>, spread: <span class="str">"soft"</span> }),
<span class="muted">05</span>   surface: <span class="str">"engraved basalt"</span>
<span class="muted">06</span> });
<span class="muted">07</span>
<span class="muted">08</span> <span class="kw">function</span> <span class="fn">renderFrame</span>(time) {
<span class="muted">09</span>   <span class="kw">const</span> light = <span class="fn">trackAmbientSource</span>(time);
<span class="muted">10</span>   surface.<span class="fn">shade</span>(light).<span class="fn">engraveGlyphs</span>();
<span class="muted">11</span>   <span class="kw">return</span> <span class="fn">requestAnimationFrame</span>(renderFrame);
<span class="muted">12</span> }`;
