import assert from "node:assert/strict";
import {
  completeExercise,
  createExerciseSession,
  failExerciseAttempt,
  requestExerciseHint,
  skipExercise
} from "../src/features/exercises/exerciseSession.ts";

const today = "2026-06-25";
const tomorrow = "2026-06-26";

let session = createExerciseSession("free", today);
assert.equal(session.dailyCompletionLimit, 2);
assert.equal(session.completedToday, 0);
assert.equal(session.skipUsedToday, false);

session = failExerciseAttempt(session, "exercise-a", today);
assert.equal(session.exerciseStates["exercise-a"].attempts, 1);
assert.equal(session.completedToday, 0);

session = requestExerciseHint(session, "exercise-a", today);
assert.equal(session.exerciseStates["exercise-a"].hintUsed, true);
assert.throws(() => requestExerciseHint(session, "exercise-a", today), /already used/i);

session = skipExercise(session, today);
assert.equal(session.skipUsedToday, true);
assert.throws(() => skipExercise(session, today), /already used/i);

session = completeExercise(session, "exercise-a", today);
session = completeExercise(session, "exercise-b", today);
assert.equal(session.completedToday, 2);
assert.throws(() => completeExercise(session, "exercise-c", today), /daily completion limit/i);

session = completeExercise(session, "exercise-c", tomorrow);
assert.equal(session.dateKey, tomorrow);
assert.equal(session.completedToday, 1);
assert.equal(session.skipUsedToday, false);

console.log("exercise session checks passed");
