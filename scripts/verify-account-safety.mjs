import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/stonecode/settings/SettingsSections.tsx", import.meta.url), "utf8");
const accountService = readFileSync(new URL("../src/services/account.ts", import.meta.url), "utf8");
const foundationMigration = readFileSync(new URL("../supabase/migrations/2026-07-29-production-revamp-foundation.sql", import.meta.url), "utf8");
const expansionMigration = readFileSync(new URL("../supabase/migrations/2026-08-01-learning-domains-and-expanded-catalog.sql", import.meta.url), "utf8");

assert.match(server, /request\.method === "GET" && url\.pathname === "\/api\/account\/export"/);
assert.match(server, /body\?\.confirmation !== "DELETE"/);
assert.match(server, /stripe\.subscriptions\.list\(\{ customer: subscription\.stripe_customer_id/);
assert.match(server, /stripe\.subscriptions\.cancel\(stripeSubscription\.id\)/);
assert.match(server, /storage\.from\("tutor-visuals"\)\.remove\(visualPaths\)/);
assert.match(server, /admin\.auth\.admin\.deleteUser\(user\.id\)/);
assert.match(server, /billing_cancellation_unavailable/);
assert.match(settings, /aria-modal="true"/);
assert.match(settings, /confirmation !== "DELETE"/);
assert.match(accountService, /authenticatedFetch\("\/api\/account\/export"/);
assert.match(accountService, /authenticatedJson<\{ deleted: true \}>\("\/api\/account"/);
assert.doesNotMatch(foundationMigration, /references public\.(?:credit_quotes|credit_grants|credit_reservations)\(id\) on delete restrict/);
assert.match(expansionMigration, /drop constraint if exists credit_reservations_quote_id_fkey/);
assert.match(expansionMigration, /drop constraint if exists credit_reservation_allocations_grant_id_fkey/);
assert.match(expansionMigration, /drop constraint if exists generation_jobs_reservation_id_fkey/);

console.log("account safety checks passed");
