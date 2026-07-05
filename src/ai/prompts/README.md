# Stonecode Tutor Prompt Pack

These files define the production AI tutor behavior used by the `/api/tutor` endpoint.

The runtime loads these markdown files directly from `src/ai/prompts/` and concatenates them into the model instructions.

Keep large lesson content, examples, rubrics, and reference material out of the system prompt. Store that material as course data or retrieval documents and pass only the relevant pieces in tutor context.

Do not make the production app depend on a local Codex skill path. The Codex `programming-tutor` skill is the source inspiration; this prompt pack is the app-owned runtime contract.

Loaded order:

1. `core-system-prompt.md`
2. `roles.md`
3. `tutor-behavior.md`
4. `onboarding-flow.md`
5. `learning-modes.md`
6. `save-memory-policy.md`
7. `tool-use-policy.md`
8. `response-contract.md`
9. `safety.md`
