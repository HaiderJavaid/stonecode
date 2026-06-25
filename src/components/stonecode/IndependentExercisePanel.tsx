import { FormEvent, useEffect, useState } from "react";
import { Course } from "@/data/courses";
import { PlanTier } from "@/lib/database.types";
import { getIndependentExercises } from "@/features/exercises/challengeData";
import {
  completeExercise,
  createExerciseSession,
  ExerciseSession,
  failExerciseAttempt,
  normalizeExerciseDay,
  requestExerciseHint,
  skipExercise
} from "@/features/exercises/exerciseSession";

export function IndependentExercisePanel({ course, plan }: { course: Course; plan: PlanTier }) {
  const exercises = getIndependentExercises(course);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = exercises[exerciseIndex % exercises.length];
  const [code, setCode] = useState(exercise.starterCode);
  const [feedback, setFeedback] = useState("Run your solution when the acceptance criteria are covered.");
  const [hintReply, setHintReply] = useState<string | null>(null);
  const [session, setSession] = useState<ExerciseSession>(() => loadSession(plan));
  const dateKey = getLocalDateKey();
  const currentSession = normalizeExerciseDay(session, dateKey);
  const exerciseState = currentSession.exerciseStates[exercise.id];
  const isComplete = Boolean(exerciseState?.completed);
  const remaining = Math.max(currentSession.dailyCompletionLimit - currentSession.completedToday, 0);

  useEffect(() => {
    saveSession(currentSession);
  }, [currentSession]);

  function runExercise() {
    const passes = exercise.requiredSnippets.every((snippet) => code.toLowerCase().includes(snippet.toLowerCase()));
    try {
      const next = passes
        ? completeExercise(currentSession, exercise.id, dateKey)
        : failExerciseAttempt(currentSession, exercise.id, dateKey);
      setSession(next);
      setFeedback(
        passes
          ? `Passed. +${exercise.xp} XP recorded locally for this prototype.`
          : "Not passing yet. Re-check every acceptance criterion and run again."
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to record this run.");
    }
  }

  function moveNext() {
    const nextIndex = (exerciseIndex + 1) % exercises.length;
    const nextExercise = exercises[nextIndex];
    const wasCompleted = Boolean(currentSession.exerciseStates[nextExercise.id]?.completed);
    setExerciseIndex(nextIndex);
    setCode(nextExercise.starterCode);
    setFeedback(wasCompleted ? "Previously completed. Continue when you want another scenario." : "New scenario loaded. Run your solution when ready.");
    setHintReply(null);
  }

  function handleSkip() {
    if (isComplete) {
      moveNext();
      return;
    }
    try {
      setSession(skipExercise(currentSession, dateKey));
      moveNext();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to skip this exercise.");
    }
  }

  function submitHint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const question = String(data.get("hint") ?? "").trim();
    if (!question) return;
    try {
      setSession(requestExerciseHint(currentSession, exercise.id, dateKey));
      setHintReply(`${exercise.hint} Your question was: “${question}”`);
      event.currentTarget.reset();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Hint unavailable.");
    }
  }

  return (
    <div className="independent-exercise-panel">
      <header>
        <div>
          <span>Independent exercise</span>
          <strong>{exercise.title}</strong>
        </div>
        <small>{remaining}/{currentSession.dailyCompletionLimit} completions left today</small>
      </header>
      <div className="exercise-meta exercise-session-meta">
        <span>{exercise.language}</span>
        <span>{exercise.topic}</span>
        <span>{exercise.difficulty}</span>
        <strong>+{exercise.xp} XP</strong>
      </div>
      <section className="exercise-brief">
        <p>{exercise.scenario}</p>
        <ul>{exercise.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
      </section>
      <textarea
        aria-label="Exercise code"
        className="exercise-code"
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        value={code}
      />
      <p className={`exercise-feedback${isComplete ? " is-success" : ""}`}>{feedback}</p>
      <form className="exercise-hint" onSubmit={submitHint}>
        {hintReply && <p>{hintReply}</p>}
        <div>
          <input
            aria-label="Ask for one hint"
            disabled={Boolean(exerciseState?.hintUsed)}
            name="hint"
            placeholder={exerciseState?.hintUsed ? "Hint used for this exercise" : "Ask one focused hint question"}
          />
          <button disabled={Boolean(exerciseState?.hintUsed)} type="submit">Hint</button>
        </div>
      </form>
      <div className="exercise-controls">
        <button onClick={runExercise} type="button">Run</button>
        <button disabled={!isComplete && currentSession.skipUsedToday} onClick={handleSkip} type="button">
          {isComplete ? "Next" : currentSession.skipUsedToday ? "Skip used today" : "Skip"}
        </button>
      </div>
    </div>
  );
}

function getLocalDateKey() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function loadSession(plan: PlanTier): ExerciseSession {
  const fallback = createExerciseSession(plan, getLocalDateKey());
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem("stonecode.exerciseSession.v1");
    if (!value) return fallback;
    return {
      ...normalizeExerciseDay(JSON.parse(value) as ExerciseSession, getLocalDateKey()),
      dailyCompletionLimit: fallback.dailyCompletionLimit
    };
  } catch {
    return fallback;
  }
}

function saveSession(session: ExerciseSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("stonecode.exerciseSession.v1", JSON.stringify(session));
}
