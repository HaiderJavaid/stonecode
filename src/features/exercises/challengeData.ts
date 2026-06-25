import { Course } from "@/data/courses";

export type IndependentExercise = {
  id: string;
  title: string;
  scenario: string;
  acceptanceCriteria: string[];
  language: string;
  topic: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  xp: number;
  starterCode: string;
  hint: string;
  requiredSnippets: string[];
};

const exercises: IndependentExercise[] = [
  {
    id: "js-order-summary",
    title: "Build an order summary",
    scenario: "A checkout page receives line items and needs a reusable total calculator.",
    acceptanceCriteria: [
      "Return the sum of price multiplied by quantity.",
      "Treat an empty order as zero.",
      "Do not mutate the input array."
    ],
    language: "JavaScript",
    topic: "Arrays",
    difficulty: "Beginner",
    xp: 20,
    starterCode: `function orderTotal(items) {\n  // Return the checkout total.\n}\n`,
    hint: "Transform each item into price × quantity, then combine those values from an initial total of zero.",
    requiredSnippets: ["return", "reduce"]
  },
  {
    id: "js-api-normalizer",
    title: "Normalize an API response",
    scenario: "A dashboard must convert inconsistent user records into a stable UI model.",
    acceptanceCriteria: [
      "Return id, displayName, and isActive for every user.",
      "Fall back to the email when name is missing.",
      "Return a new array."
    ],
    language: "JavaScript",
    topic: "Data transformation",
    difficulty: "Intermediate",
    xp: 35,
    starterCode: `function normalizeUsers(users) {\n  // Build a stable UI model.\n}\n`,
    hint: "Use map because each source record produces exactly one new display record.",
    requiredSnippets: ["return", "map"]
  },
  {
    id: "css-card-overflow",
    title: "Repair a responsive card",
    scenario: "A product card overflows narrow screens because its content cannot shrink.",
    acceptanceCriteria: [
      "Keep the card within its parent width.",
      "Allow long text to wrap.",
      "Preserve usable spacing."
    ],
    language: "CSS",
    topic: "Responsive layout",
    difficulty: "Intermediate",
    xp: 30,
    starterCode: `.product-card {\n  display: flex;\n  gap: 16px;\n}\n`,
    hint: "Inspect minimum sizing on flex children and constrain the card to the available inline size.",
    requiredSnippets: ["max-width", "min-width"]
  },
  {
    id: "python-log-summary",
    title: "Summarize failed requests",
    scenario: "An operations script needs to count failed requests by status code.",
    acceptanceCriteria: [
      "Ignore successful records.",
      "Count each failure status.",
      "Return an empty object for no failures."
    ],
    language: "Python",
    topic: "Dictionaries",
    difficulty: "Beginner",
    xp: 25,
    starterCode: `def summarize_failures(records):\n    # Return counts by status code.\n    pass\n`,
    hint: "Start with an empty dictionary and increment only when status is 400 or higher.",
    requiredSnippets: ["return", "for"]
  },
  {
    id: "python-inventory-alerts",
    title: "Generate inventory alerts",
    scenario: "A small store needs a list of products whose stock has fallen below its reorder threshold.",
    acceptanceCriteria: [
      "Return only products that need reordering.",
      "Include the product name and missing quantity.",
      "Do not change the source records."
    ],
    language: "Python",
    topic: "Lists and dictionaries",
    difficulty: "Intermediate",
    xp: 35,
    starterCode: `def inventory_alerts(products):\n    # Return reorder alerts.\n    pass\n`,
    hint: "Loop through the products, compare stock with reorder_at, and append a new alert dictionary.",
    requiredSnippets: ["return", "for", "append"]
  }
];

export function getIndependentExercises(course: Course): IndependentExercise[] {
  const matching = exercises.filter((exercise) => course.languages.includes(exercise.language));
  return matching.length ? matching : exercises;
}
