import { technologyCatalog } from "../../shared/stonecode-product.mjs";

const corpusSpecs = [
  spec("javascript", "MDN JavaScript Guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", ["variables, values, arrays, objects, and functions", "if statements, loops, errors, and async control flow", "small browser programs using standard JavaScript APIs"]),
  spec("typescript", "TypeScript Handbook", "https://www.typescriptlang.org/docs/handbook/intro.html", ["type annotations, inference, unions, interfaces, and functions", "narrowing, generics, modules, and compiler errors", "typed command-line programs without third-party packages"]),
  spec("python", "Python Tutorial", "https://docs.python.org/3/tutorial/", ["values, collections, functions, modules, and classes", "conditionals, loops, exceptions, and comprehensions", "small console programs using the Python standard library"]),
  spec("ruby", "Ruby Documentation", "https://docs.ruby-lang.org/en/master/", ["objects, arrays, hashes, methods, blocks, and classes", "conditionals, iteration, exceptions, and enumerable operations", "small console programs using Ruby's standard library"]),
  spec("php", "PHP Language Reference", "https://www.php.net/manual/en/langref.php", ["variables, arrays, functions, strings, and classes", "conditionals, loops, exceptions, and input validation", "plain PHP command-line programs without server frameworks"]),
  spec("java", "Dev.java Learn", "https://dev.java/learn/", ["types, variables, methods, arrays, records, and classes", "conditionals, loops, exceptions, collections, and streams", "single-project console programs using the Java standard library"]),
  spec("csharp", "Microsoft C# Guide", "https://learn.microsoft.com/en-us/dotnet/csharp/", ["types, variables, methods, arrays, records, and classes", "conditionals, loops, exceptions, LINQ, and collections", "console programs using the .NET base class library"]),
  spec("cpp", "C++ Language Reference", "https://en.cppreference.com/cpp", ["types, values, functions, strings, vectors, and classes", "conditionals, loops, exceptions, iterators, and ownership", "portable console programs using the C++ standard library"]),
  spec("c", "C Language Reference", "https://en.cppreference.com/c", ["types, arrays, pointers, functions, structs, and strings", "conditionals, loops, error codes, allocation, and lifetime", "portable console programs using the C standard library"]),
  spec("go", "Effective Go", "https://go.dev/doc/effective_go", ["values, slices, maps, functions, structs, and interfaces", "conditionals, loops, errors, goroutines, and channels", "small command-line programs using the Go standard library"]),
  spec("rust", "The Rust Programming Language", "https://doc.rust-lang.org/book/", ["bindings, types, functions, structs, enums, and pattern matching", "ownership, borrowing, lifetimes, Result, loops, and iterators", "small command-line programs using Rust's standard library"]),
  spec("swift", "The Swift Programming Language — The Basics", "https://raw.githubusercontent.com/swiftlang/swift-book/main/TSPL.docc/LanguageGuide/TheBasics.md", ["values, optionals, collections, functions, structs, and classes", "conditionals, loops, errors, protocols, and closures", "portable console examples using the Swift standard library"]),
  spec("kotlin", "Kotlin Basic Syntax", "https://kotlinlang.org/docs/basic-syntax.html", ["values, nullable types, functions, collections, data classes, and classes", "conditionals, loops, exceptions, lambdas, and sequences", "JVM console programs using the Kotlin standard library"]),
  spec("dart", "Dart Language Tour", "https://dart.dev/language", ["variables, null safety, functions, collections, records, and classes", "conditionals, loops, exceptions, futures, and streams", "command-line programs using Dart core libraries"]),
  spec("sql", "PostgreSQL SQL Language", "https://www.postgresql.org/docs/current/sql.html", ["tables, rows, data types, SELECT, INSERT, UPDATE, and DELETE", "filters, joins, grouping, subqueries, transactions, and constraints", "portable relational queries with dialect-specific behavior clearly labeled"]),
  spec("r", "An Introduction to R", "https://cran.r-project.org/doc/manuals/r-release/R-intro.html", ["vectors, factors, lists, data frames, functions, and formulas", "conditionals, loops, apply operations, missing values, and errors", "small data-analysis programs using base R"], {
    evaluationQueries: [
      "Teach a beginner R vectors, factors, lists, data frames, functions, and statistical formulas.",
      "Teach a beginner R if conditionals, for loops, apply functions, missing NA values, and error handling.",
      "Teach a beginner to analyze a numeric vector and data frame with mean, summary, and print using base R."
    ]
  }),
  spec("julia", "Julia Manual", "https://docs.julialang.org/en/v1/manual/control-flow/", ["values, arrays, tuples, functions, types, and multiple dispatch", "conditionals, loops, exceptions, broadcasting, and iteration", "small numerical console programs using Julia's standard library"], {
    seedUrls: [
      "https://docs.julialang.org/en/v1/manual/variables/",
      "https://docs.julialang.org/en/v1/manual/functions/",
      "https://docs.julialang.org/en/v1/manual/arrays/",
      "https://docs.julialang.org/en/v1/manual/types/",
      "https://docs.julialang.org/en/v1/manual/mathematical-operations/"
    ],
    evaluationQueries: [
      "Teach a beginner Julia variables, arrays, tuples, functions, composite types, and multiple dispatch.",
      "Teach a beginner Julia if and elseif conditionals, for and while loops, try and catch exceptions, broadcasting, and iteration.",
      "Teach a beginner to write a Julia console program using arrays, arithmetic, functions, and println."
    ]
  }),
  spec("fortran", "Fortran Language Guide", "https://fortran-lang.org/learn/", ["intrinsic types, arrays, procedures, modules, and derived types", "conditionals, loops, I/O, allocation, and numerical operations", "standard-conforming console programs without external libraries"]),
  spec("cobol", "GnuCOBOL Programmer's Guide", "https://gnucobol.sourceforge.io/HTML/gnucobpg.html", ["divisions, data items, pictures, paragraphs, and arithmetic verbs", "conditions, PERFORM loops, file status, and sequential I/O", "standard console and record-processing programs"], {
    evaluationQueries: [
      "Teach a beginner the four COBOL divisions, WORKING-STORAGE data items, PIC clauses, paragraphs, and arithmetic statements.",
      "Teach a beginner COBOL conditions, PERFORM loops, FILE STATUS, and sequential file input and output.",
      "Teach a beginner to build a standard COBOL console record-processing program with DISPLAY and ACCEPT."
    ]
  }),
  spec("basic", "FreeBASIC Manual", "https://www.freebasic.net/wiki/DocToc", ["variables, arrays, subroutines, functions, strings, and user-defined types", "IF blocks, SELECT CASE, loops, errors, and console I/O", "plain console programs without native GUI extensions"], {
    seedUrls: [
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgDim",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgType",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgFunction",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgSub",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgIfthen",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgSelectcase",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgFor",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgDo",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgInput",
      "https://www.freebasic.net/wiki/wikka.php?wakka=KeyPgPrint"
    ],
    evaluationQueries: [
      "Teach a beginner FreeBASIC variable types, DIM arrays, SUB procedures, FUNCTION procedures, strings, and TYPE records.",
      "Teach a beginner FreeBASIC IF THEN blocks, SELECT CASE, FOR and DO loops, error handling, INPUT, and PRINT.",
      "Teach a beginner to write a plain FreeBASIC console program using INPUT, variables, calculations, and PRINT without graphics or GUI extensions."
    ]
  }),
  spec("html", "MDN HTML", "https://developer.mozilla.org/en-US/docs/Web/HTML", ["documents, elements, attributes, headings, links, lists, and forms", "semantic structure, validation, accessibility, and responsive metadata", "standalone standards-based pages without server dependencies"]),
  spec("css", "MDN CSS", "https://developer.mozilla.org/en-US/docs/Web/CSS", ["selectors, cascade, inheritance, values, units, and the box model", "layout with flexbox and grid, states, media queries, and animations", "responsive stylesheets paired with semantic HTML"])
];

export const technologyCorpora = Object.freeze(corpusSpecs.map(buildCorpus));

export function findTechnologyCorpus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return technologyCorpora.find((corpus) => corpus.technologyId === normalized || corpus.displayName.toLowerCase() === normalized) ?? null;
}

export function resolveRagTechnologyId(value) {
  const normalized = ` ${String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9+#.]+/g, " ")} `;
  const aliases = [
    ["typescript", ["typescript", "type script", " ts "]], ["javascript", ["javascript", " js ", "react", "vue", "svelte", "d3", "chart.js", "p5.js"]],
    ["csharp", ["c#", "c sharp", "dotnet", ".net"]], ["cpp", ["c++", "cpp"]], ["python", ["python", " py "]],
    ["kotlin", ["kotlin"]], ["fortran", ["fortran"]], ["cobol", ["cobol"]], ["swift", ["swift"]], ["julia", ["julia"]],
    ["ruby", ["ruby"]], ["php", ["php"]], ["java", ["java"]], ["rust", ["rust"]], ["dart", ["dart"]],
    ["sql", ["sql"]], ["basic", ["basic"]], ["html", ["html"]], ["css", ["css"]], ["go", [" go ", "golang"]],
    ["r", [" r language", " r programming"]], ["c", [" c language", " c programming"]]
  ];
  return aliases.find(([, names]) => names.some((name) => normalized.includes(name)))?.[0] ?? null;
}

export function validateTechnologyCorpora(corpora = technologyCorpora) {
  const catalogIds = new Set(technologyCatalog.map((technology) => technology.id));
  const corpusIds = new Set(corpora.map((corpus) => corpus.technologyId));
  const errors = [];
  for (const id of catalogIds) if (!corpusIds.has(id)) errors.push(`Missing corpus for ${id}.`);
  for (const corpus of corpora) {
    if (!catalogIds.has(corpus.technologyId)) errors.push(`Unknown technology ${corpus.technologyId}.`);
    if (corpus.version < 1 || !corpus.corpusKey.endsWith(`:v${corpus.version}`)) errors.push(`Invalid corpus version for ${corpus.technologyId}.`);
    if (!corpus.sources.length || corpus.sources.some((source) => !source.url || !source.sourceVersion || !source.license)) errors.push(`Incomplete provenance for ${corpus.technologyId}.`);
    if (corpus.chunks.length < 3 || corpus.chunks.some((chunk) => chunk.technologyId !== corpus.technologyId || !chunk.sourceKey)) errors.push(`Invalid chunks for ${corpus.technologyId}.`);
    if (corpus.evaluationFixtures.length < 3) errors.push(`Insufficient evaluation fixtures for ${corpus.technologyId}.`);
  }
  return { valid: errors.length === 0, errors };
}

function spec(technologyId, sourceTitle, sourceUrl, teachingAreas, options = {}) {
  return { technologyId, sourceTitle, sourceUrl, teachingAreas, ...options };
}

function buildCorpus({ technologyId, sourceTitle, sourceUrl, teachingAreas, seedUrls = [], evaluationQueries = [] }) {
  const technology = technologyCatalog.find((candidate) => candidate.id === technologyId);
  if (!technology) throw new Error(`Unknown technology corpus: ${technologyId}`);
  const sourceKey = `${technologyId}:official-foundations:v1`;
  const chunks = teachingAreas.map((area, index) => ({
    key: `${technologyId}:foundation:${index + 1}:v1`,
    technologyId,
    sourceKey,
    sourceVersion: "v1",
    title: `${technology.displayName} foundation ${index + 1}`,
    content: `${technology.displayName} lessons in this corpus cover ${area}. Teach with plain raw code, introduce syntax before it is used, and keep examples within the approved ${technology.runtime === "browser" ? "browser" : "Judge0 console"} runtime.`,
    metadata: { level: "beginner", sequence: index + 1, reviewed: false }
  }));
  const otherTechnologies = technologyCatalog.filter((candidate) => candidate.id !== technologyId).map((candidate) => candidate.id);
  return Object.freeze({
    corpusKey: technology.ragCorpusKey,
    technologyId,
    displayName: technology.displayName,
    version: 1,
    status: "draft",
    ingestionStatus: "prepared",
    sources: Object.freeze([{
      key: sourceKey,
      title: sourceTitle,
      url: sourceUrl,
      sourceVersion: "accessed-version:v1",
      license: "official-documentation-terms",
      provenanceStatus: "pending_review",
      seedUrls: Object.freeze([...seedUrls])
    }]),
    chunks: Object.freeze(chunks),
    evaluationFixtures: Object.freeze(chunks.map((chunk, index) => ({
      key: `${technologyId}:retrieval:${index + 1}:v1`,
      query: evaluationQueries[index] ?? `Teach a beginner ${teachingAreas[index]} in ${technology.displayName}.`,
      expectedChunkKeys: [chunk.key],
      forbiddenTechnologyIds: otherTechnologies
    })))
  });
}
