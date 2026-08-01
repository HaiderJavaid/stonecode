import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSnapshot } from "../server/marketplace/marketplace-service.mjs";

const snapshot = buildSnapshot({
  title: "Python CLI",
  subject: "Python",
  mode: "project",
  checkpoint: "Start",
  description: "Build a CLI.",
  required_section_count: 8,
  experience_type: "guided_project",
  course_content: { schemaVersion: "guided-project-content/v2", module: { blocks: [] } },
  languages: ["Python"],
  tags: ["CLI"],
  user_id: "must-not-leak"
}, { title: "Python CLI", description: "Build a CLI.", tags: ["CLI"], technologies: ["Python"] }, 2);
assert.equal(snapshot.version, "marketplace-template/v1");
assert.equal(snapshot.listing.version, 2);
assert.equal(snapshot.course.experienceType, "guided_project");
assert.equal("user_id" in snapshot.course, false);

const migration = readFileSync(new URL("../supabase/migrations/2026-07-29-production-revamp-foundation.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/stonecode-server.mjs", import.meta.url), "utf8");
const service = readFileSync(new URL("../server/marketplace/marketplace-service.mjs", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/stonecode/MarketplacePanel.tsx", import.meta.url), "utf8");
const prototype = readFileSync(new URL("../src/components/stonecode/StonecodePrototype.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/components/stonecode/DashboardPage.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
assert.match(migration, /marketplace_versions_are_immutable/);
assert.match(migration, /source_course_id uuid references public\.courses\(id\) on delete set null/);
assert.match(server, /cloneMarketplaceTemplate/);
assert.match(service, /chargedCredits: 1/);
assert.match(app, /<Route element=\{<><\/>\} path="\/dashboard" \/>/);
assert.match(app, /<Route element=\{<><\/>\} path="\/marketplace" \/>/);
assert.equal((app.match(/StonecodePrototype authRevealActive/g) ?? []).length, 1);
assert.doesNotMatch(app, /marketplaceOpen/);
assert.match(prototype, /aria-label="Product view"/);
assert.match(prototype, /active=\{isMarketplaceView\}/);
assert.match(panel, /setAttribute\("inert", ""\)/);
assert.match(panel, /MARKETPLACE_INTERACTIVE_DELAY_MS = 2880/);
assert.match(panel, /className="marketplace-heading"/);
assert.match(panel, /className="marketplace-content-card"/);
assert.ok(panel.indexOf('className="marketplace-heading"') < panel.indexOf('className="marketplace-content-card"'));
assert.doesNotMatch(panel, /onTouchEnd|handleTouchStart|Close Marketplace/);
assert.doesNotMatch(dashboard, /dashboard-marketplace-button/);
assert.match(panel, /Clone · 1 Stone/);
const marketplaceStyles = styles.slice(styles.indexOf(".marketplace-panel"), styles.indexOf(".rule"));
assert.ok(marketplaceStyles.length > 0);
assert.doesNotMatch(marketplaceStyles, /112,\s*218,\s*151|67,\s*137,\s*92|44,\s*86,\s*58|87,\s*158,\s*113/);
assert.match(styles, /\.scene\.is-marketplace-open \.dashboard-composition/);
assert.match(styles, /translate3d\(-120vw, 0, 0\)/);
assert.match(styles, /\.scene\.is-marketplace-returning \.dashboard-composition/);
assert.match(styles, /\.marketplace-panel\.is-active \.marketplace-content-card[\s\S]*transition-delay: 1960ms/);
assert.match(styles, /\.scene\.is-marketplace-returning \.marketplace-heading/);
assert.doesNotMatch(marketplaceStyles, /opacity:\s*0\.46/);
assert.match(styles, /\.product-view-switcher/);

console.log("marketplace checks passed");
