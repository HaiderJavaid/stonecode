import { StreamLanguage } from "@codemirror/language";
import { type Extension } from "@codemirror/state";

export type EditorLanguageId =
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "sql"
  | "java"
  | "cpp"
  | "c"
  | "csharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "swift"
  | "kotlin"
  | "dart"
  | "r"
  | "julia"
  | "fortran"
  | "cobol"
  | "basic"
  | "shell"
  | "yaml"
  | "xml"
  | "vue"
  | "svelte"
  | "plaintext";

export type EditorLanguageInfo = {
  id: EditorLanguageId;
  displayName: string;
  defaultFilePath: string;
  extensions: string[];
  canRunInBrowser: boolean;
  canPreviewVisual: boolean;
  runNote?: string;
};

function judge0RunNote(language: string) {
  return `${language} runs in the configured Judge0 sandbox when its reviewed runtime is available.`;
}

const languageCatalog: EditorLanguageInfo[] = [
  { id: "javascript", displayName: "JavaScript", defaultFilePath: "main.js", extensions: ["js", "jsx", "mjs", "cjs"], canRunInBrowser: true, canPreviewVisual: true },
  { id: "typescript", displayName: "TypeScript", defaultFilePath: "main.ts", extensions: ["ts", "tsx"], canRunInBrowser: false, canPreviewVisual: false, runNote: "TypeScript editing is supported. Browser execution needs transpilation, which is not in the MVP runner yet." },
  { id: "python", displayName: "Python", defaultFilePath: "main.py", extensions: ["py", "pyw"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Python") },
  { id: "html", displayName: "HTML", defaultFilePath: "index.html", extensions: ["html", "htm"], canRunInBrowser: false, canPreviewVisual: true },
  { id: "css", displayName: "CSS", defaultFilePath: "styles.css", extensions: ["css"], canRunInBrowser: false, canPreviewVisual: true },
  { id: "json", displayName: "JSON", defaultFilePath: "data.json", extensions: ["json"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "markdown", displayName: "Markdown", defaultFilePath: "notes.md", extensions: ["md", "mdx"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "sql", displayName: "SQL", defaultFilePath: "query.sql", extensions: ["sql"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "java", displayName: "Java", defaultFilePath: "Main.java", extensions: ["java"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Java") },
  { id: "cpp", displayName: "C++", defaultFilePath: "main.cpp", extensions: ["cpp", "cc", "cxx", "hpp"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("C++") },
  { id: "c", displayName: "C", defaultFilePath: "main.c", extensions: ["c", "h"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("C") },
  { id: "csharp", displayName: "C#", defaultFilePath: "Program.cs", extensions: ["cs"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("C#") },
  { id: "go", displayName: "Go", defaultFilePath: "main.go", extensions: ["go"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Go") },
  { id: "rust", displayName: "Rust", defaultFilePath: "main.rs", extensions: ["rs"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Rust") },
  { id: "php", displayName: "PHP", defaultFilePath: "index.php", extensions: ["php"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("PHP") },
  { id: "ruby", displayName: "Ruby", defaultFilePath: "main.rb", extensions: ["rb"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Ruby") },
  { id: "swift", displayName: "Swift", defaultFilePath: "main.swift", extensions: ["swift"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Swift") },
  { id: "kotlin", displayName: "Kotlin", defaultFilePath: "Main.kt", extensions: ["kt", "kts"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Kotlin") },
  { id: "dart", displayName: "Dart", defaultFilePath: "main.dart", extensions: ["dart"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Dart") },
  { id: "r", displayName: "R", defaultFilePath: "main.R", extensions: ["r"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("R") },
  { id: "julia", displayName: "Julia", defaultFilePath: "main.jl", extensions: ["jl"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Julia") },
  { id: "fortran", displayName: "Fortran", defaultFilePath: "main.f90", extensions: ["f", "f90", "f95"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("Fortran") },
  { id: "cobol", displayName: "COBOL", defaultFilePath: "main.cob", extensions: ["cob", "cbl"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("COBOL") },
  { id: "basic", displayName: "BASIC", defaultFilePath: "main.bas", extensions: ["bas", "vb"], canRunInBrowser: false, canPreviewVisual: false, runNote: judge0RunNote("BASIC") },
  { id: "shell", displayName: "Shell", defaultFilePath: "script.sh", extensions: ["sh", "bash", "zsh"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "yaml", displayName: "YAML", defaultFilePath: "config.yaml", extensions: ["yml", "yaml"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "xml", displayName: "XML", defaultFilePath: "document.xml", extensions: ["xml"], canRunInBrowser: false, canPreviewVisual: false },
  { id: "vue", displayName: "Vue", defaultFilePath: "App.vue", extensions: ["vue"], canRunInBrowser: false, canPreviewVisual: true },
  { id: "svelte", displayName: "Svelte", defaultFilePath: "App.svelte", extensions: ["svelte"], canRunInBrowser: false, canPreviewVisual: true },
  { id: "plaintext", displayName: "Plain text", defaultFilePath: "notes.txt", extensions: ["txt", "log"], canRunInBrowser: false, canPreviewVisual: false }
];

const byId = new Map(languageCatalog.map((language) => [language.id, language]));
const byExtension = new Map<string, EditorLanguageInfo>();

for (const language of languageCatalog) {
  for (const extension of language.extensions) byExtension.set(extension, language);
}

export function resolveEditorLanguage(pathOrLanguage: string | null | undefined): EditorLanguageInfo {
  const raw = (pathOrLanguage ?? "").trim();
  const normalized = raw.toLowerCase();
  const extension = normalized.includes(".") ? normalized.split(".").pop() ?? "" : "";
  const byKnownExtension = extension ? byExtension.get(extension) : null;
  if (byKnownExtension) return byKnownExtension;

  if (/c\+\+|\bcpp\b|cplusplus/.test(normalized)) return byId.get("cpp")!;
  if (/c#|csharp|dotnet/.test(normalized)) return byId.get("csharp")!;
  if (/\bjavascript\b|\bjs\b|node/.test(normalized)) return byId.get("javascript")!;
  if (/\btypescript\b|\bts\b/.test(normalized)) return byId.get("typescript")!;
  if (/\bpython\b|\bpy\b/.test(normalized)) return byId.get("python")!;
  if (/\bhtml\b|website|web page/.test(normalized)) return byId.get("html")!;
  if (/\bcss\b/.test(normalized)) return byId.get("css")!;
  if (/\bjava\b/.test(normalized)) return byId.get("java")!;
  if (/\bgo\b|golang/.test(normalized)) return byId.get("go")!;
  if (/\brust\b/.test(normalized)) return byId.get("rust")!;
  if (/\bphp\b/.test(normalized)) return byId.get("php")!;
  if (/\bruby\b|\brb\b/.test(normalized)) return byId.get("ruby")!;
  if (/\bswift\b/.test(normalized)) return byId.get("swift")!;
  if (/\bkotlin\b/.test(normalized)) return byId.get("kotlin")!;
  if (/\bdart\b|flutter/.test(normalized)) return byId.get("dart")!;
  if (/\br programming\b|\br language\b/.test(normalized) || normalized === "r") return byId.get("r")!;
  if (/\bjulia\b/.test(normalized)) return byId.get("julia")!;
  if (/\bfortran\b/.test(normalized)) return byId.get("fortran")!;
  if (/\bcobol\b/.test(normalized)) return byId.get("cobol")!;
  if (/\bbasic\b|qbasic|visual basic/.test(normalized)) return byId.get("basic")!;
  if (/\bsql\b/.test(normalized)) return byId.get("sql")!;
  if (/\byaml\b|\byml\b/.test(normalized)) return byId.get("yaml")!;
  if (/\bxml\b/.test(normalized)) return byId.get("xml")!;
  if (/\bvue\b/.test(normalized)) return byId.get("vue")!;
  if (/\bsvelte\b/.test(normalized)) return byId.get("svelte")!;
  if (/\bshell\b|bash|zsh/.test(normalized)) return byId.get("shell")!;

  return byId.get("plaintext")!;
}

export function defaultFilePath(pathOrLanguage: string | null | undefined) {
  return resolveEditorLanguage(pathOrLanguage).defaultFilePath;
}

export function defaultStarterCode(pathOrLanguage: string | null | undefined) {
  const language = resolveEditorLanguage(pathOrLanguage);
  const starters: Partial<Record<EditorLanguageId, string>> = {
    javascript: "const message = 'Value: stone';\nconsole.log(message);\n",
    typescript: "const message: string = 'Value: stone';\nconsole.log(message);\n",
    python: "message = \"Value: stone\"\nprint(message)\n",
    ruby: "message = \"Value: stone\"\nputs message\n",
    php: "<?php\n$message = \"Value: stone\";\necho $message . PHP_EOL;\n",
    java: "public class Main {\n  public static void main(String[] args) {\n    String message = \"Value: stone\";\n    System.out.println(message);\n  }\n}\n",
    csharp: "using System;\n\nclass Program {\n  static void Main() {\n    string message = \"Value: stone\";\n    Console.WriteLine(message);\n  }\n}\n",
    cpp: "#include <iostream>\n#include <string>\n\nint main() {\n  std::string message = \"Value: stone\";\n  std::cout << message << std::endl;\n  return 0;\n}\n",
    c: "#include <stdio.h>\n\nint main(void) {\n  printf(\"Value: stone\\n\");\n  return 0;\n}\n",
    go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n  message := \"Value: stone\"\n  fmt.Println(message)\n}\n",
    rust: "fn main() {\n    let message = \"Value: stone\";\n    println!(\"{}\", message);\n}\n",
    swift: "let message = \"Value: stone\"\nprint(message)\n",
    kotlin: "fun main() {\n    val message = \"Value: stone\"\n    println(message)\n}\n",
    dart: "void main() {\n  final message = 'Value: stone';\n  print(message);\n}\n",
    sql: "SELECT 'Value: stone' AS message;\n",
    r: "message <- \"Value: stone\"\nprint(message)\n",
    julia: "message = \"Value: stone\"\nprintln(message)\n",
    fortran: "program main\n  implicit none\n  print *, \"Value: stone\"\nend program main\n",
    cobol: "IDENTIFICATION DIVISION.\nPROGRAM-ID. MAIN.\nPROCEDURE DIVISION.\n    DISPLAY \"Value: stone\".\n    STOP RUN.\n",
    basic: "Dim message As String = \"Value: stone\"\nPrint message\n",
    html: "<!doctype html>\n<html>\n  <body>\n    <h1>Value: stone</h1>\n  </body>\n</html>\n",
    css: ".message {\n  color: #8ee8ad;\n}\n"
  };
  return starters[language.id] ?? "";
}

export async function loadEditorLanguageExtension(filePath: string): Promise<Extension> {
  const language = resolveEditorLanguage(filePath);

  if (language.id === "javascript" || language.id === "typescript") {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript({ jsx: /\.(jsx|tsx|vue|svelte)$/i.test(filePath), typescript: /\.(ts|tsx)$/i.test(filePath) });
  }
  if (language.id === "python") return (await import("@codemirror/lang-python")).python();
  if (language.id === "html") return (await import("@codemirror/lang-html")).html();
  if (language.id === "css") return (await import("@codemirror/lang-css")).css();
  if (language.id === "json") return (await import("@codemirror/lang-json")).json();
  if (language.id === "markdown") return (await import("@codemirror/lang-markdown")).markdown();
  if (language.id === "sql") return (await import("@codemirror/lang-sql")).sql();
  if (language.id === "java") return (await import("@codemirror/lang-java")).java();
  if (language.id === "cpp" || language.id === "c") return (await import("@codemirror/lang-cpp")).cpp();
  if (language.id === "php") return (await import("@codemirror/lang-php")).php();
  if (language.id === "go") return (await import("@codemirror/lang-go")).go();
  if (language.id === "rust") return (await import("@codemirror/lang-rust")).rust();
  if (language.id === "csharp") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/clike")).csharp);
  if (language.id === "ruby") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/ruby")).ruby);
  if (language.id === "swift") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/swift")).swift);
  if (language.id === "kotlin") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/clike")).kotlin);
  if (language.id === "dart") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/clike")).dart);
  if (language.id === "r") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/r")).r);
  if (language.id === "julia") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/julia")).julia);
  if (language.id === "fortran") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/fortran")).fortran);
  if (language.id === "cobol") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/cobol")).cobol);
  if (language.id === "basic") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/vb")).vb);
  if (language.id === "shell") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/shell")).shell);
  if (language.id === "yaml") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/yaml")).yaml);
  if (language.id === "xml") return StreamLanguage.define((await import("@codemirror/legacy-modes/mode/xml")).xml);
  if (language.id === "vue" || language.id === "svelte") return (await import("@codemirror/lang-html")).html();

  return [];
}
