# RAG Ingestion And Approval

Stonecode has one isolated, versioned corpus for each of 22 technologies and four non-programming learning domains. Official HTML documentation is fetched server-side, bounded, chunked, embedded, and stored with a content hash. Stonecode-authored domain material is hashed and embedded through the same approval boundary. Ingestion never approves a source.

## Current State

All 22 language corpora are ingested, approved, and score `1.00` with zero cross-language leakage. Twenty-one runtime-backed manifests are enabled; Julia is `approved_pending_runtime` and hidden. BASIC now uses the FreeBASIC manual that matches the configured Judge0 runtime. The four domain corpora remain unapproved. Dev.java is recorded under Oracle's reference-use terms and still requires release legal clearance or replacement before deployment.

## Review One Technology

```bash
npm run review:rag -- --technology=python
```

Review every printed field:

1. Open every `url` and `pageUrls` entry.
2. Confirm it is the intended official documentation.
3. Confirm the retrieved version and full `contentHash`.
4. Spot-check the three chunk excerpts and reported chunk count.
5. Review the documentation license/terms and record a precise label and URL.

## Approve One Source

Use the exact source key and full hash printed by the review command:

```bash
npm run review:rag -- \
  --technology=python \
  --approve \
  --source=python:official-foundations:v1 \
  --reviewer=owner@example.com \
  --confirm-hash=FULL_64_CHARACTER_HASH \
  --license=REVIEWED_LICENSE_OR_TERMS_LABEL \
  --license-url=https://official.example/license \
  --notes="Reviewed official documentation scope and reuse terms."
```

Approval fails if the hash or stored chunk count changed. Re-ingestion invalidates approval whenever official content changes.

## Evaluate And Enable

After every source for a technology is approved:

```bash
npm run evaluate:rag -- --technology=python
```

The evaluator enables the corpus only when all gates pass:

- top-five retrieval relevance is at least 90%;
- provenance is complete;
- cross-language leakage is zero.

Corpus approval does not enable a learner capability. After evaluation, use the guarded manifest command with the exact corpus key:

```bash
npm run approve:learning-capability -- --technology=ruby --approve --reviewer=owner --confirm-corpus-key=language:ruby:v1
```

For Julia only, after its corpus passes but Judge0 still lacks it:

```bash
npm run approve:learning-capability -- --technology=julia --approve-pending-runtime --reviewer=owner --confirm-corpus-key=language:julia:v1
```

Repeat review, approval, and evaluation for each technology ID:

```txt
javascript typescript python ruby php java csharp cpp c go rust swift kotlin dart sql r julia fortran cobol basic html css
```

## Re-ingest Safely

Preview without database or embedding writes:

```bash
npm run ingest:rag -- --technology=python --dry-run --max-pages=12
```

Write a reviewed technology draft:

```bash
npm run ingest:rag -- --technology=python --max-pages=12
```

Every source is reset to pending review if its content hash changed. Use `--all` only when intentionally refreshing every corpus. Never use `--ignore-robots` for production ingestion without documented source-owner permission.

## Revoke

```bash
npm run review:rag -- \
  --technology=python \
  --revoke \
  --source=python:official-foundations:v1 \
  --reviewer=owner@example.com
```

Revocation immediately disables the corpus.

## Reject From Launch

Use this only after the product owner explicitly decides a technology will not ship. It marks every source rejected, disables the corpus, and disables its technology manifest:

```bash
npm run review:rag -- \
  --technology=ruby \
  --reject \
  --reviewer=product-owner \
  --notes="Excluded from the initial production launch."
```

Rejected technology data remains stored for a future review; it is not visible or usable by learners.

## Learning Domains

After explicit migration approval, prepare one domain or all four:

```bash
npm run seed:rag-domains -- --domain=internet_web --dry-run
npm run seed:rag-domains -- --domain=internet_web
npm run review:rag -- --domain=internet_web
npm run evaluate:rag -- --domain=internet_web
npm run approve:learning-capability -- --domain=internet_web --approve --reviewer=owner --confirm-corpus-key=domain:internet-web:v1
```

Domain IDs are `computer_fundamentals`, `internet_web`, `algorithms_data_structures`, and `math_for_programmers`. MDN content records CC BY-SA attribution; OpenDSA records MIT attribution. Math uses Stonecode-authored chunks with the exact OpenStax College Algebra 2e and Introductory Statistics 2013 PDFs recorded as bibliographic references. Those PDFs are not ingested automatically; their embedded CC BY 4.0 license and current source terms still require legal review.

Never update `enabled` directly. Review source URL/reference, exact hash, stored chunk count, license, attribution, retrieval relevance, and both language/domain leakage first.
