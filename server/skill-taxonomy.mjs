const skillCatalog = [
  skill("React", "JavaScript", ["frontend"], ["react", "react.js", "reactjs"]),
  skill("Vue", "JavaScript", ["frontend"], ["vue", "vue.js", "vuejs"]),
  skill("Svelte", "JavaScript", ["frontend"], ["svelte", "sveltekit"]),
  skill("Angular", "TypeScript", ["frontend"], ["angular"]),
  skill("Node.js", "JavaScript", ["backend"], ["node", "node.js", "nodejs"]),
  skill("Express", "JavaScript", ["backend"], ["express", "express.js", "expressjs"]),
  skill("Django", "Python", ["backend"], ["django"]),
  skill("Flask", "Python", ["backend"], ["flask"]),
  skill("FastAPI", "Python", ["backend"], ["fastapi"]),
  skill("Spring", "Java", ["backend"], ["spring", "spring boot"]),
  skill("ASP.NET", "C#", ["backend"], ["asp.net", "aspnet"]),
  skill("Laravel", "PHP", ["backend"], ["laravel"]),
  skill("Ruby on Rails", "Ruby", ["backend"], ["rails", "ruby on rails"]),
  skill("Pygame", "Python", ["game"], ["pygame"]),
  skill("Unity", "C#", ["game"], ["unity"]),
  skill("Unreal Engine", "C++", ["game"], ["unreal", "unreal engine"]),
  skill("Godot", "GDScript", ["game"], ["godot", "gdscript"]),
  skill("Phaser", "JavaScript", ["game"], ["phaser", "phaser.js"]),
  skill("Flutter", "Dart", ["mobile"], ["flutter"]),
  skill("React Native", "JavaScript", ["mobile"], ["react native"]),
  skill("SwiftUI", "Swift", ["mobile"], ["swiftui"]),
  skill("Jetpack Compose", "Kotlin", ["mobile"], ["jetpack compose", "compose"]),
  skill("HTML", null, ["frontend"], ["html"]),
  skill("CSS", null, ["frontend"], ["css"]),
  ...[
    "JavaScript", "TypeScript", "Python", "Ruby", "PHP", "Java", "C#", "C++", "C", "Swift",
    "Kotlin", "Dart", "Go", "Rust", "SQL", "R", "Julia", "Fortran", "COBOL", "BASIC", "Lua", "GDScript"
  ].map((label) => skill(label, label, [], languageAliases(label)))
];

const domainPatterns = [
  ["frontend", /\b(full[ -]?stack|front[ -]?end|frontend|web page|website|browser|ui|user interface|dom|responsive|html|css)\b/i],
  ["backend", /\b(full[ -]?stack|back[ -]?end|backend|server|api|database service|rest|graphql|authentication)\b/i],
  ["game", /\b(game|gaming|platformer|pygame|unity|unreal|godot|phaser)\b/i],
  ["mobile", /\b(mobile|ios|android|iphone|ipad|flutter|react native|swiftui|jetpack compose)\b/i]
];

export const achievementCatalog = [
  achievement("frontend-developer", "Frontend Developer", "frontend", 300, 150, ["JavaScript", "TypeScript"]),
  achievement("backend-engineer", "Backend Engineer", "backend", 400, 250, ["JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "Ruby", "Go", "Rust"]),
  achievement("game-developer", "Game Developer", "game", 400, 250, ["Python", "C#", "C++", "JavaScript", "TypeScript", "Java", "Lua", "GDScript"]),
  achievement("mobile-developer", "Mobile Developer", "mobile", 400, 250, ["Swift", "Kotlin", "Dart", "JavaScript", "TypeScript"]),
  {
    id: "full-stack-developer",
    title: "Full-stack Developer",
    description: "Complete frontend and backend learning programs and earn 1,000 verified XP across both domains.",
    domains: ["frontend", "backend"],
    requiredXp: 1000,
    prerequisiteBadges: ["frontend-developer", "backend-engineer"]
  }
];

export function resolveSkillMetadata(input = {}) {
  const combined = [input.framework, input.subject, input.language, input.platform, input.motivation, input.goal]
    .filter(Boolean)
    .join(" ");
  const frameworkMatch = findSkill(input.framework);
  const subjectMatch = findSkill(input.subject);
  const languageMatch = findSkill(input.language);
  const selected = frameworkMatch ?? subjectMatch ?? languageMatch ?? findSkill(combined);
  const primarySkill = selected?.label ?? cleanLabel(input.framework || input.language || input.subject || "Programming");
  const parentLanguage = selected?.parentLanguage ?? languageMatch?.label ?? cleanOptional(input.language) ?? (isLanguage(primarySkill) ? primarySkill : null);
  const domains = new Set(selected?.domains ?? []);
  for (const [domain, pattern] of domainPatterns) {
    if (pattern.test(combined)) domains.add(domain);
  }
  return {
    primarySkill,
    parentLanguage,
    domainIds: [...domains]
  };
}

export function normalizeSkillTopics(values) {
  const seen = new Set();
  const topics = [];
  for (const value of Array.isArray(values) ? values : []) {
    const label = cleanLabel(value).slice(0, 80);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    topics.push(label);
  }
  return topics.slice(0, 12);
}

export function normalizeExerciseDifficulty(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "intermediate") return "Intermediate";
  if (normalized === "advanced") return "Advanced";
  return "Beginner";
}

export function exerciseXp(kind, difficulty) {
  const normalizedDifficulty = normalizeExerciseDifficulty(difficulty);
  const values = kind === "mcq"
    ? { Beginner: 5, Intermediate: 10, Advanced: 15 }
    : { Beginner: 20, Intermediate: 35, Advanced: 50 };
  return values[normalizedDifficulty];
}

export function normalizeBadgeDefinition(id, earnedAt = null) {
  if (id === "first-steps") {
    return { id, title: "First Steps", description: "Complete your first verified Stonecode exercise.", earnedAt };
  }
  const achievementItem = achievementCatalog.find((item) => item.id === id);
  return achievementItem
    ? { id, title: achievementItem.title, description: achievementItem.description, earnedAt }
    : { id, title: titleCase(id), description: "Stonecode learning achievement.", earnedAt };
}

export function evaluateAchievementProgress({ activity = [], completedPrograms = [], earnedBadgeKeys = [] } = {}) {
  const earned = new Set(earnedBadgeKeys);
  const domainXp = sumXpByDomain(activity);
  const completionCounts = countProgramsByDomain(completedPrograms);
  const languageDomainXp = sumLanguageXpByDomain(activity);
  const specialistProgress = achievementCatalog.slice(0, 4).map((definition) => {
    const domain = definition.domains[0];
    const currentXp = domainXp[domain] ?? 0;
    const qualifyingCompletions = completionCounts[domain] ?? 0;
    const languageXp = Math.max(...definition.languages.map((language) => languageDomainXp[domain]?.[language] ?? 0), 0);
    const isEarned = qualifyingCompletions >= 1 && currentXp >= definition.requiredXp && languageXp >= definition.requiredLanguageXp;
    if (isEarned) earned.add(definition.id);
    return progressItem(definition, { currentXp, qualifyingCompletions, languageXp, isEarned: isEarned || earned.has(definition.id) });
  });

  const fullStack = achievementCatalog[4];
  const combinedXp = uniqueActivityXp(activity, fullStack.domains);
  const fullStackEarned = fullStack.prerequisiteBadges.every((key) => earned.has(key)) && combinedXp >= fullStack.requiredXp;
  if (fullStackEarned) earned.add(fullStack.id);
  const fullStackProgress = progressItem(fullStack, {
    currentXp: combinedXp,
    qualifyingCompletions: Math.min(completionCounts.frontend ?? 0, completionCounts.backend ?? 0),
    languageXp: 0,
    isEarned: fullStackEarned || earned.has(fullStack.id)
  });

  return {
    earnedBadgeKeys: [...earned],
    newlyEarnedBadgeKeys: [...earned].filter((key) => !earnedBadgeKeys.includes(key) && key !== "first-steps"),
    progress: [...specialistProgress, fullStackProgress]
  };
}

function skill(label, parentLanguage, domains, aliases) {
  return { label, parentLanguage, domains, aliases: aliases.map((alias) => alias.toLowerCase()) };
}

function achievement(id, title, domain, requiredXp, requiredLanguageXp, languages) {
  return {
    id,
    title,
    description: `Complete a ${title.toLowerCase()} learning program and prove the related skills through verified exercises.`,
    domains: [domain],
    requiredXp,
    requiredLanguageXp,
    languages
  };
}

function findSkill(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const exact = skillCatalog.find((item) => item.aliases.includes(normalized));
  if (exact) return exact;
  return skillCatalog
    .flatMap((item) => item.aliases.map((alias) => ({ item, alias })))
    .filter(({ alias }) => new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(normalized))
    .sort((a, b) => b.alias.length - a.alias.length)[0]?.item ?? null;
}

function languageAliases(label) {
  const aliases = [label.toLowerCase()];
  if (label === "JavaScript") aliases.push("javascript", "js");
  if (label === "TypeScript") aliases.push("typescript", "ts");
  if (label === "C#") aliases.push("c#", "csharp");
  if (label === "C++") aliases.push("c++", "cpp");
  if (label === "SQL") aliases.push("sql", "postgresql", "mysql");
  return aliases;
}

function isLanguage(label) {
  return skillCatalog.some((item) => item.label === label && item.parentLanguage === label);
}

function sumXpByDomain(activity) {
  const totals = {};
  for (const item of activity) {
    for (const domain of uniqueStrings(item.domain_ids)) totals[domain] = (totals[domain] ?? 0) + (Number(item.xp) || 0);
  }
  return totals;
}

function sumLanguageXpByDomain(activity) {
  const totals = {};
  for (const item of activity) {
    const language = cleanOptional(item.parent_language || item.language);
    if (!language) continue;
    for (const domain of uniqueStrings(item.domain_ids)) {
      totals[domain] ??= {};
      totals[domain][language] = (totals[domain][language] ?? 0) + (Number(item.xp) || 0);
    }
  }
  return totals;
}

function countProgramsByDomain(programs) {
  const counts = {};
  for (const program of programs) {
    for (const domain of uniqueStrings(program.domain_ids)) counts[domain] = (counts[domain] ?? 0) + 1;
  }
  return counts;
}

function uniqueActivityXp(activity, domains) {
  const domainSet = new Set(domains);
  return activity.reduce((total, item) => uniqueStrings(item.domain_ids).some((domain) => domainSet.has(domain)) ? total + (Number(item.xp) || 0) : total, 0);
}

function progressItem(definition, values) {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    currentXp: values.currentXp,
    requiredXp: definition.requiredXp,
    qualifyingCompletions: values.qualifyingCompletions,
    requiredCompletions: definition.id === "full-stack-developer" ? 2 : 1,
    languageXp: values.languageXp,
    requiredLanguageXp: definition.requiredLanguageXp ?? 0,
    earned: values.isEarned
  };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function cleanOptional(value) {
  const label = cleanLabel(value);
  return label || null;
}

function cleanLabel(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function titleCase(value) {
  return cleanLabel(value).split(/[-_\s]+/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
