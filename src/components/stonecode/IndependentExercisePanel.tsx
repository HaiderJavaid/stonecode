import { FormEvent, useState } from "react";
import { Course } from "@/data/courses";
import { PlanTier } from "@/lib/database.types";
import { getIndependentExercises } from "@/features/exercises/challengeData";
import { useAuth } from "@/auth/AuthProvider";
import { useProgression } from "@/hooks/useProgression";
import {
  requestChallengeHint,
  skipChallenge,
  submitChallengeAttempt
} from "@/services/progression";

export function IndependentExercisePanel({ course, plan }: { course: Course; plan: PlanTier }) {
  const auth = useAuth();
  const { progression, refresh } = useProgression();
  const exercises = getIndependentExercises(course);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = exercises[exerciseIndex % exercises.length];
  const [code, setCode] = useState(exercise.starterCode);
  const [feedback, setFeedback] = useState("Run your solution when the acceptance criteria are covered.");
  const [hintReply, setHintReply] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const exerciseState = progression.challenges.find((challenge) => challenge.key === exercise.id);
  const isComplete = Boolean(exerciseState?.completed);
  const dailyLimit = plan === "pro" ? 30 : plan === "basic" ? 10 : 2;
  const completedToday = isLatestUsageToday(progression.latestDailyUsage?.activity_date, progression.timezone)
    ? progression.latestDailyUsage?.independent_completions ?? 0
    : 0;
  const skipUsedToday = isLatestUsageToday(progression.latestDailyUsage?.activity_date, progression.timezone)
    ? (progression.latestDailyUsage?.independent_skips ?? 0) > 0
    : false;
  const remaining = Math.max(dailyLimit - completedToday, 0);

  async function runExercise() {
    const token = auth.session?.access_token;
    if (!token) {
      setFeedback("Authentication required.");
      return;
    }
    setIsPending(true);
    try {
      const result = await submitChallengeAttempt(token, {
        challengeKey: exercise.id,
        courseId: course.id,
        submission: { code }
      });
      setFeedback(
        result.xpAwarded > 0
          ? `Passed. +${result.xpAwarded} XP added to your progression.`
          : "Passed previously. No duplicate XP awarded."
      );
      await refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Not passing yet.");
      await refresh();
    } finally {
      setIsPending(false);
    }
  }

  function moveNext() {
    const nextIndex = (exerciseIndex + 1) % exercises.length;
    const nextExercise = exercises[nextIndex];
    const wasCompleted = Boolean(progression.challenges.find((challenge) => challenge.key === nextExercise.id)?.completed);
    setExerciseIndex(nextIndex);
    setCode(nextExercise.starterCode);
    setFeedback(wasCompleted ? "Previously completed. Continue when you want another scenario." : "New scenario loaded. Run your solution when ready.");
    setHintReply(null);
  }

  async function handleSkip() {
    if (isComplete) {
      moveNext();
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    setIsPending(true);
    try {
      await skipChallenge(token);
      await refresh();
      moveNext();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to skip this exercise.");
    } finally {
      setIsPending(false);
    }
  }

  async function submitHint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const question = String(data.get("hint") ?? "").trim();
    if (!question) return;
    const token = auth.session?.access_token;
    if (!token) return;
    setIsPending(true);
    try {
      await requestChallengeHint(token, {
        challengeKey: exercise.id,
        courseId: course.id
      });
      setHintReply(`${exercise.hint} Your question was: “${question}”`);
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Hint unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="independent-exercise-panel">
      <header>
        <div>
          <span>Independent exercise</span>
          <strong>{exercise.title}</strong>
        </div>
        <small>{remaining}/{dailyLimit} completions left today</small>
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
            disabled={isPending || Boolean(exerciseState?.hintUsed)}
            name="hint"
            placeholder={exerciseState?.hintUsed ? "Hint used for this exercise" : "Ask one focused hint question"}
          />
          <button disabled={isPending || Boolean(exerciseState?.hintUsed)} type="submit">Hint</button>
        </div>
      </form>
      <div className="exercise-controls">
        <button disabled={isPending} onClick={runExercise} type="button">{isPending ? "Checking..." : "Run"}</button>
        <button disabled={isPending || (!isComplete && skipUsedToday)} onClick={handleSkip} type="button">
          {isComplete ? "Next" : skipUsedToday ? "Skip used today" : "Skip"}
        </button>
      </div>
    </div>
  );
}

function isLatestUsageToday(activityDate: string | undefined, timezone: string) {
  if (!activityDate) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return activityDate === today;
}
