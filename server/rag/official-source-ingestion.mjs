import { createHash } from "node:crypto";

const defaultUserAgent = "StonecodeRAGIngestion/1.0";
const defaultPageLimit = 3_000_000;
const defaultChunkLimit = 4_200;
const ignoredExtensions = /\.(?:avif|bmp|css|csv|docx?|eot|gif|gz|ico|jpe?g|json|map|mp3|mp4|odp|ods|odt|pdf|png|pptx?|rss|svg|tar|tgz|tsv|txt|webm|webp|woff2?|xlsx?|xml|zip)$/i;
const boilerplate = /^(?:skip to (?:main )?content|table of contents|on this page|previous|next|edit this page|report a problem|back to top|menu|search|sign in|log in|copyright|privacy|terms)$/i;

export async function collectOfficialSource({
  technologyId,
  source,
  maxPages = 4,
  fetchImpl = fetch,
  respectRobots = true,
  maxPageBytes = defaultPageLimit,
  userAgent = defaultUserAgent
}) {
  const root = validateOfficialSourceUrl(source?.url);
  const pageLimit = boundedInteger(maxPages, 1, 20, 4);
  const seeds = [root, ...(source?.seedUrls ?? []).map(validateOfficialSourceUrl)];
  if (seeds.some((seed) => seed.origin !== root.origin)) {
    throw ingestionError("rag_source_seed_origin_blocked", "Every reviewed seed URL must use the official source origin.");
  }
  const scopes = seeds.map((seed) => ({ root: seed, scopePath: sourceScopePath(seed) }));
  const robots = respectRobots ? await readRobots(root, { fetchImpl, userAgent }) : "";
  const blockedSeed = robots && seeds.find((seed) => !isRobotsAllowed(robots, seed.pathname, userAgent));
  if (blockedSeed) {
    throw ingestionError("rag_source_robots_disallowed", `robots.txt disallows ingestion of ${blockedSeed.pathname}.`);
  }

  const queue = [...new Set(seeds.map((seed) => seed.href))];
  const queued = new Set(queue);
  const pages = [];
  const warnings = [];
  while (queue.length && pages.length < pageLimit) {
    const requestedUrl = queue.shift();
    const requested = new URL(requestedUrl);
    if (robots && !isRobotsAllowed(robots, requested.pathname, userAgent)) continue;
    let fetched;
    try {
      fetched = await fetchOfficialPage(requested.href, {
        allowedOrigin: root.origin,
        fetchImpl,
        maxPageBytes,
        userAgent
      });
    } catch (error) {
      if (requested.href === root.href) throw error;
      warnings.push({ url: requested.href, code: error?.code ?? "rag_source_fetch_failed", message: String(error?.message ?? error).slice(0, 300) });
      continue;
    }
    const extracted = fetched.contentType.includes("text/plain")
      ? extractOfficialText(fetched.html, fetched.url)
      : extractOfficialHtml(fetched.html, fetched.url);
    if (extracted.blocks.length < 2 || extracted.text.length < 120) continue;
    pages.push({
      url: fetched.url,
      title: extracted.title || source.title,
      blocks: extracted.blocks,
      text: extracted.text,
      etag: fetched.etag,
    lastModified: fetched.lastModified
    });
    for (const link of extracted.links) {
      if (queued.has(link)) continue;
      const candidate = new URL(link);
      if (!scopes.some((scope) => isAllowedCrawlUrl(candidate, scope.root, scope.scopePath))) continue;
      queued.add(link);
      queue.push(link);
    }
  }

  if (!pages.length) throw ingestionError("rag_source_empty", `No readable official documentation was found at ${root.href}.`);
  const contentHash = sha256(pages.map((page) => `${page.url}\n${page.text}`).join("\n\n"));
  const chunks = chunkOfficialPages({ technologyId, pages, contentHash });
  if (chunks.length < 3) throw ingestionError("rag_source_insufficient", `Only ${chunks.length} usable chunks were extracted from ${root.href}; increase page coverage or choose a better reviewed source.`);
  return {
    sourceKey: source.key,
    sourceUrl: root.href,
    sourceTitle: source.title,
    contentHash,
    sourceVersion: resolveSourceVersion(source, pages, contentHash),
    retrievedAt: new Date().toISOString(),
    pageUrls: pages.map((page) => page.url),
    pages,
    chunks,
    warnings
  };
}

export async function fetchOfficialPage(url, {
  allowedOrigin,
  fetchImpl = fetch,
  maxPageBytes = defaultPageLimit,
  userAgent = defaultUserAgent
} = {}) {
  const requested = validateOfficialSourceUrl(url);
  const response = await fetchImpl(requested.href, {
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
      "User-Agent": userAgent
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response?.ok) throw ingestionError("rag_source_fetch_failed", `Official source returned HTTP ${response?.status ?? "unknown"}.`);
  const finalUrl = validateOfficialSourceUrl(response.url || requested.href);
  if (allowedOrigin && finalUrl.origin !== allowedOrigin) {
    throw ingestionError("rag_source_redirect_blocked", `Official source redirected outside its approved origin to ${finalUrl.origin}.`);
  }
  const contentType = String(response.headers?.get?.("content-type") ?? "").toLowerCase();
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
    throw ingestionError("rag_source_content_type_blocked", `Unsupported official-source content type: ${contentType}.`);
  }
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxPageBytes) {
    throw ingestionError("rag_source_too_large", `Official source exceeds the ${maxPageBytes} byte page limit.`);
  }
  const html = await readResponseText(response, maxPageBytes);
  return {
    url: finalUrl.href,
    html,
    contentType,
    etag: cleanHeader(response.headers?.get?.("etag")),
    lastModified: cleanHeader(response.headers?.get?.("last-modified"))
  };
}

export function extractOfficialHtml(htmlValue, pageUrl) {
  const html = String(htmlValue ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|canvas|nav|header|footer|form|noscript|dialog)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = normalizeText(titleMatch?.[1] ?? "");
  const blocks = [];
  const pattern = /<(h[1-4]|p|li|pre|dt|dd|th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const kind = match[1].toLowerCase();
    const text = normalizeText(match[2], kind === "pre");
    if (!text || boilerplate.test(text) || (!kind.startsWith("h") && text.length < 24)) continue;
    const previous = blocks.at(-1);
    if (previous?.text === text) continue;
    blocks.push({ kind: kind.startsWith("h") ? "heading" : kind === "pre" ? "code" : "text", text });
  }
  const links = extractOfficialLinks(html, pageUrl);
  return { title, blocks, links, text: blocks.map((block) => block.text).join("\n\n") };
}

export function extractOfficialText(textValue, pageUrl) {
  const lines = String(textValue ?? "").replace(/<!--[\s\S]*?-->/g, " ").split(/\r?\n/);
  const blocks = [];
  const links = new Set();
  let paragraph = [];
  let code = [];
  let inFence = false;
  const flushParagraph = () => {
    const text = normalizeText(paragraph.join(" "));
    if (text && text.length >= 24 && !boilerplate.test(text)) blocks.push({ kind: "text", text });
    paragraph = [];
  };
  const flushCode = () => {
    const text = normalizeText(code.join("\n"), true);
    if (text) blocks.push({ kind: "code", text });
    code = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^```/.test(line.trim())) {
      if (inFence) flushCode();
      else flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: normalizeText(heading[1].replace(/<[^>]+>/g, " ")) });
      continue;
    }
    for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      try {
        const url = new URL(match[1], pageUrl);
        url.hash = "";
        url.search = "";
        links.add(url.href);
      } catch {
        // Ignore malformed Markdown links.
      }
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (/^@(?:Metadata|Options|Comment|TechnologyRoot)\b/.test(line.trim())) continue;
    paragraph.push(line.replace(/^\s*(?:[-*+] |\d+[.)]\s+)/, ""));
  }
  if (inFence) flushCode();
  flushParagraph();
  const title = blocks.find((block) => block.kind === "heading")?.text ?? "Official documentation";
  return { title, blocks, links: [...links], text: blocks.map((block) => block.text).join("\n\n") };
}

export function extractOfficialLinks(htmlValue, pageUrl) {
  const base = validateOfficialSourceUrl(pageUrl);
  const links = new Set();
  const pattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  let match;
  while ((match = pattern.exec(String(htmlValue ?? "")))) {
    const href = decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const url = new URL(href, base);
      url.hash = "";
      url.search = "";
      links.add(url.href);
    } catch {
      // Ignore malformed documentation links.
    }
  }
  return [...links];
}

export function chunkOfficialPages({ technologyId, pages, contentHash, maxChars = defaultChunkLimit }) {
  const chunks = [];
  let ordinal = 0;
  for (const page of pages) {
    let heading = page.title || "Official documentation";
    let buffer = [];
    let length = 0;
    const flush = () => {
      const content = buffer.join("\n\n").trim();
      if (content.length < 160) {
        buffer = [];
        length = 0;
        return;
      }
      ordinal += 1;
      chunks.push({
        key: `${technologyId}:official:${contentHash.slice(0, 12)}:${ordinal}:v1`,
        title: heading.slice(0, 180),
        content,
        sourceUrl: page.url,
        metadata: { technologyId, pageUrl: page.url, pageTitle: page.title, heading, ordinal, contentHash }
      });
      buffer = [];
      length = 0;
    };
    for (const block of page.blocks) {
      if (block.kind === "heading") {
        if (length >= 900) flush();
        heading = block.text;
        continue;
      }
      for (const part of splitLongText(block.text, maxChars)) {
        if (length && length + part.length + 2 > maxChars) flush();
        buffer.push(part);
        length += part.length + 2;
      }
    }
    flush();
  }
  return chunks.slice(0, 160);
}

export function chooseExpectedChunkKeys(chunks, query, limit = 3) {
  const queryTerms = meaningfulTerms(query);
  return [...chunks]
    .map((chunk) => ({
      key: chunk.key,
      score: scoreRelevanceCandidate(chunk, queryTerms)
    }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.key);
}

export function validateProvenanceApproval({ document, reviewer, confirmHash, license, licenseUrl }) {
  const metadata = document?.metadata ?? {};
  const actualHash = String(metadata.contentHash ?? "");
  if (!document?.id || !document?.url || !document?.source_version) return { valid: false, error: "Source metadata is incomplete." };
  if (!actualHash || actualHash.length !== 64) return { valid: false, error: "Source content hash is missing." };
  if (!String(reviewer ?? "").trim()) return { valid: false, error: "Reviewer identity is required." };
  if (!String(license ?? "").trim() || String(license).trim() === "pending-review") return { valid: false, error: "A reviewed license or documentation-terms label is required." };
  if (!isHttpsUrl(licenseUrl)) return { valid: false, error: "An HTTPS license or documentation-terms URL is required." };
  if (String(confirmHash ?? "").trim().toLowerCase() !== actualHash.toLowerCase()) return { valid: false, error: "Content hash confirmation does not match." };
  if (!Number.isInteger(metadata.chunkCount) || metadata.chunkCount < 1) return { valid: false, error: "Source has no ingested chunks." };
  return { valid: true };
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value ?? "")).protocol === "https:";
  } catch {
    return false;
  }
}

export function isRobotsAllowed(robotsText, path, userAgent = defaultUserAgent) {
  const targetAgent = userAgent.split("/")[0].toLowerCase();
  const groups = [];
  let current = null;
  for (const rawLine of String(robotsText ?? "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      current = { agents: [value.toLowerCase()], rules: [] };
      groups.push(current);
    } else if (field === "disallow" || field === "allow") {
      if (current) current.rules.push({ type: field, path: value });
    }
  }
  const applicable = groups.filter((group) => group.agents.some((agent) => agent === "*" || targetAgent.includes(agent)));
  const rules = applicable.flatMap((group) => group.rules).filter((rule) => rule.path && String(path).startsWith(rule.path));
  if (!rules.length) return true;
  rules.sort((a, b) => b.path.length - a.path.length || (a.type === "allow" ? -1 : 1));
  return rules[0].type === "allow";
}

function validateOfficialSourceUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw ingestionError("rag_source_url_invalid", "Official source URL is invalid.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw ingestionError("rag_source_url_invalid", "Official source URLs must use HTTPS without embedded credentials.");
  }
  url.hash = "";
  return url;
}

function sourceScopePath(root) {
  if (root.pathname.endsWith("/")) return root.pathname;
  const leaf = root.pathname.split("/").at(-1) ?? "";
  if (!leaf.includes(".")) return `${root.pathname}/`;
  return root.pathname.slice(0, root.pathname.lastIndexOf("/") + 1) || "/";
}

function isAllowedCrawlUrl(candidate, root, scopePath) {
  return candidate.protocol === "https:"
    && candidate.origin === root.origin
    && candidate.pathname.startsWith(scopePath)
    && !ignoredExtensions.test(candidate.pathname)
    && !/(?:\/|^)(?:search|login|signin|signup|account|download)(?:\/|$)/i.test(candidate.pathname);
}

async function readRobots(root, { fetchImpl, userAgent }) {
  try {
    const response = await fetchImpl(`${root.origin}/robots.txt`, {
      headers: { Accept: "text/plain", "User-Agent": userAgent },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response?.ok) return "";
    return (await readResponseText(response, 250_000)).slice(0, 250_000);
  } catch {
    return "";
  }
}

async function readResponseText(response, limit) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > limit) throw ingestionError("rag_source_too_large", `Official source exceeds the ${limit} byte page limit.`);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => null);
      throw ingestionError("rag_source_too_large", `Official source exceeds the ${limit} byte page limit.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

function normalizeText(value, preserveLines = false) {
  const withBreaks = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withBreaks).replace(/\u00a0/g, " ");
  if (preserveLines) return decoded.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 24_000);
  return decoded.replace(/\s+/g, " ").trim().slice(0, 24_000);
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…" };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named[entity.toLowerCase()] ?? full;
  });
}

function splitLongText(text, limit) {
  if (text.length <= limit) return [text];
  const parts = [];
  let buffer = "";
  for (const sentence of text.split(/(?<=[.!?}])\s+/)) {
    if (buffer && buffer.length + sentence.length + 1 > limit) {
      parts.push(buffer);
      buffer = "";
    }
    if (sentence.length > limit) {
      for (let index = 0; index < sentence.length; index += limit) parts.push(sentence.slice(index, index + limit));
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer) parts.push(buffer);
  return parts;
}

function meaningfulTerms(value) {
  const stop = new Set(["about", "after", "also", "and", "beginner", "code", "cover", "for", "from", "into", "language", "learn", "plain", "program", "small", "standard", "teach", "that", "the", "their", "this", "using", "with"]);
  return new Set((String(value ?? "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [])
    .filter((term) => !stop.has(term))
    .map(stemTerm));
}

function scoreRelevanceCandidate(chunk, queryTerms) {
  const titleTerms = termCounts(chunk?.title);
  const contentTerms = termCounts(chunk?.content);
  let score = 0;
  for (const term of queryTerms) {
    const titleCount = titleTerms.get(term) ?? 0;
    const contentCount = contentTerms.get(term) ?? 0;
    if (titleCount) score += 6;
    if (contentCount) score += 2 + Math.min(2, Math.log2(contentCount + 1) / 2);
  }
  const title = String(chunk?.title ?? "").toLowerCase();
  if (/^(?:navigation|table of contents|index|introduction)$/.test(title.trim())) score -= 4;
  return score;
}

function termCounts(value) {
  const counts = new Map();
  for (const raw of String(value ?? "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []) {
    const term = stemTerm(raw);
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

function stemTerm(value) {
  let term = String(value ?? "").replace(/^[^a-z]+|[^a-z0-9+#.-]+$/g, "");
  if (term.length > 5 && term.endsWith("ies")) term = `${term.slice(0, -3)}y`;
  else if (term.length > 5 && term.endsWith("ing")) term = term.slice(0, -3);
  else if (term.length > 4 && term.endsWith("ed")) term = term.slice(0, -2);
  else if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss")) term = term.slice(0, -1);
  return term;
}

function resolveSourceVersion(source, pages, contentHash) {
  const validators = pages.map((page) => page.etag || page.lastModified).filter(Boolean);
  if (validators.length) return validators.join("|").slice(0, 240);
  const configured = String(source?.sourceVersion ?? "").trim();
  if (configured && !/^accessed-version|pending|unversioned/i.test(configured)) return configured.slice(0, 240);
  return `sha256:${contentHash.slice(0, 24)}`;
}

function cleanHeader(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null;
}

function boundedInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, minimum), maximum);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function ingestionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
