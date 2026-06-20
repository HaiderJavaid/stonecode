const codeOutput = document.querySelector("#code-output");
const scene = document.querySelector(".scene");
const cardsRail = document.querySelector(".cards");
const cards = [...document.querySelectorAll(".shadow-card")];
const filePanel = document.querySelector(".file-panel");
const fileTopic = document.querySelector("#file-topic");
const fileTree = document.querySelector("#file-tree");
document.documentElement.dataset.motion = "css";

const topics = {
  rendering: {
    label: "Rendering",
    light: 1.08,
    files: [
      ["surface.ts", `<span class="muted">01</span> <span class="kw">const</span> surface = <span class="fn">createStoneIDE</span>({
<span class="muted">02</span>   theme: <span class="str">"basement-shadow"</span>,
<span class="muted">03</span>   texture: <span class="str">"grainy basalt wall"</span>,
<span class="muted">04</span>   lighting: <span class="fn">staticLowKey</span>({ angle: <span class="num">-18</span>, spread: <span class="str">"soft"</span> }),
<span class="muted">05</span>   surface: <span class="str">"engraved basalt"</span>
<span class="muted">06</span> });`],
      ["lighting.ts", `<span class="muted">01</span> <span class="kw">export function</span> <span class="fn">staticLowKey</span>(source) {
<span class="muted">02</span>   <span class="kw">const</span> shadow = source.angle * <span class="num">0.18</span>;
<span class="muted">03</span>   <span class="kw">return</span> { spread: source.spread, shadow };
<span class="muted">04</span> }`],
      ["engrave.ts", `<span class="muted">01</span> <span class="kw">function</span> <span class="fn">renderFrame</span>(time) {
<span class="muted">02</span>   <span class="kw">const</span> light = <span class="fn">trackAmbientSource</span>(time);
<span class="muted">03</span>   surface.<span class="fn">shade</span>(light).<span class="fn">engraveGlyphs</span>();
<span class="muted">04</span>   <span class="kw">return</span> <span class="fn">requestAnimationFrame</span>(renderFrame);
<span class="muted">05</span> }`]
    ]
  },
  structures: {
    label: "Structures",
    light: 1.12,
    files: [
      ["graph.ts", `<span class="muted">01</span> <span class="kw">class</span> <span class="fn">LearningGraph</span> {
<span class="muted">02</span>   nodes = <span class="kw">new</span> <span class="fn">Map</span>();
<span class="muted">03</span>   edges = <span class="kw">new</span> <span class="fn">Set</span>();
<span class="muted">04</span>   <span class="fn">connect</span>(topic, prerequisite) {
<span class="muted">05</span>     <span class="kw">const</span> key = <span class="str">\`\${topic}:\${prerequisite}\`</span>;
<span class="muted">06</span>     <span class="kw">return</span> this.edges.<span class="fn">add</span>(key);
<span class="muted">07</span>   }
<span class="muted">08</span> }`],
      ["queue.ts", `<span class="muted">01</span> <span class="kw">const</span> queue = [];
<span class="muted">02</span> queue.<span class="fn">push</span>(<span class="str">"tries"</span>, <span class="str">"graphs"</span>);
<span class="muted">03</span> <span class="kw">const</span> next = queue.<span class="fn">shift</span>();
<span class="muted">04</span> <span class="fn">study</span>(next);`],
      ["cache.ts", `<span class="muted">01</span> <span class="kw">const</span> cache = <span class="kw">new</span> <span class="fn">WeakMap</span>();
<span class="muted">02</span> <span class="kw">export const</span> memo = (node) =&gt;
<span class="muted">03</span>   cache.<span class="fn">get</span>(node) ?? <span class="fn">compute</span>(node);`]
    ]
  },
  async: {
    label: "Async",
    light: 1.1,
    files: [
      ["runtime.ts", `<span class="muted">01</span> <span class="kw">const</span> scheduler = <span class="fn">createRuntime</span>({
<span class="muted">02</span>   budget: <span class="num">16.7</span>,
<span class="muted">03</span>   strategy: <span class="str">"yield-early"</span>
<span class="muted">04</span> });`],
      ["lesson.ts", `<span class="muted">01</span> <span class="kw">async function</span> <span class="fn">loadLesson</span>(id) {
<span class="muted">02</span>   <span class="kw">const</span> lesson = <span class="kw">await</span> cache.<span class="fn">read</span>(id);
<span class="muted">03</span>   <span class="kw">await</span> scheduler.<span class="fn">paint</span>(lesson);
<span class="muted">04</span>   <span class="kw">return</span> lesson.progress;
<span class="muted">05</span> }`],
      ["worker.ts", `<span class="muted">01</span> worker.<span class="fn">postMessage</span>({ type: <span class="str">"compile"</span> });
<span class="muted">02</span> worker.onmessage = ({ data }) =&gt; {
<span class="muted">03</span>   ui.<span class="fn">commit</span>(data.result);
<span class="muted">04</span> };`]
    ]
  },
  design: {
    label: "Design",
    light: 1.14,
    files: [
      ["tokens.ts", `<span class="muted">01</span> <span class="kw">const</span> tokens = {
<span class="muted">02</span>   radius: <span class="num">13</span>,
<span class="muted">03</span>   surface: <span class="str">"#101111"</span>,
<span class="muted">04</span>   engraving: <span class="str">"inset-text-shadow"</span>,
<span class="muted">05</span>   density: <span class="str">"compact"</span>
<span class="muted">06</span> };`],
      ["card.ts", `<span class="muted">01</span> <span class="fn">composeCard</span>(tokens)
<span class="muted">02</span>   .<span class="fn">withProgress</span>()
<span class="muted">03</span>   .<span class="fn">withActions</span>()
<span class="muted">04</span>   .<span class="fn">withChat</span>();`],
      ["type.css", `<span class="muted">01</span> .engraved {
<span class="muted">02</span>   color: <span class="str">rgba(230,230,220,.58)</span>;
<span class="muted">03</span>   text-shadow: <span class="str">0 -1px 1px #000</span>;
<span class="muted">04</span> }`]
    ]
  },
  algorithms: {
    label: "Algorithms",
    light: 1.16,
    files: [
      ["pathfinding.ts", `<span class="muted">01</span> <span class="kw">function</span> <span class="fn">choosePath</span>(graph, start, goal) {
<span class="muted">02</span>   <span class="kw">const</span> open = <span class="kw">new</span> <span class="fn">PriorityQueue</span>();
<span class="muted">03</span>   open.<span class="fn">push</span>(start, <span class="num">0</span>);
<span class="muted">04</span>   <span class="kw">while</span> (open.size) {
<span class="muted">05</span>     <span class="kw">const</span> node = open.<span class="fn">pop</span>();
<span class="muted">06</span>     <span class="kw">if</span> (node === goal) <span class="kw">return</span> <span class="fn">trace</span>(node);
<span class="muted">07</span>   }
<span class="muted">08</span> }`],
      ["sort.ts", `<span class="muted">01</span> items.<span class="fn">sort</span>((a, b) =&gt;
<span class="muted">02</span>   a.priority - b.priority
<span class="muted">03</span> );`],
      ["memo.ts", `<span class="muted">01</span> <span class="kw">const</span> memoize = (fn) =&gt; {
<span class="muted">02</span>   <span class="kw">const</span> seen = <span class="kw">new</span> <span class="fn">Map</span>();
<span class="muted">03</span>   <span class="kw">return</span> (x) =&gt; seen.<span class="fn">get</span>(x) ?? fn(x);
<span class="muted">04</span> };`]
    ]
  },
  systems: {
    label: "Systems",
    light: 1.12,
    files: [
      ["stonecode.ts", `<span class="muted">01</span> <span class="kw">const</span> ide = <span class="fn">composeSystem</span>({
<span class="muted">02</span>   editor: <span class="str">"stone-terminal"</span>,
<span class="muted">03</span>   mentor: <span class="str">"ai-chat"</span>,
<span class="muted">04</span>   progress: <span class="str">"topic-cards"</span>,
<span class="muted">05</span>   storage: <span class="str">"local-session"</span>
<span class="muted">06</span> });`],
      ["sync.ts", `<span class="muted">01</span> ide.<span class="fn">resume</span>()
<span class="muted">02</span>   .<span class="fn">syncProgress</span>()
<span class="muted">03</span>   .<span class="fn">render</span>();`],
      ["modules.ts", `<span class="muted">01</span> <span class="kw">export</span> { editor, cards, mentor };
<span class="muted">02</span> <span class="kw">export default</span> <span class="fn">stonecode</span>;`]
    ]
  }
};

let activeCard = null;
let openTimers = [];

function clearOpenTimers() {
  openTimers.forEach((timer) => window.clearTimeout(timer));
  openTimers = [];
}

function setCode(html, light = 1.08) {
  codeOutput.style.opacity = "0";
  window.setTimeout(() => {
    codeOutput.innerHTML = html;
    document.documentElement.style.setProperty("--code-light", light);
    codeOutput.style.opacity = "1";
  }, 140);
}

function renderFiles(topicKey, selectedIndex = 0, updateCode = true) {
  const topic = topics[topicKey] || topics.rendering;
  fileTopic.textContent = topic.label;
  fileTree.innerHTML = "";

  topic.files.forEach(([name, html], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `file-button${index === selectedIndex ? " is-selected" : ""}`;
    button.textContent = name;
    button.addEventListener("click", () => {
      fileTree.querySelectorAll(".file-button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      setCode(html, topic.light);
    });
    fileTree.append(button);
  });
  if (updateCode) setCode(topic.files[selectedIndex][1], topic.light);
  return topic.files[selectedIndex][1];
}

function openCard(card) {
  clearOpenTimers();
  activeCard = card;
  codeOutput.style.opacity = "0";
  cardsRail.classList.add("has-open");
  cards.forEach((item) => {
    const active = item === card;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-expanded", String(active));
  });

  openTimers.push(window.setTimeout(() => {
    scene.classList.add("has-panel");
    filePanel.classList.add("is-visible");
    filePanel.setAttribute("aria-hidden", "false");
    renderFiles(card.dataset.topic, 0, false);
  }, 520));

  openTimers.push(window.setTimeout(() => {
    const topic = topics[card.dataset.topic] || topics.rendering;
    setCode(topic.files[0][1], topic.light);
  }, 1080));
}

function collapseCard() {
  clearOpenTimers();
  activeCard = null;
  scene.classList.remove("has-panel");
  cardsRail.classList.remove("has-open");
  cards.forEach((item) => {
    item.classList.remove("is-active");
    item.setAttribute("aria-expanded", "false");
  });
  filePanel.classList.remove("is-visible");
  filePanel.setAttribute("aria-hidden", "true");
}

cards.forEach((card) => {
  card.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) {
      if (button.classList.contains("card-back")) {
        collapseCard();
        return;
      }
      const chat = card.querySelector(".mini-chat p");
      const label = button.textContent.trim();
      if (chat) chat.textContent = `${label} selected. AI chat is ready for this topic.`;
      return;
    }
    if (activeCard !== card) openCard(card);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeCard !== card) openCard(card);
    }
  });
});

cards.forEach((card) => {
  const chat = card.querySelector(".mini-chat");
  const form = document.createElement("form");
  form.className = "chat-compose";
  form.innerHTML = `<input type="text" placeholder="Ask AI..." aria-label="Chat message" /><button type="submit">Send</button>`;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input");
    const message = input.value.trim();
    const output = chat.querySelector("p");
    if (!message) return;
    output.textContent = `You: ${message}`;
    input.value = "";
  });
  chat.append(form);
});
