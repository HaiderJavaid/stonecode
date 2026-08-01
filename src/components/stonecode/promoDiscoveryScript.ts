import type { LearningBrief } from "@/data/courses";
import type { CourseSetupServices } from "@/components/stonecode/CourseSetupCard";

const browserBrief: LearningBrief = {
  type: "guided_project",
  goal: "Build an interactive browser dashboard with JavaScript",
  subject: "JavaScript",
  language: "JavaScript",
  platform: "Web",
  desiredOutcome: "An interactive browser dashboard",
  motivation: "Learn browser programming by building something visual",
  priorKnowledge: "Comfortable with JavaScript variables and loops",
  topics: ["DOM fundamentals", "Events", "State and rendering"]
};

async function pause(ms = 260) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const promoDiscoveryServices: Partial<CourseSetupServices> = {
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
