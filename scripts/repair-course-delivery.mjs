import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { repairExistingCourseDelivery } from "../server/learning-orchestrator/generation-worker.mjs";

loadLocalEnv();
const courseId = argumentValue("--course-id");
if (!/^[0-9a-f-]{36}$/i.test(String(courseId ?? ""))) throw new Error("A valid --course-id UUID is required.");
if (!process.argv.includes("--confirm")) throw new Error("Add --confirm to repair the course. This updates only that course and does not charge Stones.");
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const result = await repairExistingCourseDelivery({ admin, courseId, env: process.env });
console.log(JSON.stringify(result, null, 2));

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function argumentValue(name) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}
