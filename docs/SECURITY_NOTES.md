# Security Notes

## Dependency Exception Awaiting Upstream Release

- Tracking ID: `SC-SEC-2026-07-29-01`
- Package: `react-router` through `react-router-dom@7.18.2`
- Advisory: `GHSA-qwww-vcr4-c8h2`
- Registry state on 2026-07-29: patched `8.3.0` is named by the advisory but is not available from npm.
- Resolution review: `7.11.0` was tested and rejected because npm reports a broader set of client/SSR redirect, XSS, DoS, and deserialization advisories through `7.17.0`. Stonecode remains exactly pinned to `7.18.2`, which narrows the unresolved finding to the non-applicable RSC advisory.
- Applicability: the advisory affects unstable React Server Components APIs. Stonecode uses the client-only declarative `BrowserRouter` and has no React Router RSC packages, RSC actions, or RSC request handlers, so the exploit precondition is absent.
- Action: upgrade when a patched stable release is published; re-run `npm audit`; re-review immediately if Stonecode adopts React Router framework/RSC APIs.
- Required before production: product/security owner signs off this temporary exception.

Vite, PostCSS, ESLint, minimatch, and brace-expansion advisories found during the 2026-07-29 audit were removed by upgrading to supported Vite 7, PostCSS 8.5.24, and ESLint 10.

## Release security controls

- API responses carry request IDs; JSON errors expose only the trace ID and safe error message.
- Netlify serves HSTS, CSP, clickjacking, MIME-sniffing, referrer, and browser-permission headers.
- Server error webhooks contain route/method/trace/timestamp and omit authorization headers, request bodies, prompts, and credentials.
- Account deletion cancels an active Stripe subscription before deleting authentication and cascading user data; failure to cancel or remove private visual assets blocks deletion.
- Account export is authenticated and excludes server credentials. Stripe may retain legally required transaction records.
- Production still requires owner sign-off on the React Router exception, real provider alert routing, external legal review, and post-deploy attack/rate/load testing.
