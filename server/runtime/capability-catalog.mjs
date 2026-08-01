import { browserFrameworkCatalog, learningDomainCatalog, technologyCatalog } from "../../shared/stonecode-product.mjs";
import { resolveExecutionConfig } from "../execution/index.mjs";
import { judge0LanguageAvailable, listJudge0Languages } from "../execution/language-map.mjs";

export async function buildRuntimeCapabilityCatalog({ admin = null, env = process.env, fetchImpl = fetch } = {}) {
  const executionConfig = resolveExecutionConfig(env);
  const judge0Languages = executionConfig.configured
    ? await listJudge0Languages(executionConfig, fetchImpl).catch(() => [])
    : [];
  const [ragStatus, manifestStatus, domainManifestStatus] = await Promise.all([
    loadRagStatuses(admin),
    loadTechnologyManifests(admin),
    loadLearningDomainManifests(admin)
  ]);
  const technologies = technologyCatalog.map((technology) => {
    const manifest = manifestStatus.get(technology.id);
    const manifestApproved = manifest?.enabled === true
      && manifest.editor_id === technology.editorId
      && manifest.default_file_path === technology.defaultFilePath
      && manifest.runtime_type === technology.runtime
      && manifest.rag_corpus_key === technology.ragCorpusKey;
    const editorAvailable = manifestApproved;
    const gradingAvailable = manifestApproved && manifest?.metadata?.grading === true;
    const runtimeAvailable = technology.runtime === "browser"
      ? manifestApproved
      : manifestApproved && executionConfig.configured && judge0LanguageAvailable(judge0Languages, technology.id);
    const corpus = ragStatus.get(technology.ragCorpusKey);
    const ragApproved = corpus?.status === "enabled"
      && Number(corpus.top_five_relevance ?? 0) >= 0.9
      && corpus.provenance_complete === true
      && Number(corpus.cross_language_leakage_count ?? 0) === 0;
    return {
      ...technology,
      manifestApproved,
      editorAvailable,
      gradingAvailable,
      runtimeAvailable,
      ragStatus: corpus?.status ?? "draft",
      ragApproved,
      available: editorAvailable && runtimeAvailable && gradingAvailable && ragApproved && !technology.hiddenUntilRuntime
    };
  });
  const availableTechnologyIds = new Set(technologies.filter((technology) => technology.available).map((technology) => technology.id));
  const domains = learningDomainCatalog.map((domain) => {
    if (domain.id === "programming") {
      return {
        ...domain,
        manifestApproved: true,
        ragStatus: "technology-scoped",
        ragApproved: availableTechnologyIds.size > 0,
        available: availableTechnologyIds.size > 0
      };
    }
    const manifest = domainManifestStatus.get(domain.id);
    const manifestApproved = manifest?.enabled === true
      && manifest.rag_corpus_key === domain.ragCorpusKey
      && sameStringSet(manifest.technology_required_for, domain.technologyRequiredFor);
    const corpus = ragStatus.get(domain.ragCorpusKey);
    const ragApproved = corpus?.status === "enabled"
      && Number(corpus.top_five_relevance ?? 0) >= 0.9
      && corpus.provenance_complete === true
      && Number(corpus.cross_language_leakage_count ?? 0) === 0;
    const requiredRuntimeAvailable = !domain.defaultTechnologyId || availableTechnologyIds.has(domain.defaultTechnologyId);
    return {
      ...domain,
      manifestApproved,
      ragStatus: corpus?.status ?? "draft",
      ragApproved,
      available: manifestApproved && ragApproved && requiredRuntimeAvailable
    };
  });
  return {
    version: "learning-capabilities/v2",
    provider: executionConfig.configured ? executionConfig.provider : "browser-only",
    browserFrameworks: browserFrameworkCatalog,
    technologies,
    domains
  };
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((value) => expected.has(value));
}

async function loadTechnologyManifests(admin) {
  const manifests = new Map();
  if (!admin) return manifests;
  const { data, error } = await admin
    .from("technology_manifests")
    .select("technology_id,editor_id,default_file_path,runtime_type,rag_corpus_key,enabled,metadata");
  if (error || !Array.isArray(data)) return manifests;
  for (const row of data) manifests.set(row.technology_id, row);
  return manifests;
}

async function loadLearningDomainManifests(admin) {
  const manifests = new Map();
  if (!admin) return manifests;
  const { data, error } = await admin
    .from("learning_domain_manifests")
    .select("domain_id,rag_corpus_key,technology_required_for,default_technology_id,enabled,metadata");
  if (error || !Array.isArray(data)) return manifests;
  for (const row of data) manifests.set(row.domain_id, row);
  return manifests;
}

async function loadRagStatuses(admin) {
  const statuses = new Map();
  if (!admin) return statuses;
  const { data, error } = await admin
    .from("rag_corpora")
    .select("corpus_key,status,top_five_relevance,provenance_complete,cross_language_leakage_count")
    .order("version", { ascending: false });
  if (error || !Array.isArray(data)) return statuses;
  for (const row of data) {
    if (!statuses.has(row.corpus_key)) statuses.set(row.corpus_key, row);
  }
  return statuses;
}
