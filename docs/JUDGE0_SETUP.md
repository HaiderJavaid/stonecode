# Judge0 Execution Setup

Stonecode uses Judge0 through a provider-neutral server adapter. The browser never receives Judge0 credentials, language ids, expected solutions, or hidden grading data.

## Provision

For paid-beta use, subscribe to the official Judge0 CE RapidAPI product, provision Judge0 Cloud, or use a dedicated self-hosted instance separate from the Stonecode application server.

Do not use a public unauthenticated execution endpoint for production learner code.

Judge0 is Stonecode's headless console compiler/runner and grader. It does not provide persistent terminal sessions, remote GUI windows, VNC/WebRTC desktops, native mobile emulators, or external game engines. Those remote-streamed execution modes are outside Stonecode scope.

Per-user daily caps and a global operator hard circuit breaker are implemented. Apply `2026-07-30-atomic-usage-and-operator-limits.sql` before production so those limits are atomic across instances. The current `wait=true` adapter still needs production concurrency validation and provider cost alerts.

## Environment

Add these values to the server environment:

```env
CODE_RUNNER_PROVIDER=judge0
JUDGE0_API_URL=https://your-judge0-host.example
JUDGE0_API_KEY=replace-me
JUDGE0_API_KEY_HEADER=X-Auth-Token

EXECUTION_TIMEOUT_MS=5000
EXECUTION_MEMORY_KB=131072
EXECUTION_OUTPUT_LIMIT=32000
EXECUTION_CODE_LIMIT=64000
EXECUTION_STDIN_LIMIT=8000
EXECUTION_RUNS_PER_MINUTE=20
```

For a RapidAPI-hosted instance, set the provider's required key header and host:

```env
JUDGE0_API_KEY_HEADER=X-RapidAPI-Key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
```

`JUDGE0_API_KEY` is the RapidAPI `X-RapidAPI-Key`. There is no separate Judge0 secret for this hosted product. The RapidAPI account must be subscribed to Judge0 CE; a valid-looking key without a subscription returns `You are not subscribed to this API.`

Restart the Stonecode server after changing environment values.

## Runtime Activation

Judge0 runtime ids differ between installations. Stonecode loads `/languages` from the configured instance and resolves ids by runtime name.

The expansion roster requires 18 Judge0 technologies. JavaScript, HTML, and CSS run in browser Output. Julia remains hidden because the configured provider does not report it. Every language still requires fresh source approval, a passing isolated corpus, a matching manifest, grading metadata, and runtime discovery before visibility.

Language matching is anchored and version-aware. R intentionally resolves to the reviewed Judge0 `R (4.0.0)` runtime; `R (4.4.1)` exceeds Stonecode's three-second CPU ceiling even for the starter smoke program. If the pinned runtime disappears, R becomes unavailable until another runtime passes certification.

Run `npm run verify:runtime-matrix` for the static 21-technology contract and `npm run verify:runtime-matrix:live` for all 18 real Judge0 smoke executions.

If a runtime is missing, Stonecode returns `execution_language_unavailable` instead of silently grading without execution.

## API

Authenticated endpoints:

```txt
GET  /api/runtime/capabilities
GET  /api/execution/capabilities
POST /api/execution/run
```

Manual Run request:

```json
{
  "filePath": "main.py",
  "language": "Python",
  "code": "print('hello')",
  "stdin": ""
}
```

Generated exercise grading resolves language, starter code, expected result code, and acceptance criteria from the server-persisted course. Client-submitted grading rules are ignored.

## Grading

For generated workshops, Stonecode:

1. Rejects unchanged starter code.
2. Runs learner code in Judge0.
3. Runs the generated `resultCode` as an oracle when available.
4. Compares normalized visible output.
5. Applies the server-side acceptance-criteria checker.
6. Returns deterministic feedback to the learner.

If the oracle does not compile or run, the exercise fails with `execution_oracle_invalid` and should be regenerated.

## Security Defaults

- All routes require Supabase authentication.
- Optional course ids are ownership checked.
- Code and stdin sizes are capped.
- CPU, wall time, memory, and output are capped.
- Runs are rate-limited per user in the Stonecode process.
- No shell command is accepted from the client.
- Only registered language capabilities can execute.
- HTML/CSS remain sandboxed browser Output content.
- Judge0 must run outside the Stonecode application host with no Stonecode or Supabase secrets.

For multi-instance production deployment, move rate limiting from process memory to Redis or another shared store.

## Verification

```bash
npm run verify:execution-sandbox
npm run check:production
npm run typecheck
npm run build
```

Then perform authenticated QA:

1. Open a generated Python workshop.
2. Press Run and confirm stdout appears in the terminal.
3. Introduce a syntax error and confirm compile feedback appears.
4. Restore valid code but produce wrong output and confirm submission stays blocked.
5. Make the requested micro-edit and confirm sandbox grading unlocks the next step.
