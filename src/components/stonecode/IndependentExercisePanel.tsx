import { FormEvent, useEffect, useState } from "react";
import { Course } from "@/data/courses";
import { PlanTier } from "@/lib/database.types";
import { getIndependentExercises, IndependentExercise } from "@/features/exercises/challengeData";
import { useProgression } from "@/hooks/useProgression";
import { mutateExerciseProgression } from "@/services/progression";
import { renderMarkdown } from "@/components/stonecode/markdown";

export function IndependentExercisePanel({
  course,
  plan,
  activeCode,
  onLoadExerciseFile,
  requestExerciseHint,
  requestExerciseTemplate
}: {
  course: Course;
  plan: PlanTier;
  activeCode: string;
  onLoadExerciseFile: (path: string, content: string) => void;
  requestExerciseHint: (exercise: IndependentExercise, question: string, code: string) => Promise<string>;
  requestExerciseTemplate: (exercise: IndependentExercise, code: string) => Promise<string>;
}) {
  const exercises = getIndependentExercises(course);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = exercises[exerciseIndex % exercises.length];
  const [feedback, setFeedback] = useState("Run your solution when the acceptance criteria are covered.");
  const [hintReply, setHintReply] = useState<string | null>(null);
  const [hintDraft, setHintDraft] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { progression, isLoading, error, refresh } = useProgression();
  const exerciseState = progression.attempts.find(
    (attempt) => attempt.source === "independent" && attempt.exercise_key === exercise.id
  );
  const isComplete = exerciseState?.status === "completed";
  const dailyLimit = plan === "pro" ? 30 : plan === "basic" ? 10 : 2;
  const remaining = Math.max(dailyLimit - progression.dailyState.completedCount, 0);
  const exerciseFilePath = resolveExerciseFilePath(exercise);

  useEffect(() => {
    onLoadExerciseFile(exerciseFilePath, exercise.starterCode);
  }, [exercise.id]);

  async function runExercise() {
    setIsPending(true);
    try {
      const result = await mutateExerciseProgression({
        action: "complete",
        source: "independent",
        exerciseKey: exercise.id,
        courseId: course.id,
        submission: { code: activeCode }
      });
      setFeedback(result.passed
        ? result.awarded
          ? `Passed. +${result.xp} XP saved.`
          : "Previously completed. No duplicate XP awarded."
        : result.feedback ?? "Not passing yet.");
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Unable to record this run.");
    } finally {
      setIsPending(false);
    }
  }

  function moveNext() {
    const nextIndex = (exerciseIndex + 1) % exercises.length;
    const nextExercise = exercises[nextIndex];
    const wasCompleted = progression.attempts.some(
      (attempt) => attempt.source === "independent" && attempt.exercise_key === nextExercise.id && attempt.status === "completed"
    );
    setExerciseIndex(nextIndex);
    setFeedback(wasCompleted ? "Previously completed. Continue when you want another scenario." : "New scenario loaded. Run your solution when ready.");
    setHintReply(null);
    setHintDraft("");
  }

  async function handleSkip() {
    if (isComplete) {
      moveNext();
      return;
    }
    setIsPending(true);
    try {
      await mutateExerciseProgression({
        action: "skip",
        source: "independent",
        exerciseKey: exercise.id,
        courseId: course.id
      });
      await refresh();
      moveNext();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Unable to skip this exercise.");
    } finally {
      setIsPending(false);
    }
  }

  async function submitHint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const question = String(data.get("hint") ?? "").trim();
    if (!question) return;
    setIsPending(true);
    try {
      await mutateExerciseProgression({
        action: "hint",
        source: "independent",
        exerciseKey: exercise.id,
        courseId: course.id
      });
      const reply = await requestExerciseHint(exercise, question, activeCode);
      setHintReply(reply);
      setHintDraft("");
      await refresh();
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Hint unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  async function fillExerciseTemplate() {
    setIsPending(true);
    try {
      const template = await requestExerciseTemplate(exercise, activeCode);
      setHintDraft(template.trim() || buildExerciseTemplatePlaceholder(exercise));
    } catch {
      setHintDraft(buildExerciseTemplatePlaceholder(exercise));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="lesson-panel ai-chat-panel independent-exercise-panel">
      <div className="chat-canvas-head">
        <div className="lesson-progress-copy">
          <span>{isLoading ? "Syncing" : `${remaining}/${dailyLimit} left`}</span>
        </div>
        <div className="lesson-progress-track" aria-label={`${remaining} exercise completions left today`}>
          <i style={{ width: `${Math.min((remaining / Math.max(dailyLimit, 1)) * 100, 100)}%` }} />
        </div>
        <div className="exercise-meta exercise-meta-inline" aria-label="Generated exercise tags">
          <span>{exercise.language || "AI topic"}</span>
          <span>{exercise.difficulty || "Level pending"}</span>
          <button aria-label="Fill exercise answer template" className="xp-template-button" disabled={isPending || Boolean(exerciseState?.hint_used)} onClick={fillExerciseTemplate} type="button">
            EXP
          </button>
        </div>
      </div>

      <div className="ai-chat-scroll" aria-label={`${exercise.title} exercise chat`}>
        <div className="ai-message assistant-message ai-response">
          <h1>{exercise.title}</h1>
          <h2>Task</h2>
          <p>{exercise.scenario}</p>
          <h2>Acceptance</h2>
          <ul>{exercise.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        </div>
        <div className="exercise-editor-note">
          <strong>Code in the middle editor</strong>
          <p>Starter loaded at <code>{exerciseFilePath}</code>. Use Run/Submit here after editing the center IDE.</p>
        </div>
        <p className={`exercise-feedback${isComplete ? " is-success" : ""}`}>{feedback}</p>
        {error && <p className="exercise-feedback">{error}</p>}
        {hintReply && (
          <div className="ai-message assistant-message ai-response">
            {renderMarkdown(hintReply)}
          </div>
        )}
      </div>

      <div className="chat-dock">
        <div className="quick-action-label">Quick actions</div>
        <div className="reply-suggestions" aria-label="Suggested replies">
          <button disabled={isPending || Boolean(exerciseState?.hint_used)} onClick={() => setHintDraft("Can you give me one small hint about the next step?")} type="button">
            {exerciseState?.hint_used ? "Hint used today" : "Ask for a hint"}
          </button>
          <button disabled={isPending || Boolean(exerciseState?.hint_used)} onClick={fillExerciseTemplate} type="button">
            EXP
          </button>
        </div>
        <form className="chat-compose" onSubmit={submitHint}>
          <textarea
            aria-label="Ask for one hint"
            disabled={isPending || Boolean(exerciseState?.hint_used)}
            name="hint"
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={exerciseState?.hint_used ? "Hint used today" : "Ask one focused hint question"}
            rows={2}
            value={hintDraft}
            onChange={(event) => setHintDraft(event.currentTarget.value)}
          />
          <button disabled={isPending || Boolean(exerciseState?.hint_used)} type="submit">Hint</button>
        </form>
        <div className="lesson-controls exercise-controls">
          <button disabled={isPending} onClick={runExercise} type="button">Run</button>
          <button disabled={isPending || (!isComplete && progression.dailyState.skipUsed)} onClick={handleSkip} type="button">
            {isComplete ? "Next" : progression.dailyState.skipUsed ? "Skip used today" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function buildExerciseTemplatePlaceholder(exercise: IndependentExercise) {
  return [
    `I am working on: ${exercise.title}`,
    "",
    "What I tried:",
    "- [write the code or idea you tried]",
    "",
    "Where I am stuck:",
    "- [describe the exact error, failed check, or confusing step]",
    "",
    "Acceptance I am checking:",
    ...exercise.acceptanceCriteria.map((criterion) => `- ${criterion}: [pass/fail/unsure]`)
  ].join("\n");
}

function resolveExerciseFilePath(exercise: IndependentExercise) {
  const extension = exercise.language.toLowerCase().includes("python") ? "py" : exercise.language.toLowerCase().includes("css") ? "css" : "js";
  return `practice/${exercise.id}.${extension}`;
}
