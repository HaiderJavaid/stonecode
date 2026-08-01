import { createClient } from "@supabase/supabase-js";
import { processGenerationJob } from "../../server/learning-orchestrator/generation-worker.mjs";

export async function handler(event) {
  const expectedSecret = process.env.STONECODE_INTERNAL_JOB_SECRET;
  const suppliedSecret = event.headers?.["x-stonecode-job-secret"];
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized background job." }) };
  }
  const jobId = parseJobId(event.body);
  if (!jobId) return { statusCode: 400, body: JSON.stringify({ error: "Generation job id is required." }) };
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { statusCode: 503, body: JSON.stringify({ error: "Supabase service role is not configured." }) };
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await processGenerationJob({ admin, jobId, env: process.env });
  return { statusCode: 200, body: JSON.stringify(result) };
}

function parseJobId(body) {
  try {
    const parsed = JSON.parse(body || "{}");
    return typeof parsed.jobId === "string" && /^[0-9a-f-]{36}$/i.test(parsed.jobId) ? parsed.jobId : null;
  } catch {
    return null;
  }
}
