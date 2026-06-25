export type ExercisePlan = "free" | "basic" | "pro";

export type ExerciseAttemptState = {
  attempts: number;
  completed: boolean;
  hintUsed: boolean;
};

export type ExerciseSession = {
  dateKey: string;
  dailyCompletionLimit: number;
  completedToday: number;
  skipUsedToday: boolean;
  exerciseStates: Record<string, ExerciseAttemptState>;
};

const completionLimits: Record<ExercisePlan, number> = {
  free: 2,
  basic: 10,
  pro: 30
};

export function createExerciseSession(plan: ExercisePlan, dateKey: string): ExerciseSession {
  return {
    dateKey,
    dailyCompletionLimit: completionLimits[plan],
    completedToday: 0,
    skipUsedToday: false,
    exerciseStates: {}
  };
}

export function failExerciseAttempt(
  session: ExerciseSession,
  exerciseId: string,
  dateKey: string
): ExerciseSession {
  const current = normalizeExerciseDay(session, dateKey);
  const exercise = readExerciseState(current, exerciseId);

  return withExerciseState(current, exerciseId, {
    ...exercise,
    attempts: exercise.attempts + 1
  });
}

export function requestExerciseHint(
  session: ExerciseSession,
  exerciseId: string,
  dateKey: string
): ExerciseSession {
  const current = normalizeExerciseDay(session, dateKey);
  const exercise = readExerciseState(current, exerciseId);
  if (exercise.hintUsed) throw new Error("Hint already used for this exercise.");

  return withExerciseState(current, exerciseId, {
    ...exercise,
    hintUsed: true
  });
}

export function skipExercise(session: ExerciseSession, dateKey: string): ExerciseSession {
  const current = normalizeExerciseDay(session, dateKey);
  if (current.skipUsedToday) throw new Error("Daily skip already used.");
  return { ...current, skipUsedToday: true };
}

export function completeExercise(
  session: ExerciseSession,
  exerciseId: string,
  dateKey: string
): ExerciseSession {
  const current = normalizeExerciseDay(session, dateKey);
  const exercise = readExerciseState(current, exerciseId);
  if (exercise.completed) return current;
  if (current.completedToday >= current.dailyCompletionLimit) {
    throw new Error("Daily completion limit reached.");
  }

  return withExerciseState(
    {
      ...current,
      completedToday: current.completedToday + 1
    },
    exerciseId,
    {
      ...exercise,
      attempts: exercise.attempts + 1,
      completed: true
    }
  );
}

export function normalizeExerciseDay(session: ExerciseSession, dateKey: string): ExerciseSession {
  if (session.dateKey === dateKey) return session;
  return {
    ...session,
    dateKey,
    completedToday: 0,
    skipUsedToday: false
  };
}

function readExerciseState(session: ExerciseSession, exerciseId: string): ExerciseAttemptState {
  return session.exerciseStates[exerciseId] ?? {
    attempts: 0,
    completed: false,
    hintUsed: false
  };
}

function withExerciseState(
  session: ExerciseSession,
  exerciseId: string,
  exercise: ExerciseAttemptState
): ExerciseSession {
  return {
    ...session,
    exerciseStates: {
      ...session.exerciseStates,
      [exerciseId]: exercise
    }
  };
}
