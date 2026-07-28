import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LessonCodeExercise, resolveCourseLessonSteps } from "@/components/stonecode/lessonData";
import { renderMarkdown } from "@/components/stonecode/markdown";
import { CourseCardProps } from "@/components/stonecode/types";
import { CourseHome } from "@/components/stonecode/CourseHome";
import { IndependentExercisePanel } from "@/components/stonecode/IndependentExercisePanel";
import { useTypedText } from "@/hooks/useTypedText";
import { useProgression } from "@/hooks/useProgression";
import {
  completeCourseSection,
  mutateExerciseProgression
} from "@/services/progression";
import { StoneSurface } from "@/components/stonecode/StoneSurface";
import { buildWorkshopEditorDiagnostics } from "@/services/editorDiagnostics";
import { normalizeWorkspacePath } from "@/services/workspaceFiles";
import { learningExperienceLabel } from "@/data/courses";

const coursePanelRevealStorageKey = "stonecode.coursePanelRevealed.v1";
const lessonIntroAnimationStorageKey = "stonecode.lessonIntroAnimated.v1";

function getLessonIntroAnimationKey(key: string) {
  return `${lessonIntroAnimationStorageKey}:${key}`;
}

function readLessonIntroAnimated(key: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getLessonIntroAnimationKey(key)) === "true";
}

function markLessonIntroAnimated(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getLessonIntroAnimationKey(key), "true");
}

export function CourseCard({
  active,
  hidden,
  hiddenDirection,
  course,
  cardIndex,
  chatMessages,
  activeFileContent,
  workspaceFiles,
  fileCount,
  lessonIndex,
  progress,
  view,
  onOpen,
  onBack,
  onChat,
  requestLessonIntro,
  onExerciseHint,
  onExerciseTemplate,
  onGenerateChapter,
  onLoadExerciseFile,
  onLoadExerciseWorkspace,
  onEditorDiagnosticsChange,
  onLessonIndexChange,
  onViewChange,
  onStartProject,
  onKeyDown,
  onTypingComplete,
  typingMessageId,
  plan
}: CourseCardProps) {
  const courseLessonSteps = useMemo(() => resolveCourseLessonSteps(course), [course]);
  const safeLessonIndex = Math.min(lessonIndex, Math.max(courseLessonSteps.length - 1, 0));
  const lesson = courseLessonSteps[safeLessonIndex];
  const exerciseFileContent = lesson.codeExercise
    ? workspaceFiles.find((file) => normalizeWorkspacePath(file.path) === normalizeWorkspacePath(lesson.codeExercise?.filePath ?? ""))?.content ?? ""
    : activeFileContent;
  const initialPanelReady = Boolean(active && view && hasCoursePanelRevealed(course.id, view));
  const [panelContentReady, setPanelContentReady] = useState(initialPanelReady);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [gradingFeedback, setGradingFeedback] = useState<string | null>(null);
  const [gradingPassed, setGradingPassed] = useState<boolean | null>(null);
  const [editorExerciseFeedback, setEditorExerciseFeedback] = useState<string | null>(null);
  const [editorExercisePassed, setEditorExercisePassed] = useState(false);
  const [editorCriteriaStatus, setEditorCriteriaStatus] = useState<Array<{ label: string; passed: boolean }>>([]);
  const [criteriaCollapsed, setCriteriaCollapsed] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [isGeneratingNextSegment, setIsGeneratingNextSegment] = useState(false);
  const [segmentGenerationError, setSegmentGenerationError] = useState<string | null>(null);
  const [completedExerciseKeys, setCompletedExerciseKeys] = useState<string[]>([]);
  const { progression, refresh: refreshProgression } = useProgression(active && view === "resume");
  const stableLessonKey = lesson.sectionId ?? `${safeLessonIndex}`;
  const lessonAnimationKey = `${course.id}:${stableLessonKey}:intro`;
  const [introAnimationDone, setIntroAnimationDone] = useState(() => readLessonIntroAnimated(lessonAnimationKey));
  const canvasMessages = useMemo(
    () => chatMessages.filter((message) => message.lessonIndex === lessonIndex),
    [chatMessages, lessonIndex]
  );
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const requestedIntroKeysRef = useRef<Set<string>>(new Set());
  const requestedChapterGenerationRef = useRef<Set<string>>(new Set());
  const loadedCodeExerciseKeysRef = useRef<Set<string>>(new Set());
  const repairedExerciseWorkspaceKeysRef = useRef<Set<string>>(new Set());
  const lessonIntroKey = `lesson-intro:${stableLessonKey}`;
  const lessonIntroMessage = useMemo(
    () => canvasMessages.find((message) => message.generatedKey === lessonIntroKey && message.role === "assistant") ?? null,
    [canvasMessages, lessonIntroKey]
  );
  const conversationMessages = useMemo(
    () => canvasMessages.filter((message) => message.generatedKey !== lessonIntroKey),
    [canvasMessages, lessonIntroKey]
  );
  const typingMessage = useMemo(
    () => conversationMessages.find((message) => message.id === typingMessageId && message.role === "assistant"),
    [conversationMessages, typingMessageId]
  );
  const isProjectStarted = fileCount > 0;
  const lessonIntroText = lessonIntroMessage?.content || lesson.tutor || "## Preparing your lesson\nYour personal AI Tutor is generating this section from your course and workspace context.";
  const shouldAnimateIntro = Boolean(active && view === "resume" && panelContentReady && lessonIntroText && !introAnimationDone);
  const {
    typedText: typedLessonIntroText,
    isTyping: isLessonIntroTyping
  } = useTypedText(lessonIntroText, {
    delayMs: 160,
    enabled: shouldAnimateIntro,
    maxTicks: 220,
    minFrameMs: 24,
    onComplete: () => {
      markLessonIntroAnimated(lessonAnimationKey);
      setIntroAnimationDone(true);
    }
  });
  const lessonIntroMarkup = useMemo(
    () => renderMarkdown(shouldAnimateIntro ? typedLessonIntroText : lessonIntroText),
    [lessonIntroText, shouldAnimateIntro, typedLessonIntroText]
  );
  const typingMessageMarkup = useMemo(
    () => (panelContentReady && typingMessage ? renderMarkdown(typingMessage.content) : null),
    [panelContentReady, typingMessage]
  );
  const renderedAssistantMessages = useMemo(() => {
    if (!panelContentReady) return new Map();
    return new Map(
      conversationMessages
        .filter((message) => message.role === "assistant" && message.id !== typingMessageId)
        .map((message) => [message.id, renderMarkdown(message.content)])
    );
  }, [conversationMessages, panelContentReady, typingMessageId]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [conversationMessages, editorExerciseFeedback, isGrading, typingMessage?.content, lessonIntroMessage?.content]);

  useEffect(() => {
    if (!typingMessageId) onTypingComplete();
  }, [onTypingComplete, typingMessageId]);

  useEffect(() => {
    setPanelContentReady(false);
    setSelectedOptionIndex(null);
    const existingCompletion = getCompletedLessonState();
    setGradingFeedback(existingCompletion && lesson.kind !== "terminal-exercise" ? "Completed earlier." : null);
    setGradingPassed(existingCompletion && lesson.kind !== "terminal-exercise" ? true : null);
    setEditorExerciseFeedback(existingCompletion && lesson.kind === "terminal-exercise" ? "Completed earlier." : null);
    setEditorExercisePassed(existingCompletion && lesson.kind === "terminal-exercise");
    setEditorCriteriaStatus(buildInitialCriteriaStatus(lesson.codeExercise?.acceptanceCriteria));
    setCriteriaCollapsed(true);
    onEditorDiagnosticsChange([]);
    setIntroAnimationDone(readLessonIntroAnimated(lessonAnimationKey));
    if (!active || !view) return;
    if (hasCoursePanelRevealed(course.id, view)) {
      setPanelContentReady(true);
      return;
    }

    const timer = window.setTimeout(() => {
      markCoursePanelRevealed(course.id, view);
      setPanelContentReady(true);
    }, 460);
    return () => window.clearTimeout(timer);
  }, [active, course.id, lessonAnimationKey, lesson.kind, onEditorDiagnosticsChange, stableLessonKey, view]);

  useEffect(() => {
    onEditorDiagnosticsChange([]);
  }, [exerciseFileContent, onEditorDiagnosticsChange]);

  useEffect(() => {
    if (!active || view !== "resume" || !panelContentReady) return;
    if (course.courseContent) return;
    if (lesson.generatedBlocks) return;
    if (lessonIntroMessage) return;
    if (requestedIntroKeysRef.current.has(lessonIntroKey)) return;
    requestedIntroKeysRef.current.add(lessonIntroKey);
    void requestLessonIntro(safeLessonIndex, lesson);
  }, [active, lesson, safeLessonIndex, lessonIntroKey, lessonIntroMessage, requestLessonIntro, panelContentReady, view]);

  useEffect(() => {
    if (!active || view !== "resume" || !panelContentReady) return;
    if (!course.courseContent || course.courseContent.schemaVersion !== "course-content/v1" || !lesson.chapterId || !lesson.generatedBlocks || lesson.generatedBlocks.length > 0) return;
    const chapterIndex = course.courseContent.chapters.findIndex((chapter) => chapter.id === lesson.chapterId);
    if (chapterIndex < 0) return;
    const requestKey = `${course.id}:${chapterIndex}`;
    if (requestedChapterGenerationRef.current.has(requestKey)) return;
    requestedChapterGenerationRef.current.add(requestKey);
    void onGenerateChapter(chapterIndex);
  }, [active, course.courseContent, course.id, lesson.chapterId, lesson.generatedBlocks?.length, onGenerateChapter, panelContentReady, view]);

  useEffect(() => {
    if (!active || view !== "resume" || !panelContentReady || !lesson.codeExercise) return;
    const loadKey = `${course.id}:${stableLessonKey}:${lesson.codeExercise.filePath}`;
    const workspaceFiles = mergeExerciseWorkspaceFiles(lesson.codeExercise);
    if (loadedCodeExerciseKeysRef.current.has(loadKey) || hasExerciseStarterLoaded(loadKey)) {
      if (workspaceFiles.length > 1 && !repairedExerciseWorkspaceKeysRef.current.has(loadKey)) {
        repairedExerciseWorkspaceKeysRef.current.add(loadKey);
        onLoadExerciseWorkspace(workspaceFiles, lesson.codeExercise.filePath, false);
      }
      return;
    }
    loadedCodeExerciseKeysRef.current.add(loadKey);
    const replaceExisting = lesson.codeExercise.exerciseKind !== "workshop" || (lesson.blockStepIndex ?? 0) === 0;
    if (workspaceFiles.length > 1) {
      onLoadExerciseWorkspace(workspaceFiles, lesson.codeExercise.filePath, replaceExisting);
    } else {
      onLoadExerciseFile(lesson.codeExercise.filePath, lesson.codeExercise.starterCode, replaceExisting);
    }
    markExerciseStarterLoaded(loadKey);
  }, [active, course.id, lesson.codeExercise, onLoadExerciseFile, onLoadExerciseWorkspace, panelContentReady, stableLessonKey, view]);

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    onChat(message, lessonIndex);
    form.reset();
  }

  async function handleWrittenExerciseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    setIsGrading(true);
    setGradingPassed(null);
    try {
      const chatExercise = lesson.generatedBlocks?.find((block) => block.type === "chat_exercise");
      const result = await mutateExerciseProgression({
        action: "complete",
        source: "course-chat",
        exerciseKey: getExerciseKey(lesson, "chat"),
        courseId: course.id,
        usesPracticeAllowance: course.experienceType === "exercise",
        submission: {
          answer: message,
          prompt: chatExercise?.type === "chat_exercise" ? chatExercise.prompt : lesson.title,
          rubric: chatExercise?.type === "chat_exercise" ? chatExercise.rubric : undefined
        }
      });
      setGradingPassed(Boolean(result.passed));
      setGradingFeedback(result.passed
        ? result.awarded
          ? `${result.feedback} +${result.xp} XP saved.`
          : `${result.feedback} Already completed; no duplicate XP.`
        : result.feedback ?? "Not quite. Review the correction, then continue.");
      if (result.passed) {
        markLessonExerciseCompleted("course-chat", getExerciseKey(lesson, "chat"));
        void refreshProgression();
      }
    } catch (caughtError) {
      setGradingPassed(false);
      setGradingFeedback(caughtError instanceof Error ? caughtError.message : "Unable to grade this answer.");
    } finally {
      setIsGrading(false);
    }
  }

  function sendSuggestion(message: string) {
    onChat(message, lessonIndex);
  }

  function moveLesson(direction: -1 | 1) {
    const targetLesson = courseLessonSteps[safeLessonIndex + direction] ?? null;
    if (direction === 1 && targetLesson?.moduleId && lesson.moduleId && targetLesson.moduleId !== lesson.moduleId) return;
    if (direction === 1) {
      const currentSection = lesson.sectionId
        ? course.syllabus.find((section) => section.id === lesson.sectionId)
        : course.syllabus.find((section) => section.lessonIndex === safeLessonIndex);
      if (currentSection) void completeCourseSection(course.id, currentSection.id);
    }
    onLessonIndexChange(Math.min(Math.max(safeLessonIndex + direction, 0), courseLessonSteps.length - 1));
  }

  async function gradeMultipleChoice(index: number) {
    setSelectedOptionIndex(index);
    setIsGrading(true);
    try {
      const result = await mutateExerciseProgression({
        action: "complete",
        source: "course-mcq",
        exerciseKey: getExerciseKey(lesson, "mcq"),
        courseId: course.id,
        usesPracticeAllowance: course.experienceType === "exercise",
        submission: { answerIndex: index }
      });
      setGradingPassed(Boolean(result.passed));
      setGradingFeedback(result.passed
        ? result.awarded
          ? `Correct. +${result.xp} XP saved.`
          : "Correct. Previously completed; no duplicate XP."
        : result.feedback ?? "Not quite.");
      if (result.passed) {
        markLessonExerciseCompleted("course-mcq", getExerciseKey(lesson, "mcq"));
        void refreshProgression();
      }
    } catch (caughtError) {
      setGradingFeedback(caughtError instanceof Error ? caughtError.message : "Unable to grade this answer.");
    } finally {
      setIsGrading(false);
    }
  }

  async function submitEditorExercise() {
    const code = exerciseFileContent.trim();
    if (!code) {
      setEditorExerciseFeedback("The starter should appear in the middle editor. If it is still empty, go back and reopen this step.");
      return;
    }
    onEditorDiagnosticsChange([]);
    setIsGrading(true);
    try {
      const result = await mutateExerciseProgression({
        action: "complete",
        source: "course-chat",
        exerciseKey: getExerciseKey(lesson, "code"),
        courseId: course.id,
        usesPracticeAllowance: course.experienceType === "exercise",
        submission: { code, prompt: lesson.codeExercise?.prompt }
      });
      setEditorCriteriaStatus(evaluateAcceptanceCriteria(code, lesson.codeExercise?.acceptanceCriteria ?? [], Boolean(result.passed)));
      setEditorExercisePassed(Boolean(result.passed));
      setEditorExerciseFeedback(result.passed
        ? result.awarded
          ? `${result.feedback ?? "Editor exercise verified."} +${result.xp} XP saved.`
          : `${result.feedback ?? "Editor exercise verified."} Already completed; no duplicate XP.`
        : result.feedback ?? "Not enough yet. Update the middle editor so the task is runnable before submitting.");
      if (!result.passed && lesson.codeExercise?.exerciseKind === "workshop" && lesson.codeExercise.resultCode) {
        onEditorDiagnosticsChange(buildWorkshopEditorDiagnostics(code, lesson.codeExercise.resultCode, lesson.codeExercise.filePath));
      }
      if (result.passed) {
        markLessonExerciseCompleted("course-chat", getExerciseKey(lesson, "code"));
        void refreshProgression();
      }
    } catch (caughtError) {
      setEditorExerciseFeedback(caughtError instanceof Error ? caughtError.message : "Unable to grade editor code.");
    } finally {
      setIsGrading(false);
    }
  }

  function handleEditorExercisePrimaryAction() {
    if (editorExercisePassed || getCompletedLessonState()) {
      moveLesson(1);
      return;
    }
    void submitEditorExercise();
  }

  const blockStepIndex = lesson.blockStepIndex ?? safeLessonIndex;
  const blockStepCount = lesson.blockStepCount ?? courseLessonSteps.length;
  const lessonProgress = ((blockStepIndex + 1) / Math.max(blockStepCount, 1)) * 100;
  const selectedOption = selectedOptionIndex === null ? null : lesson.options?.[selectedOptionIndex] ?? null;
  const nextLesson = courseLessonSteps[safeLessonIndex + 1] ?? null;
  const nextCrossesModule = Boolean(nextLesson?.moduleId && lesson.moduleId && nextLesson.moduleId !== lesson.moduleId);
  const projectMilestones = course.courseContent?.schemaVersion === "guided-project-content/v1" ? course.courseContent.milestones : null;
  const nextProjectMilestoneIndex = projectMilestones && lesson.moduleId
    ? projectMilestones.findIndex((milestone, index) => index > projectMilestones.findIndex((item) => item.id === lesson.moduleId) && !milestone.unlocked)
    : -1;
  const canGenerateNextProjectMilestone = Boolean(nextCrossesModule && projectMilestones && nextProjectMilestoneIndex >= 0);
  const nextStartsNewBlock = Boolean(nextLesson?.blockId && lesson.blockId && nextLesson.blockId !== lesson.blockId);
  const nextStartsNewTopic = Boolean(nextLesson?.topicId && lesson.topicId && nextLesson.topicId !== lesson.topicId);
  const nextStartsNewChapter = Boolean(
    (nextLesson?.chapterId && lesson.chapterId && nextLesson.chapterId !== lesson.chapterId) ||
    nextStartsNewTopic
  );
  const lessonIntroReady = !isLessonIntroTyping;
  const currentExerciseCompleted = getCompletedLessonState();
  const editorExerciseComplete = editorExercisePassed || currentExerciseCompleted;
  const nextDisabled = isLessonIntroTyping || isGrading || isGeneratingNextSegment || (
    lesson.kind === "terminal-exercise"
      ? editorExerciseComplete && nextCrossesModule && !canGenerateNextProjectMilestone
      : (nextCrossesModule && !canGenerateNextProjectMilestone) || (
        lesson.kind === "multiple-choice"
          ? gradingPassed === null && !currentExerciseCompleted
          : lesson.kind === "chat-exercise"
            ? gradingPassed === null && !currentExerciseCompleted
            : false
      )
  );
  const hasLessonXp = typeof lesson.xp === "number" && lesson.xp > 0;

  const cardClassName = [
    "shadow-card",
    active ? "is-active" : "",
    active && (view === "resume" || view === "exercises") ? "has-chat-canvas" : "",
    active && view === "resume" && hasLessonXp ? "is-exercise-step" : "",
    hidden ? "is-hidden" : "",
    hidden ? `is-${hiddenDirection}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <StoneSurface
      as="article"
      variant="card"
      aria-expanded={active}
      className={cardClassName}
      data-course-id={course.id}
      style={{ "--card-y": `${cardIndex * 166}px` } as React.CSSProperties}
      onClick={() => {
        if (!active) onOpen();
      }}
      onKeyDown={onKeyDown}
      role={active ? "region" : "button"}
      tabIndex={hidden ? -1 : 0}
    >
      <div className="card-top">
        <div><span className={`experience-type-badge is-${course.experienceType}`}>{learningExperienceLabel(course.experienceType)}</span><h2>{course.title}</h2></div>
        <button
          className="card-back"
          onClick={(event) => {
            event.stopPropagation();
            onBack();
          }}
          type="button"
        >
          Back
        </button>
      </div>
      <div className="rule" />
      <div className="card-summary">
        <p>{course.description}</p>
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <span className="percent">{progress}%</span>
      </div>
      <div className="card-detail">
        {active ? (
          <CourseHome
            course={course}
            isProjectStarted={isProjectStarted}
            lessonIndex={lessonIndex}
            onStartOrResume={() => {
              if (isProjectStarted) onViewChange("resume");
              else onStartProject(course);
            }}
          />
        ) : (
          <>
            <div className="course-meta">
              <span>{learningExperienceLabel(course.experienceType)}</span>
              <span>{course.checkpoint}</span>
              <span>{course.updatedAt}</span>
            </div>
          </>
        )}
      </div>
      {active && view && (
        <div className={`selection-panel${view === "resume" ? " is-chat-canvas" : ""}${panelContentReady ? " is-content-ready" : ""}${view === "resume" && hasLessonXp ? " is-exercise-step" : ""}`} onClick={(event) => event.stopPropagation()}>
          <button className="selection-back" onClick={() => onViewChange(null)} type="button">
            Back
          </button>
          {panelContentReady && view === "resume" && (
            <div className="lesson-panel ai-chat-panel">
              <div className="chat-canvas-head">
                <div className="lesson-progress-copy">
                  <span>Step {blockStepIndex + 1} / {blockStepCount} in this block</span>
                  <span>{Math.round(lessonProgress)}%</span>
                </div>
                <div className="lesson-progress-track" aria-label={`${Math.round(lessonProgress)}% block progress`}>
                  <i style={{ width: `${lessonProgress}%` }} />
                </div>
                <LessonContentMeta lesson={lesson} showXp={hasLessonXp} />
              </div>
              <div className="ai-chat-scroll" aria-label={`${lesson.label} conversation`} ref={chatScrollRef}>
                <div className="ai-message assistant-message ai-response">
                  {lessonIntroMarkup}
                  {(isLessonIntroTyping || lessonIntroMessage?.id === typingMessageId) && <span className="typing-caret" />}
                </div>
                {lesson.kind === "multiple-choice" && lessonIntroReady && (
                  <div className="lesson-options is-entering" aria-label="Answer choices">
                    {lesson.options?.map((option, index) => (
                      <button
                        className={[
                          selectedOptionIndex === index ? "is-selected" : "",
                          selectedOptionIndex === index && gradingPassed === true ? "is-correct" : "",
                          selectedOptionIndex === index && gradingPassed === false ? "is-incorrect" : ""
                        ].filter(Boolean).join(" ")}
                        key={option.label}
                        disabled={isGrading}
                        onClick={() => void gradeMultipleChoice(index)}
                        type="button"
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {option.label}
                      </button>
                    ))}
                    {selectedOption && (
                      <p className={`option-feedback${gradingPassed ? " is-correct" : ""}`}>
                        {gradingFeedback ?? (isGrading ? "Checking answer..." : "Choose an answer to continue.")}
                      </p>
                    )}
                  </div>
                )}
                {conversationMessages.map((message) => (
                  <div className={`ai-message ${message.role === "assistant" ? "assistant-message ai-response" : "user-message"}`} key={message.id}>
                    {message.role === "assistant" ? (
                      <>
                        {message.id === typingMessageId ? typingMessageMarkup : renderedAssistantMessages.get(message.id)}
                        {message.id === typingMessageId && <span className="typing-caret" />}
                      </>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                ))}
                {lesson.codeExercise && (isGrading || editorExerciseFeedback || lesson.codeExercise.requiresPreview || lesson.codeExercise.requiresTerminal) && (
                  <div className={`ai-message assistant-message workshop-check-message${editorExerciseComplete ? " is-correct" : ""}`} aria-live="polite">
                    <strong>{lesson.codeExercise.filePath} · {isGrading ? "checking" : editorExerciseFeedback ? "check result" : "workspace note"}</strong>
                    {isGrading && <p>Checking the current editor code against this step.</p>}
                    {!isGrading && editorExerciseFeedback && <p>{editorExerciseFeedback}</p>}
                    {lesson.codeExercise.requiresPreview && <p>Use Visual to inspect the synchronized project scene. This preview updates without running Terminal.</p>}
                    {lesson.codeExercise.requiresTerminal && <p>Use Terminal to run {lesson.codeExercise.filePath} and inspect its output.</p>}
                  </div>
                )}
                {segmentGenerationError && <div className="ai-message assistant-message workshop-check-message"><strong>Milestone generation</strong><p>{segmentGenerationError}</p></div>}
              </div>
              <div className="chat-dock">
                {(lesson.kind === "theory" || lesson.kind === "canvas") && (
                  <>
                    <div className="quick-action-label">Quick actions</div>
                    <div className="reply-suggestions" aria-label="Suggested replies">
                      {lesson.suggestions.slice(0, 3).map((suggestion) => (
                        <button key={suggestion} disabled={isLessonIntroTyping} onClick={() => sendSuggestion(suggestion)} type="button">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {lesson.kind === "chat-exercise" && lessonIntroReady && (
                  <form className="chat-compose written-exercise-form is-entering" onSubmit={handleWrittenExerciseSubmit}>
                    <textarea
                      aria-label="Written exercise answer"
                      name="message"
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder="Answer this checkpoint..."
                      rows={2}
                    />
                    <button disabled={isGrading} type="submit">{isGrading ? "Grading..." : "Check"}</button>
                  </form>
                )}
                {lesson.kind === "chat-exercise" && gradingFeedback && (
                  <p className={`option-feedback${gradingPassed ? " is-correct" : ""}`}>{gradingFeedback}</p>
                )}
                {lesson.codeExercise && (
                  <>
                    <div className={`editor-exercise-checklist${criteriaCollapsed ? " is-collapsed" : ""}`} aria-label="MVP checklist">
                      <button
                        aria-label={criteriaCollapsed ? "Show MVP checklist" : "Hide MVP checklist"}
                        aria-expanded={!criteriaCollapsed}
                        className="checklist-toggle"
                        onClick={() => setCriteriaCollapsed((current) => !current)}
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 12 7">
                          <path d="M1 6 6 1l5 5" />
                        </svg>
                      </button>
                      <div className="checklist-content">
                        <strong>MVP checklist</strong>
                        {editorCriteriaStatus.map((criterion) => (
                          <span className={criterion.passed ? "is-passed" : ""} key={criterion.label}>
                            <i aria-hidden="true">{criterion.passed ? "ok" : "-"}</i>
                            {criterion.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="quick-action-label">Quick actions</div>
                    <div className="reply-suggestions" aria-label="Suggested replies">
                      {lesson.suggestions.slice(0, 3).map((suggestion) => (
                        <button key={suggestion} disabled={isLessonIntroTyping} onClick={() => sendSuggestion(suggestion)} type="button">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <form className="chat-compose" onSubmit={handleChatSubmit}>
                      <textarea
                        aria-label="Chat message"
                        name="message"
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder="Ask a follow-up..."
                        rows={2}
                      />
                      <button disabled={isLessonIntroTyping} type="submit">Send</button>
                    </form>
                  </>
                )}
                {(lesson.kind === "theory" || lesson.kind === "canvas") && (
                  <form className="chat-compose" onSubmit={handleChatSubmit}>
                    <textarea
                      aria-label="Chat message"
                      name="message"
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder="Ask a follow-up..."
                      rows={2}
                    />
                    <button disabled={isGrading || isLessonIntroTyping} type="submit">{isGrading ? "Grading..." : "Send"}</button>
                  </form>
                )}
                <div className="lesson-controls">
                  <button disabled={safeLessonIndex === 0} onClick={() => moveLesson(-1)} type="button">Prev</button>
                  <button
                    className={nextStartsNewChapter ? "next-chapter-button" : ""}
                    disabled={nextDisabled}
                    onClick={canGenerateNextProjectMilestone ? () => void generateNextProjectMilestone() : lesson.codeExercise ? handleEditorExercisePrimaryAction : () => moveLesson(1)}
                    type="button"
                  >
                    {isGeneratingNextSegment
                      ? "Generating milestone..."
                      : canGenerateNextProjectMilestone
                        ? "Generate next milestone"
                        : lesson.codeExercise
                      ? isGrading
                        ? "Checking..."
                        : editorExerciseComplete
                          ? nextCrossesModule ? "Module complete" : "Next section"
                          : "Check"
                      : getNextButtonLabel({ nextCrossesModule, nextLesson, nextStartsNewBlock, nextStartsNewChapter })}
                  </button>
                </div>
              </div>
            </div>
          )}
          {panelContentReady && view === "exercises" && (
            <IndependentExercisePanel
              activeCode={activeFileContent}
              course={course}
              onLoadExerciseFile={onLoadExerciseFile}
              plan={plan}
              requestExerciseHint={onExerciseHint}
              requestExerciseTemplate={onExerciseTemplate}
            />
          )}
        </div>
      )}
    </StoneSurface>
  );

  function getCompletedLessonState() {
    if (lesson.kind === "multiple-choice") return isLessonExerciseCompleted("course-mcq", getExerciseKey(lesson, "mcq"));
    if (lesson.kind === "chat-exercise") return isLessonExerciseCompleted("course-chat", getExerciseKey(lesson, "chat"));
    if (lesson.kind === "terminal-exercise") return isLessonExerciseCompleted("course-chat", getExerciseKey(lesson, "code"));
    return false;
  }

  async function generateNextProjectMilestone() {
    if (nextProjectMilestoneIndex < 0) return;
    setIsGeneratingNextSegment(true);
    setSegmentGenerationError(null);
    try {
      await onGenerateChapter(nextProjectMilestoneIndex);
      onLessonIndexChange(Math.min(safeLessonIndex + 1, courseLessonSteps.length));
    } catch (error) {
      setSegmentGenerationError(error instanceof Error ? error.message : "Could not generate the next milestone. Your files were preserved.");
    } finally {
      setIsGeneratingNextSegment(false);
    }
  }

  function isLessonExerciseCompleted(source: "course-mcq" | "course-chat", exerciseKey: string) {
    const localKey = getCompletedExerciseStorageKey(course.id, source, exerciseKey);
    return completedExerciseKeys.includes(localKey) || progression.attempts.some((attempt) =>
      attempt.source === source &&
      (attempt.exercise_key === exerciseKey || attempt.exercise_key === `${course.id}:${exerciseKey}`) &&
      attempt.status === "completed"
    );
  }

  function markLessonExerciseCompleted(source: "course-mcq" | "course-chat", exerciseKey: string) {
    const localKey = getCompletedExerciseStorageKey(course.id, source, exerciseKey);
    setCompletedExerciseKeys((current) => current.includes(localKey) ? current : [...current, localKey]);
  }
}

function getNextButtonLabel({
  nextCrossesModule,
  nextLesson,
  nextStartsNewBlock,
  nextStartsNewChapter
}: {
  nextCrossesModule: boolean;
  nextLesson: ReturnType<typeof resolveCourseLessonSteps>[number] | null;
  nextStartsNewBlock: boolean;
  nextStartsNewChapter: boolean;
}) {
  if (!nextLesson) return "Finish course";
  if (nextCrossesModule) return "Module complete";
  if (nextStartsNewChapter) return "Next topic";
  if (nextStartsNewBlock) return "Next block";
  return "Next section";
}

function mergeExerciseWorkspaceFiles(exercise: LessonCodeExercise) {
  const byPath = new Map(
    (exercise.workspaceFiles ?? []).map((file) => [file.path, file])
  );
  byPath.set(exercise.filePath, {
    ...byPath.get(exercise.filePath),
    path: exercise.filePath,
    content: exercise.starterCode,
    editable: true
  });
  return [...byPath.values()];
}

function buildInitialCriteriaStatus(criteria: string[] | undefined) {
  return (criteria ?? []).map((label) => ({ label, passed: false }));
}

function evaluateAcceptanceCriteria(code: string, criteria: string[], forcePassed: boolean) {
  return criteria.map((label) => ({
    label,
    passed: forcePassed || evaluateSingleCriterion(code, label)
  }));
}

function evaluateSingleCriterion(code: string, criterion: string) {
  const normalizedCode = code.toLowerCase();
  const normalizedCriterion = criterion.toLowerCase();
  const outputCount = (
    code.match(/console\.(log|write|writeline)\s*\(|print\s*\(|system\.out\.println|std::cout|printf\s*\(|fmt\.println|println!|puts\s+|echo\s+/gi) ?? []
  ).length;
  const functionCallCount = countCallsToDefinedFunctions(code);

  if (!code.trim()) return false;
  if (/(second|two|2|both|twice)/.test(normalizedCriterion) && /(function|method|call)/.test(normalizedCriterion)) return functionCallCount >= 2;
  if (/(second|two|2|both|twice)/.test(normalizedCriterion) && /(output|print|log|show|visible|result|call)/.test(normalizedCriterion)) return outputCount >= 2;
  if (/function|method|named/.test(normalizedCriterion)) {
    return /(function\s+\w+|=>|def\s+\w+|class\s+\w+|static\s+\w+|func\s+\w+|fn\s+\w+)/i.test(code);
  }
  if (/print|log|output|visible|show|readable|result/.test(normalizedCriterion)) return outputCount > 0 || normalizedCode.includes("return ");
  if (/decision|if|choice/.test(normalizedCriterion)) return /\bif\b|\?|switch|match\s+/i.test(code);
  if (/value|variable|stores|named/.test(normalizedCriterion)) return /(const|let|var|=|def\s+\w+|string\s+\w+|int\s+\w+|auto\s+\w+)/i.test(code);
  if (/one file|simple file|same file/.test(normalizedCriterion)) return true;
  return code.trim().length > 24;
}

function countCallsToDefinedFunctions(code: string) {
  const definitionNames = Array.from(code.matchAll(/\b(?:function|def|func|fn)\s+([A-Za-z_]\w*)\s*\(|\bstatic\s+\w+\s+([A-Za-z_]\w*)\s*\(/gi))
    .map((match) => match[1] || match[2])
    .filter(Boolean);
  return definitionNames.reduce((total, name) => {
    const callMatches = code.match(new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, "g")) ?? [];
    return total + Math.max(0, callMatches.length - 1);
  }, 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function LessonContentMeta({
  lesson,
  showXp
}: {
  lesson: ReturnType<typeof resolveCourseLessonSteps>[number];
  showXp: boolean;
}) {
  const tags = [
    lesson.label || "AI section",
    lesson.language || "AI topic",
    lesson.difficulty || "Level pending"
  ];

  return (
    <div className={`exercise-meta exercise-meta-inline lesson-content-meta${showXp ? " is-exercise-meta" : ""}`} aria-label="Generated lesson tags">
      {tags.map((tag, index) => <span className={showXp && index === 1 ? "exercise-category-tag" : undefined} key={tag}>{tag}</span>)}
      {showXp && <strong className="exercise-xp-badge">{lesson.xp ? `+${lesson.xp} XP` : "XP pending"}</strong>}
    </div>
  );
}

function getExerciseKey(lesson: ReturnType<typeof resolveCourseLessonSteps>[number], type: "mcq" | "chat" | "code") {
  if (!lesson.sectionId && type === "mcq") return "choose-an-operation";
  if (!lesson.sectionId && type === "chat") return "explain-edge-cases";
  if (lesson.blockId && typeof lesson.blockStepIndex === "number") return `${lesson.blockId}:${lesson.blockStepIndex}:${type}`;
  return `${lesson.sectionId ?? lesson.title}:${type}`;
}

function getCoursePanelRevealKey(courseId: string, view: string) {
  return `${coursePanelRevealStorageKey}:${courseId}:${view}`;
}

function hasCoursePanelRevealed(courseId: string, view: string | null) {
  if (!view || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getCoursePanelRevealKey(courseId, view)) === "true";
}

function markCoursePanelRevealed(courseId: string, view: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getCoursePanelRevealKey(courseId, view), "true");
}

function getCompletedExerciseStorageKey(courseId: string, source: "course-mcq" | "course-chat", exerciseKey: string) {
  return `${courseId}:${source}:${exerciseKey}`;
}

function getExerciseStarterStorageKey(loadKey: string) {
  return `stonecode.exerciseStarterLoaded.v1:${loadKey}`;
}

function hasExerciseStarterLoaded(loadKey: string) {
  return typeof window !== "undefined" && window.localStorage.getItem(getExerciseStarterStorageKey(loadKey)) === "true";
}

function markExerciseStarterLoaded(loadKey: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(getExerciseStarterStorageKey(loadKey), "true");
}
