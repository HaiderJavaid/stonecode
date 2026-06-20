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
    blocks.push(
      <pre className={`ai-canvas ${codeFence.lang === "diagram" ? "diagram-canvas" : "code-canvas"}`} key={`canvas-${blocks.length}`}>
        <code>{codeFence.lines.join("\n")}</code>
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

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(<h3 key={`heading-${blocks.length}`}>{line.replace("## ", "")}</h3>);
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
