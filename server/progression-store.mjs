import {
  canCompleteCourse,
  canEquipTitle,
  earnedBadgeKeys,
  evaluateChallengeAttempt,
  formatProgressionSummary,
  getChallengeDefinition
} from "./progression.mjs";

export async function loadProgression(admin, userId, { language = null, days = 365 } = {}) {
  const [
    profileResult,
    challengeResult,
    completionResult,
    badgeResult,
    courseResult,
    usageResult
  ] = await Promise.all([
    admin.from("profiles").select("display_name,timezone,equipped_badge_key,updated_at").eq("id", userId).maybeSingle(),
    admin
      .from("challenge_progress")
      .select("challenge_key,source,language,topic,difficulty,attempts,hint_used,completed_at,xp_awarded,updated_at")
      .eq("user_id", userId),
    admin.from("course_completions").select("course_id,completed_at").eq("user_id", userId),
    admin.from("user_badges").select("badge_key,earned_at").eq("user_id", userId),
    admin.from("courses").select("id,title,subject,status").eq("user_id", userId),
    admin
      .from("daily_exercise_usage")
      .select("activity_date,independent_completions,independent_skips")
      .eq("user_id", userId)
      .order("activity_date", { ascending: false })
      .limit(1)
  ]);

  throwResultError(profileResult);
  throwResultError(challengeResult);
  throwResultError(completionResult);
  throwResultError(badgeResult);
  throwResultError(courseResult);
  throwResultError(usageResult);

  const profile = profileResult.data ?? {};
  const courseCompletions = completionResult.data ?? [];
  const completedCourseIds = new Set(courseCompletions.map((completion) => completion.course_id));
  const courses = courseResult.data ?? [];
  const summary = formatProgressionSummary({
    timezone: profile.timezone ?? "UTC",
    days,
    language,
    challenges: challengeResult.data ?? [],
    courseCompletions,
    badges: badgeResult.data ?? [],
    equippedBadgeKey: profile.equipped_badge_key ?? null
  });

  return {
    ...summary,
    challenges: (challengeResult.data ?? []).map((challenge) => ({
      key: challenge.challenge_key,
      source: challenge.source,
      difficulty: challenge.difficulty,
      completed: Boolean(challenge.completed_at),
      hintUsed: challenge.hint_used,
      attempts: challenge.attempts,
      xpAwarded: challenge.xp_awarded
    })),
    displayName: profile.display_name ?? null,
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      subject: course.subject,
      status: completedCourseIds.has(course.id) ? "completed" : course.status
    })),
    latestDailyUsage: usageResult.data?.[0] ?? null
  };
}

export async function recordChallengeAttempt(admin, {
  userId,
  courseId = null,
  challengeKey,
  sectionId = null,
  submission,
  plan
}) {
  const challenge = getChallengeDefinition(challengeKey);
  if (!challenge) throw new Error("Unknown challenge.");
  if (challenge.source === "course" && !courseId) throw new Error("Course challenge requires a course.");
  if (courseId) await assertCourseOwnership(admin, userId, courseId);

  const validation = evaluateChallengeAttempt(challengeKey, submission);
  const scopeKey = createScopeKey(challenge.source, courseId, sectionId, challengeKey);
  const { data, error } = await admin.rpc("record_challenge_attempt", {
    p_user_id: userId,
    p_course_id: courseId,
    p_challenge_key: challengeKey,
    p_scope_key: scopeKey,
    p_section_id: sectionId,
    p_source: challenge.source,
    p_language: challenge.language,
    p_topic: challenge.topic,
    p_difficulty: challenge.difficulty,
    p_xp: challenge.xp,
    p_accepted: validation.accepted,
    p_plan: plan
  });
  if (error) throw error;

  if (validation.accepted) await awardEligibleBadges(admin, userId);
  return {
    ...data,
    reason: validation.reason,
    challenge: {
      key: challengeKey,
      language: challenge.language,
      topic: challenge.topic,
      difficulty: challenge.difficulty,
      xp: challenge.xp
    }
  };
}

export async function recordChallengeHint(admin, {
  userId,
  courseId = null,
  challengeKey,
  sectionId = null
}) {
  const challenge = getChallengeDefinition(challengeKey);
  if (!challenge) throw new Error("Unknown challenge.");
  if (challenge.source === "course" && !courseId) throw new Error("Course challenge requires a course.");
  if (courseId) await assertCourseOwnership(admin, userId, courseId);

  const { data, error } = await admin.rpc("record_challenge_hint", {
    p_user_id: userId,
    p_course_id: courseId,
    p_challenge_key: challengeKey,
    p_scope_key: createScopeKey(challenge.source, courseId, sectionId, challengeKey),
    p_section_id: sectionId,
    p_source: challenge.source,
    p_language: challenge.language,
    p_topic: challenge.topic,
    p_difficulty: challenge.difficulty
  });
  if (error) throw error;
  return data;
}

export async function recordChallengeSkip(admin, userId) {
  const { data, error } = await admin.rpc("record_challenge_skip", { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function completeCourse(admin, userId, courseId) {
  const course = await assertCourseOwnership(admin, userId, courseId, "id,title,subject,syllabus");
  const [progressResult, challengeResult] = await Promise.all([
    admin.from("course_progress").select("lesson_index").eq("course_id", courseId).maybeSingle(),
    admin
      .from("challenge_progress")
      .select("challenge_key")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .not("completed_at", "is", null)
  ]);
  throwResultError(progressResult);
  throwResultError(challengeResult);

  const syllabus = Array.isArray(course.syllabus) ? course.syllabus : [];
  const finalLessonIndex = Math.max(...syllabus.map((section) => Number(section.lessonIndex) || 0), 0);
  const requiredChallengeKeys = syllabus
    .filter((section) => section.hasChallenge)
    .map((section) => section.challengeKey ?? fallbackChallengeKey(section.lessonIndex))
    .filter(Boolean);
  const completedChallengeKeys = new Set((challengeResult.data ?? []).map((challenge) => challenge.challenge_key));

  if (!canCompleteCourse({
    lessonIndex: progressResult.data?.lesson_index ?? 0,
    finalLessonIndex,
    requiredChallengeKeys,
    completedChallengeKeys
  })) {
    throw new Error("Complete the final roadmap section and every required course challenge first.");
  }

  const { data, error } = await admin
    .from("course_completions")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
    .select("course_id,completed_at")
    .single();
  if (error && error.code !== "PGRST116") throw error;
  await awardEligibleBadges(admin, userId);
  return data ?? { course_id: courseId };
}

export async function equipProgressionTitle(admin, userId, badgeKey) {
  const { data, error } = await admin.from("user_badges").select("badge_key").eq("user_id", userId);
  if (error) throw error;
  const earnedKeys = new Set((data ?? []).map((badge) => badge.badge_key));
  if (!canEquipTitle(badgeKey, earnedKeys)) throw new Error("That title has not been earned.");

  const { error: updateError } = await admin
    .from("profiles")
    .update({ equipped_badge_key: badgeKey, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateError) throw updateError;
  return { equippedBadgeKey: badgeKey };
}

export async function saveProfileTimezone(admin, userId, timezone) {
  if (!isValidTimezone(timezone)) return;
  const { error } = await admin
    .from("profiles")
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function awardEligibleBadges(admin, userId) {
  const [challengeResult, completionResult] = await Promise.all([
    admin
      .from("challenge_progress")
      .select("language,xp_awarded,completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    admin.from("course_completions").select("course_id").eq("user_id", userId)
  ]);
  throwResultError(challengeResult);
  throwResultError(completionResult);

  const completionRows = completionResult.data ?? [];
  const completedCourseIds = completionRows.map((completion) => completion.course_id);
  const courseResult = completedCourseIds.length
    ? await admin.from("courses").select("subject").in("id", completedCourseIds)
    : { data: [], error: null };
  throwResultError(courseResult);

  const challenges = challengeResult.data ?? [];
  const activeDays = new Set(challenges.map((challenge) => challenge.completed_at?.slice(0, 10)).filter(Boolean)).size;
  const languageXp = {};
  for (const challenge of challenges) {
    languageXp[challenge.language] = (languageXp[challenge.language] ?? 0) + (challenge.xp_awarded ?? 0);
  }

  const keys = earnedBadgeKeys({
    completedChallenges: challenges.length,
    activeDays,
    completedCourseCount: completionRows.length,
    completedCourseSubjects: (courseResult.data ?? []).map((course) => course.subject),
    languageXp
  });
  if (!keys.length) return [];

  const { error } = await admin
    .from("user_badges")
    .upsert(
      keys.map((badgeKey) => ({ user_id: userId, badge_key: badgeKey })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true }
    );
  if (error) throw error;
  return keys;
}

function createScopeKey(source, courseId, sectionId, challengeKey) {
  return source === "independent"
    ? `independent:global:${challengeKey}`
    : `course:${courseId}:${sectionId ?? "none"}:${challengeKey}`;
}

async function assertCourseOwnership(admin, userId, courseId, select = "id") {
  const { data, error } = await admin
    .from("courses")
    .select(select)
    .eq("id", courseId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Course not found.");
  return data;
}

function fallbackChallengeKey(lessonIndex) {
  if (lessonIndex === 1) return "course-empty-array";
  if (lessonIndex === 2) return "course-array-mutation";
  if (lessonIndex === 3) return "course-queue-terminal";
  return null;
}

function isValidTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length > 80) return false;
  try {
    Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function throwResultError(result) {
  if (result.error) throw result.error;
}
