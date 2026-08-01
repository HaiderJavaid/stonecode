import assert from "node:assert/strict";
import {
  chooseExpectedChunkKeys,
  chunkOfficialPages,
  collectOfficialSource,
  extractOfficialHtml,
  extractOfficialText,
  fetchOfficialPage,
  isRobotsAllowed,
  validateProvenanceApproval
} from "../server/rag/official-source-ingestion.mjs";

const extracted = extractOfficialHtml(`
  <html><head><title>Python Tutorial</title><style>.bad{}</style></head>
  <body><nav>Search Sign in</nav><main>
    <h1>Functions</h1>
    <p>Functions group reusable behavior and can receive values through parameters.</p>
    <pre>def greet(name):\n    return "Hello " + name</pre>
    <script>stealSecrets()</script>
    <a href="./control-flow.html#loops">Control flow</a>
  </main></body></html>
`, "https://docs.example.test/tutorial/");
assert.equal(extracted.title, "Python Tutorial");
assert.ok(extracted.text.includes("Functions group reusable behavior"));
assert.ok(extracted.text.includes("def greet(name)"));
assert.ok(!extracted.text.includes("stealSecrets") && !extracted.text.includes("Search Sign in"));
assert.deepEqual(extracted.links, ["https://docs.example.test/tutorial/control-flow.html"]);

const extractedMarkdown = extractOfficialText(`# The Basics

Values and variables hold information that a program can reuse while it runs.

\`\`\`swift
let answer = 42
print(answer)
\`\`\`

[More values](./values.md)
`, "https://raw.example.test/book/basics.md");
assert.equal(extractedMarkdown.title, "The Basics");
assert.ok(extractedMarkdown.text.includes("let answer = 42"));
assert.deepEqual(extractedMarkdown.links, ["https://raw.example.test/book/values.md"]);

const chunks = chunkOfficialPages({
  technologyId: "python",
  contentHash: "a".repeat(64),
  maxChars: 260,
  pages: [{
    title: "Python Tutorial",
    url: "https://docs.example.test/tutorial/",
    blocks: [
      { kind: "heading", text: "Functions" },
      { kind: "text", text: "Functions receive parameters and return values. ".repeat(8) },
      { kind: "heading", text: "Loops" },
      { kind: "text", text: "For loops iterate over collections while conditions control repetition. ".repeat(8) }
    ]
  }]
});
assert.ok(chunks.length >= 2);
assert.ok(chunks.every((chunk) => chunk.content.length <= 260 && chunk.key.startsWith("python:official:")));
assert.ok(chooseExpectedChunkKeys(chunks, "Teach Python functions with parameters and return values", 1)[0]);
assert.equal(chooseExpectedChunkKeys([
  { key: "guide:index", title: "Introduction", content: "COBOL program guide and standard records. ".repeat(20) },
  { key: "guide:accept", title: "ACCEPT FROM CONSOLE", content: "ACCEPT reads console input and DISPLAY prints a result." }
], "Build a standard COBOL console program with DISPLAY and ACCEPT", 1)[0], "guide:accept");

assert.equal(isRobotsAllowed("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/secret"), false);
assert.equal(isRobotsAllowed("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/public/page"), true);

const validDocument = {
  id: "document-id",
  url: "https://docs.example.test/tutorial/",
  source_version: "etag:v1",
  metadata: { contentHash: "b".repeat(64), chunkCount: 12 }
};
assert.deepEqual(validateProvenanceApproval({
  document: validDocument,
  reviewer: "owner@example.test",
  confirmHash: "b".repeat(64),
  license: "official-documentation-terms-reviewed",
  licenseUrl: "https://docs.example.test/license"
}), { valid: true });
assert.equal(validateProvenanceApproval({
  document: validDocument,
  reviewer: "owner@example.test",
  confirmHash: "wrong",
  license: "official-documentation-terms-reviewed",
  licenseUrl: "https://docs.example.test/license"
}).valid, false);
assert.equal(validateProvenanceApproval({
  document: validDocument,
  reviewer: "owner@example.test",
  confirmHash: "b".repeat(64),
  license: "official-documentation-terms-reviewed"
}).valid, false);

await assert.rejects(
  () => fetchOfficialPage("http://docs.example.test/tutorial/", { fetchImpl: async () => null }),
  /must use HTTPS/
);
await assert.rejects(
  () => fetchOfficialPage("https://docs.example.test/tutorial/", {
    allowedOrigin: "https://docs.example.test",
    fetchImpl: async () => response({ url: "https://evil.example.test/copied", body: "<p>redirected content is blocked</p>" })
  }),
  /redirected outside/
);
await assert.rejects(
  () => fetchOfficialPage("https://docs.example.test/tutorial/file.pdf", {
    fetchImpl: async () => response({ url: "https://docs.example.test/tutorial/file.pdf", body: "%PDF", contentType: "application/pdf" })
  }),
  /Unsupported official-source content type/
);

const pages = new Map([
  ["https://docs.example.test/tutorial/", `
    <title>Example Guide</title><h1>Values</h1>
    <p>Values represent information that a program stores and transforms while it runs.</p>
    <p>Variables give those values readable names so later statements can reuse them safely.</p>
    <a href="functions.html">Functions</a><a href="https://evil.example.test/offsite">Offsite</a>
  `],
  ["https://docs.example.test/tutorial/functions.html", `
    <title>Functions</title><h1>Functions</h1>
    <p>Functions collect reusable statements and accept parameters provided by the caller.</p>
    <p>A return value sends the computed result back to the expression that called the function.</p>
  `],
  ["https://docs.example.test/tutorial/loops.html", `
    <title>Loops</title><h1>Loops</h1>
    <p>Loops repeat a block of statements while a condition or collection supplies more work.</p>
    <p>Each iteration should make visible progress toward the condition that ends repetition.</p>
  `]
]);
const collected = await collectOfficialSource({
  technologyId: "python",
  source: {
    key: "python:test",
    title: "Example Guide",
    url: "https://docs.example.test/tutorial/",
    seedUrls: ["https://docs.example.test/tutorial/loops.html"],
    sourceVersion: "v1"
  },
  maxPages: 3,
  respectRobots: false,
  fetchImpl: async (url) => response({ url, body: pages.get(url) ?? "", contentType: "text/html" })
});
assert.equal(collected.pages.length, 3);
assert.ok(collected.chunks.length >= 3);
assert.ok(collected.pageUrls.every((url) => url.startsWith("https://docs.example.test/tutorial/")));
assert.equal(collected.contentHash.length, 64);

await assert.rejects(
  () => collectOfficialSource({
    technologyId: "python",
    source: {
      key: "python:test",
      title: "Example Guide",
      url: "https://docs.example.test/tutorial/",
      seedUrls: ["https://evil.example.test/tutorial/"]
    },
    respectRobots: false,
    fetchImpl: async (url) => response({ url, body: pages.get(url) ?? "", contentType: "text/html" })
  }),
  /official source origin/
);

console.log("official RAG ingestion safety checks passed");

function response({ url, body, contentType = "text/html" }) {
  return {
    ok: true,
    status: 200,
    url,
    body: null,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    text: async () => body
  };
}
