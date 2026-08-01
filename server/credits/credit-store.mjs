import { quoteCreationCredits } from "../../shared/stonecode-product.mjs";

export async function ensureCreditAccount(admin, userId) {
  const { error } = await admin.rpc("ensure_stonecode_credit_account", { p_user_id: userId });
  if (error) throw creditStoreError(error);
}

export async function getCreditSummary(admin, userId) {
  await ensureCreditAccount(admin, userId);
  const { error: cleanupError } = await admin.rpc("release_expired_stonecode_reservations", { p_user_id: userId });
  if (cleanupError) throw creditStoreError(cleanupError);
  const now = new Date().toISOString();
  const [{ data: grants, error: grantsError }, { data: reservations, error: reservationsError }] = await Promise.all([
    admin
      .from("credit_grants")
      .select("id,grant_type,original_amount,remaining_amount,expires_at,created_at")
      .eq("user_id", userId)
      .gt("remaining_amount", 0)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("expires_at", { ascending: true, nullsFirst: false }),
    admin
      .from("credit_reservations")
      .select("id,amount,status,expires_at,created_at")
      .eq("user_id", userId)
      .eq("status", "reserved")
      .order("created_at", { ascending: false })
  ]);
  if (grantsError) throw creditStoreError(grantsError);
  if (reservationsError) throw creditStoreError(reservationsError);
  const activeGrants = Array.isArray(grants) ? grants : [];
  const activeReservations = Array.isArray(reservations) ? reservations : [];
  return {
    version: "credit-summary/v1",
    available: activeGrants.reduce((total, grant) => total + Number(grant.remaining_amount ?? 0), 0),
    reserved: activeReservations.reduce((total, reservation) => total + Number(reservation.amount ?? 0), 0),
    grants: activeGrants,
    reservations: activeReservations
  };
}

export async function createCreditQuote(admin, { userId, scope, idempotencyKey }) {
  const quote = quoteCreationCredits(scope);
  const key = cleanKey(idempotencyKey);
  const payload = {
    user_id: userId,
    quote_version: quote.version,
    experience_type: quote.type,
    scope: quote.scope,
    credits: quote.credits,
    idempotency_key: key
  };
  const { data, error } = await admin
    .from("credit_quotes")
    .upsert(payload, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw creditStoreError(error);
  if (data) return data;
  const { data: existing, error: existingError } = await admin
    .from("credit_quotes")
    .select("*")
    .eq("user_id", userId)
    .eq("idempotency_key", key)
    .single();
  if (existingError) throw creditStoreError(existingError);
  return existing;
}

export async function reserveCredits(admin, { userId, quoteId, idempotencyKey }) {
  const { data, error } = await admin.rpc("reserve_stonecode_credits", {
    p_user_id: userId,
    p_quote_id: quoteId,
    p_idempotency_key: cleanKey(idempotencyKey)
  });
  if (error) throw creditStoreError(error);
  return { id: data };
}

export async function settleCredits(admin, { userId, reservationId }) {
  const { error } = await admin.rpc("settle_stonecode_credit_reservation", {
    p_user_id: userId,
    p_reservation_id: reservationId
  });
  if (error) throw creditStoreError(error);
}

export async function releaseCredits(admin, { userId, reservationId }) {
  const { error } = await admin.rpc("release_stonecode_credit_reservation", {
    p_user_id: userId,
    p_reservation_id: reservationId
  });
  if (error) throw creditStoreError(error);
}

export async function grantMonthlyProCredits(admin, { userId, periodStart, periodEnd }) {
  const { error } = await admin.rpc("grant_stonecode_monthly_credits", {
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_amount: 100
  });
  if (error) throw creditStoreError(error);
}

function cleanKey(value) {
  const key = typeof value === "string" ? value.trim().slice(0, 160) : "";
  if (!key) {
    const error = new Error("An idempotency key is required.");
    error.code = "credit_idempotency_required";
    error.status = 400;
    throw error;
  }
  return key;
}

function creditStoreError(value) {
  const message = String(value?.message ?? value ?? "Credit operation failed.");
  const error = new Error(
    /insufficient_credits/i.test(message)
      ? "Not enough creation credits for this learning path."
      : /credit_quote_unavailable/i.test(message)
        ? "This credit quote expired or is no longer available."
        : message
  );
  error.code = /insufficient_credits/i.test(message)
    ? "insufficient_credits"
    : /credit_quote_unavailable/i.test(message)
      ? "credit_quote_unavailable"
      : "credit_store_error";
  error.status = error.code === "insufficient_credits" ? 402 : error.code === "credit_quote_unavailable" ? 409 : 500;
  return error;
}
