export const learningExperienceTypes = ["course", "project", "exercise"];

export const planCatalog = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    registrationCredits: 10,
    monthlyCredits: 0,
    activePathLimit: 1,
    tutorRepliesPerMonth: 50,
    aiImagesPerMonth: 5,
    judge0ActionsPerDay: 20
  }),
  pro: Object.freeze({
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 9,
    registrationCredits: 0,
    monthlyCredits: 100,
    activePathLimit: 10,
    tutorRepliesPerMonth: 500,
    aiImagesPerMonth: 50,
    judge0ActionsPerDay: 100
  })
});

export const creationCreditBands = Object.freeze({
  exercise: Object.freeze([
    { credits: 1, minExercises: 5, maxExercises: 5 },
    { credits: 2, minExercises: 6, maxExercises: 10 },
    { credits: 3, minExercises: 11, maxExercises: 15 },
    { credits: 4, minExercises: 16, maxExercises: 20 },
    { credits: 5, minExercises: 21, maxExercises: 25 }
  ]),
  project: Object.freeze([
    { credits: 5, minSteps: 6, maxSteps: 10, maxFiles: 2 },
    { credits: 10, minSteps: 11, maxSteps: 20, maxFiles: 5 },
    { credits: 15, minSteps: 21, maxSteps: 30, maxFiles: 10 }
  ]),
  course: Object.freeze([
    { credits: 5, minModules: 1, maxModules: 2, maxSteps: 20 },
    { credits: 10, minModules: 3, maxModules: 5, maxSteps: 60 },
    { credits: 15, minModules: 6, maxModules: 8, maxSteps: 100 },
    { credits: 20, minModules: 9, maxModules: 10, maxSteps: 140 },
    { credits: 25, minModules: 11, maxModules: 12, maxSteps: 180 }
  ]),
  marketplaceClone: 1
});

export const browserFrameworkCatalog = Object.freeze([
  browserFramework("react", "React", "18.3.1", [
    asset("https://unpkg.com/react@18.3.1/umd/react.production.min.js", "script"),
    asset("https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", "script")
  ]),
  browserFramework("vue", "Vue", "3.5.13", [
    asset("https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.runtime.global.prod.js", "script")
  ], { sourceMode: "browser_sfc" }),
  browserFramework("svelte", "Svelte", "3.59.2", [
    asset("https://unpkg.com/svelte@3.59.2/compiler.js", "script"),
    asset("https://unpkg.com/svelte@3.59.2/internal/index.mjs", "module")
  ], { sourceMode: "browser_sfc" }),
  browserFramework("d3", "D3", "7.9.0", [
    asset("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js", "script")
  ]),
  browserFramework("chart.js", "Chart.js", "4.4.7", [
    asset("https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js", "script")
  ]),
  browserFramework("p5.js", "p5.js", "1.11.2", [
    asset("https://cdn.jsdelivr.net/npm/p5@1.11.2/lib/p5.min.js", "script")
  ])
]);

export const browserFrameworkAllowlist = Object.freeze(browserFrameworkCatalog.map((framework) => framework.id));

export const approvedBrowserAssetUrls = Object.freeze(
  browserFrameworkCatalog.flatMap((framework) => framework.assets.map((item) => item.url))
);

export function isApprovedBrowserAssetUrl(value) {
  return approvedBrowserAssetUrls.includes(String(value ?? "").trim());
}

export const technologyCatalog = Object.freeze([
  technology("javascript", "JavaScript", "browser", "main.js"),
  technology("typescript", "TypeScript", "judge0", "main.ts"),
  technology("python", "Python", "judge0", "main.py"),
  technology("ruby", "Ruby", "judge0", "main.rb"),
  technology("php", "PHP", "judge0", "index.php"),
  technology("java", "Java", "judge0", "Main.java"),
  technology("csharp", "C#", "judge0", "Program.cs"),
  technology("cpp", "C++", "judge0", "main.cpp"),
  technology("c", "C", "judge0", "main.c"),
  technology("go", "Go", "judge0", "main.go"),
  technology("rust", "Rust", "judge0", "main.rs"),
  technology("swift", "Swift", "judge0", "main.swift"),
  technology("kotlin", "Kotlin", "judge0", "Main.kt"),
  technology("dart", "Dart", "judge0", "main.dart"),
  technology("sql", "SQL", "judge0", "query.sql"),
  technology("r", "R", "judge0", "main.R"),
  technology("julia", "Julia", "judge0", "main.jl", { hiddenUntilRuntime: true }),
  technology("fortran", "Fortran", "judge0", "main.f90"),
  technology("cobol", "COBOL", "judge0", "main.cob"),
  technology("basic", "BASIC", "judge0", "main.bas"),
  technology("html", "HTML", "browser", "index.html", { output: true, terminal: false }),
  technology("css", "CSS", "browser", "styles.css", { output: true, terminal: false })
]);

export const launchTechnologyIds = Object.freeze(
  technologyCatalog.filter((technology) => !technology.hiddenUntilRuntime).map((technology) => technology.id)
);

// Kept as an export for older callers. The production roster is now the full
// runtime-capable launch catalog rather than the original five-language beta.
export const productionTechnologyIds = launchTechnologyIds;

export const learningDomainCatalog = Object.freeze([
  learningDomain("programming", "Programming", {
    description: "Programming languages, browser technologies, and practical software projects.",
    ragCorpusKey: null,
    technologyRequiredFor: ["course", "project", "exercise"],
    focusAreas: ["Basic syntax", "Variables and types", "Functions", "Object-oriented programming", "Debugging"]
  }),
  learningDomain("computer_fundamentals", "Computer & IT Fundamentals", {
    description: "Computer hardware, operating systems, files, security, troubleshooting, and everyday IT.",
    technologyRequiredFor: ["project", "exercise"],
    focusAreas: ["Computer hardware", "Operating systems", "Files and storage", "Security basics", "Troubleshooting"]
  }),
  learningDomain("internet_web", "Internet & Web Fundamentals", {
    description: "How networks, the internet, browsers, servers, URLs, HTTP, and web standards work.",
    technologyRequiredFor: ["project", "exercise"],
    focusAreas: ["How the internet works", "Browsers and servers", "URLs and DNS", "HTTP and HTTPS", "Web standards"]
  }),
  learningDomain("algorithms_data_structures", "Algorithms & Data Structures", {
    description: "Problem solving, complexity, common algorithms, and data structures with runnable code.",
    technologyRequiredFor: ["course", "project", "exercise"],
    defaultTechnologyId: "python",
    focusAreas: ["Complexity", "Arrays and linked lists", "Stacks and queues", "Trees and graphs", "Searching and sorting"]
  }),
  learningDomain("math_for_programmers", "Math for Programmers", {
    description: "Algebra, functions, discrete reasoning, probability, and statistics through runnable code.",
    technologyRequiredFor: ["course", "project", "exercise"],
    defaultTechnologyId: "python",
    focusAreas: ["Algebra", "Functions and graphs", "Discrete math", "Probability", "Statistics"]
  })
]);

export function isProductionTechnology(value) {
  return productionTechnologyIds.includes(String(value ?? "").trim().toLowerCase());
}

export function normalizeProductPlan(value) {
  return value === "pro" ? "pro" : "free";
}

export function normalizeProductExperienceType(value) {
  if (value === "guided_project" || value === "project") return "project";
  if (value === "exercise") return "exercise";
  return "course";
}

export function quoteCreationCredits(scope = {}) {
  const type = normalizeProductExperienceType(scope.type);
  if (scope.marketplaceClone === true) {
    return buildQuote("marketplace_clone", creationCreditBands.marketplaceClone, scope);
  }
  if (type === "exercise") {
    const exerciseCount = integer(scope.exerciseCount, 0);
    const band = creationCreditBands.exercise.find((candidate) => exerciseCount >= candidate.minExercises && exerciseCount <= candidate.maxExercises);
    if (!band) throw quoteError("Exercise packs must contain 5 to 25 exercises.");
    return buildQuote(type, band.credits, { ...scope, exerciseCount });
  }
  if (type === "project") {
    const stepCount = integer(scope.stepCount, 0);
    const fileCount = integer(scope.fileCount, 0);
    if (stepCount < 6 || stepCount > 30 || fileCount > 10) {
      throw quoteError("Projects must contain 6 to 30 steps and no more than 10 files.");
    }
    const stepBand = creationCreditBands.project.findIndex((candidate) => stepCount <= candidate.maxSteps);
    const fileBand = creationCreditBands.project.findIndex((candidate) => fileCount <= candidate.maxFiles);
    const band = creationCreditBands.project[Math.max(stepBand, fileBand)];
    return buildQuote(type, band.credits, { ...scope, stepCount, fileCount });
  }
  const moduleCount = integer(scope.moduleCount, 0);
  const stepCount = integer(scope.stepCount, 0);
  if (moduleCount < 1 || moduleCount > 12 || stepCount < 1 || stepCount > 180) {
    throw quoteError("Courses must contain 1 to 12 modules and 1 to 180 steps.");
  }
  const moduleBand = creationCreditBands.course.findIndex((candidate) => moduleCount <= candidate.maxModules);
  const stepBand = creationCreditBands.course.findIndex((candidate) => stepCount <= candidate.maxSteps);
  const band = creationCreditBands.course[Math.max(moduleBand, stepBand)];
  return buildQuote(type, band.credits, { ...scope, moduleCount, stepCount });
}

export function findTechnology(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return technologyCatalog.find((item) => item.id === normalized || item.displayName.toLowerCase() === normalized) ?? null;
}

export function findLearningDomain(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s/&-]+/g, "_");
  if (!normalized) return null;
  return learningDomainCatalog.find((item) =>
    item.id === normalized || item.displayName.toLowerCase().replace(/[\s/&-]+/g, "_") === normalized
  ) ?? null;
}

export function resolveStepSurfaceManifest({ technologyId, requiresOutput = false, requiresTerminal = false, recommended = "code" } = {}) {
  const technology = findTechnology(technologyId);
  const output = Boolean(requiresOutput && technology?.surfaces.output);
  const terminal = Boolean(requiresTerminal && technology?.surfaces.terminal);
  const available = ["code", ...(output ? ["output"] : []), ...(terminal ? ["terminal"] : [])];
  return {
    available,
    recommended: available.includes(recommended) ? recommended : "code"
  };
}

function technology(id, displayName, runtime, defaultFilePath, overrides = {}) {
  return Object.freeze({
    id,
    displayName,
    editorId: id,
    defaultFilePath,
    runtime,
    ragCorpusKey: `language:${id}:v1`,
    ragRequired: true,
    hiddenUntilRuntime: Boolean(overrides.hiddenUntilRuntime),
    surfaces: Object.freeze({
      code: true,
      output: overrides.output ?? runtime === "browser",
      terminal: overrides.terminal ?? runtime === "judge0"
    })
  });
}

function learningDomain(id, displayName, overrides = {}) {
  return Object.freeze({
    id,
    displayName,
    description: overrides.description ?? "",
    ragCorpusKey: overrides.ragCorpusKey === null ? null : overrides.ragCorpusKey ?? `domain:${id.replaceAll("_", "-")}:v1`,
    technologyRequiredFor: Object.freeze(overrides.technologyRequiredFor ?? []),
    defaultTechnologyId: overrides.defaultTechnologyId ?? null,
    focusAreas: Object.freeze(overrides.focusAreas ?? [])
  });
}

function browserFramework(id, displayName, version, assets, overrides = {}) {
  return Object.freeze({
    id,
    displayName,
    version,
    sourceMode: overrides.sourceMode ?? "browser_global",
    assets: Object.freeze(assets)
  });
}

function asset(url, type) {
  return Object.freeze({ url, type });
}

function buildQuote(type, credits, scope) {
  return Object.freeze({
    version: "credit-quote/v1",
    type,
    credits,
    currency: "stonecode_credit",
    scope: Object.freeze({ ...scope })
  });
}

function integer(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function quoteError(message) {
  const error = new Error(message);
  error.code = "invalid_credit_quote_scope";
  return error;
}
