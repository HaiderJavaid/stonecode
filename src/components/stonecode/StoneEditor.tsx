import { useEffect, useMemo, useRef } from "react";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, Extension } from "@codemirror/state";
import { drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

type StoneEditorProps = {
  filePath: string;
  value: string;
  onChange: (value: string) => void;
};

function languageForPath(filePath: string): Extension {
  if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath)) {
    return javascript({ jsx: /\.(jsx|tsx)$/.test(filePath), typescript: /\.(ts|tsx)$/.test(filePath) });
  }

  return [];
}

const stoneHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "rgba(150, 184, 242, 0.58)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "rgba(141, 214, 186, 0.58)" },
  { tag: [tags.string, tags.special(tags.string)], color: "rgba(214, 181, 126, 0.6)" },
  { tag: [tags.number, tags.bool, tags.null], color: "rgba(218, 144, 172, 0.6)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "rgba(220, 220, 212, 0.31)" },
  { tag: [tags.variableName, tags.propertyName, tags.definition(tags.variableName)], color: "rgba(218, 218, 212, 0.46)" },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: "rgba(218, 218, 212, 0.4)" }
]);

export function StoneEditor({ filePath, value, onChange }: StoneEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  const extensions = useMemo(
    () => [
      lineNumbers({ formatNumber: (lineNo) => String(lineNo).padStart(2, "0") }),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightActiveLine(),
      syntaxHighlighting(stoneHighlightStyle, { fallback: true }),
      languageForPath(filePath),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          background: "transparent",
          color: "rgba(218, 218, 212, 0.46)",
          fontFamily: "\"SF Mono\", \"IBM Plex Mono\", \"Roboto Mono\", ui-monospace, monospace",
          fontSize: "clamp(7px, 0.68vw, 10px)"
        },
        ".cm-scroller": {
          height: "100%",
          overflow: "auto",
          padding: "2.9rem 2.4rem 2.4rem 0",
          fontFamily: "inherit",
          lineHeight: "1.95"
        },
        ".cm-content": {
          minHeight: "100%",
          padding: "0",
          caretColor: "rgba(238, 238, 228, 0.78)"
        },
        ".cm-line": {
          padding: "0 0 0 10px",
          lineHeight: "1.95"
        },
        ".cm-gutters": {
          minWidth: "2.85rem",
          paddingTop: "0",
          border: "0",
          background: "transparent",
          color: "rgba(220, 220, 212, 0.31)",
          lineHeight: "1.95"
        },
        ".cm-lineNumbers .cm-gutterElement": {
          minWidth: "2rem",
          padding: "0 8px 0 0",
          lineHeight: "1.95"
        },
        ".cm-activeLine, .cm-activeLineGutter": {
          background: "rgba(255, 255, 255, 0.035)"
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          background: "rgba(214, 214, 198, 0.18)"
        },
        "&.cm-focused": {
          outline: "none"
        },
        ".cm-cursor": {
          borderLeftColor: "rgba(238, 238, 228, 0.78)"
        },
        ".cm-tooltip": {
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          background: "rgba(5, 6, 6, 0.96)",
          color: "rgba(238, 238, 228, 0.76)"
        }
      })
    ],
    [filePath]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions
      })
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;

    const selection = view.state.selection.main;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: EditorSelection.cursor(Math.min(selection.head, value.length))
    });
  }, [value]);

  return <div className="stone-editor" ref={containerRef} />;
}
