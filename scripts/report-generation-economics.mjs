import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { nominalProStoneUsd } from "../server/billing/ai-costs.mjs";

loadLocalEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const limit = Math.min(100, Math.max(1, Number(argumentValue("--limit")) || 20));
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin
  .from("generation_jobs")
  .select("id,status,created_at,estimated_ai_cost_microusd,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,stones_charged,nominal_creation_revenue_microusd")
  .order("created_at", { ascending: false })
  .limit(limit);
if (error) throw new Error(`${error.message} Apply 2026-07-31-ai-cost-and-job-hardening.sql first.`);

const rows = (data ?? []).map((job) => {
  const apiCostUsd = Number(job.estimated_ai_cost_microusd ?? 0) / 1_000_000;
  const nominalRevenueUsd = Number(job.nominal_creation_revenue_microusd ?? 0) / 1_000_000;
  const stones = Number(job.stones_charged ?? 0);
  return {
    job: job.id.slice(0, 8),
    status: job.status,
    date: job.created_at,
    stones,
    input: Number(job.input_tokens ?? 0),
    cached: Number(job.cached_input_tokens ?? 0),
    output: Number(job.output_tokens ?? 0),
    reasoning: Number(job.reasoning_tokens ?? 0),
    apiUsd: apiCostUsd.toFixed(4),
    costPerStoneUsd: stones ? (apiCostUsd / stones).toFixed(4) : "n/a",
    breakEvenProStones: Math.ceil(apiCostUsd / nominalProStoneUsd),
    nominalProRevenueUsd: nominalRevenueUsd.toFixed(2),
    aiShareOfNominal: nominalRevenueUsd > 0 ? `${((apiCostUsd / nominalRevenueUsd) * 100).toFixed(1)}%` : "n/a",
    nominalCoverage: apiCostUsd > 0 && nominalRevenueUsd > 0 ? `${(nominalRevenueUsd / apiCostUsd).toFixed(2)}x` : "n/a"
  };
});
console.table(rows);
const totals = rows.reduce((summary, row) => ({
  stones: summary.stones + row.stones,
  apiUsd: summary.apiUsd + Number(row.apiUsd),
  nominalRevenueUsd: summary.nominalRevenueUsd + Number(row.nominalProRevenueUsd)
}), { stones: 0, apiUsd: 0, nominalRevenueUsd: 0 });
console.log(JSON.stringify({
  jobs: rows.length,
  stonesCharged: totals.stones,
  apiCostUsd: Number(totals.apiUsd.toFixed(4)),
  nominalProStoneRevenueUsd: Number(totals.nominalRevenueUsd.toFixed(2)),
  note: "Free/registration Stones contribute $0 nominal revenue. Pro subscription Stones use $9/100 = $0.09 as a reference, before tutor, image, Judge0, infrastructure, Stripe, tax, and support costs."
}, null, 2));

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
