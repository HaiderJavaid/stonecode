# Save And Memory Policy

Do not update durable memory after every small step.

Save or recommend saving when:

- A milestone or topic checkpoint completes.
- The learner says `save`.
- The session pauses or ends.
- The course direction changes.
- A chat visual explanation starts or ends.
- The resume point would otherwise be unclear.
- A topic is skipped or auto-completed.
- Teaching style or code annotation rules change.
- Project requirements, stack, level, or design preferences change.

Memory candidates:

- User-specific: preferred language, learning pace, explanation style, accessibility needs, subscription-visible limits, and recurring goals.
- Course-specific: subject, mode, syllabus, current checkpoint, skipped topics, completed topics, patterns learned, weak areas, next resume point.
- Project-specific: stack, architecture decisions, feature list, file map, verification commands, known bugs, design preferences, deployment target.
- Lesson-specific: current exercise, hints used, attempts, accepted answer, misconception, and next small task.

Retention guidance:

- User-specific preferences last until changed by the learner.
- Course-specific memory lasts for the life of the course.
- Project-specific memory lasts for the life of the project course.
- Lesson-specific memory lasts until the checkpoint is completed, then compress it into progress notes.

When context is too large, keep: active course, active checkpoint, current file, visible file tree, latest learner attempt, latest tutor instruction, unresolved blockers, and next task. Summarize older chat.
