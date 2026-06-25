export type LessonDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type LessonOption = {
  label: string;
  correct: boolean;
};

export type LessonStep = {
  kind: "theory" | "chat-exercise" | "multiple-choice" | "terminal-exercise" | "canvas";
  label: string;
  title: string;
  tutor: string;
  suggestions: string[];
  language?: string;
  difficulty?: LessonDifficulty;
  xp?: number;
  options?: LessonOption[];
};

export const lessonSteps: LessonStep[] = [
  {
    kind: "theory",
    label: "Theory",
    title: "Read the Current File",
    tutor: `## Let's inspect the current file

Start by reading the smallest function or statement that controls the current behavior.

- Name the input.
- Name the output.
- Point to the line that changes state.

**Goal:** explain what data enters and what leaves before editing anything.

Ask for clarification at any point. If a question belongs to an upcoming section, the tutor will tell you where it will be covered.`,
    suggestions: ["Explain the state change", "Give me a small hint", "What comes next?"]
  },
  {
    kind: "chat-exercise",
    label: "Exercise",
    title: "Answer in Chat",
    language: "JavaScript",
    difficulty: "Beginner",
    xp: 10,
    tutor: `## Check your understanding

The function receives an array and returns its first element.

**Question:** what should the function return when the array is empty, and why?

Write your answer in chat. The tutor will review your reasoning before you continue.`,
    suggestions: ["Give me a hint", "Show the function signature", "Review my answer"]
  },
  {
    kind: "multiple-choice",
    label: "Exercise",
    title: "Choose the Best Answer",
    language: "JavaScript",
    difficulty: "Beginner",
    xp: 15,
    tutor: `## Which operation changes the array?

Choose the answer that mutates the original array.`,
    suggestions: [],
    options: [
      { label: "array.map(item => item * 2)", correct: false },
      { label: "array.slice(1)", correct: false },
      { label: "array.push(nextItem)", correct: true },
      { label: "[...array, nextItem]", correct: false }
    ]
  },
  {
    kind: "terminal-exercise",
    label: "Exercise",
    title: "Write and Run Code",
    language: "Python",
    difficulty: "Intermediate",
    xp: 25,
    tutor: `## Complete this in the editor

Create \`practice/queue.py\` and implement a queue with:

- \`enqueue(value)\`
- \`dequeue()\`
- an empty-queue guard

Run the file in the terminal when ready, then explain the time complexity in chat.`,
    suggestions: ["Show related files", "Explain queue complexity", "Review my implementation"]
  },
  {
    kind: "canvas",
    label: "Visual explanation",
    title: "See the Data Move",
    tutor: `## Queue flow

\`\`\`diagram
enqueue("A")  ->  [ A ]
enqueue("B")  ->  [ A ][ B ]
dequeue()     ->       [ B ]
                    front ^
\`\`\`

\`\`\`css
.queue-item {
  border: 1px solid #74d99f;
  background: #10261a;
  color: #baf5cf;
}
\`\`\`

The first item added is the first item removed. This is **FIFO**: first in, first out.`,
    suggestions: ["Explain FIFO again", "Compare queue vs stack", "Start a queue problem"]
  }
];
