import { createCreditQuote } from "../credits/credit-store.mjs";

export async function countProposalsSince(admin, userId, sinceIso) {
  const { count, error } = await admin
    .from("learning_proposals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) throw proposalStoreError(error);
  return count ?? 0;
}

export async function findLearningProposalByIdempotency(admin, userId, idempotencyKey) {
  return findProposalByKey(admin, userId, cleanKey(idempotencyKey));
}

export async function createLearningProposalRecord(admin, { userId, brief, proposal, idempotencyKey }) {
  const key = cleanKey(idempotencyKey);
  const existing = await findProposalByKey(admin, userId, key);
  if (existing) return { proposal: existing, idempotent: true };

  const quote = await createCreditQuote(admin, {
    userId,
    scope: quoteScope(proposal),
    idempotencyKey: `proposal-quote:${key}`
  });
  const { data, error } = await admin
    .from("learning_proposals")
    .insert({
      user_id: userId,
      brief,
      proposal,
      quote_id: quote.id,
      idempotency_key: key
    })
    .select("*")
    .single();
  if (error) {
    if (/duplicate key|unique constraint/i.test(error.message ?? "")) {
      const duplicate = await findProposalByKey(admin, userId, key);
      if (duplicate) return { proposal: duplicate, idempotent: true };
    }
    throw proposalStoreError(error);
  }
  return { proposal: data, idempotent: false };
}

export async function updateLearningProposalRecord(admin, { userId, proposalId, proposal, idempotencyKey }) {
  const current = await findOwnedProposal(admin, userId, proposalId);
  if (!current) throw notFoundError();
  if (current.status !== "draft") throw immutableError();
  const quote = await createCreditQuote(admin, {
    userId,
    scope: quoteScope(proposal),
    idempotencyKey: `proposal-requote:${proposalId}:${cleanKey(idempotencyKey)}`
  });
  const { data, error } = await admin
    .from("learning_proposals")
    .update({ proposal, quote_id: quote.id, updated_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw proposalStoreError(error);
  return data;
}

export async function finalizeLearningProposalRecord(admin, { userId, proposalId, idempotencyKey }) {
  const key = cleanKey(idempotencyKey);
  const { data, error } = await admin.rpc("finalize_stonecode_learning_proposal", {
    p_user_id: userId,
    p_proposal_id: proposalId,
    p_idempotency_key: key
  });
  if (error) throw proposalStoreError(error);
  if (!data?.job?.id) throw proposalStoreError("Generation job could not be created.");
  return { job: data.job, idempotent: data.idempotent === true };
}

export async function findOwnedProposal(admin, userId, proposalId) {
  const { data, error } = await admin
    .from("learning_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw proposalStoreError(error);
  return data ?? null;
}

export async function findOwnedGenerationJob(admin, userId, jobId) {
  const { data, error } = await admin
    .from("generation_jobs")
    .select("*,learning_proposals(id,brief,proposal,quote_id,status)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw proposalStoreError(error);
  return data ?? null;
}

function quoteScope(proposal) {
  return {
    type: proposal.type,
    moduleCount: proposal.totals?.modules,
    stepCount: proposal.totals?.steps,
    fileCount: proposal.totals?.files,
    exerciseCount: proposal.totals?.exercises
  };
}

async function findProposalByKey(admin, userId, key) {
  const { data, error } = await admin
    .from("learning_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw proposalStoreError(error);
  return data ?? null;
}

function cleanKey(value) {
  const key = typeof value === "string" ? value.trim().slice(0, 160) : "";
  if (!key) throw invalidProposalError("An idempotency key is required.");
  return key;
}

function notFoundError() {
  const error = new Error("Learning proposal not found.");
  error.code = "learning_proposal_not_found";
  error.status = 404;
  return error;
}

function immutableError() {
  const error = new Error("Finalized learning proposals cannot be changed.");
  error.code = "learning_proposal_immutable";
  error.status = 409;
  return error;
}

function invalidProposalError(message) {
  const error = new Error(message);
  error.code = "invalid_learning_proposal";
  error.status = 400;
  return error;
}

function proposalStoreError(value) {
  if (value instanceof Error && value.code) return value;
  const raw = String(value?.message ?? value ?? "Learning proposal operation failed.");
  const insufficient = /insufficient_credits/i.test(raw);
  const unavailableQuote = /credit_quote_unavailable|learning_proposal_quote_missing/i.test(raw);
  const missing = /learning_proposal_not_found/i.test(raw);
  const immutable = /learning_proposal_immutable/i.test(raw);
  const error = new Error(
    insufficient
      ? "Not enough creation credits for this learning path."
      : unavailableQuote
        ? "This proposal needs a fresh credit quote."
        : missing
          ? "Learning proposal not found."
          : immutable
            ? "This learning proposal can no longer be finalized."
            : raw
  );
  error.code = insufficient
    ? "insufficient_credits"
    : unavailableQuote
      ? "credit_quote_unavailable"
      : missing
        ? "learning_proposal_not_found"
        : immutable
          ? "learning_proposal_immutable"
          : "learning_proposal_store_error";
  error.status = insufficient ? 402 : unavailableQuote || immutable ? 409 : missing ? 404 : 500;
  return error;
}
