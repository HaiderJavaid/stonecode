export const lessonSteps = [
  {
    label: "Section 1",
    title: "Read the Current File",
    tutor: `## Let's inspect the current file

Start by reading the smallest function or statement that controls the current behavior.

- Name the input.
- Name the output.
- Point to the line that changes state.

\`Goal\`: explain what data enters and what leaves before editing anything.`,
    suggestions: ["Help me find the state change", "Give me a small hint", "Check my explanation"]
  },
  {
    label: "Section 2",
    title: "Compare the Tradeoff",
    tutor: `## Compare the simple path with the optimized path

Do not memorize the code. Name the tradeoff.

- What becomes faster?
- What becomes harder to read?
- When would readability win?

\`Task\`: write one sentence choosing readability or speed for this file.`,
    suggestions: ["Review my tradeoff", "Show a counterexample", "Make this simpler"]
  },
  {
    label: "Exercise",
    title: "Prediction Exercise",
    tutor: `## Predict before changing code

Make one prediction, then compare it against the file.

- What line runs first?
- What value changes?
- What result do you expect?

\`Finish\`: send your prediction and ask for review.`,
    suggestions: ["Review my prediction", "Ask me one test question", "Move to next topic"]
  }
];
