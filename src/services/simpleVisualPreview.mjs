export const AUTO_SIMPLE_VISUAL_MARKER = "auto-simple-v1";

const EXTERNAL_ENGINE_PATTERN = /\b(?:unity(?:engine)?|unreal(?:\s+engine)?|godot|cryengine|roblox(?:\s+studio)?|gamemaker|game\s+maker|source\s+engine|blender)\b/i;

const VISUAL_PROFILES = [
  { id: "pygame", label: "Pygame", pattern: /\bpygame\b/i },
  { id: "python-turtle", label: "Python Turtle", pattern: /\b(?:import\s+turtle|from\s+turtle|turtle\.)/i },
  { id: "tkinter", label: "Tkinter Canvas", pattern: /\b(?:tkinter|tk\.|canvas\.create_(?:rectangle|oval|line|text))\b/i },
  { id: "matplotlib", label: "Matplotlib", pattern: /\b(?:matplotlib|pyplot|plt\.(?:plot|scatter|bar|imshow))\b/i },
  { id: "browser-canvas", label: "Browser Canvas", pattern: /\b(?:getContext\s*\(\s*["']2d|fillRect|strokeRect|arc\s*\(|fillText)\b/i },
  { id: "p5", label: "p5.js", pattern: /\b(?:createCanvas|function\s+draw\s*\(|p5\.)\b/i },
  { id: "phaser", label: "Phaser 2D", pattern: /\bPhaser\b/i },
  { id: "raylib", label: "raylib", pattern: /\b(?:raylib|DrawRectangle|DrawCircle|DrawText|InitWindow)\b/i },
  { id: "sfml", label: "SFML", pattern: /\b(?:SFML|sf::RenderWindow|sf::RectangleShape|sf::CircleShape)\b/i },
  { id: "sdl", label: "SDL 2D", pattern: /\b(?:SDL2?|SDL_Render|SDL_CreateWindow)\b/i },
  { id: "processing", label: "Processing", pattern: /\b(?:Processing|size\s*\(|void\s+draw\s*\(|ellipse\s*\()\b/i },
  { id: "java-2d", label: "Java 2D", pattern: /\b(?:javafx|javax\.swing|java\.awt|Graphics2D|fillRect|drawOval|drawString)\b/i },
  { id: "dotnet-2d", label: ".NET 2D", pattern: /\b(?:WinForms|Windows\s+Forms|System\.Drawing|WPF|FillRectangle|DrawEllipse|DrawString|MonoGame)\b/i },
  { id: "flutter", label: "Flutter", pattern: /\b(?:package:flutter|MaterialApp|CustomPaint|Canvas\s+canvas|Widget\s+build)\b/i },
  { id: "swift-ui", label: "SwiftUI", pattern: /\b(?:SwiftUI|UIView|UIKit|Canvas\s*\{|GeometryReader|struct\s+\w+\s*:\s*View)\b/i },
  { id: "compose", label: "Compose UI", pattern: /\b(?:Jetpack\s+Compose|androidx\.compose|@Composable|Canvas\s*\()\b/i },
  { id: "love2d", label: "LÖVE 2D", pattern: /\b(?:love\.graphics|function\s+love\.draw)\b/i },
  { id: "ruby-gosu", label: "Gosu 2D", pattern: /\b(?:require\s+["']gosu|Gosu::Window|draw_rect)\b/i }
];

const GENERIC_VISUAL_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "rb", "lua", "java", "kt", "kts", "dart", "swift", "cs", "cpp", "cc", "c", "h", "hpp", "php", "svg", "css"
]);

export function inspectSimpleVisualSource(input) {
  const path = String(input?.path ?? "");
  const content = String(input?.content ?? "");
  const combined = [input?.language, input?.context, input?.prompt, path, content].filter(Boolean).join("\n");
  if (EXTERNAL_ENGINE_PATTERN.test(combined)) {
    return { supported: false, excludedEngine: true, profileId: "external-engine", label: "External game engine" };
  }
  if (/\.html?$/i.test(path)) return { supported: false, excludedEngine: false, profileId: "browser-html", label: "Browser HTML" };
  const profile = VISUAL_PROFILES.find((candidate) => candidate.pattern.test(combined));
  if (profile) return { supported: true, excludedEngine: false, profileId: profile.id, label: profile.label };
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  if (input?.requiresPreview && GENERIC_VISUAL_EXTENSIONS.has(extension)) {
    return { supported: true, excludedEngine: false, profileId: extension === "css" ? "css" : extension === "svg" ? "svg" : "generic-2d", label: "Simple 2D" };
  }
  return { supported: false, excludedEngine: false, profileId: "none", label: "Not visual" };
}

export function createSimpleVisualPreviewFile(input, existingPaths = []) {
  const inspection = inspectSimpleVisualSource(input);
  if (!inspection.supported) return null;
  const normalizedPaths = new Set(existingPaths.map((path) => String(path).replace(/^\/+/, "")));
  const previewPath = normalizedPaths.has("preview/index.html") ? "preview/stonecode-visual.html" : "preview/index.html";
  return {
    path: previewPath,
    content: buildSimpleVisualPreviewHtml(input, { previewPath, inspection }),
    purpose: `Synchronized simple visual for ${input.path}`,
    editable: false
  };
}

export function isAutoSimpleVisualPreview(html) {
  return new RegExp(`<meta\\b[^>]*name=["']stonecode-preview["'][^>]*content=["']${AUTO_SIMPLE_VISUAL_MARKER}["']`, "i").test(String(html ?? ""));
}

export function buildSimpleVisualPreviewHtml(input, options = {}) {
  const inspection = options.inspection ?? inspectSimpleVisualSource({ ...input, requiresPreview: true });
  const previewPath = options.previewPath ?? "preview/index.html";
  const sourcePath = String(input?.path ?? "main.txt").replace(/^\/+/, "");
  const sourceReference = relativeSourceReference(previewPath, sourcePath);
  const scene = buildScene({ ...input, content: String(input?.content ?? "") }, inspection);
  const encodedScene = JSON.stringify(scene).replace(/</g, "\\u003c");
  const title = escapeHtml(scene.title);
  const status = escapeHtml(scene.status);

  if (inspection.profileId === "css") return buildCssPreviewHtml(input, { sourceReference, title, status, label: inspection.label });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="stonecode-preview" content="${AUTO_SIMPLE_VISUAL_MARKER}">
  <meta name="stonecode-source" content="${escapeHtml(sourceReference)}">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #080c11; color: #edf7f1; }
    main { width: min(94vw, 960px); padding: 18px 0; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
    h1 { margin: 0; font-size: 16px; font-weight: 650; }
    p { margin: 4px 0 0; color: #a7b7ae; font-size: 12px; line-height: 1.45; }
    .badge { border: 1px solid #36594a; border-radius: 999px; padding: 5px 9px; color: #a8e8c8; font-size: 11px; white-space: nowrap; }
    .stage { position: relative; overflow: hidden; border: 1px solid #2c3932; border-radius: 11px; background: #101722; box-shadow: 0 18px 70px #0008; }
    canvas { display: block; width: 100%; height: auto; }
    .empty { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
    .empty div { max-width: 420px; padding: 18px 22px; border: 1px solid #31443a; border-radius: 10px; background: #0d1512dd; text-align: center; }
    .empty strong { display: block; margin-bottom: 6px; color: #c8f3dc; font-size: 14px; }
    footer { margin-top: 9px; color: #788a80; font-size: 11px; }
  </style>
</head>
<body>
  <main>
    <header><div><h1>${title}</h1><p>${status}</p></div><span class="badge">${escapeHtml(inspection.label)} · synchronized 2D preview</span></header>
    <div class="stage"><canvas id="scene" width="${scene.width}" height="${scene.height}"></canvas><div class="empty" id="empty" hidden><div><strong id="empty-title"></strong><span id="empty-copy"></span></div></div></div>
    <footer>Visual approximation from the current source code. It does not execute the native framework or replace engine/runtime testing.</footer>
  </main>
  <script>
    const scene = ${encodedScene};
    const canvas = document.querySelector('#scene');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, scene.width, scene.height);
    drawGrid(ctx, scene.width, scene.height);
    for (const item of scene.objects) drawItem(ctx, item);
    if (!scene.objects.length) {
      document.querySelector('#empty').hidden = false;
      document.querySelector('#empty-title').textContent = scene.emptyTitle;
      document.querySelector('#empty-copy').textContent = scene.emptyCopy;
    }
    function drawGrid(context, width, height) {
      context.strokeStyle = 'rgba(255,255,255,.035)'; context.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y <= height; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    }
    function drawItem(context, item) {
      context.fillStyle = item.color; context.strokeStyle = item.color; context.lineWidth = 3;
      if (item.kind === 'circle') { context.beginPath(); context.arc(item.x, item.y, item.radius, 0, Math.PI * 2); item.outline ? context.stroke() : context.fill(); }
      else if (item.kind === 'line') { context.beginPath(); context.moveTo(item.x, item.y); context.lineTo(item.x + item.width, item.y + item.height); context.stroke(); }
      else if (item.kind === 'text') { context.font = item.font || '16px ui-sans-serif, system-ui'; context.fillText(item.label, item.x, item.y); }
      else { item.outline ? context.strokeRect(item.x, item.y, item.width, item.height) : context.fillRect(item.x, item.y, item.width, item.height); }
      if (item.label && item.kind !== 'text') { context.font = '12px ui-sans-serif, system-ui'; context.fillStyle = '#edf7f1'; context.fillText(item.label, item.x + 5, Math.max(14, item.y - 6)); }
    }
  <\/script>
</body>
</html>`;
}

function buildScene(input, inspection) {
  const source = String(input.content ?? "");
  const numbers = numericConstants(source);
  const width = clamp(resolveDimension(source, numbers, "width", 800), 240, 1200);
  const height = clamp(resolveDimension(source, numbers, "height", 450), 180, 800);
  const objects = [];
  collectRectangleCalls(source, numbers, objects);
  collectCircleCalls(source, numbers, objects);
  collectTextCalls(source, numbers, objects);
  collectLineCalls(source, numbers, objects);
  if (inspection.profileId === "matplotlib" && !objects.length) collectChartObjects(source, width, height, objects);
  if (["flutter", "swift-ui", "compose"].includes(inspection.profileId) && !objects.length) collectUiObjects(source, width, height, objects);
  const background = resolveBackground(source) ?? "#101722";
  const progress = resolveProgress(source, inspection.profileId);
  return {
    title: `${inspection.label} scene · ${fileName(input.path)}`,
    status: progress.status,
    width,
    height,
    background,
    objects: objects.slice(0, 60).map((object) => constrainObject(object, width, height)),
    emptyTitle: progress.emptyTitle,
    emptyCopy: progress.emptyCopy
  };
}

function resolveProgress(source, profileId) {
  if (profileId === "pygame") {
    if (!/\bimport\s+pygame\b/i.test(source)) return { status: "Pygame has not been imported yet.", emptyTitle: "No Pygame scene yet", emptyCopy: "Add the Pygame import in Code. Visual will update without running Terminal." };
    if (!/pygame\.init\s*\(/i.test(source)) return { status: "Pygame is imported; initialization comes next.", emptyTitle: "Library available", emptyCopy: "The code can now reference Pygame, but no window exists yet." };
    if (!/(?:display\.set_mode|pygame\.display\.set_mode)\s*\(/i.test(source)) return { status: "Pygame is initialized; the display has not been created yet.", emptyTitle: "Runtime initialized", emptyCopy: "Define dimensions, then create the display surface in a later micro-step." };
    return { status: /while\s+\w+/i.test(source) ? "Display and game loop detected in the current code." : "Display surface detected in the current code.", emptyTitle: "Window ready", emptyCopy: "The source creates a window; add drawable objects to see them represented here." };
  }
  const lineCount = source.trim() ? source.trim().split(/\r?\n/).length : 0;
  return { status: `${lineCount} source line${lineCount === 1 ? "" : "s"} mapped into a simple learning scene.`, emptyTitle: "Scene structure detected", emptyCopy: "Add a supported rectangle, circle, line, text, chart, or UI element and Visual will update." };
}

function collectRectangleCalls(source, numbers, objects) {
  const namedRects = new Map();
  const rectPattern = /([A-Za-z_]\w*)\s*=\s*(?:pygame\.)?Rect\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi;
  for (const match of source.matchAll(rectPattern)) {
    const object = rectangleObject(match.slice(2, 6), numbers, "#63d6a0", humanize(match[1]));
    namedRects.set(match[1], object); objects.push(object);
  }
  const tuplePatterns = [
    /(?:fillRect|strokeRect|DrawRectangle|draw_rect)\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi,
    /create_rectangle\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi,
    /(?:pygame\.)?draw\.rect\s*\([^,]+,\s*([^,]+),\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi
  ];
  for (const [patternIndex, pattern] of tuplePatterns.entries()) {
    for (const match of source.matchAll(pattern)) {
      const values = patternIndex === 2 ? match.slice(2, 6) : match.slice(1, 5);
      const color = patternIndex === 2 ? resolveColor(match[1]) : "#6eb6ff";
      objects.push(rectangleObject(values, numbers, color, "Rectangle", patternIndex === 0 && /strokeRect/i.test(match[0])));
    }
  }
  for (const match of source.matchAll(/pygame\.draw\.rect\s*\([^,]+,\s*([^,]+),\s*([A-Za-z_]\w*)/gi)) {
    const named = namedRects.get(match[2]);
    if (named) named.color = resolveColor(match[1]);
  }
}

function collectCircleCalls(source, numbers, objects) {
  const patterns = [
    /(?:DrawCircle|circle|ellipse)\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)/gi,
    /(?:pygame\.)?draw\.circle\s*\([^,]+,\s*([^,]+),\s*\(\s*([^,]+),\s*([^)]+)\),\s*([^)]+)\)/gi,
    /create_oval\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi
  ];
  for (const [index, pattern] of patterns.entries()) {
    for (const match of source.matchAll(pattern)) {
      if (index === 1) {
        objects.push({ kind: "circle", x: valueOf(match[2], numbers, 160), y: valueOf(match[3], numbers, 120), radius: valueOf(match[4], numbers, 24), color: resolveColor(match[1]), label: "Circle" });
      } else if (index === 2) {
        const x1 = valueOf(match[1], numbers, 100); const y1 = valueOf(match[2], numbers, 100); const x2 = valueOf(match[3], numbers, 160); const y2 = valueOf(match[4], numbers, 160);
        objects.push({ kind: "circle", x: (x1 + x2) / 2, y: (y1 + y2) / 2, radius: Math.max(8, Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2), color: "#ffcc73", label: "Oval" });
      } else {
        objects.push({ kind: "circle", x: valueOf(match[1], numbers, 160), y: valueOf(match[2], numbers, 120), radius: valueOf(match[3], numbers, 24), color: "#ffcc73", label: "Circle" });
      }
    }
  }
}

function collectTextCalls(source, numbers, objects) {
  const patterns = [
    /(?:fillText|DrawText|drawString)\s*\(\s*["']([^"']+)["']\s*,\s*([^,]+),\s*([^)]+)/gi,
    /create_text\s*\(\s*([^,]+),\s*([^,)]+)[\s\S]{0,100}?text\s*=\s*["']([^"']+)["']/gi
  ];
  for (const [index, pattern] of patterns.entries()) {
    for (const match of source.matchAll(pattern)) {
      objects.push({ kind: "text", x: valueOf(match[index ? 1 : 2], numbers, 40), y: valueOf(match[index ? 2 : 3], numbers, 50), color: "#f2f7f4", label: match[index ? 3 : 1].slice(0, 80) });
    }
  }
}

function collectLineCalls(source, numbers, objects) {
  const pattern = /(?:drawLine|DrawLine|create_line|moveTo)\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi;
  for (const match of source.matchAll(pattern)) {
    const x1 = valueOf(match[1], numbers, 60); const y1 = valueOf(match[2], numbers, 60); const x2 = valueOf(match[3], numbers, 220); const y2 = valueOf(match[4], numbers, 140);
    objects.push({ kind: "line", x: x1, y: y1, width: x2 - x1, height: y2 - y1, color: "#9d8cff", label: "Line" });
  }
}

function collectChartObjects(source, width, height, objects) {
  objects.push({ kind: "line", x: 70, y: height - 60, width: width - 120, height: 0, color: "#708078", label: "x" });
  objects.push({ kind: "line", x: 70, y: height - 60, width: 0, height: -(height - 120), color: "#708078", label: "y" });
  const values = [...source.matchAll(/\[([^\]]*\d[^\]]*)\]/g)].flatMap((match) => match[1].split(",").map(Number).filter(Number.isFinite)).slice(0, 12);
  values.forEach((value, index) => objects.push({ kind: "circle", x: 95 + index * 42, y: height - 80 - Math.abs(value % Math.max(80, height - 150)), radius: 6, color: "#63d6a0", label: "" }));
}

function collectUiObjects(source, width, height, objects) {
  const phoneWidth = Math.min(330, width - 100); const phoneX = (width - phoneWidth) / 2;
  objects.push({ kind: "rectangle", x: phoneX, y: 26, width: phoneWidth, height: height - 52, color: "#53645b", label: "App", outline: true });
  if (/AppBar|Navigation|navigationTitle/i.test(source)) objects.push({ kind: "rectangle", x: phoneX + 8, y: 38, width: phoneWidth - 16, height: 52, color: "#285844", label: "Navigation" });
  if (/Button|ElevatedButton|TextButton/i.test(source)) objects.push({ kind: "rectangle", x: phoneX + 54, y: height - 112, width: phoneWidth - 108, height: 44, color: "#63d6a0", label: "Button" });
  if (/Text\s*\(|Text\s*\{|UILabel/i.test(source)) objects.push({ kind: "text", x: phoneX + 34, y: 140, color: "#edf7f1", label: "Text content" });
}

function buildCssPreviewHtml(input, meta) {
  const css = String(input?.content ?? "").replace(/<\/style/gi, "/* blocked style close */");
  const classes = [...css.matchAll(/\.([A-Za-z_-][\w-]*)/g)].map((match) => match[1]).filter((value, index, all) => all.indexOf(value) === index).slice(0, 5);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="stonecode-preview" content="${AUTO_SIMPLE_VISUAL_MARKER}"><meta name="stonecode-source" content="${escapeHtml(meta.sourceReference)}"><title>${meta.title}</title><style>:root{color-scheme:dark;font-family:system-ui}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090d13;color:#eef7f2}.shell{width:min(88vw,760px);padding:24px;border:1px solid #304139;border-radius:12px;background:#111a16}.note{margin-bottom:18px;color:#9fb2a8;font-size:12px}.sample{padding:18px;border:1px dashed #4a6558;border-radius:8px}${css}</style></head><body><div class="shell"><strong>${meta.title}</strong><p class="note">${meta.status} · CSS-only sample wrapper</p><div class="sample ${classes.join(" ")}"><h2>Visual sample</h2><p>Your current CSS is applied to this small placeholder structure.</p><button>Example button</button></div></div></body></html>`;
}

function numericConstants(source) {
  const values = new Map();
  for (const match of source.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/g)) values.set(match[1].toLowerCase(), Number(match[2]));
  return values;
}

function resolveDimension(source, numbers, dimension, fallback) {
  const direct = numbers.get(dimension) ?? numbers.get(dimension.toUpperCase().toLowerCase());
  if (Number.isFinite(direct)) return direct;
  const setMode = source.match(/(?:set_mode|createCanvas|InitWindow|size)\s*\(\s*\(?\s*([^,]+),\s*([^)]+)/i);
  return setMode ? valueOf(setMode[dimension === "width" ? 1 : 2], numbers, fallback) : fallback;
}

function resolveBackground(source) {
  const match = source.match(/(?:\.fill|background|ClearBackground)\s*\(\s*([^\n;)]+)/i);
  return match ? resolveColor(match[1]) : null;
}

function rectangleObject(values, numbers, color, label, outline = false) {
  return { kind: "rectangle", x: valueOf(values[0], numbers, 80), y: valueOf(values[1], numbers, 80), width: valueOf(values[2], numbers, 100), height: valueOf(values[3], numbers, 60), color, label, outline };
}

function valueOf(raw, numbers, fallback) {
  const cleaned = String(raw ?? "").trim().replace(/[()]/g, "");
  const number = Number(cleaned);
  if (Number.isFinite(number)) return number;
  const stored = numbers.get(cleaned.toLowerCase());
  return Number.isFinite(stored) ? stored : fallback;
}

function resolveColor(raw) {
  const value = String(raw ?? "").trim();
  const hex = value.match(/#[0-9a-f]{3,8}/i)?.[0];
  if (hex) return hex;
  const tuple = value.match(/\(?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (tuple) return `rgb(${clamp(Number(tuple[1]), 0, 255)},${clamp(Number(tuple[2]), 0, 255)},${clamp(Number(tuple[3]), 0, 255)})`;
  const named = value.match(/\b(?:red|blue|green|yellow|orange|purple|white|black|gray|grey|pink|cyan)\b/i)?.[0];
  return named ?? "#63d6a0";
}

function constrainObject(object, width, height) {
  return {
    ...object,
    x: clamp(finite(object.x, 40), -100, width + 100),
    y: clamp(finite(object.y, 40), -100, height + 100),
    width: clamp(finite(object.width, 80), -width, width * 2),
    height: clamp(finite(object.height, 50), -height, height * 2),
    radius: clamp(finite(object.radius, 20), 2, Math.max(width, height)),
    color: safeColor(object.color),
    label: String(object.label ?? "").slice(0, 80)
  };
}

function relativeSourceReference(previewPath, sourcePath) {
  const depth = Math.max(0, String(previewPath).split("/").length - 1);
  return `${"../".repeat(depth)}${sourcePath}`;
}

function fileName(path) {
  return String(path ?? "source").split("/").at(-1) || "source";
}

function humanize(value) {
  return String(value ?? "Object").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeColor(value) {
  const color = String(value ?? "").trim();
  return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]{3,20})$/i.test(color) ? color : "#63d6a0";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}
