# Stonecode Session

## Date

2026-06-25

## Current State

Stonecode is a paid-beta AI programming tutor with a persistent IDE workspace, dashboard-integrated settings, public landing/legal/support pages, Supabase persistence, Stripe subscription sync, and authenticated streaming tutor calls.

## Latest Work

- Added five dummy tutor states navigable with Next/Prev:
  - theory and clarification.
  - chat-answer exercise.
  - multiple-choice exercise.
  - terminal coding exercise.
  - visual diagram/CSS canvas.
- Added section progress, language, difficulty, and XP metadata.
- Added clickable MCQ answers with correct/incorrect feedback.
- Fixed chat input: spaces work, Enter sends, Shift+Enter inserts a line.
- Updated live tutor instructions for clarification and upcoming-topic handling.
- Expanded file icons across common languages and formats.
- Added lazy CodeMirror modes for JS/TS, Python, HTML, CSS, JSON, Markdown, SQL, Java, C/C++, and PHP.
- Added `npm run verify:tutor-flow`.
- Upgraded Vite from 5.4.14 to 5.4.21.

## Verification

- `npm run verify:tutor-flow` passed.
- `npm run verify:response-stream` passed.
- `npm run verify:usage-summary` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- Authenticated Chrome CDP QA rendered the MCQ flow, correct-answer feedback, progress bar, XP metadata, Python/Java/SQL icons, and editor/file layout.
- Browser plugin bootstrap failed because its sandbox metadata was invalid; Chrome CDP was used as fallback.

## Risks

- XP/streak/badge awards are UI-only and need server persistence plus anti-tamper rules.
- Model-generated clickable blocks still need a structured response protocol.
- Full Enter-to-send automation was timing-sensitive under temporary authenticated QA; deterministic source verification covers the keyboard contract.
- Current Vite 5 remains covered by npm advisories whose available fix is Vite 8, a breaking upgrade.
- Lazy language chunks reduce startup cost, but production bundle/code-splitting should still be reviewed.

## Next

1. Define and persist XP, streaks, categories, and badge awards.
2. Define structured tutor blocks for MCQ, canvas, and exercise grading.
3. Connect terminal exercise completion to verified runs and XP awards.
4. Continue real-session dashboard/workspace QA.
