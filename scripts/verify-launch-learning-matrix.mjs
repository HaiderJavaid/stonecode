import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { normalizeGeneratedCourseContent } from "../server/course-generation.mjs";
import { assertCourseDeliveryScope } from "../server/learning-orchestrator/course-delivery.mjs";
import { normalizeGeneratedLearningContent } from "../server/learning-orchestrator/generation.mjs";
import { missingLearningBriefFields } from "../server/learning-orchestrator/contracts.mjs";
import { findTechnology, launchTechnologyIds, learningDomainCatalog } from "../shared/stonecode-product.mjs";

const modes = ["course", "guided_project", "exercise"];
const technologyMatrix = launchTechnologyIds.flatMap((technologyId) => {
  const technology = findTechnology(technologyId);
  return modes.map((mode) => ({ technology, domainId: "programming", mode, brief: briefForTechnology(technology, mode) }));
});
const domainMatrix = learningDomainCatalog.filter((domain) => domain.id !== "programming").flatMap((domain) =>
  modes.map((mode) => ({
    technology: domainTechnology(domain.id, mode),
    domainId: domain.id,
    mode,
    brief: briefForDomain(domain, mode)
  }))
);
const matrix = [...technologyMatrix, ...domainMatrix];

for (const item of matrix) assert.deepEqual(missingLearningBriefFields(item.brief), [], `${item.domainId}/${item.technology?.id ?? "conceptual"}/${item.mode} brief must be complete`);
if (!process.argv.includes("--live")) {
  console.table(matrix.map((item) => ({ domain: item.domainId, technology: item.technology?.displayName ?? "conceptual", mode: item.mode, subject: item.brief.subject })));
  console.log(`Launch matrix contract check passed (${technologyMatrix.length} technology paths + ${domainMatrix.length} domain paths). Paid live generation additionally requires --live --confirm-external-spend.`);
  process.exit(0);
}
if (!process.argv.includes("--confirm-external-spend")) throw new Error("Live matrix generation incurs external AI cost. Re-run only after explicit authorization with --confirm-external-spend.");

loadLocalEnv();
const baseUrl = argumentValue("--base-url") ?? "http://127.0.0.1:5174";
const target = new URL(baseUrl);
if (!isLoopback(target.hostname) && !process.argv.includes("--allow-remote")) throw new Error("Remote launch-matrix checks require --allow-remote.");
for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`${key} is required.`);
}
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
for (const item of matrix) results.push(await certify(item));
console.table(results);
assert.ok(results.every((result) => result.status === "passed"), JSON.stringify(results.filter((result) => result.status !== "passed"), null, 2));
console.log(`All ${matrix.length} launch learning flows passed.`);

async function certify({ technology, domainId, mode, brief }) {
  const suffix = randomUUID();
  const label = `${domainId}.${technology?.id ?? "conceptual"}`;
  const email = `stonecode.matrix.${label}.${mode}.${suffix}@example.test`;
  const password = `Stonecode-${randomUUID()}-9a!`;
  const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let userId = null;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Launch Matrix QA" } });
    if (createError) throw createError;
    userId = created.user?.id;
    assert.ok(userId);
    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const token = signedIn.session?.access_token;
    assert.ok(token);
    const proposalResult = await apiJson("/api/learning/proposals", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, idempotencyKey: `matrix-proposal:${suffix}` })
    });
    const expectedProposalType = mode === "guided_project" ? "project" : mode;
    assert.equal(proposalResult.proposal.type, expectedProposalType);
    assert.ok(proposalResult.proposal.creditQuote.credits <= 10, "matrix fixtures must fit the registration Stone grant");
    const finalized = await apiJson(`/api/learning/proposals/${proposalResult.proposal.id}/finalize`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `matrix-finalize:${suffix}` })
    });
    const job = await waitForJob(finalized.job.id, token);
    assert.equal(job.status, "succeeded", `${job.error_code ?? "generation_failed"}: ${job.error_message ?? "unknown error"}`);
    const { data: course, error: courseError } = await admin.from("courses").select("experience_type,course_content").eq("id", job.result_course_id).eq("user_id", userId).single();
    if (courseError) throw courseError;
    assert.equal(course.experience_type, mode);
    const normalized = mode === "course"
      ? normalizeGeneratedCourseContent(course.course_content)
      : normalizeGeneratedLearningContent(course.course_content, { brief });
    validateContent({ technology, domainId, mode, raw: course.course_content, normalized, proposal: proposalResult.proposal });
    return { domain: domainId, technology: technology?.displayName ?? "conceptual", mode, status: "passed", stones: proposalResult.proposal.creditQuote.credits };
  } catch (error) {
    return { domain: domainId, technology: technology?.displayName ?? "conceptual", mode, status: "failed", error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => null);
  }
}

function validateContent({ technology, domainId, mode, raw, normalized, proposal }) {
  assert.equal(raw?.generationProvenance?.domainId, domainId);
  assert.equal(raw?.generationProvenance?.technologyId, technology?.id ?? null);
  if (domainId !== "programming") assert.ok(raw?.generationProvenance?.sources?.some((source) => source.domainId === domainId));
  if (technology) assert.ok(raw?.generationProvenance?.sources?.some((source) => source.technologyId === technology.id));
  const steps = practicalSteps(normalized, mode);
  if (!technology) {
    assert.equal(mode, "course");
    assert.equal(steps.length, 0, "conceptual Courses must not invent executable steps");
    assert.deepEqual(normalized.languages, []);
  } else {
    assert.ok(steps.length > 0, "generated path needs practical coding steps");
    assert.ok(steps.every((step) => !(step.requiresPreview && step.requiresTerminal)), "a step cannot expose Output and Terminal together");
    if (technology.runtime === "judge0") {
      assert.ok(steps.every((step) => !step.requiresPreview && step.requiresTerminal), `${technology.displayName} must use Judge0/Terminal, never browser Output`);
    }
    if (technology.runtime === "browser") {
      assert.ok(steps.every((step) => step.requiresPreview && !step.requiresTerminal), `${technology.displayName} must use browser Output`);
      for (const step of steps) {
        const html = step.workspaceFiles?.find((file) => file.path === "index.html")?.content;
        assert.ok(typeof html === "string", `${technology.displayName} browser work needs index.html`);
        if (technology.id === "css") assert.match(html, /styles\.css/i);
      }
    }
  }
  if (mode === "exercise") assert.equal(normalized.problems.length, 5);
  if (mode === "guided_project") {
    const features = normalized.module.blocks.slice(1, -1);
    assert.ok(features.length >= 2);
    assert.ok(features.every((block) => block.steps.filter((step) => step.type === "workshop").length >= 4));
  }
  if (mode === "course") {
    const delivery = assertCourseDeliveryScope(proposal, normalized);
    assert.equal(delivery.modules, proposal.totals.modules);
    assert.ok(delivery.steps >= proposal.totals.steps);
    assert.ok(normalized.modules.every((module) => module.unlocked), "a fully delivered Course must expose every generated module");
  }
}

function practicalSteps(content, mode) {
  if (mode === "exercise") return content.problems.flatMap((problem) => problem.blocks).flatMap((block) => block.steps).filter((step) => step.type === "lab");
  if (mode === "guided_project") return content.module.blocks.flatMap((block) => block.steps).filter((step) => step.type === "workshop");
  return content.modules.flatMap((module) => module.topics).flatMap((topic) => topic.blocks).flatMap((block) => block.steps).filter((step) => ["workshop", "lab", "project"].includes(step.type));
}

function briefForTechnology(technology, mode) {
  const language = technology.displayName;
  const subject = `${language} fundamentals`;
  const base = { domainId: "programming", technologyId: technology.id };
  if (mode === "exercise") return {
    ...base,
    type: "exercise",
    goal: `Practise ${language} fundamentals through five useful coding exercises`,
    subject,
    language,
    motivation: "Build stronger practical fundamentals",
    practiceScope: "topics",
    topics: language === "HTML" ? ["semantic structure"] : language === "CSS" ? ["selectors and layout"] : ["variables", "control flow"],
    difficulty: "beginner",
    exerciseCount: 5,
    exerciseMixPreference: "custom",
    codingPercent: 100
  };
  if (mode === "guided_project") return {
    ...base,
    type: "guided_project",
    goal: projectGoal(language),
    subject,
    language,
    platform: ["JavaScript", "HTML", "CSS"].includes(language) ? "web" : "terminal",
    desiredOutcome: projectOutcome(language),
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  };
  return {
    ...base,
    type: "course",
    goal: `Learn ${language} fundamentals in a compact two-module course with one small practical build`,
    subject,
    language,
    desiredOutcome: projectOutcome(language),
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  };
}

function briefForDomain(domain, mode) {
  const technology = domainTechnology(domain.id, mode);
  const subject = domain.displayName;
  const base = {
    domainId: domain.id,
    technologyId: technology?.id,
    language: technology?.displayName,
    focusAreas: [...domain.focusAreas.slice(0, 2)]
  };
  if (mode === "exercise") return {
    ...base,
    type: "exercise",
    goal: `Practise ${domain.displayName} through five focused ${technology.displayName} exercises`,
    subject,
    motivation: "Build stronger computing foundations",
    practiceScope: "topics",
    topics: [...domain.focusAreas.slice(0, 2)],
    difficulty: "beginner",
    exerciseCount: 5,
    exerciseMixPreference: "custom",
    codingPercent: 100
  };
  if (mode === "guided_project") return {
    ...base,
    type: "guided_project",
    goal: `Build a small ${technology.displayName} teaching tool for ${domain.displayName}`,
    subject,
    platform: technology.runtime === "browser" ? "web" : "terminal",
    desiredOutcome: `A runnable tool demonstrating ${domain.focusAreas[0]}`,
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  };
  return {
    ...base,
    type: "course",
    goal: technology
      ? `Learn ${domain.displayName} through ${technology.displayName} examples`
      : `Learn ${domain.displayName} conceptually with quizzes, reviews, and diagrams`,
    subject,
    priorKnowledge: "Complete beginner",
    supportMode: "teaching_heavy"
  };
}

function domainTechnology(domainId, mode) {
  if (mode === "course" && ["computer_fundamentals", "internet_web"].includes(domainId)) return null;
  return findTechnology(domainId === "internet_web" ? "javascript" : "python");
}

function projectGoal(language) {
  if (language === "JavaScript") return "Build a browser habit counter with add and reset controls";
  if (language === "TypeScript") return "Build a terminal task tracker with typed task records";
  if (language === "Python") return "Build a terminal expense tracker with totals and categories";
  if (language === "HTML") return "Build a semantic personal profile page with navigation and sections";
  if (language === "CSS") return "Build and style a responsive profile card with clear layout states";
  return `Build a small ${language} terminal tracker that stores entries and prints a summary`;
}

function projectOutcome(language) {
  if (language === "JavaScript") return "A working browser habit counter";
  if (language === "TypeScript") return "A runnable typed terminal task tracker";
  if (language === "Python") return "A runnable terminal expense tracker";
  if (language === "HTML") return "A semantic browser-rendered profile page";
  if (language === "CSS") return "A browser-rendered responsive profile card linked from index.html";
  return `A runnable ${language} terminal tracker`;
}

async function waitForJob(jobId, token) {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const result = await apiJson(`/api/generation-jobs/${jobId}`, token);
    if (["succeeded", "failed", "cancelled"].includes(result.job.status)) return result.job;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Generation did not finish within twelve minutes.");
}

async function apiJson(path, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(new URL(path, target), { ...init, headers, signal: AbortSignal.timeout(90_000) });
  const payload = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${path} failed with HTTP ${response.status}: ${payload?.error ?? "unknown error"}`);
  return payload;
}

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function argumentValue(name) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(hostname).toLowerCase());
}
