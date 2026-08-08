export const openAiPricingVersion = "openai-standard-2026-07-30";
export const openAiFastPricingVersion = "openai-fast-2026-07-30";

// USD per one million tokens. Keep versioned because provider prices change.
const textRates = Object.freeze({
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, cacheWriteInput: 0.25, output: 1.2 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 }
});

const fastTextRates = Object.freeze({
  "gpt-5.6-luna": { input: 0.4, cachedInput: 0.04, cacheWriteInput: 0.5, output: 2.4 },
  "gpt-5.4-mini": { input: 1.5, cachedInput: 0.15, output: 9 },
  "gpt-5.4": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5-mini": { input: 0.45, cachedInput: 0.045, output: 3.6 },
  "gpt-4.1-mini": { input: 0.7, cachedInput: 0.175, output: 2.8 },
  "gpt-4.1-nano": { input: 0.2, cachedInput: 0.05, output: 0.8 },
  "gpt-4.1": { input: 3.5, cachedInput: 0.875, output: 14 },
  "gpt-4o-mini": { input: 0.25, cachedInput: 0.125, output: 1 },
  "gpt-4o": { input: 4.25, cachedInput: 2.125, output: 17 }
});

export const nominalProStoneUsd = 0.09;

export function estimateOpenAiTextCost({ model, serviceTier = "default", inputTokens = 0, cachedInputTokens = 0, cacheWriteInputTokens = 0, outputTokens = 0 } = {}) {
  const rateKey = resolveRateKey(model);
  const normalizedServiceTier = normalizeServiceTier(serviceTier);
  const pricingVersion = normalizedServiceTier === "fast" ? openAiFastPricingVersion : openAiPricingVersion;
  const rates = rateKey ? (normalizedServiceTier === "fast" ? fastTextRates[rateKey] : textRates[rateKey]) : null;
  if (!rates) return { estimatedCostMicrousd: null, pricingVersion, rateKey: null, serviceTier: normalizedServiceTier };
  const input = nonNegativeInteger(inputTokens);
  const cached = Math.min(input, nonNegativeInteger(cachedInputTokens));
  const cacheWrite = Math.min(Math.max(0, input - cached), nonNegativeInteger(cacheWriteInputTokens));
  const uncached = Math.max(0, input - cached - cacheWrite);
  const output = nonNegativeInteger(outputTokens);
  // token * USD-per-million equals micro-USD directly.
  const estimatedCostMicrousd = Math.round(uncached * rates.input + cached * rates.cachedInput + cacheWrite * (rates.cacheWriteInput ?? rates.input) + output * rates.output);
  return { estimatedCostMicrousd, pricingVersion, rateKey, serviceTier: normalizedServiceTier };
}

export function formatCostUsd(microusd) {
  const value = Number(microusd);
  return Number.isFinite(value) && value >= 0 ? value / 1_000_000 : null;
}

function resolveRateKey(model) {
  const normalized = String(model ?? "").trim().toLowerCase();
  return Object.keys(textRates).sort((left, right) => right.length - left.length).find((key) => normalized === key || normalized.startsWith(`${key}-`)) ?? null;
}

function normalizeServiceTier(value) {
  return ["fast", "priority"].includes(String(value ?? "").trim().toLowerCase()) ? "fast" : "default";
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}
