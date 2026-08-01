const allowedPlanFeatures = new Set(["tutor_reply", "ai_image", "judge0_action", "learning_proposal"]);
const fallbackOperatorCounters = new Map();
const warnedFallbacks = new Set();

export function utcPeriodStart(kind, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) throw new Error("Usage period requires a valid date.");
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return kind === "month" ? `${year}-${month}-01` : `${year}-${month}-${day}`;
}

export async function consumePlanUsage({ admin, userId, feature, periodStart, limit, amount = 1, fallback = null }) {
  validatePlanInput({ userId, feature, periodStart, limit, amount });
  const { data, error } = await admin.rpc("consume_stonecode_plan_usage", {
    p_user_id: userId,
    p_feature: feature,
    p_period_start: periodStart,
    p_limit: limit,
    p_amount: amount
  });
  if (!error) return normalizeAllowance(data, limit, true);
  if (isMissingUsageCounterRpc(error) && typeof fallback === "function") {
    warnFallback("plan");
    return { ...(await fallback()), atomic: false };
  }
  throw usageLimitError(error);
}

export async function releasePlanUsage({ admin, userId, feature, periodStart, amount = 1 }) {
  const { error } = await admin.rpc("release_stonecode_plan_usage", {
    p_user_id: userId,
    p_feature: feature,
    p_period_start: periodStart,
    p_amount: amount
  });
  if (error && !isMissingUsageCounterRpc(error)) throw usageLimitError(error);
}

export async function consumeOperatorUsage({ admin, feature, periodStart, limit, amount = 1 }) {
  if (feature !== "judge0_action" || !periodStart || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(amount) || amount < 1) {
    throw new Error("Operator usage input is invalid.");
  }
  const { data, error } = await admin.rpc("consume_stonecode_operator_usage", {
    p_feature: feature,
    p_period_start: periodStart,
    p_limit: limit,
    p_amount: amount
  });
  if (!error) return normalizeAllowance(data, limit, true);
  if (isMissingUsageCounterRpc(error)) {
    warnFallback("operator");
    return consumeFallbackOperatorUsage({ feature, periodStart, limit, amount });
  }
  throw usageLimitError(error);
}

export async function releaseOperatorUsage({ admin, feature, periodStart, amount = 1 }) {
  const { error } = await admin.rpc("release_stonecode_operator_usage", {
    p_feature: feature,
    p_period_start: periodStart,
    p_amount: amount
  });
  if (!error) return;
  if (!isMissingUsageCounterRpc(error)) throw usageLimitError(error);
  const key = `${feature}:${periodStart}`;
  fallbackOperatorCounters.set(key, Math.max(0, (fallbackOperatorCounters.get(key) ?? 0) - amount));
}

export function resolveOperatorJudge0Limit(env = process.env) {
  const value = Number(env.JUDGE0_GLOBAL_ACTIONS_PER_DAY);
  if (!Number.isInteger(value)) return 1_000;
  return Math.min(Math.max(value, 1), 1_000_000);
}

export function isMissingUsageCounterRpc(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "PGRST202" || code === "42883" || /consume_stonecode_(?:plan|operator)_usage|release_stonecode_(?:plan|operator)_usage/i.test(message) && /not find|does not exist|schema cache/i.test(message);
}

function consumeFallbackOperatorUsage({ feature, periodStart, limit, amount }) {
  const key = `${feature}:${periodStart}`;
  const used = fallbackOperatorCounters.get(key) ?? 0;
  if (used + amount > limit) return { allowed: false, used, limit, atomic: false };
  const next = used + amount;
  fallbackOperatorCounters.set(key, next);
  return { allowed: true, used: next, limit, atomic: false };
}

function validatePlanInput({ userId, feature, periodStart, limit, amount }) {
  if (!userId || !allowedPlanFeatures.has(feature) || !/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart))) {
    throw new Error("Plan usage input is invalid.");
  }
  if (!Number.isInteger(limit) || limit < 0 || !Number.isInteger(amount) || amount < 1) {
    throw new Error("Plan usage limit is invalid.");
  }
}

function normalizeAllowance(value, fallbackLimit, atomic) {
  return {
    allowed: value?.allowed === true,
    used: Math.max(0, Number(value?.used) || 0),
    limit: Math.max(0, Number(value?.limit ?? fallbackLimit) || 0),
    atomic
  };
}

function warnFallback(kind) {
  if (warnedFallbacks.has(kind)) return;
  warnedFallbacks.add(kind);
  console.warn(`Atomic ${kind} usage counters are unavailable; apply 2026-07-30-atomic-usage-and-operator-limits.sql before production traffic.`);
}

function usageLimitError(value) {
  const error = new Error(String(value?.message ?? value ?? "Usage limit operation failed."));
  error.code = "usage_limit_error";
  error.status = 500;
  return error;
}
