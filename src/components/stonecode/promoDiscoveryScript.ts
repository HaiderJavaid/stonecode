import type { LearningBrief } from "@/data/courses";
import type { CourseSetupServices } from "@/components/stonecode/CourseSetupCard";

const pygameBrief: LearningBrief = {
  type: "guided_project",
  goal: "Build a small 2D platformer with Python and Pygame",
  subject: "Pygame",
  language: "Python",
  framework: "Pygame",
  platform: "Desktop",
  desiredOutcome: "A playable 2D platformer",
  motivation: "Learn game development by building something visual",
  priorKnowledge: "Comfortable with Python variables, loops, and functions",
  topics: ["Pygame fundamentals", "Game loop", "Movement and collision"]
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
          suggestions: ["Build a 2D game", "Learn web development", "Practice Python"],
          brief: null,
          draftBrief: null,
          missingFields: ["goal"],
          nextAction: "clarify"
        }
      };
    }
    if (turn === 1) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "Great. Which language or game tool would you like to use?",
          suggestions: ["Python with Pygame", "JavaScript with Canvas", "Help me choose"],
          brief: null,
          draftBrief: { type: "guided_project", goal: pygameBrief.goal },
          missingFields: ["language", "framework", "priorKnowledge"],
          nextAction: "clarify"
        }
      };
    }
    if (turn === 2) {
      return {
        source: "ai",
        discovery: {
          status: "clarifying",
          reply: "What experience do you already have with Python or game programming?",
          suggestions: ["I know Python basics", "I’m completely new", "I’ve built small scripts"],
          brief: null,
          draftBrief: { ...pygameBrief, priorKnowledge: undefined },
          missingFields: ["priorKnowledge"],
          nextAction: "clarify"
        }
      };
    }
    return {
      source: "ai",
      discovery: {
        status: "ready",
        reply: "Perfect. I’ll shape the project around your Python basics and check only the Pygame prerequisites that matter.",
        suggestions: [],
        brief: pygameBrief,
        draftBrief: pygameBrief,
        missingFields: [],
        nextAction: "assessment_offer"
      }
    };
  },
  async requestAssessmentPlan() {
    await pause(220);
    return {
      source: "ai",
      plan: {
        supported: true,
        reason: "A short check helps target the Pygame refreshers.",
        targetSubject: "Pygame",
        courseCategory: "game-dev",
        requiresAssessment: true,
        prerequisiteAreas: [
          { id: "python-control-flow", title: "Python control flow", reason: "Used inside the game loop.", startingDifficulty: "entry" },
          { id: "coordinates", title: "2D coordinates", reason: "Used for movement and collision.", startingDifficulty: "entry" },
          { id: "state", title: "Program state", reason: "Used to track the player and scene.", startingDifficulty: "basic" }
        ]
      }
    };
  },
  async requestAssessmentQuestion() {
    await pause(240);
    return {
      source: "ai",
      question: {
        id: "promo-python-loop",
        type: "mcq",
        questionKind: "prerequisite",
        assessmentArea: "python-control-flow",
        difficulty: "entry",
        prompt: "Which loop is best when a game should keep running until the player quits?",
        options: ["A while loop", "A single if statement", "A class definition", "An import statement"],
        correctOptionIndex: 0
      }
    };
  }
};
