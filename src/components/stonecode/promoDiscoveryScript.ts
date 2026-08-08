import type { LearningBrief } from "@/data/courses";
import type { CourseSetupServices } from "@/components/stonecode/CourseSetupCard";
import type { LearningProposal } from "@/services/courseGeneration";

const browserBrief: LearningBrief = {
  type: "guided_project",
  goal: "Build an interactive browser dashboard with JavaScript",
  subject: "JavaScript",
  language: "JavaScript",
  platform: "Web",
  desiredOutcome: "An interactive browser dashboard",
  motivation: "Learn browser programming by building something visual",
  priorKnowledge: "Comfortable with JavaScript variables and loops",
  projectDifficulty: "advanced",
  topics: ["DOM fundamentals", "Events", "State and rendering"]
};

const browserProposal: LearningProposal = {
  id: "promo-browser-dashboard",
  schemaVersion: "learning-proposal/v1",
  status: "draft",
  type: "project",
  domainId: "programming",
  technologyId: "javascript",
  focusAreas: ["DOM fundamentals", "Events", "State and rendering"],
  title: "Build an interactive browser dashboard",
  summary: "Create a responsive dashboard with reusable rendering, event-driven controls, validation, and resilient empty states.",
  technology: "JavaScript",
  outcomes: ["Build and explain a complete browser dashboard"],
  items: [
    { id: "shell", title: "Design the dashboard shell and state model", summary: "Connect semantic markup to a small, explicit application-state model.", stepCount: 5, fileCount: 3 },
    { id: "rendering", title: "Render reusable metric and activity components", summary: "Turn state into consistent cards and activity rows without duplicating DOM code.", stepCount: 5, fileCount: 3 },
    { id: "interaction", title: "Add filtering, validation, and resilient empty states", summary: "Handle user actions, invalid input, and edge cases with visible feedback.", stepCount: 5, fileCount: 3 },
    { id: "finish", title: "Polish and verify the complete dashboard", summary: "Check responsive behavior, state transitions, and the final user flow.", stepCount: 4, fileCount: 3 }
  ],
  totals: { modules: 0, steps: 19, files: 3, exercises: 0 },
  creditQuote: { version: "credit-quote/v1", credits: 15, currency: "stonecode_credit" },
  quoteId: "promo-quote",
  brief: browserBrief
};

async function pause(ms = 260) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const promoDiscoveryServices: Partial<CourseSetupServices> = {
  async requestFeatures() {
    return { features: { learning_proposals_v1: true, credits_v1: true } };
  },
  async requestProposal() {
    await pause();
    return { proposal: browserProposal };
  },
  async finalizeProposal() {
    await new Promise<never>(() => undefined);
    throw new Error("unreachable");
  },
  async requestDiscoveryTurn({ turn }) {
    await pause();
    if (turn === 0) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "What would you like to learn or build?",
          suggestions: ["Build a browser project", "Learn JavaScript", "Practice Python"],
          brief: null,
          draftBrief: null,
          missingFields: ["goal"],
          questionField: "goal",
          responseTurn: turn,
          nextAction: "clarify"
        }
      };
    }
    if (turn === 1) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "Great. Which supported browser technology would you like to use?",
          suggestions: ["Plain JavaScript", "React", "Help me choose"],
          brief: null,
          draftBrief: { type: "guided_project", goal: browserBrief.goal },
          missingFields: ["language", "framework", "priorKnowledge"],
          questionField: "language",
          responseTurn: turn,
          nextAction: "clarify"
        }
      };
    }
    if (turn === 2) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "What experience do you already have with JavaScript or browser programming?",
          suggestions: ["I know JavaScript basics", "I’m completely new", "I’ve built a small page"],
          brief: null,
          draftBrief: { ...browserBrief, priorKnowledge: undefined },
          missingFields: ["priorKnowledge"],
          questionField: "priorKnowledge",
          responseTurn: turn,
          nextAction: "clarify"
        }
      };
    }
    if (turn === 3) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "Since you already know the basics, should this be a focused basic build or an advanced dashboard with richer state and edge cases?",
          suggestions: ["Basic", "Advanced"],
          brief: null,
          draftBrief: { ...browserBrief, projectDifficulty: undefined },
          missingFields: ["project_difficulty"],
          questionField: "project_difficulty",
          responseTurn: turn,
          nextAction: "clarify"
        }
      };
    }
    return {
      source: "ai",
      discovery: {
        status: "ready",
        reply: "Perfect. I’ll shape the project around your JavaScript basics and prepare a concrete outline.",
        suggestions: [],
        brief: browserBrief,
        draftBrief: browserBrief,
        missingFields: [],
        questionField: null,
        responseTurn: turn,
        nextAction: "confirm"
      }
    };
  }
};
