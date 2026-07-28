import type { LRLanguage } from "@codemirror/language";
import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { javascriptLanguage, jsxLanguage, tsxLanguage, typescriptLanguage } from "@codemirror/lang-javascript";
import { jsonLanguage } from "@codemirror/lang-json";
import { highlightCode, tagHighlighter, tags } from "@lezer/highlight";
import type { ReactNode } from "react";

const codeHighlighter = tagHighlighter([
  { tag: tags.keyword, class: "code-token-keyword" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.function(tags.definition(tags.variableName))], class: "code-token-function" },
  { tag: [tags.tagName, tags.typeName, tags.className], class: "code-token-type" },
  { tag: [tags.propertyName, tags.attributeName], class: "code-token-property" },
  { tag: [tags.string, tags.special(tags.string)], class: "code-token-string" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit, tags.color], class: "code-token-number" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], class: "code-token-comment" },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.name], class: "code-token-variable" },
  { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], class: "code-token-operator" }
]);

export function renderMarkdown(content: string) {
  const lines = content.trim().split("\n");
  const blocks: JSX.Element[] = [];
  let listItems: string[] = [];
  let codeFence: { lang: string; lines: string[]; auto?: boolean } | null = null;

  function flushList() {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item) => (
          <li key={item}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  function flushCodeFence() {
    if (!codeFence) return;
    blocks.push(
      <CodeFence code={codeFence.lines.join("\n")} language={codeFence.lang} key={`canvas-${blocks.length}`} />
    );
    codeFence = null;
  }

  lines.forEach((line) => {
    const trimmedStart = line.trimStart();
    if (trimmedStart.startsWith("```")) {
      if (codeFence) {
        flushCodeFence();
        return;
      }

      flushList();
      codeFence = { lang: trimmedStart.replace("```", "").trim(), lines: [] };
      return;
    }

    if (codeFence?.auto && (!line.trim() || !isCodeLikeContinuation(line, codeFence.lang))) {
      flushCodeFence();
      if (!line.trim()) return;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      return;
    }

    if (!line.trim()) {
      flushList();
      return;
    }

    if (isCodeLikeLine(line)) {
      flushList();
      codeFence = { lang: resolveDisplayedLanguage("", line), lines: [line], auto: true };
      return;
    }

    if (line.startsWith("# ")) {
      flushList();
      blocks.push(<h1 key={`heading-${blocks.length}`}>{line.replace("# ", "")}</h1>);
      return;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(<h2 key={`heading-${blocks.length}`}>{line.replace("## ", "")}</h2>);
      return;
    }

    if (line.startsWith("### ")) {
      flushList();
      blocks.push(<h3 key={`heading-${blocks.length}`}>{line.replace("### ", "")}</h3>);
      return;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.replace("- ", ""));
      return;
    }

    flushList();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(line)}</p>);
  });

  flushList();
  flushCodeFence();
  return blocks;
}

function isCodeLikeLine(line: string) {
  const trimmed = line.trim();
  return /^<\/?[A-Za-z][\w-]*(\s|>|\/)/.test(trimmed)
    || /^[.#][A-Za-z_][\w-]*\s*\{/.test(trimmed)
    || /^\w[\w-]*\s*:\s*[^;]+;?$/.test(trimmed);
}

function isCodeLikeContinuation(line: string, language: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (language === "html") return /^<\/?[A-Za-z][\w-]*(\s|>|\/)|^<\/[A-Za-z][\w-]*>$/.test(trimmed);
  if (language === "css") return /^[.#]?[A-Za-z_][\w-]*\s*\{|^[A-Za-z-]+\s*:|^[{};]$|^}/.test(trimmed);
  return isCodeLikeLine(line);
}

function CodeFence({ code, language }: { code: string; language: string }) {
  const normalizedLanguage = resolveDisplayedLanguage(language, code);
  const languageClass = normalizedLanguage ? ` language-${normalizedLanguage.replace(/[^a-z0-9-]/gi, "").toLowerCase()}` : "";
  const normalizedCode = normalizeDisplayedCode(code, normalizedLanguage);

  return (
    <pre className={`ai-canvas ${normalizedLanguage === "diagram" ? "diagram-canvas" : "code-canvas"}${languageClass}`} data-language={normalizedLanguage || undefined}>
      <code>{renderHighlightedCodeLines(normalizedCode, normalizedLanguage)}</code>
    </pre>
  );
}

function resolveDisplayedLanguage(language: string, code: string) {
  const normalized = language.toLowerCase().trim();
  if (normalized) return normalized;
  const firstLine = code.trimStart().split("\n")[0]?.trim().toLowerCase();
  if (firstLine && code.includes("\n") && knownCodeLanguageLabels.has(firstLine)) return normalizeCodeLanguageLabel(firstLine);
  const text = code.toLowerCase();
  if (/<\/?[a-z][\w-]*(\s|>|\/)/.test(text)) return "html";
  if (/[.#]?[a-z][\w-]*\s*\{/.test(text) || /\b(background|background-color|color|padding|margin|display|font-size)\b\s*:/.test(text)) return "css";
  if (/\b(function|const|let|var|return|console|import|export)\b/.test(text)) return "js";
  return "";
}

function normalizeDisplayedCode(code: string, language: string) {
  const normalized = stripLeadingCodeLanguageLabel(code.replace(/\r\n/g, "\n"), language).trimEnd();
  if (!shouldRepairFragmentedCode(normalized, language)) return normalized;
  if (language === "css") return repairCssFragmentedCode(normalized);
  if (isJavaScriptLikeLanguage(language)) return repairJavaScriptFragmentedCode(normalized);
  return repairFragmentedCode(normalized);
}

const knownCodeLanguageLabels = new Set([
  "css",
  "html",
  "javascript",
  "js",
  "jsx",
  "typescript",
  "ts",
  "tsx",
  "json",
  "python",
  "py",
  "java",
  "c",
  "cpp",
  "c++",
  "csharp",
  "cs",
  "c#",
  "go",
  "rust",
  "php"
]);

function normalizeCodeLanguageLabel(label: string) {
  if (label === "javascript") return "js";
  if (label === "typescript") return "ts";
  if (label === "python") return "py";
  return label;
}

function stripLeadingCodeLanguageLabel(code: string, language: string) {
  if (!language) return code;
  const lines = code.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return code;
  const firstLine = lines[firstContentIndex].trim().toLowerCase();
  const normalizedLanguage = normalizeCodeLanguageLabel(language.toLowerCase());
  if (normalizeCodeLanguageLabel(firstLine) !== normalizedLanguage) return code;
  return [...lines.slice(0, firstContentIndex), ...lines.slice(firstContentIndex + 1)].join("\n").trimStart();
}

function isJavaScriptLikeLanguage(language: string) {
  return ["js", "javascript", "mjs", "cjs", "node", "ts", "typescript", "jsx", "tsx", "react"].includes(language);
}

function shouldRepairFragmentedCode(code: string, language: string) {
  if (!code.includes("\n")) return false;
  if (!["css", "html", "js", "javascript", "ts", "typescript", "jsx", "tsx", "json", "java", "c", "cpp", "c++", "csharp", "cs", "c#", "go", "rust", "php"].includes(language)) {
    return false;
  }

  const lines = code.split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmpty.length < 4) return false;

  const blankLineCount = lines.filter((line) => !line.trim()).length;
  const tokenLikeCount = nonEmpty.filter((line) => /^[A-Za-z_$#.-][\w$#.-]*;?$|^[{}()[\];:,.]$|^[=!<>+\-*/%&|]+$|^"(?:[^"]*)";?$|^'(?:[^']*)';?$|^`(?:[^`]*)`;?$|^#[0-9a-f]{3,8};?$|^\d+(?:\.\d+)?(?:px|rem|em|%)?;?$/i.test(line)).length;
  const averageLineLength = nonEmpty.join("").length / nonEmpty.length;
  const tokenLikeRatio = tokenLikeCount / nonEmpty.length;

  if (isJavaScriptLikeLanguage(language)) {
    const hasJavaScriptShape = nonEmpty.some((line) => /^(function|const|let|var|return|class|import|export)$/.test(line))
      && nonEmpty.some((line) => /^[{}()[\];=]$/.test(line));
    return hasJavaScriptShape && tokenLikeRatio >= 0.58 && averageLineLength <= 12;
  }

  return (blankLineCount >= Math.floor(lines.length / 4) || averageLineLength <= 10)
    && tokenLikeRatio >= 0.65;
}

function repairCssFragmentedCode(code: string) {
  const tokens = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((token) => token.endsWith(";") && token !== ";" ? [token.slice(0, -1), ";"] : [token]);

  const lines: string[] = [];
  let selector = "";
  let property = "";
  let value: string[] = [];
  let inRule = false;

  function flushDeclaration() {
    if (!property) return;
    lines.push(`  ${property}: ${value.join(" ").trim()};`);
    property = "";
    value = [];
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "{") {
      lines.push(`${selector.trim()} {`);
      selector = "";
      inRule = true;
      continue;
    }
    if (token === "}") {
      flushDeclaration();
      lines.push("}");
      inRule = false;
      continue;
    }
    if (!inRule) {
      selector = selector ? `${selector} ${token}` : token;
      continue;
    }
    if (token === ":") {
      continue;
    }
    if (token === ";") {
      flushDeclaration();
      continue;
    }
    if (!property) {
      property = token;
      while (tokens[index + 1] === "-" && tokens[index + 2] && /^[A-Za-z_][\w-]*$/.test(tokens[index + 2])) {
        property += `-${tokens[index + 2]}`;
        index += 2;
      }
      continue;
    }
    value.push(token);
  }

  flushDeclaration();
  return lines.join("\n");
}

function repairJavaScriptFragmentedCode(code: string) {
  const tokens = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap(splitTrailingJavaScriptPunctuation);

  const lines: string[] = [];
  let current = "";
  let indent = 0;

  function pushCurrent() {
    if (!current.trim()) return;
    lines.push(`${"  ".repeat(Math.max(indent, 0))}${current.trim()}`);
    current = "";
  }

  function appendWord(token: string) {
    if (!current) {
      current = token;
      return;
    }

    if (current.endsWith("(") || current.endsWith("[") || current.endsWith(".") || current.endsWith("!")) {
      current = `${current}${token}`;
      return;
    }

    if (/[\s(](?:typeof|void|new|return|throw|case)$/.test(` ${current}`)) {
      current = `${current} ${token}`;
      return;
    }

    if (/^[+\-*/%=<>!&|?]+$/.test(token) || /[+\-*/%=<>!&|?:]$/.test(current)) {
      current = `${current.trimEnd()} ${token}`;
      return;
    }

    current = `${current} ${token}`;
  }

  for (const token of tokens) {
    if (token === "}") {
      pushCurrent();
      indent = Math.max(indent - 1, 0);
      lines.push(`${"  ".repeat(indent)}}`);
      continue;
    }

    if (token === "{") {
      current = `${current.trimEnd()} {`.trim();
      pushCurrent();
      indent += 1;
      continue;
    }

    if (token === ";") {
      current = `${current.trimEnd()};`;
      pushCurrent();
      continue;
    }

    if (token === ",") {
      current = `${current.trimEnd()},`;
      continue;
    }

    if (token === ".") {
      current = `${current.trimEnd()}.`;
      continue;
    }

    if (token === "(") {
      current = /\b(if|for|while|switch|catch|with)$/.test(current.trim())
        ? `${current.trimEnd()} (`
        : `${current.trimEnd()}(`;
      continue;
    }

    if (token === "[") {
      current = `${current.trimEnd()}[`;
      continue;
    }

    if (token === ")" || token === "]") {
      current = `${current.trimEnd()}${token}`;
      continue;
    }

    appendWord(token);
  }

  pushCurrent();
  return lines.join("\n");
}

function splitTrailingJavaScriptPunctuation(token: string) {
  const pieces: string[] = [];
  let current = token;

  while (
    current.length > 1
    && /[;,]$/.test(current)
    && !/^[;,]$/.test(current)
  ) {
    pieces.unshift(current.at(-1) || "");
    current = current.slice(0, -1);
  }

  pieces.unshift(current);
  return pieces;
}

function repairFragmentedCode(code: string) {
  const tokens = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let current = "";
  let indent = 0;

  function pushCurrent() {
    if (!current.trim()) return;
    lines.push(`${"  ".repeat(Math.max(indent, 0))}${current.trim()}`);
    current = "";
  }

  for (const token of tokens) {
    if (token === "}") {
      pushCurrent();
      indent = Math.max(indent - 1, 0);
      lines.push(`${"  ".repeat(indent)}}`);
      continue;
    }
    if (token === "{") {
      current = `${current.trimEnd()} {`.trim();
      pushCurrent();
      indent += 1;
      continue;
    }
    if (token === ";") {
      current = `${current.trimEnd()};`;
      pushCurrent();
      continue;
    }
    if (token === ":") {
      current = `${current.trimEnd()}:`;
      continue;
    }
    if (token === ",") {
      current = `${current.trimEnd()},`;
      continue;
    }
    if (token === ")" || token === "]") {
      current = `${current.trimEnd()}${token}`;
      continue;
    }
    if (token === "(" || token === "[") {
      current = `${current.trimEnd()}${token}`;
      continue;
    }

    if (!current) {
      current = token;
      continue;
    }

    if (current.endsWith(":")) {
      current = `${current} ${token}`;
      continue;
    }

    current = `${current} ${token}`;
  }

  pushCurrent();
  return lines.join("\n");
}

function renderRegexHighlightedCode(code: string, language: string) {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage === "diagram") return code;
  if (normalizedLanguage === "css") return renderCssFallbackHighlightedCode(code);
  if (normalizedLanguage === "html" || normalizedLanguage === "xml") return renderHtmlFallbackHighlightedCode(code);
  const tokenPattern = /(\/\/.*|\/\*[\s\S]*?\*\/|#[0-9a-f]{3,8}\b|#.*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:abstract|async|await|bool|boolean|break|case|catch|class|const|continue|def|else|enum|export|extends|false|final|finally|float|for|from|func|function|if|import|in|int|interface|let|new|null|None|out|pass|private|protected|public|return|static|string|struct|switch|this|true|True|try|undefined|using|var|void|while|white|black|blue|red|green|transparent|block|flex|grid|inline|none)\b|\b[A-Za-z_$][\w$-]*(?=\s*\()|\.[A-Za-z_$][\w$-]*|\b\d+(?:\.\d+)?(?:px|rem|em|%)?\b|[{}()[\];,.=:+\-*/<>!&|?]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(code)) !== null) {
    if (match.index > lastIndex) parts.push(<span key={`t-${lastIndex}`}>{code.slice(lastIndex, match.index)}</span>);
    const token = match[0];
    const className = resolveTokenClass(token);
    parts.push(<span className={className} key={`t-${match.index}`}>{token}</span>);
    lastIndex = match.index + token.length;
  }

  if (lastIndex < code.length) parts.push(<span key={`t-${lastIndex}`}>{code.slice(lastIndex)}</span>);
  return parts.length ? parts : code;
}

function renderHighlightedCodeLines(code: string, language: string) {
  if (language.toLowerCase() === "diagram") return code;
  const parser = resolveStaticCodeParser(language);
  if (parser) {
    try {
      return renderLezerHighlightedCodeLines(code, parser);
    } catch {
      return renderRegexHighlightedCodeLines(code, language);
    }
  }
  return renderRegexHighlightedCodeLines(code, language);
}

function renderRegexHighlightedCodeLines(code: string, language: string) {
  return code.split("\n").map((line, index) => (
    <span className="code-line" key={`line-${index}`}>
      {line ? renderRegexHighlightedCode(line, language) : "\u00A0"}
    </span>
  ));
}

function renderLezerHighlightedCodeLines(code: string, language: LRLanguage) {
  const lines: ReactNode[][] = [[]];
  let key = 0;

  function pushText(text: string, classes?: string) {
    const pieces = text.split("\n");
    pieces.forEach((piece, index) => {
      if (index > 0) lines.push([]);
      if (!piece) return;
      lines[lines.length - 1].push(
        classes
          ? <span className={classes} key={`c-${key++}`}>{piece}</span>
          : <span key={`c-${key++}`}>{piece}</span>
      );
    });
  }

  highlightCode(
    code,
    language.parser.parse(code),
    codeHighlighter,
    pushText,
    () => {
      lines.push([]);
    }
  );

  return lines.map((line, index) => (
    <span className="code-line" key={`line-${index}`}>
      {line.length ? line : "\u00A0"}
    </span>
  ));
}

function resolveStaticCodeParser(language: string) {
  const normalized = language.replace(/[^a-z0-9+#-]/gi, "").toLowerCase();
  if (["js", "javascript", "mjs", "cjs", "node"].includes(normalized)) return javascriptLanguage;
  if (["jsx", "react"].includes(normalized)) return jsxLanguage;
  if (["ts", "typescript"].includes(normalized)) return typescriptLanguage;
  if (["tsx"].includes(normalized)) return tsxLanguage;
  if (["css"].includes(normalized)) return cssLanguage;
  if (["html", "xml"].includes(normalized)) return htmlLanguage;
  if (["json"].includes(normalized)) return jsonLanguage;
  return null;
}

function renderCssFallbackHighlightedCode(code: string) {
  return renderTokenizedCode(
    code,
    /(\/\*[\s\S]*?\*\/|#[0-9a-f]{3,8}\b|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b[A-Za-z-]+(?=\s*:)|\b(?:white|black|blue|red|green|transparent|block|flex|grid|inline|none|solid|relative|absolute|fixed|auto)\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)?\b|[.#]?[A-Za-z_][\w-]*|[{}()[\];:,.=+\-*/<>!&|?]+)/g,
    resolveCssTokenClass
  );
}

function renderHtmlFallbackHighlightedCode(code: string) {
  return renderTokenizedCode(
    code,
    /(<!--[\s\S]*?-->|<\/?[A-Za-z][\w-]*|\/?>|=|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b[A-Za-z_:][\w:.-]*\b)/g,
    resolveHtmlTokenClass
  );
}

function resolveCssTokenClass(token: string) {
  if (/^\/\*/.test(token)) return "code-token-comment";
  if (/^#[0-9a-f]{3,8}$/i.test(token) || /^\d/.test(token)) return "code-token-number";
  if (/^["']/.test(token)) return "code-token-string";
  if (/^[{}()[\];:,.=+\-*/<>!&|?]+$/.test(token)) return "code-token-operator";
  if (/^[.#]/.test(token)) return "code-token-type";
  if (/^(white|black|blue|red|green|transparent|block|flex|grid|inline|none|solid|relative|absolute|fixed|auto)$/i.test(token)) return "code-token-keyword";
  return "code-token-property";
}

function resolveHtmlTokenClass(token: string) {
  if (/^<!--/.test(token)) return "code-token-comment";
  if (/^<\/?[A-Za-z]/.test(token)) return "code-token-type";
  if (/^["']/.test(token)) return "code-token-string";
  if (/^(\/?>|=)$/.test(token)) return "code-token-operator";
  return "code-token-property";
}

function renderTokenizedCode(code: string, tokenPattern: RegExp, resolveClassName: (token: string) => string) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(code)) !== null) {
    if (match.index > lastIndex) parts.push(<span key={`t-${lastIndex}`}>{code.slice(lastIndex, match.index)}</span>);
    const token = match[0];
    parts.push(<span className={resolveClassName(token)} key={`t-${match.index}`}>{token}</span>);
    lastIndex = match.index + token.length;
  }

  if (lastIndex < code.length) parts.push(<span key={`t-${lastIndex}`}>{code.slice(lastIndex)}</span>);
  return parts.length ? parts : code;
}

function resolveTokenClass(token: string) {
  if (/^#[0-9a-f]{3,8}$/i.test(token)) return "code-token-number";
  if (/^(\/\/|#|\/\*)/.test(token)) return "code-token-comment";
  if (/^["'`]/.test(token)) return "code-token-string";
  if (/^\d/.test(token)) return "code-token-number";
  if (/^\./.test(token)) return "code-token-property";
  if (/^[A-Za-z_$]/.test(token) && !/^(abstract|async|await|bool|boolean|break|case|catch|class|const|continue|def|else|enum|export|extends|false|final|finally|float|for|from|func|function|if|import|in|int|interface|let|new|null|None|out|pass|private|protected|public|return|static|string|struct|switch|this|true|True|try|undefined|using|var|void|while)$/.test(token)) return "code-token-function";
  if (/^[{}()[\];,.=:+\-*/<>!&|?]+$/.test(token)) return "code-token-operator";
  return "code-token-keyword";
}

function renderInlineMarkdown(content: string) {
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
    ) : part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}
