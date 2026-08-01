import { learningDomainCatalog } from "../../shared/stonecode-product.mjs";

const domainSpecs = [
  spec("computer_fundamentals", [
    authoredSource("computer-fundamentals:stonecode:v1", "Stonecode Computer & IT Fundamentals", [
      area("hardware", "Computer hardware and data flow", "Teach how processors, memory, storage, input, output, and peripherals cooperate, distinguishing temporary memory from persistent storage."),
      area("operating-systems", "Operating systems and processes", "Teach how an operating system manages programs, processes, files, users, permissions, devices, updates, and resource limits."),
      area("files-storage", "Files, folders, formats, and backups", "Teach paths, extensions, formats, local versus cloud storage, backup copies, synchronization, and safe file organization."),
      area("security", "Practical security fundamentals", "Teach authentication, authorization, updates, least privilege, phishing awareness, encryption basics, and recoverable backups."),
      area("troubleshooting", "Evidence-led troubleshooting", "Teach learners to reproduce a problem, isolate one variable, read messages, check connections and resources, test a hypothesis, and record the resolution.")
    ], [reference("NIST Computer Security Resource Center glossary", "https://csrc.nist.gov/glossary", "United States government primary reference; terms require reviewer confirmation before approval.")])
  ]),
  spec("internet_web", [
    officialSource(
      "internet-web:mdn-web-foundations:v1",
      "MDN Web Docs — How the web works",
      "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works",
      "CC-BY-SA-2.5-or-later",
      "https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license"
    )
  ]),
  spec("algorithms_data_structures", [
    officialSource(
      "algorithms-data-structures:opendsa:v1",
      "OpenDSA — CS3 Data Structures & Algorithms",
      "https://opendsa-server.cs.vt.edu/OpenDSA/Books/CS3/html/index.html",
      "MIT",
      "https://opendsa-server.cs.vt.edu/ODSA/lib/license.html"
    )
  ]),
  spec("math_for_programmers", [
    authoredSource("math-for-programmers:stonecode:v1", "Stonecode Math for Programmers", [
      area("algebra", "Algebra as code relationships", "Teach variables, expressions, equations, inequalities, ratios, exponents, and rearranging formulas, then connect each relationship to runnable calculations."),
      area("functions", "Functions, domains, and graphs", "Teach inputs, outputs, domain, range, linear and nonlinear functions, rates of change, and reading a graph before translating the idea into a function."),
      area("discrete", "Discrete reasoning", "Teach sets, logic, counting, sequences, recurrence, and invariants with finite examples that support algorithms and program reasoning."),
      area("probability", "Probability for programs", "Teach events, conditional probability, independence, expected value, simulation, and the difference between theoretical and observed results."),
      area("statistics", "Statistics for data", "Teach populations, samples, variables, distributions, center, spread, correlation, and uncertainty without presenting correlation as causation.")
    ], [
      reference("OpenStax College Algebra 2e PDF (2021, digital ISBN 978-1-951693-41-1)", "https://assets.openstax.org/oscms-prodcms/media/documents/College-Algebra-2e-WEB.pdf", "Exact PDF embeds CC BY 4.0; use as a bibliographic reference only until legal/source-hash approval."),
      reference("OpenStax Introductory Statistics PDF (2013 edition)", "https://assets.openstax.org/oscms-prodcms/media/documents/IntroductoryStatistics-OP.pdf", "Exact PDF embeds CC BY 4.0; use as a bibliographic reference only until legal/source-hash approval.")
    ])
  ])
];

export const learningDomainCorpora = Object.freeze(domainSpecs.map(buildCorpus));

export function findLearningDomainCorpus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return learningDomainCorpora.find((corpus) => corpus.domainId === normalized || corpus.displayName.toLowerCase() === normalized) ?? null;
}

export function validateLearningDomainCorpora(corpora = learningDomainCorpora) {
  const expectedIds = new Set(learningDomainCatalog.filter((domain) => domain.ragCorpusKey).map((domain) => domain.id));
  const corpusIds = new Set(corpora.map((corpus) => corpus.domainId));
  const errors = [];
  for (const id of expectedIds) if (!corpusIds.has(id)) errors.push(`Missing domain corpus for ${id}.`);
  for (const corpus of corpora) {
    if (!expectedIds.has(corpus.domainId)) errors.push(`Unknown domain corpus ${corpus.domainId}.`);
    if (!corpus.sources.length) errors.push(`Missing sources for ${corpus.domainId}.`);
    if (corpus.sources.some((source) => !source.key || !source.title || !source.license || !source.licenseUrl && source.ingestionMode === "official_html")) errors.push(`Incomplete provenance for ${corpus.domainId}.`);
    if (corpus.evaluationFixtures.length < 3) errors.push(`Insufficient evaluation fixtures for ${corpus.domainId}.`);
  }
  return { valid: errors.length === 0, errors };
}

function spec(domainId, sources) {
  return { domainId, sources };
}

function buildCorpus(input) {
  const domain = learningDomainCatalog.find((candidate) => candidate.id === input.domainId);
  if (!domain?.ragCorpusKey) throw new Error(`Unknown learning domain corpus: ${input.domainId}`);
  const chunks = input.sources.flatMap((source) => source.chunks ?? []).map((chunk, index) => ({
    ...chunk,
    key: `${input.domainId}:${chunk.key}:v1`,
    domainId: input.domainId,
    sourceKey: chunk.sourceKey,
    metadata: { level: "beginner", sequence: index + 1, reviewed: false }
  }));
  const otherDomains = learningDomainCatalog.filter((candidate) => candidate.ragCorpusKey && candidate.id !== input.domainId).map((candidate) => candidate.id);
  const focusAreas = domain.focusAreas.length ? domain.focusAreas : [domain.displayName];
  return Object.freeze({
    corpusKey: domain.ragCorpusKey,
    domainId: domain.id,
    displayName: domain.displayName,
    version: 1,
    status: "draft",
    sources: Object.freeze(input.sources),
    chunks: Object.freeze(chunks),
    evaluationFixtures: Object.freeze(focusAreas.slice(0, 5).map((focus, index) => ({
      key: `${domain.id}:retrieval:${index + 1}:v1`,
      query: `Teach a beginner ${focus} as part of ${domain.displayName}.`,
      expectedChunkKeys: chunks.length ? [chunks[index % chunks.length].key] : [],
      forbiddenDomainIds: otherDomains
    })))
  });
}

function officialSource(key, title, url, license, licenseUrl) {
  return Object.freeze({ key, title, url, license, licenseUrl, sourceVersion: "retrieved-content-hash", provenanceStatus: "pending_review", ingestionMode: "official_html", chunks: [] });
}

function authoredSource(key, title, areas, references = []) {
  return Object.freeze({
    key,
    title,
    url: null,
    license: "Stonecode-authored-proprietary",
    licenseUrl: null,
    sourceVersion: "v1",
    provenanceStatus: "pending_review",
    ingestionMode: "stonecode_authored",
    references: Object.freeze(references),
    chunks: Object.freeze(areas.map((item) => ({ ...item, sourceKey: key })))
  });
}

function area(key, title, content) {
  return Object.freeze({ key, title, content });
}

function reference(title, url, note) {
  return Object.freeze({ title, url, note, ingestionMode: "reference_only" });
}
