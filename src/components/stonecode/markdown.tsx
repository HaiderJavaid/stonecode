export function renderMarkdown(content: string) {
  const lines = content.trim().split("\n");
  const blocks: JSX.Element[] = [];
  let listItems: string[] = [];
  let codeFence: { lang: string; lines: string[] } | null = null;

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
    const languageClass = codeFence.lang ? ` language-${codeFence.lang.replace(/[^a-z0-9-]/gi, "").toLowerCase()}` : "";
    blocks.push(
      <pre className={`ai-canvas ${codeFence.lang === "diagram" ? "diagram-canvas" : "code-canvas"}${languageClass}`} key={`canvas-${blocks.length}`}>
        <code>{renderHighlightedCode(codeFence.lines.join("\n"), codeFence.lang)}</code>
      </pre>
    );
    codeFence = null;
  }

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      if (codeFence) {
        flushCodeFence();
        return;
      }

      flushList();
      codeFence = { lang: line.replace("```", "").trim(), lines: [] };
      return;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      return;
    }

    if (!line.trim()) {
      flushList();
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

function renderHighlightedCode(code: string, language: string) {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage === "diagram") return code;
  const tokenPattern = /("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|export|import|from|async|await|def|pass|print|true|false|null|undefined|None|True|False)\b|\b\d+(?:\.\d+)?\b|\/\/.*|#.*|\/\*[\s\S]*?\*\/)/g;
  const parts: JSX.Element[] = [];
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

function resolveTokenClass(token: string) {
  if (/^["'`]/.test(token)) return "code-token-string";
  if (/^(\/\/|#|\/\*)/.test(token)) return "code-token-comment";
  if (/^\d/.test(token)) return "code-token-number";
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
