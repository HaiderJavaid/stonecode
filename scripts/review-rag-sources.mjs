import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { validateProvenanceApproval } from "../server/rag/official-source-ingestion.mjs";
import { findTechnologyCorpus } from "../server/rag/technology-corpora.mjs";
import { findLearningDomainCorpus } from "../server/rag/learning-domain-corpora.mjs";

loadLocalEnv();
const args = parseArguments(process.argv.slice(2));
if (args.technology && args.domain) throw new Error("Choose either --technology or --domain, not both.");
const corpusSpec = args.domain ? findLearningDomainCorpus(args.domain) : findTechnologyCorpus(args.technology);
if (!corpusSpec) throw new Error("Choose a valid corpus with --technology=<id> or --domain=<id>.");
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service role is required to review RAG sources.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: corpus, error: corpusError } = await admin
  .from("rag_corpora")
  .select("id,corpus_key,technology_id,domain_id,version,status,top_five_relevance,provenance_complete,cross_language_leakage_count")
  .eq("corpus_key", corpusSpec.corpusKey)
  .eq("version", corpusSpec.version)
  .single();
if (corpusError) throw corpusError;
const { data: documents, error: documentError } = await admin
  .from("rag_documents")
  .select("id,source_key,source_type,title,url,source_version,license,retrieved_at,metadata")
  .eq("corpus_id", corpus.id)
  .order("source_key");
if (documentError) throw documentError;

if (args.reject) {
  await rejectCapability();
} else if (args.approve || args.revoke) {
  const document = documents?.find((item) => item.source_key === args.source);
  if (!document) throw new Error("Choose an ingested source with --source=<source-key>.");
  if (args.revoke) {
    await revokeSource(document);
  } else {
    await approveSource(document);
  }
}

await printReview();

async function approveSource(document) {
  const { count: actualChunkCount, error: countError } = await admin
    .from("rag_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", document.id);
  if (countError) throw countError;
  if (actualChunkCount !== document.metadata?.chunkCount) throw new Error("Stored chunk count does not match the ingested provenance record; re-ingest before approval.");
  const validation = document.source_type === "stonecode-curriculum"
    ? validateAuthoredApproval({ document, reviewer: args.reviewer, confirmHash: args.confirmHash, license: args.license })
    : validateProvenanceApproval({ document, reviewer: args.reviewer, confirmHash: args.confirmHash, license: args.license, licenseUrl: args.licenseUrl });
  if (!validation.valid) throw new Error(validation.error);
  const now = new Date().toISOString();
  const metadata = {
    ...document.metadata,
    provenanceStatus: "approved",
    approvedAt: now,
    approvedBy: args.reviewer.trim().slice(0, 160),
    approvalNotes: args.notes?.trim().slice(0, 800) || null,
    licenseUrl: args.licenseUrl || document.metadata?.licenseUrl || null
  };
  const { error } = await admin.from("rag_documents").update({
    license: args.license.trim().slice(0, 240),
    metadata,
    updated_at: now
  }).eq("id", document.id);
  if (error) throw error;
  console.log(`approved ${document.source_key} at content hash ${document.metadata.contentHash}`);
  await refreshCorpusReviewState(document.id, true);
}

async function revokeSource(document) {
  const now = new Date().toISOString();
  const { error } = await admin.from("rag_documents").update({
    license: "pending-review",
    metadata: {
      ...document.metadata,
      provenanceStatus: "pending_review",
      approvalRevokedAt: now,
      approvalRevokedBy: args.reviewer?.trim().slice(0, 160) || "manual-review"
    },
    updated_at: now
  }).eq("id", document.id);
  if (error) throw error;
  const { error: corpusUpdateError } = await admin.from("rag_corpora").update({
    status: "disabled",
    provenance_complete: false,
    enabled_at: null
  }).eq("id", corpus.id);
  if (corpusUpdateError) throw corpusUpdateError;
  console.log(`revoked approval for ${document.source_key}`);
}

async function rejectCapability() {
  const reviewer = args.reviewer?.trim().slice(0, 160);
  if (!reviewer) throw new Error("A reviewer is required with --reviewer=<identity>.");
  if (!documents?.length) throw new Error("This corpus has no ingested sources to reject.");
  const now = new Date().toISOString();
  for (const document of documents) {
    const { error } = await admin.from("rag_documents").update({
      metadata: {
        ...document.metadata,
        provenanceStatus: "rejected",
        rejectedAt: now,
        rejectedBy: reviewer,
        rejectionNotes: args.notes?.trim().slice(0, 800) || "Excluded from the production launch roster by product owner."
      },
      updated_at: now
    }).eq("id", document.id);
    if (error) throw error;
  }
  const { error: corpusError } = await admin.from("rag_corpora").update({
    status: "disabled",
    provenance_complete: false,
    enabled_at: null
  }).eq("id", corpus.id);
  if (corpusError) throw corpusError;

  const manifestTable = corpus.domain_id ? "learning_domain_manifests" : "technology_manifests";
  const manifestColumn = corpus.domain_id ? "domain_id" : "technology_id";
  const capabilityId = corpus.domain_id ?? corpus.technology_id;
  const { data: manifest, error: manifestReadError } = await admin
    .from(manifestTable)
    .select("metadata")
    .eq(manifestColumn, capabilityId)
    .single();
  if (manifestReadError) throw manifestReadError;
  const { error: manifestError } = await admin.from(manifestTable).update({
    enabled: false,
    metadata: {
      ...(manifest?.metadata ?? {}),
      launchStatus: "rejected",
      launchReviewedAt: now,
      launchReviewedBy: reviewer
    },
    updated_at: now
  }).eq(manifestColumn, capabilityId);
  if (manifestError) throw manifestError;
  console.log(`rejected ${capabilityId} for production launch (${documents.length} source${documents.length === 1 ? "" : "s"})`);
}

async function refreshCorpusReviewState(updatedDocumentId, approved) {
  const current = (documents ?? []).map((document) => document.id === updatedDocumentId
    ? { ...document, metadata: { ...document.metadata, provenanceStatus: approved ? "approved" : "pending_review" } }
    : document);
  const allApproved = current.length > 0 && current.every((document) => document.metadata?.provenanceStatus === "approved");
  const { error } = await admin.from("rag_corpora").update({
    status: allApproved ? "evaluating" : "draft",
    provenance_complete: allApproved,
    enabled_at: null
  }).eq("id", corpus.id);
  if (error) throw error;
}

async function printReview() {
  const { data: freshCorpus, error: freshCorpusError } = await admin
    .from("rag_corpora")
    .select("id,corpus_key,technology_id,domain_id,version,status,top_five_relevance,provenance_complete,cross_language_leakage_count")
    .eq("id", corpus.id)
    .single();
  if (freshCorpusError) throw freshCorpusError;
  const { data: freshDocuments, error } = await admin
    .from("rag_documents")
    .select("id,source_key,source_type,title,url,source_version,license,retrieved_at,metadata")
    .eq("corpus_id", corpus.id)
    .order("source_key");
  if (error) throw error;
  console.log(JSON.stringify({
    corpus: {
      capability: freshCorpus.technology_id ?? freshCorpus.domain_id,
      version: freshCorpus.version,
      status: freshCorpus.status,
      relevance: freshCorpus.top_five_relevance,
      provenanceComplete: freshCorpus.provenance_complete,
      leakage: freshCorpus.cross_language_leakage_count
    },
    sources: await Promise.all((freshDocuments ?? []).map(async (document) => {
      const { count } = await admin.from("rag_chunks").select("id", { count: "exact", head: true }).eq("document_id", document.id);
      const { data: previews } = await admin.from("rag_chunks").select("chunk_key,title,content").eq("document_id", document.id).order("chunk_key").limit(3);
      return {
        sourceKey: document.source_key,
        title: document.title,
        url: document.url,
        sourceVersion: document.source_version,
        license: document.license,
        retrievedAt: document.retrieved_at,
        provenanceStatus: document.metadata?.provenanceStatus ?? "unknown",
        contentHash: document.metadata?.contentHash ?? null,
        pageUrls: document.metadata?.pageUrls ?? [],
        chunkCount: count ?? 0,
        previews: (previews ?? []).map((chunk) => ({
          key: chunk.chunk_key,
          title: chunk.title,
          excerpt: String(chunk.content ?? "").replace(/\s+/g, " ").slice(0, 300)
        }))
      };
    }))
  }, null, 2));
}

function parseArguments(values) {
  const valueFor = (name) => values.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
  return {
    technology: valueFor("--technology"),
    domain: valueFor("--domain"),
    source: valueFor("--source"),
    reviewer: valueFor("--reviewer"),
    confirmHash: valueFor("--confirm-hash"),
    license: valueFor("--license"),
    licenseUrl: valueFor("--license-url"),
    notes: valueFor("--notes"),
    approve: values.includes("--approve"),
    revoke: values.includes("--revoke"),
    reject: values.includes("--reject")
  };
}

function validateAuthoredApproval({ document, reviewer, confirmHash, license }) {
  const metadata = document?.metadata ?? {};
  const actualHash = String(metadata.contentHash ?? "");
  if (!document?.id || !document?.source_version) return { valid: false, error: "Authored source metadata is incomplete." };
  if (!actualHash || actualHash.length !== 64) return { valid: false, error: "Authored source content hash is missing." };
  if (!String(reviewer ?? "").trim()) return { valid: false, error: "Reviewer identity is required." };
  if (!String(license ?? "").trim() || String(license).trim() === "pending-review") return { valid: false, error: "A reviewed license is required." };
  if (String(confirmHash ?? "").trim().toLowerCase() !== actualHash.toLowerCase()) return { valid: false, error: "Content hash confirmation does not match." };
  if (!Number.isInteger(metadata.chunkCount) || metadata.chunkCount < 1) return { valid: false, error: "Source has no ingested chunks." };
  return { valid: true };
}

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
