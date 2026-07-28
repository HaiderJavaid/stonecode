# Judge0 Execution Setup

Stonecode uses Judge0 through a provider-neutral server adapter. The browser never receives Judge0 credentials, language ids, expected solutions, or hidden grading data.

## Provision

For paid-beta use, provision a managed Judge0 Cloud instance or a dedicated self-hosted instance separate from the Stonecode application server.

Do not use a public unauthenticated execution endpoint for production learner code.

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
JUDGE0_RAPIDAPI_HOST=your-host-value
```

Restart the Stonecode server after changing environment values.

## Runtime Activation

Judge0 runtime ids differ between installations. Stonecode loads `/languages` from the configured instance and resolves ids by runtime name.

Enable runtimes in this order:

1. JavaScript, TypeScript, Python.
2. Java, C#, C++.
3. Go, Rust.
4. Kotlin, Swift, Dart.
5. PHP, Ruby, SQL, R, Julia.
6. Fortran, COBOL, BASIC.

If a runtime is missing, Stonecode returns `execution_language_unavailable` instead of silently grading without execution.

## API

Authenticated endpoints:

```txt
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
- HTML/CSS remain Visual-preview content.
- Judge0 must run outside the Stonecode application host with no Stonecode or Supabase secrets.

For multi-instance production deployment, move rate limiting from process memory to Redis or another shared store.

## Verification

```bash
npm run verify:execution-sandbox
npm run typecheck
npm run build
```

Then perform authenticated QA:

1. Open a generated Python workshop.
2. Press Run and confirm stdout appears in the terminal.
3. Introduce a syntax error and confirm compile feedback appears.
4. Restore valid code but produce wrong output and confirm submission stays blocked.
5. Make the requested micro-edit and confirm sandbox grading unlocks the next step.
