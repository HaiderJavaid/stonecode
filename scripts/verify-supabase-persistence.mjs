import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = resolve(new URL("..", import.meta.url).pathname);
loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars. Expected VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const anon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const email = `stonecode.verify.${Date.now()}@gmail.com`;
const password = `Stonecode!${Date.now().toString().slice(-6)}`;
const courseTitle = `Stonecode Verify ${Date.now()}`;
let userId = null;
let courseId = null;

try {
  const schemaCheck = await checkSchemaCache();
  const missingTables = schemaCheck.filter((entry) => !entry.ok);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (created.error || !created.data.user) {
    throw new Error(`Failed to create verification user: ${created.error?.message ?? "Unknown error"}`);
  }

  userId = created.data.user.id;

  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(`Failed to sign in verification user: ${signedIn.error?.message ?? "No session returned"}`);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${signedIn.data.session.access_token}`
      }
    }
  });

  await expectOk(
    client.from("profiles").upsert({
      id: userId,
      email,
      timezone: "Asia/Kuala_Lumpur",
      updated_at: new Date().toISOString()
    }),
    "upsert profiles row"
  );

  const insertedCourse = await client
    .from("courses")
    .insert({
      user_id: userId,
      title: courseTitle,
      subject: "Verification",
      mode: "project",
      checkpoint: "verify-live-schema",
      description: "Temporary verification course",
      progress: 0,
      languages: ["JavaScript"],
      tags: ["Verification"],
      syllabus: [
        {
          id: "verify",
          title: "Verify",
          summary: "Verify progression persistence.",
          lessonIndex: 0,
          hasChallenge: true,
          challengeKey: "verify-course"
        }
      ]
    })
    .select("id,title")
    .single();

  if (insertedCourse.error || !insertedCourse.data) {
    throw new Error(`Failed to insert course: ${insertedCourse.error?.message ?? "Unknown error"}`);
  }

  courseId = insertedCourse.data.id;

  await expectOk(
    client.from("workspace_files").upsert(
      [
        {
          course_id: courseId,
          path: "README.md",
          content: "# verification",
          updated_at: new Date().toISOString()
        }
      ],
      { onConflict: "course_id,path" }
    ),
    "upsert workspace_files"
  );

  const folderWrite = await client.from("workspace_folders").upsert(
    [
      {
        course_id: courseId,
        path: "lessons",
        updated_at: new Date().toISOString()
      }
    ],
    { onConflict: "course_id,path" }
  );

  const messageWrite = await client
    .from("chat_messages")
    .insert({
      course_id: courseId,
      role: "user",
      content: "verify",
      lesson_index: 0
    })
    .select("id")
    .single();

  const progressWrite = await client.from("course_progress").upsert({
    course_id: courseId,
    lesson_index: 0,
    lesson_view: "resume",
    selected_file_path: "README.md",
    updated_at: new Date().toISOString()
  });

  const courseAttemptArgs = {
    p_user_id: userId,
    p_course_id: courseId,
    p_challenge_key: "verify-course",
    p_scope_key: `course:${courseId}:verify:verify-course`,
    p_section_id: "verify",
    p_source: "course",
    p_language: "JavaScript",
    p_topic: "Verification",
    p_difficulty: "Beginner",
    p_xp: 20,
    p_accepted: true,
    p_plan: "free"
  };
  const firstCourseAttempt = await admin.rpc("record_challenge_attempt", courseAttemptArgs);
  const duplicateCourseAttempt = await admin.rpc("record_challenge_attempt", courseAttemptArgs);
  if (firstCourseAttempt.error || duplicateCourseAttempt.error) {
    throw new Error(`Progression attempt RPC failed: ${firstCourseAttempt.error?.message ?? duplicateCourseAttempt.error?.message}`);
  }
  if (firstCourseAttempt.data?.xpAwarded !== 20 || duplicateCourseAttempt.data?.xpAwarded !== 0) {
    throw new Error("Duplicate challenge completion awarded XP.");
  }

  const hintArgs = {
    p_user_id: userId,
    p_course_id: courseId,
    p_challenge_key: "verify-hint",
    p_scope_key: `course:${courseId}:verify:verify-hint`,
    p_section_id: "verify",
    p_source: "course",
    p_language: "JavaScript",
    p_topic: "Verification",
    p_difficulty: "Beginner"
  };
  const firstHint = await admin.rpc("record_challenge_hint", hintArgs);
  const duplicateHint = await admin.rpc("record_challenge_hint", hintArgs);
  if (firstHint.error || !duplicateHint.error) throw new Error("Hint RPC did not enforce one hint per challenge.");

  const firstSkip = await admin.rpc("record_challenge_skip", { p_user_id: userId });
  const duplicateSkip = await admin.rpc("record_challenge_skip", { p_user_id: userId });
  if (firstSkip.error || !duplicateSkip.error) throw new Error("Skip RPC did not enforce one daily skip.");

  const independentAttempts = await Promise.all(
    ["a", "b", "c"].map((suffix) =>
      admin.rpc("record_challenge_attempt", {
        ...courseAttemptArgs,
        p_course_id: courseId,
        p_challenge_key: `verify-independent-${suffix}`,
        p_scope_key: `independent:global:verify-${suffix}`,
        p_section_id: null,
        p_source: "independent",
        p_xp: 5
      })
    )
  );
  if (independentAttempts.filter((result) => !result.error).length !== 2) {
    throw new Error("Concurrent Free completion limit was not enforced atomically.");
  }

  await expectOk(
    admin.from("course_completions").upsert({ user_id: userId, course_id: courseId }),
    "upsert course_completions"
  );
  await expectOk(
    admin.from("user_badges").upsert({ user_id: userId, badge_key: "first-steps" }),
    "upsert user_badges"
  );

  const roundTrip = {
    courses: await countRows(client, "courses", "id", courseId),
    workspace_files: await countRows(client, "workspace_files", "course_id", courseId),
    workspace_folders: folderWrite.error
      ? {
          ok: false,
          error: compactError(folderWrite.error)
        }
      : await countRows(client, "workspace_folders", "course_id", courseId),
    chat_messages: messageWrite.error
      ? {
          ok: false,
          error: compactError(messageWrite.error)
        }
      : await countRows(client, "chat_messages", "course_id", courseId),
    course_progress: progressWrite.error
      ? {
          ok: false,
          error: compactError(progressWrite.error)
        }
      : await countRows(client, "course_progress", "course_id", courseId),
    challenge_progress: await countRows(client, "challenge_progress", "user_id", userId),
    daily_exercise_usage: await countRows(client, "daily_exercise_usage", "user_id", userId),
    course_completions: await countRows(client, "course_completions", "user_id", userId),
    user_badges: await countRows(client, "user_badges", "user_id", userId)
  };

  console.log(
    JSON.stringify(
      {
        verificationUser: email,
        schemaCheck,
        missingTables,
        roundTrip
      },
      null,
      2
    )
  );

  if (missingTables.length || folderWrite.error || messageWrite.error || progressWrite.error) {
    process.exitCode = 1;
  }
} finally {
  if (courseId) {
    await admin.from("courses").delete().eq("id", courseId);
  }
  if (userId) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

async function checkSchemaCache() {
  const tables = [
    "profiles",
    "courses",
    "workspace_files",
    "workspace_folders",
    "chat_messages",
    "course_progress",
    "subscriptions",
    "usage_events",
    "challenge_progress",
    "daily_exercise_usage",
    "course_completions",
    "user_badges"
  ];

  const results = [];
  for (const table of tables) {
    const { error, data } = await anon.from(table).select("*").limit(1);
    results.push({
      table,
      ok: !error,
      rows: Array.isArray(data) ? data.length : null,
      error: error ? compactError(error) : null
    });
  }
  return results;
}

async function countRows(client, table, column, value) {
  const { error, count } = await client.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) {
    return { ok: false, error: compactError(error) };
  }
  return { ok: true, count };
}

async function expectOk(operation, label) {
  const { error } = await operation;
  if (error) {
    throw new Error(`Failed to ${label}: ${error.message}`);
  }
}

function compactError(error) {
  return {
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null
  };
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
