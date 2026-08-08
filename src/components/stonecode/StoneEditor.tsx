import { useEffect, useMemo, useRef } from "react";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { EditorDiagnostic } from "@/components/stonecode/types";
import { loadEditorLanguageExtension } from "@/services/editorLanguages";

type StoneEditorProps = {
  filePath: string;
  value: string;
  onChange: (value: string) => void;
  diagnostics?: EditorDiagnostic[];
  readOnly?: boolean;
};

const setEditorDiagnostics = StateEffect.define<EditorDiagnostic[]>();

const editorDiagnosticsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setEditorDiagnostics)) continue;
      const decorations = effect.value.flatMap((diagnostic) => {
        const lineNumber = Math.max(1, Math.min(diagnostic.line, transaction.state.doc.lines));
        const line = transaction.state.doc.line(lineNumber);
        return [Decoration.line({ class: "cm-diagnostic-line" }).range(line.from)];
      });
      value = Decoration.set(decorations, true);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field)
});

const stoneHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "rgba(211, 112, 132, 0.95)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.function(tags.definition(tags.variableName))], color: "rgba(129, 190, 142, 0.96)" },
  { tag: [tags.tagName, tags.typeName, tags.className], color: "rgba(130, 177, 255, 0.95)" },
  { tag: [tags.propertyName, tags.attributeName], color: "rgba(143, 185, 118, 0.95)" },
  { tag: [tags.string, tags.special(tags.string)], color: "rgba(159, 184, 119, 0.96)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit, tags.color], color: "rgba(209, 157, 113, 0.95)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "rgba(220, 220, 212, 0.42)", fontStyle: "italic" },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.name], color: "rgba(229, 229, 220, 0.82)" },
  { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: "rgba(220, 220, 212, 0.62)" }
]);

export function StoneEditor({ filePath, value, onChange, diagnostics = [], readOnly = false }: StoneEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const languageCompartmentRef = useRef(new Compartment());

  onChangeRef.current = onChange;
  valueRef.current = value;

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
      languageCompartmentRef.current.of([]),
      editorDiagnosticsField,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-label": `${readOnly ? "Read-only" : "Editable"} code editor for ${filePath || "current file"}`
      }),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          background: "transparent",
          color: "rgba(229, 229, 220, 0.82)",
          fontFamily: "\"SF Mono\", \"IBM Plex Mono\", \"Roboto Mono\", ui-monospace, monospace",
          fontSize: "clamp(9px, 0.78vw, 12px)"
        },
        ".cm-scroller": {
          height: "100%",
          overflow: "auto",
          padding: "2.9rem 2.4rem 2.4rem 0",
          fontFamily: "inherit",
          lineHeight: "1.65"
        },
        ".cm-content": {
          minHeight: "100%",
          padding: "0",
          caretColor: "rgba(238, 238, 228, 0.78)"
        },
        ".cm-line": {
          padding: "0 0 0 10px",
          lineHeight: "1.65"
        },
        ".cm-gutters": {
          minWidth: "2.85rem",
          paddingTop: "0",
          border: "0",
          background: "transparent",
          color: "rgba(220, 220, 212, 0.31)",
          lineHeight: "1.65"
        },
        ".cm-lineNumbers .cm-gutterElement": {
          minWidth: "2rem",
          padding: "0 8px 0 0",
          lineHeight: "1.65"
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
        ".cm-diagnostic-line": {
          background: "rgba(215, 92, 92, 0.08)"
        },
        ".cm-tooltip": {
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          background: "rgba(5, 6, 6, 0.96)",
          color: "rgba(238, 238, 228, 0.76)"
        }
      })
    ],
    [filePath, readOnly]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: valueRef.current,
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
    let isCancelled = false;

    loadEditorLanguageExtension(filePath).then((language) => {
      if (isCancelled || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: languageCompartmentRef.current.reconfigure(language)
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [filePath]);

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

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setEditorDiagnostics.of(diagnostics) });
  }, [diagnostics]);

  return <div className="stone-editor" ref={containerRef} />;
}
