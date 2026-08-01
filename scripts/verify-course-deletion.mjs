import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/components/stonecode/DashboardPage.tsx", import.meta.url), "utf8");
const storage = readFileSync(new URL("../src/services/supabaseCourseStorage.ts", import.meta.url), "utf8");

assert.match(server, /\.from\("courses"\)\s*\.delete\(\)\s*\.eq\("id", courseId\)\s*\.eq\("user_id", user\.id\)/s);
assert.match(server, /xpPreserved: true/);
assert.doesNotMatch(storage, /resetSupabaseCourseProgress/);
assert.match(dashboard, /Files, tutor chat, and course progress will be removed\. Your earned XP stays\./);
assert.match(dashboard, /aria-modal="true"/);

console.log("course deletion checks passed");
