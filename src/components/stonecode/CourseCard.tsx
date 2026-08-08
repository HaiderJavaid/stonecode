import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { Course, learningExperienceLabel } from "@/data/courses";
import { Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { loadTutorVisualAsset, requestTutorVisual, TutorVisualAttachmentV1 } from "@/services/tutorVisuals";

const coursePanelRevealStorageKey = "stonecode.coursePanelRevealed.v1";
const lessonIntroAnimationStorageKey = "stonecode.lessonIntroAnimated.v1";
type EditorCriterionState = "idle" | "checking" | "passed";

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
  onDelete,
  onBack,
  onChat,
  onApplyTutorPatch,
  onRejectTutorPatch,
  onUndoTutorPatch,
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
  const [editorCriteriaStatus, setEditorCriteriaStatus] = useState<Array<{ label: string; status: EditorCriterionState }>>([]);
  const [criteriaCollapsed, setCriteriaCollapsed] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [isModuleTransitioning, setIsModuleTransitioning] = useState(false);
  const [isGeneratingNextSegment, setIsGeneratingNextSegment] = useState(false);
  const [segmentGenerationError, setSegmentGenerationError] = useState<string | null>(null);
  const [tutorPatchError, setTutorPatchError] = useState<string | null>(null);
  const [tutorVisual, setTutorVisual] = useState<TutorVisualAttachmentV1 | null>(null);
  const [tutorVisualUrl, setTutorVisualUrl] = useState<string | null>(null);
  const [isVisualViewerOpen, setIsVisualViewerOpen] = useState(false);
  const [completedExerciseKeys, setCompletedExerciseKeys] = useState<string[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const moduleTransitionTimerRef = useRef<number | null>(null);
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
  const completedLessonState = getCompletedLessonState();

  useEffect(() => {
    if (!active || view !== "resume" || !lesson.visualCue || !lesson.sectionId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setTutorVisual(null);
    setTutorVisualUrl(null);
    requestTutorVisual(course.id, lesson.sectionId)
      .then(async (visual) => {
        objectUrl = await loadTutorVisualAsset(visual.contentUrl);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setTutorVisual(visual);
        setTutorVisualUrl(objectUrl);
      })
      .catch(() => {
        // Optional visual failures never block the text lesson.
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [active, course.id, lesson.sectionId, lesson.visualCue, view]);
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

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    if (moduleTransitionTimerRef.current) window.clearTimeout(moduleTransitionTimerRef.current);
  }, []);

  useEffect(() => {
    setPanelContentReady(false);
    setSelectedOptionIndex(null);
    setGradingFeedback(null);
    setGradingPassed(null);
    setEditorExerciseFeedback(null);
    setEditorExercisePassed(false);
    setEditorCriteriaStatus(buildInitialCriteriaStatus(lesson.codeExercise?.acceptanceCriteria, false));
    setCriteriaCollapsed(true);
    setShowCompletionCelebration(false);
    setIsModuleTransitioning(false);
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
  }, [active, course.id, lesson.codeExercise?.acceptanceCriteria, lessonAnimationKey, lesson.kind, onEditorDiagnosticsChange, stableLessonKey, view]);

  useEffect(() => {
    if (!completedLessonState) return;
    if (lesson.kind === "terminal-exercise") {
      setEditorExercisePassed(true);
      setEditorExerciseFeedback((current) => current ?? "Completed earlier.");
      setEditorCriteriaStatus((current) => current.length
        ? current.map((criterion) => ({ ...criterion, status: "passed" }))
        : buildInitialCriteriaStatus(lesson.codeExercise?.acceptanceCriteria, true));
      return;
    }
    setGradingPassed(true);
    setGradingFeedback((current) => current ?? "Completed earlier.");
  }, [completedLessonState, lesson.codeExercise?.acceptanceCriteria, lesson.kind]);

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
  }, [active, course.courseContent, lesson, lesson.generatedBlocks, safeLessonIndex, lessonIntroKey, lessonIntroMessage, requestLessonIntro, panelContentReady, view]);

  useEffect(() => {
    if (!active || view !== "resume" || !panelContentReady) return;
    if (!course.courseContent || course.courseContent.schemaVersion !== "course-content/v1" || !lesson.chapterId || !lesson.generatedBlocks || lesson.generatedBlocks.length > 0) return;
    const chapterIndex = course.courseContent.chapters.findIndex((chapter) => chapter.id === lesson.chapterId);
    if (chapterIndex < 0) return;
    const requestKey = `${course.id}:${chapterIndex}`;
    if (requestedChapterGenerationRef.current.has(requestKey)) return;
    requestedChapterGenerationRef.current.add(requestKey);
    void onGenerateChapter(chapterIndex);
  }, [active, course.courseContent, course.id, lesson.chapterId, lesson.generatedBlocks, onGenerateChapter, panelContentReady, view]);

  useEffect(() => {
    if (!active || view !== "resume" || !panelContentReady || !lesson.codeExercise) return;
    const loadKey = `${course.id}:${stableLessonKey}:${lesson.codeExercise.filePath}`;
    const exerciseWorkspaceFiles = mergeExerciseWorkspaceFiles(lesson.codeExercise);
    const hasDeclaredExerciseFile = workspaceFiles.some((file) =>
      normalizeWorkspacePath(file.path) === normalizeWorkspacePath(lesson.codeExercise?.filePath ?? "")
    );
    if (loadedCodeExerciseKeysRef.current.has(loadKey) || hasExerciseStarterLoaded(loadKey)) {
      if ((!hasDeclaredExerciseFile || exerciseWorkspaceFiles.length > 1) && !repairedExerciseWorkspaceKeysRef.current.has(loadKey)) {
        repairedExerciseWorkspaceKeysRef.current.add(loadKey);
        if (exerciseWorkspaceFiles.length > 1) {
          onLoadExerciseWorkspace(exerciseWorkspaceFiles, lesson.codeExercise.filePath, false);
        } else if (!hasDeclaredExerciseFile) {
          onLoadExerciseFile(lesson.codeExercise.filePath, lesson.codeExercise.starterCode, false);
        }
      }
      return;
    }
    loadedCodeExerciseKeysRef.current.add(loadKey);
    const replaceExisting = lesson.codeExercise.exerciseKind !== "workshop" || (lesson.blockStepIndex ?? 0) === 0;
    if (exerciseWorkspaceFiles.length > 1) {
      onLoadExerciseWorkspace(exerciseWorkspaceFiles, lesson.codeExercise.filePath, replaceExisting);
    } else {
      onLoadExerciseFile(lesson.codeExercise.filePath, lesson.codeExercise.starterCode, replaceExisting);
    }
    markExerciseStarterLoaded(loadKey);
  }, [active, course.id, lesson.blockStepIndex, lesson.codeExercise, onLoadExerciseFile, onLoadExerciseWorkspace, panelContentReady, stableLessonKey, view, workspaceFiles]);

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
        celebrateExerciseCompletion();
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

  function celebrateExerciseCompletion() {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    setShowCompletionCelebration(true);
    celebrationTimerRef.current = window.setTimeout(() => {
      setShowCompletionCelebration(false);
      celebrationTimerRef.current = null;
    }, 1800);
  }

  function moveLesson(direction: -1 | 1) {
    if (isModuleTransitioning) return;
    const targetIndex = Math.min(Math.max(safeLessonIndex + direction, 0), courseLessonSteps.length - 1);
    const targetLesson = courseLessonSteps[safeLessonIndex + direction] ?? null;
    const crossesModule = Boolean(targetLesson?.moduleId && lesson.moduleId && targetLesson.moduleId !== lesson.moduleId);
    if (
      direction === 1
      && targetLesson?.moduleId
      && lesson.moduleId
      && crossesModule
      && !isGeneratedModuleReady(course, targetLesson.moduleId)
    ) return;
    if (direction === 1) {
      const currentSection = lesson.sectionId
        ? course.syllabus.find((section) => section.id === lesson.sectionId)
        : course.syllabus.find((section) => section.lessonIndex === safeLessonIndex);
      if (currentSection) void completeCourseSection(course.id, currentSection.id);
    }
    if (direction === 1 && crossesModule) {
      setIsModuleTransitioning(true);
      moduleTransitionTimerRef.current = window.setTimeout(() => {
        onLessonIndexChange(targetIndex);
        setIsModuleTransitioning(false);
        moduleTransitionTimerRef.current = null;
      }, 650);
      return;
    }
    onLessonIndexChange(targetIndex);
  }

  async function gradeMultipleChoice(index: number) {
    setSelectedOptionIndex(index);
    setIsGrading(true);
    setGradingPassed(null);
    setGradingFeedback(null);
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
          ? `${result.feedback ?? "Correct."} +${result.xp} XP saved.`
          : result.xpEligible === false
            ? `${result.feedback ?? "Correct."} No XP after a retry.`
            : `${result.feedback ?? "Correct."} Previously completed; no duplicate XP.`
        : result.feedback ?? "Not quite. Review why, then choose another answer.");
      if (result.passed) {
        markLessonExerciseCompleted("course-mcq", getExerciseKey(lesson, "mcq"));
        celebrateExerciseCompletion();
        void refreshProgression();
      }
    } catch (caughtError) {
      setGradingPassed(false);
      setGradingFeedback(caughtError instanceof Error ? caughtError.message : "Unable to grade this answer.");
    } finally {
      setIsGrading(false);
    }
  }

  async function submitEditorExercise() {
    const code = exerciseFileContent.trim();
    setCriteriaCollapsed(false);
    if (!code) {
      setEditorCriteriaStatus((current) => current.map((criterion) => ({ ...criterion, status: "idle" })));
      setEditorExerciseFeedback("The starter should appear in the middle editor. If it is still empty, go back and reopen this step.");
      return;
    }
    onEditorDiagnosticsChange([]);
    setEditorExerciseFeedback(null);
    setEditorExercisePassed(false);
    setEditorCriteriaStatus((current) => current.map((criterion) => ({ ...criterion, status: "checking" })));
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
      setEditorCriteriaStatus(result.criteria?.length
        ? result.criteria.map((criterion) => ({ label: criterion.label, status: criterion.passed ? "passed" : "idle" }))
        : evaluateAcceptanceCriteria(code, lesson.codeExercise?.acceptanceCriteria ?? [], Boolean(result.passed)));
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
        celebrateExerciseCompletion();
        void refreshProgression();
      }
    } catch (caughtError) {
      setEditorExercisePassed(false);
      setEditorCriteriaStatus((current) => current.map((criterion) => ({ ...criterion, status: "idle" })));
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
  const nextGeneratedModuleReady = !nextCrossesModule || Boolean(nextLesson?.moduleId && isGeneratedModuleReady(course, nextLesson.moduleId));
  const awaitingNextGeneratedModule = !nextLesson && hasPendingGeneratedModules(course);
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
  const isExerciseLesson = ["multiple-choice", "chat-exercise", "terminal-exercise"].includes(lesson.kind);
  const exerciseComplete = lesson.kind === "terminal-exercise"
    ? editorExerciseComplete
    : currentExerciseCompleted || gradingPassed === true;
  const nextDisabled = isLessonIntroTyping || isGrading || isGeneratingNextSegment || isModuleTransitioning || awaitingNextGeneratedModule || (
    lesson.kind === "terminal-exercise"
      ? editorExerciseComplete && nextCrossesModule && !canGenerateNextProjectMilestone && !nextGeneratedModuleReady
      : (nextCrossesModule && !canGenerateNextProjectMilestone && !nextGeneratedModuleReady) || (
        lesson.kind === "multiple-choice"
          ? !exerciseComplete
          : lesson.kind === "chat-exercise"
            ? !exerciseComplete
            : false
      )
  );
  const hasLessonXp = typeof lesson.xp === "number" && lesson.xp > 0;

  const cardClassName = [
    "shadow-card",
    active ? "is-active" : "",
    isClosing ? "is-closing" : "",
    active && (view === "resume" || view === "exercises") ? "has-chat-canvas" : "",
    active && view === "resume" && hasLessonXp ? "is-exercise-step" : "",
    active && view === "resume" && isExerciseLesson && exerciseComplete ? "is-exercise-complete" : "",
    showCompletionCelebration ? "is-completion-celebrating" : "",
    isModuleTransitioning ? "is-module-transitioning" : "",
    hidden ? "is-hidden" : "",
    hidden ? `is-${hiddenDirection}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  function rememberCardOpenOffset(element: HTMLElement) {
    const cards = element.closest(".cards");
    if (!cards) return;
    const offset = element.getBoundingClientRect().top - cards.getBoundingClientRect().top;
    element.style.setProperty("--card-open-offset", `${Math.max(offset, 0)}px`);
    element.style.setProperty("--card-open-top", `${cards.scrollTop}px`);
  }

  function closeCard() {
    if (isClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onBack();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onBack();
      closeTimerRef.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsClosing(false));
      });
    }, 1120);
  }

  return (
    <StoneSurface
      as="article"
      variant="card"
      aria-hidden={hidden || undefined}
      aria-expanded={active}
      className={cardClassName}
      data-course-id={course.id}
      style={{ "--card-y": `${cardIndex * 124}px` } as React.CSSProperties}
      onClick={(event) => {
        if (!active) {
          rememberCardOpenOffset(event.currentTarget);
          onOpen();
        }
      }}
      onKeyDown={(event) => {
        if (!active && (event.key === "Enter" || event.key === " ")) rememberCardOpenOffset(event.currentTarget);
        onKeyDown(event);
      }}
      role={active ? "region" : "button"}
      tabIndex={hidden ? -1 : 0}
    >
      {showCompletionCelebration && (
        <div className="lesson-complete-confetti" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} style={{ left: `${4 + (index * 17) % 92}%`, animationDelay: `${(index % 6) * 55}ms` }} />
          ))}
        </div>
      )}
      {isModuleTransitioning && (
        <div className="module-transition-progress" aria-label="Loading next module" role="progressbar">
          <i />
        </div>
      )}
      <div className="card-top">
        <div><span className={`experience-type-badge is-${course.experienceType}`}>{learningExperienceLabel(course.experienceType)}</span><h2>{course.title}</h2><small className="card-created-at">{formatCourseCreatedAt(course)}</small></div>
        <div className="card-actions">
          {active && view && <button
            className="card-back"
            disabled={isClosing}
            onClick={(event) => {
              event.stopPropagation();
              onViewChange(null);
            }}
            type="button"
          >
            Back
          </button>}
          <button
            aria-label={active ? `Close ${course.title}` : `Delete ${course.title}`}
            className={active ? "card-close" : "card-delete"}
            disabled={hidden || isClosing}
            onClick={(event) => {
              event.stopPropagation();
              if (active) closeCard();
              else onDelete();
            }}
            title={active ? "Close learning path" : "Delete learning path"}
            type="button"
          >
            {active ? <X aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="rule" />
      <div className="card-summary">
        <div className="card-progress-row">
          <div className="progress">
            <i style={{ width: `${progress}%` }} />
          </div>
          <span className="percent">{progress}%</span>
        </div>
      </div>
      <div className="card-detail">
        {active ? (
          <CourseHome
            course={course}
            isProjectStarted={isProjectStarted}
            lessonIndex={lessonIndex}
            onStartOrResume={() => {
              onStartProject(course);
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
                  {tutorVisual && tutorVisualUrl && (
                    <button className="tutor-visual-attachment" onClick={() => setIsVisualViewerOpen(true)} type="button">
                      <img alt={tutorVisual.altText} src={tutorVisualUrl} />
                      <span>{tutorVisual.caption}<small>Open larger</small></span>
                    </button>
                  )}
                </div>
                {lesson.kind === "multiple-choice" && lessonIntroReady && (
                  <div className="lesson-options is-entering" aria-label="Topic practice choices">
                    {lesson.options?.map((option, index) => (
                      <button
                        className={[
                          selectedOptionIndex === index ? "is-selected" : "",
                          selectedOptionIndex === index && gradingPassed === true ? "is-correct" : "",
                          selectedOptionIndex === index && gradingPassed === false ? "is-incorrect" : ""
                        ].filter(Boolean).join(" ")}
                        key={option.label}
                        disabled={isGrading || exerciseComplete}
                        onClick={() => void gradeMultipleChoice(index)}
                        type="button"
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {option.label}
                      </button>
                    ))}
                    {selectedOption && (
                      <p className={`option-feedback${gradingPassed === true ? " is-correct" : gradingPassed === false ? " is-incorrect" : " is-checking"}`}>
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
                    {message.role === "assistant" && message.toolPayload?.patches.map((patch) => (
                      <section className={`tutor-patch-card is-${patch.status}`} key={patch.toolCallId}>
                        <span>Proposed code patch</span>
                        <strong>{patch.summary}</strong>
                        <p>{patch.patches.map((change) => change.path).join(" · ")}</p>
                        <div>
                          {patch.status === "pending" && <button onClick={() => {
                            setTutorPatchError(null);
                            try { onRejectTutorPatch(message.id, patch.toolCallId); } catch (caughtError) { setTutorPatchError(caughtError instanceof Error ? caughtError.message : "Could not reject patch."); }
                          }} type="button">Reject</button>}
                          {patch.status === "pending" && <button className="is-primary" onClick={() => {
                            setTutorPatchError(null);
                            try { onApplyTutorPatch(message.id, patch.toolCallId); } catch (caughtError) { setTutorPatchError(caughtError instanceof Error ? caughtError.message : "Could not apply patch."); }
                          }} type="button">Apply</button>}
                          {patch.status === "applied" && <button onClick={() => {
                            setTutorPatchError(null);
                            try { onUndoTutorPatch(message.id, patch.toolCallId); } catch (caughtError) { setTutorPatchError(caughtError instanceof Error ? caughtError.message : "Could not undo patch."); }
                          }} type="button">Undo</button>}
                          {patch.status !== "pending" && <em>{patch.status}</em>}
                        </div>
                      </section>
                    ))}
                  </div>
                ))}
                {tutorPatchError && <div className="ai-message assistant-message workshop-check-message"><strong>Patch not applied</strong><p>{tutorPatchError}</p></div>}
                {lesson.codeExercise && (isGrading || Boolean(editorExerciseFeedback && !editorExerciseComplete)) && (
                  <div className={`ai-message assistant-message workshop-check-message${!isGrading ? " is-error" : ""}`} aria-live="polite">
                    <strong>{lesson.codeExercise.filePath} · {isGrading ? "checking" : "needs another look"}</strong>
                    {isGrading && <p>Checking the current editor code against this step.</p>}
                    {!isGrading && editorExerciseFeedback && <p>{editorExerciseFeedback}</p>}
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
                {lesson.kind === "chat-exercise" && lessonIntroReady && !exerciseComplete && (
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
                  <p className={`option-feedback${gradingPassed === true ? " is-correct" : gradingPassed === false ? " is-incorrect" : ""}`}>{gradingFeedback}</p>
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
                          <span className={`is-${criterion.status}`} key={criterion.label}>
                            <i aria-hidden="true">{criterion.status === "passed" ? "✓" : ""}</i>
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
                  <button disabled={safeLessonIndex === 0 || isModuleTransitioning} onClick={() => moveLesson(-1)} type="button">Prev</button>
                  <button
                    className={[nextStartsNewChapter ? "next-chapter-button" : "", isExerciseLesson && exerciseComplete ? "is-complete-action" : ""].filter(Boolean).join(" ")}
                    disabled={nextDisabled}
                    onClick={canGenerateNextProjectMilestone ? () => void generateNextProjectMilestone() : lesson.codeExercise ? handleEditorExercisePrimaryAction : () => moveLesson(1)}
                    type="button"
                  >
                    {isGeneratingNextSegment
                      ? "Generating milestone..."
                      : awaitingNextGeneratedModule
                        ? "Module complete"
                      : canGenerateNextProjectMilestone
                        ? "Generate next milestone"
                        : isExerciseLesson && exerciseComplete
                          ? nextCrossesModule ? "Module complete" : "Next"
                        : lesson.codeExercise
                      ? isGrading
                        ? "Checking..."
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
      {isVisualViewerOpen && tutorVisual && tutorVisualUrl && (
        <TutorVisualViewer attachment={tutorVisual} onClose={() => setIsVisualViewerOpen(false)} src={tutorVisualUrl} />
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

function TutorVisualViewer({ attachment, onClose, src }: { attachment: TutorVisualAttachmentV1; onClose: () => void; src: string }) {
  const [zoom, setZoom] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])") ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="tutor-visual-viewer" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <section aria-describedby="tutor-visual-caption" aria-label="Enlarged tutor visual" aria-modal="true" ref={dialogRef} role="dialog">
        <header>
          <p id="tutor-visual-caption">{attachment.caption}</p>
          <div>
            <button aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} type="button"><ZoomOut /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))} type="button"><ZoomIn /></button>
            <button aria-label="Close visual" onClick={onClose} ref={closeButtonRef} type="button"><X /></button>
          </div>
        </header>
        <div
          className="tutor-visual-stage"
          onPointerDown={(event) => {
            const stage = stageRef.current;
            if (!stage) return;
            dragRef.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
            stage.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const stage = stageRef.current;
            const drag = dragRef.current;
            if (!stage || !drag) return;
            stage.scrollLeft = drag.left - (event.clientX - drag.x);
            stage.scrollTop = drag.top - (event.clientY - drag.y);
          }}
          onPointerUp={() => { dragRef.current = null; }}
          ref={stageRef}
        >
          <img alt={attachment.altText} src={src} style={{ transform: `scale(${zoom})` }} />
        </div>
      </section>
    </div>,
    document.body
  );
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

function formatCourseCreatedAt(course: CourseCardProps["course"]) {
  if (!course.createdAt) return `Created ${course.updatedAt}`;
  const created = new Date(course.createdAt);
  if (Number.isNaN(created.getTime())) return `Created ${course.updatedAt}`;
  return `Created ${created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
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

function buildInitialCriteriaStatus(criteria: string[] | undefined, completed = false) {
  return (criteria ?? []).map((label) => ({ label, status: completed ? "passed" as const : "idle" as const }));
}

function evaluateAcceptanceCriteria(code: string, criteria: string[], forcePassed: boolean) {
  return criteria.map((label) => ({
    label,
    status: forcePassed || evaluateSingleCriterion(code, label) ? "passed" as const : "idle" as const
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

function isGeneratedModuleReady(course: Course, moduleId: string) {
  const content = course.courseContent;
  if (!content || content.schemaVersion === "course-content/v1") return false;
  if (content.schemaVersion !== "course-content/v2") return true;
  const progressiveModule = content.progressiveGeneration?.modules.find((module) => module.id === moduleId);
  if (progressiveModule) return progressiveModule.status === "ready";
  return Boolean(content.modules.find((module) => module.id === moduleId)?.unlocked);
}

function hasPendingGeneratedModules(course: Course) {
  const content = course.courseContent;
  return Boolean(
    content?.schemaVersion === "course-content/v2"
    && content.progressiveGeneration?.status === "background"
    && content.progressiveGeneration.readyModuleCount < content.progressiveGeneration.totalModules
  );
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
