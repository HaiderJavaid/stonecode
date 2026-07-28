const capability = ({
  id,
  label,
  aliases,
  filePath,
  extensions,
  outputVerb,
  starterCode,
  family,
  execution = "sandbox"
}) => ({ id, label, aliases, filePath, extensions, outputVerb, starterCode, family, execution });

export const courseLanguageCapabilities = [
  capability({ id: "javascript", label: "JavaScript", aliases: [/javascript/i, /\bjs\b/i, /node/i], filePath: "main.js", extensions: ["js", "jsx", "mjs", "cjs"], outputVerb: "console.log", starterCode: "const message = 'Value: stone';\nconsole.log(message);\n", family: "web", execution: "browser" }),
  capability({ id: "typescript", label: "TypeScript", aliases: [/typescript/i, /\bts\b/i], filePath: "main.ts", extensions: ["ts", "tsx"], outputVerb: "console.log", starterCode: "const message: string = 'Value: stone';\nconsole.log(message);\n", family: "web" }),
  capability({ id: "python", label: "Python", aliases: [/python/i, /\bpy\b/i], filePath: "main.py", extensions: ["py", "pyw"], outputVerb: "print", starterCode: "message = \"Value: stone\"\nprint(message)\n", family: "application" }),
  capability({ id: "ruby", label: "Ruby", aliases: [/ruby/i, /\brb\b/i], filePath: "main.rb", extensions: ["rb"], outputVerb: "puts", starterCode: "message = \"Value: stone\"\nputs message\n", family: "application" }),
  capability({ id: "php", label: "PHP", aliases: [/php/i], filePath: "index.php", extensions: ["php"], outputVerb: "echo", starterCode: "<?php\n$message = \"Value: stone\";\necho $message . PHP_EOL;\n", family: "web" }),
  capability({ id: "java", label: "Java", aliases: [/\bjava\b/i], filePath: "Main.java", extensions: ["java"], outputVerb: "System.out.println", starterCode: "public class Main {\n  public static void main(String[] args) {\n    String message = \"Value: stone\";\n    System.out.println(message);\n  }\n}\n", family: "enterprise" }),
  capability({ id: "csharp", label: "C#", aliases: [/c#/i, /csharp/i, /dotnet/i], filePath: "Program.cs", extensions: ["cs"], outputVerb: "Console.WriteLine", starterCode: "using System;\n\nclass Program {\n  static void Main() {\n    string message = \"Value: stone\";\n    Console.WriteLine(message);\n  }\n}\n", family: "enterprise" }),
  capability({ id: "cpp", label: "C++", aliases: [/c\+\+/i, /cpp/i, /cplusplus/i], filePath: "main.cpp", extensions: ["cpp", "cc", "cxx", "hpp"], outputVerb: "std::cout", starterCode: "#include <iostream>\n#include <string>\n\nint main() {\n  std::string message = \"Value: stone\";\n  std::cout << message << std::endl;\n  return 0;\n}\n", family: "systems" }),
  capability({ id: "c", label: "C", aliases: [/\bc\b(?!#|\+\+)/i], filePath: "main.c", extensions: ["c", "h"], outputVerb: "printf", starterCode: "#include <stdio.h>\n\nint main(void) {\n  printf(\"Value: stone\\n\");\n  return 0;\n}\n", family: "systems" }),
  capability({ id: "go", label: "Go", aliases: [/\bgo\b/i, /golang/i], filePath: "main.go", extensions: ["go"], outputVerb: "fmt.Println", starterCode: "package main\n\nimport \"fmt\"\n\nfunc main() {\n  message := \"Value: stone\"\n  fmt.Println(message)\n}\n", family: "systems" }),
  capability({ id: "rust", label: "Rust", aliases: [/rust/i], filePath: "main.rs", extensions: ["rs"], outputVerb: "println!", starterCode: "fn main() {\n    let message = \"Value: stone\";\n    println!(\"{}\", message);\n}\n", family: "systems" }),
  capability({ id: "swift", label: "Swift", aliases: [/swift/i], filePath: "main.swift", extensions: ["swift"], outputVerb: "print", starterCode: "let message = \"Value: stone\"\nprint(message)\n", family: "mobile" }),
  capability({ id: "kotlin", label: "Kotlin", aliases: [/kotlin/i], filePath: "Main.kt", extensions: ["kt", "kts"], outputVerb: "println", starterCode: "fun main() {\n    val message = \"Value: stone\"\n    println(message)\n}\n", family: "mobile" }),
  capability({ id: "dart", label: "Dart", aliases: [/dart/i, /flutter/i], filePath: "main.dart", extensions: ["dart"], outputVerb: "print", starterCode: "void main() {\n  final message = 'Value: stone';\n  print(message);\n}\n", family: "mobile" }),
  capability({ id: "sql", label: "SQL", aliases: [/sql/i, /database/i], filePath: "query.sql", extensions: ["sql"], outputVerb: "SELECT", starterCode: "SELECT 'Value: stone' AS message;\n", family: "data" }),
  capability({ id: "r", label: "R", aliases: [/\br programming\b/i, /\br language\b/i, /^r$/i], filePath: "main.R", extensions: ["r"], outputVerb: "print", starterCode: "message <- \"Value: stone\"\nprint(message)\n", family: "data" }),
  capability({ id: "julia", label: "Julia", aliases: [/julia/i], filePath: "main.jl", extensions: ["jl"], outputVerb: "println", starterCode: "message = \"Value: stone\"\nprintln(message)\n", family: "data" }),
  capability({ id: "fortran", label: "Fortran", aliases: [/fortran/i], filePath: "main.f90", extensions: ["f", "f90", "f95"], outputVerb: "print", starterCode: "program main\n  implicit none\n  print *, \"Value: stone\"\nend program main\n", family: "legacy" }),
  capability({ id: "cobol", label: "COBOL", aliases: [/cobol/i], filePath: "main.cob", extensions: ["cob", "cbl"], outputVerb: "DISPLAY", starterCode: "IDENTIFICATION DIVISION.\nPROGRAM-ID. MAIN.\nPROCEDURE DIVISION.\n    DISPLAY \"Value: stone\".\n    STOP RUN.\n", family: "legacy" }),
  capability({ id: "basic", label: "BASIC", aliases: [/\bbasic\b/i, /qbasic/i, /visual basic/i], filePath: "main.bas", extensions: ["bas", "vb"], outputVerb: "PRINT", starterCode: "LET message$ = \"Value: stone\"\nPRINT message$\n", family: "legacy" }),
  capability({ id: "html", label: "HTML", aliases: [/html/i, /website/i, /web page/i], filePath: "index.html", extensions: ["html", "htm"], outputVerb: "rendered page", starterCode: "<!doctype html>\n<html>\n  <body>\n    <h1>Value: stone</h1>\n  </body>\n</html>\n", family: "web", execution: "preview" }),
  capability({ id: "css", label: "CSS", aliases: [/css/i], filePath: "styles.css", extensions: ["css"], outputVerb: "visible style", starterCode: ".message {\n  color: #8ee8ad;\n}\n", family: "web", execution: "preview" })
];

const frameworkPattern = /\b(react(?:\.js)?|next(?:\.js)?|vue|angular|svelte|node(?:\.js)?|express|django|flask|fastapi|laravel|spring|rails|flutter|pygame|unity|unreal|godot|pandas|numpy|tensorflow|pytorch)\b/i;
const appliedPattern = /\b(frontend|backend|fullstack|full-stack|web development|web dev|mobile|ios|android|game development|games|data science|machine learning|automation|api|server-side|server side|enterprise application)\b/i;
const advancedPattern = /\b(advanced|concurrency|parallel|performance|distributed|compiler|metaprogramming|architecture|internals)\b/i;
const fromZeroPattern = /\b(beginner|from zero|zero|fundamental|fundamentals|basics|basic|intro|introduction)\b/i;

export function findCourseLanguageCapability(value) {
  const text = String(value ?? "").trim() || "JavaScript";
  const extension = text.toLowerCase().includes(".") ? text.toLowerCase().split(".").pop() : "";
  const extensionMatch = courseLanguageCapabilities.find((language) => language.extensions.includes(extension));
  if (extensionMatch) return extensionMatch;
  if (/c#|csharp|dotnet/i.test(text)) return courseLanguageCapabilities.find((language) => language.id === "csharp");
  if (/c\+\+|cpp|cplusplus/i.test(text)) return courseLanguageCapabilities.find((language) => language.id === "cpp");
  return courseLanguageCapabilities.find((language) => language.aliases.some((alias) => alias.test(text))) ?? null;
}

export function resolveCourseLanguageCapability(value) {
  return findCourseLanguageCapability(value) ?? courseLanguageCapabilities[0];
}

export function classifyCourseIntent(subject) {
  const text = String(subject ?? "").trim();
  const language = courseLanguageCapabilities.find((item) => item.aliases.some((alias) => alias.test(text))) ?? null;
  if (frameworkPattern.test(text)) return { kind: "framework", language, requiresAssessment: true };
  if (advancedPattern.test(text)) return { kind: "advanced-language", language, requiresAssessment: true };
  if (appliedPattern.test(text)) return { kind: "applied-path", language, requiresAssessment: true };
  if (language) return { kind: "language-fundamentals", language, requiresAssessment: false };
  return { kind: fromZeroPattern.test(text) ? "language-fundamentals" : "software-topic", language, requiresAssessment: false };
}

export function isSupportedProgrammingSubject(subject) {
  const text = String(subject ?? "").toLowerCase();
  if (/\b(cooking|recipe|fitness|workout|history|geography|biology|chemistry|english|marketing|sales|finance|trading|music|guitar|piano|photography)\b/.test(text)) return false;
  if (courseLanguageCapabilities.some((item) => item.aliases.some((alias) => alias.test(text)))) return true;
  return /\b(program|programming|code|coding|software|developer|script|web|frontend|backend|fullstack|app|game|framework|library|database|api|automation|machine learning|data science|mobile|server)\b/.test(text) || frameworkPattern.test(text);
}

export function inferGeneratedSubject(objective) {
  const text = String(objective ?? "").trim();
  const framework = text.match(frameworkPattern)?.[0];
  if (framework) return framework.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const language = resolveCourseLanguageCapability(text);
  return language && language.aliases.some((alias) => alias.test(text)) ? language.label : "Programming";
}

export function inferGeneratedLanguages(objective) {
  const text = String(objective ?? "");
  if (/react|next|vue|angular|svelte|web development|frontend/i.test(text)) return ["JavaScript", "HTML", "CSS"];
  if (/flutter/i.test(text)) return ["Dart"];
  if (/pygame/i.test(text)) return ["Python"];
  if (/unity/i.test(text)) return ["C#"];
  if (/unreal/i.test(text)) return ["C++"];
  return [resolveCourseLanguageCapability(text).label];
}
