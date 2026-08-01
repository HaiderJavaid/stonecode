# Browser And Managed Sandbox Execution Plan

> Superseded on 2026-07-29 by `docs/DECISIONS.md` and `docs/project-architecture.md`. Stonecode now exposes only Code, Output, and Terminal; no Visual/Whiteboard surface, deterministic native-GUI preview, Pyodide/Pygbag, or unapproved engine fallback is part of the active product.

## Goal

Give Stonecode a real IDE-style Run experience for supported console, web, and lightweight visual programming without operating remote streamed desktops or expensive per-user GUI machines.

## Approved Product Boundary

Stonecode will support:

- HTML, CSS, JavaScript, TypeScript, React, and selected browser frameworks through an isolated browser bundler and real Visual iframe.
- Registered high-level and systems-language console programs through the existing provider-neutral Judge0 boundary.
- Plain Python in a browser worker where the requested packages are WebAssembly-compatible.
- Pygame through a real Pygbag/pygame-ce browser runtime.
- Selected lightweight C/C++ 2D libraries through Emscripten in a later phase.
- Terminal stdout, stderr, compiler errors, runtime errors, tests, and grading feedback.
- The existing deterministic source-linked Visual as a clearly labeled reference when a native GUI cannot execute in-browser.

Stonecode will not support:

- Remote streamed desktop windows, VNC/WebRTC desktops, per-user virtual machines, or persistent cloud workstations.
- Real WinForms, WPF, Java Swing/JavaFX, Tkinter desktop, native SwiftUI/UIKit, Android emulator, or comparable OS-window rendering.
- Unity, Unreal, Godot, Roblox Studio, Blender, or other external engines/editors.
- Arbitrary operating-system shells, background servers, unrestricted package installation, or unapproved native dependencies.

When a request requires an excluded runtime, engine, simulator, package, or native GUI, the tutor must say that execution is currently outside Stonecode's scope. It may offer the closest supported console, browser, WebAssembly, or deterministic-reference alternative. It must never imply that a reference Visual is native runtime output.

## Runtime Router

Add a deterministic server/client runtime decision before Run:

```txt
workspace files + learning-step requirements
-> runtime capability resolver
   -> browser_web       HTML/CSS/JS/TS/React/approved web frameworks
   -> browser_python    compatible plain Python
   -> browser_pygame    pygame-ce/Pygbag
   -> browser_wasm_2d   approved C/C++ SDL/raylib-style targets
   -> remote_console    Judge0 registered console runtime
   -> visual_reference  deterministic non-executing Visual
   -> unsupported       concise scope explanation and supported alternatives
```

The runtime decision is deterministic. AI may propose files and dependencies but cannot override execution policy.

## Judge0 Role

Judge0 is the headless console compiler, runner, and grading service. It is not a persistent terminal or graphical desktop.

Before paid activation:

- Replace synchronous `wait=true` submissions with asynchronous submission-token polling or webhooks.
- Count learner runs, grading runs, and expected-solution oracle runs as billable submissions.
- Add per-user daily limits, one global daily submission cap, and a global monetary circuit breaker.
- Add alert thresholds before shutdown and preserve a learner-facing retry state when the budget is exhausted.
- Keep the Judge0 service isolated from Stonecode and Supabase secrets.
- Keep authentication, ownership checks, code/input/output limits, CPU/memory limits, and language allowlists.

Initial configurable paid-beta guardrail proposal:

```txt
50 Judge0 submissions per user per day
3,000 Judge0 submissions globally per day
60% budget warning
80% operator alert
100% hard stop until the next billing day or an explicit operator override
```

At the observed Rapid pay-per-use price of USD 0.0017 per submission, 3,000 submissions are approximately USD 5.10 before bandwidth. Pricing must remain configuration/operations metadata rather than a permanent code constant.

Browser-runtime executions do not consume Judge0 allowance.

## Web And Framework Execution

- Use the complete workspace file tree, not only the active file.
- Compile TypeScript/JSX and render the actual application inside a sandboxed Visual iframe.
- Stream build/runtime errors into Terminal.
- Support hot reload and explicit Run, Stop, and Restart.
- Start with a small approved dependency registry and pinned versions.
- Include React, React DOM, React Router, and selected testing/CSS packages first.
- Reject or explain unsupported packages instead of silently omitting them.
- Keep iframe permissions minimal and block access to Stonecode authentication/session data.

## Python And Lightweight Visual Execution

- Use a browser worker for compatible plain Python and send stdout/stderr to Terminal.
- Use Pygbag/pygame-ce for real interactive Pygame canvas, keyboard, mouse, audio, and game-loop output in Visual.
- Preserve project-relative assets and files.
- Update generated Pygame starter contracts to use a browser-compatible asynchronous main loop.
- Keep the deterministic Visual available while code is incomplete or a browser runtime cannot load.
- Add Emscripten SDL/raylib support only after Python/Pygame and web runtimes are stable.

## Native GUI Behavior

Console compilation and tests may still run through Judge0 for languages such as C#, Java, Python, Swift, and Kotlin. If the requested application depends on a real native window, emulator, device SDK, or desktop-only GUI framework:

1. Explain that the real window is outside Stonecode's execution scope.
2. Keep Code and Terminal available where compilation/tests are supported.
3. Show a labeled deterministic Visual only when it is pedagogically useful.
4. Suggest an in-scope browser or console equivalent when appropriate.
5. Do not generate a course promise that requires unsupported execution to complete.

## Implementation Order

1. Add capability contracts, unsupported-scope messages, daily/global counters, monetary circuit breaker, and async Judge0 polling.
2. Add real multi-file browser web execution for HTML/CSS/JS/TS/React with Terminal build logs and Visual hot reload.
3. Add plain Python browser execution and real Pygame/Pygbag Visual execution.
4. Extend Judge0 transport from active-file submissions to validated multi-file console projects where the runtime supports them.
5. Add selected Emscripten 2D targets only after the earlier paths pass authenticated QA.
6. Update learning discovery/generation so it selects supported runtimes and declines excluded engines/native GUI requirements before confirmation.

## Verification

Automated:

- Runtime resolution is deterministic for every registered language/framework.
- Unsupported native GUI and engine requests cannot be marked executable.
- React multi-file dependencies compile and render without leaking host credentials.
- Browser runtime output appears in Terminal and Visual without Judge0 usage.
- Pygame input and animation are real runtime output, not deterministic reconstruction.
- Judge0 direct runs, grading runs, and oracle runs all count toward daily/global budgets.
- The hard budget stop prevents new paid submissions and preserves learner work.
- Asynchronous Judge0 polling handles queued, successful, compile-error, runtime-error, timeout, and queue-full states.

Authenticated browser QA:

- HTML/CSS/JavaScript linked project.
- React project with approved packages and multiple files.
- Python console exercise.
- Pygame interactive mini-game.
- C#, Java, C++, Go, Rust, Kotlin, Swift, PHP, Ruby, R, Julia, Fortran, COBOL, and BASIC console smoke checks when present on the configured Judge0 instance.
- WinForms/WPF, Swing/JavaFX, Tkinter desktop, mobile emulator, and Unity requests receive a concise out-of-scope explanation and supported alternatives.

Required commands:

```bash
npm run verify:execution-sandbox
npm run verify:simple-visual-preview
npm run verify:generated-course-content
npm run verify:tutor-flow
npm run typecheck
npm run build
```

## Estimated Implementation

Approximately 8–12% weekly quota across two to three focused implementation windows, excluding provider account provisioning and live billing spend.
