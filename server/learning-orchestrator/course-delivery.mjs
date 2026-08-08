import {
  createGeneratedCourseSkeletonFromOutline,
  normalizeGeneratedCourseContent
} from "../course-generation.mjs";
import { creationCreditBands, quoteCreationCredits } from "../../shared/stonecode-product.mjs";

export const minimumCourseModuleSteps = 6;

export function buildApprovedCourseOutlineContract(proposal) {
  const items = proposalItems(proposal);
  const stepFloor = items.reduce((total, item) => total + moduleStepTarget(item), 0);
  return `APPROVED COURSE DELIVERY CONTRACT
- Return exactly ${items.length} modules, in this exact order.
- Preserve each approved module title and learning direction.
- Plan enough theory, guided workshop, reinforcement, and review blocks for every module to contain at least its target learner-step count.
- The complete generated course must contain at least ${stepFloor} visible learner steps. The approved ${Number(proposal?.creditQuote?.credits ?? 0)}-Stone quote is fixed; additional valid teaching steps may be included when they improve the course.
- Do not merge, remove, or add modules.

Approved modules:
${JSON.stringify(items.map((item, index) => ({
    order: index + 1,
    id: item.id,
    title: item.title,
    summary: item.summary,
    minimumLearnerSteps: moduleStepTarget(item)
  })))}.`;
}

export function buildApprovedModuleDeliveryContract(proposal, moduleIndex) {
  const items = proposalItems(proposal);
  const item = items[moduleIndex];
  if (!item) throw scopeError(`Approved module ${moduleIndex + 1} is missing.`);
  const { minimum, maximum } = approvedModuleStepRange(proposal, moduleIndex);
  return `APPROVED MODULE DELIVERY CONTRACT
- This is module ${moduleIndex + 1} of ${items.length}: "${item.title}".
- Preserve that exact title and direction: ${item.summary}
- Return at least ${minimum} visible learner steps across this module. ${minimum}-${maximum} is the preferred range, but additional valid teaching steps are allowed.
- Include at least one substantive guided workshop with connected micro-edits.
- Return this module only. Do not add, remove, merge, or write another module.`;
}

export function createApprovedCourseSkeleton({ proposal, subject, assessmentReview, courseBlueprint, ragSources }) {
  const items = proposalItems(proposal);
  const outline = {
    title: proposal.title,
    subject,
    description: proposal.summary,
    modules: items.map((item, moduleIndex) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      locked: moduleIndex > 0,
      chapters: [{
        id: `${item.id}-topic`,
        title: item.title,
        summary: item.summary,
        blocks: plannedModuleBlocks(item, moduleIndex, items.length)
      }]
    }))
  };
  return reconcileCourseOutlineWithProposal(outline, {
    proposal,
    subject,
    assessmentReview,
    courseBlueprint,
    ragSources
  });
}

export function approvedModuleStepRange(proposal, moduleIndex) {
  const items = proposalItems(proposal);
  const item = items[moduleIndex];
  if (!item) throw scopeError(`Approved module ${moduleIndex + 1} is missing.`);
  const stepCeiling = approvedCourseStepCeiling(proposal);
  const floorTotal = items.reduce((total, candidate) => total + moduleStepTarget(candidate), 0);
  const sharedExtra = Math.floor(Math.max(0, stepCeiling - floorTotal) / items.length);
  const minimum = moduleStepTarget(item);
  return { minimum, maximum: Math.max(minimum, minimum + sharedExtra) };
}

export function reconcileCourseOutlineWithProposal(outline, { proposal, subject, assessmentReview, courseBlueprint, ragSources }) {
  const items = proposalItems(proposal);
  const skeleton = createGeneratedCourseSkeletonFromOutline(outline, {
    subject,
    assessmentReview,
    courseBlueprint,
    ragSources
  });
  if (skeleton.modules.length !== items.length) {
    throw scopeError(`Approved proposal requires ${items.length} modules; generated outline returned ${skeleton.modules.length}.`);
  }

  return {
    ...skeleton,
    title: proposal.title,
    description: proposal.summary,
    generationDepth: "full_structure_first_module",
    modules: skeleton.modules.map((module, index) => ({
      ...module,
      id: items[index].id,
      title: items[index].title,
      summary: items[index].summary,
      order: index,
      unlocked: false,
      topics: module.topics.map((topic) => ({ ...topic, unlocked: false }))
    }))
  };
}

export function mergeApprovedGeneratedModule(skeleton, generatedModule, moduleIndex, proposal) {
  const items = proposalItems(proposal);
  const approved = items[moduleIndex];
  const outlineModule = skeleton?.modules?.[moduleIndex];
  if (!approved || !outlineModule || !generatedModule) {
    throw scopeError(`Generated module ${moduleIndex + 1} could not be matched to the approved proposal.`);
  }
  return {
    ...outlineModule,
    ...generatedModule,
    id: approved.id,
    title: approved.title,
    summary: approved.summary,
    order: moduleIndex,
    unlocked: true,
    topics: (generatedModule.topics ?? []).map((topic, topicIndex) => ({
      ...topic,
      order: topicIndex,
      unlocked: true
    }))
  };
}

export function assembleCompleteApprovedCourse(skeleton, generatedModules, proposal) {
  const content = normalizeGeneratedCourseContent({
    ...skeleton,
    title: proposal.title,
    description: proposal.summary,
    generationDepth: "full_course",
    modules: generatedModules
  });
  assertCourseDeliveryScope(proposal, content);
  return content;
}

export function assertCourseDeliveryScope(proposal, contentValue) {
  const items = proposalItems(proposal);
  const content = normalizeGeneratedCourseContent(contentValue);
  if (content.modules.length !== items.length) {
    throw scopeError(`Approved proposal requires ${items.length} modules; generated course contains ${content.modules.length}.`);
  }

  let actualSteps = 0;
  content.modules.forEach((module, index) => {
    if (normalizeText(module.title) !== normalizeText(items[index].title)) {
      throw scopeError(`Module ${index + 1} does not match the approved title "${items[index].title}".`);
    }
    const steps = countModuleSteps(module);
    const required = moduleStepTarget(items[index]);
    if (steps < required) {
      throw scopeError(`Module ${index + 1} requires at least ${required} learner steps; generated ${steps}.`);
    }
    actualSteps += steps;
  });

  const approvedCredits = Number(proposal?.creditQuote?.credits ?? 0);
  let deliveredQuote = null;
  try {
    deliveredQuote = quoteCreationCredits({ type: "course", moduleCount: content.modules.length, stepCount: actualSteps });
  } catch {
    // The approved quote stays fixed. Extra valid teaching content is a delivery bonus,
    // including when it exceeds the largest quoting band.
  }
  return {
    modules: content.modules.length,
    steps: actualSteps,
    approvedCredits,
    deliveredBandCredits: deliveredQuote?.credits ?? null,
    exceedsApprovedBand: !deliveredQuote || deliveredQuote.credits > approvedCredits
  };
}

export function countModuleSteps(module) {
  return (module?.topics ?? []).reduce((moduleTotal, topic) => moduleTotal +
    (topic?.blocks ?? []).reduce((topicTotal, block) => topicTotal + (block?.steps?.length ?? 0), 0), 0);
}

export function moduleStepTarget(item) {
  return Math.max(minimumCourseModuleSteps, Number.isInteger(Number(item?.stepCount)) ? Number(item.stepCount) : minimumCourseModuleSteps);
}

export function approvedCourseStepCeiling(proposal) {
  const credits = Number(proposal?.creditQuote?.credits ?? 0);
  const band = creationCreditBands.course.find((candidate) => candidate.credits === credits);
  if (!band) throw scopeError(`Course proposal has unsupported ${credits}-Stone quote.`);
  return band.maxSteps;
}

function proposalItems(proposal) {
  const items = Array.isArray(proposal?.items) ? proposal.items : [];
  if (!items.length) throw scopeError("Approved Course proposal does not contain module items.");
  const expected = Number(proposal?.totals?.modules ?? items.length);
  if (expected !== items.length) throw scopeError(`Course proposal totals require ${expected} modules but list ${items.length}.`);
  return items;
}

function plannedModuleBlocks(item, moduleIndex, moduleCount) {
  const blocks = [
    { id: `${item.id}-theory`, kind: "theory", title: `${item.title} explained`, summary: item.summary },
    { id: `${item.id}-workshop`, kind: "workshop", title: `${item.title} guided practice`, summary: `Build one focused application of ${item.title} through connected micro-steps.` }
  ];
  if (moduleCount >= 3 && moduleIndex === moduleCount - 2) {
    blocks.push({ id: `${item.id}-lab`, kind: "lab", title: `${item.title} transfer exercise`, summary: "Apply the practiced pattern independently in one focused exercise." });
  }
  if (moduleCount >= 3 && moduleIndex === moduleCount - 1) {
    blocks.push({ id: `${item.id}-project`, kind: "project", title: item.title, summary: "Combine previously practised capabilities in the approved final application." });
  }
  return blocks;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scopeError(message) {
  const error = new Error(message);
  error.code = "generation_scope_mismatch";
  return error;
}
