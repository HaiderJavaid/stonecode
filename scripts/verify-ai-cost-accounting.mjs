import assert from "node:assert/strict";
import { estimateOpenAiTextCost, formatCostUsd, nominalProStoneUsd, openAiPricingVersion } from "../server/billing/ai-costs.mjs";

const estimate = estimateOpenAiTextCost({
  model: "gpt-5.4-mini-2026-07-01",
  inputTokens: 10_000,
  cachedInputTokens: 2_000,
  outputTokens: 20_000
});
assert.equal(estimate.rateKey, "gpt-5.4-mini");
assert.equal(estimate.pricingVersion, openAiPricingVersion);
assert.equal(estimate.estimatedCostMicrousd, 96_150);
assert.equal(formatCostUsd(estimate.estimatedCostMicrousd), 0.09615);
const lunaEstimate = estimateOpenAiTextCost({
  model: "gpt-5.6-luna",
  inputTokens: 10_000,
  cachedInputTokens: 2_000,
  cacheWriteInputTokens: 1_000,
  outputTokens: 20_000
});
assert.equal(lunaEstimate.rateKey, "gpt-5.6-luna");
assert.equal(lunaEstimate.estimatedCostMicrousd, 25_690);
assert.equal(formatCostUsd(lunaEstimate.estimatedCostMicrousd), 0.02569);
assert.equal(nominalProStoneUsd, 0.09);
assert.equal(estimateOpenAiTextCost({ model: "unknown", inputTokens: 10 }).estimatedCostMicrousd, null);
console.log("AI cost accounting verification passed.");
