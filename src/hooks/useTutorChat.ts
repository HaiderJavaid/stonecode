import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { AiFileEdit } from "@/ai/fileEditCommands";
import { requestTutorReplyStream } from "@/ai/tutorClient";
import { updateTutorPatchStatus, validateClientTutorPatch } from "@/ai/tutorTools";
import { useAuth } from "@/auth/AuthProvider";
import { Course } from "@/data/courses";
import { LessonStep } from "@/components/stonecode/lessonData";
import { IndependentExercise } from "@/features/exercises/challengeData";
import {
  createStoredMessage,
  StoredChatMessage,
  StoredCourseState
} from "@/services/courseStorage";
import { createSupabaseChatMessage, updateSupabaseChatToolPayload } from "@/services/supabaseCourseStorage";
import { ActiveState, CardView } from "@/components/stonecode/types";

export function useTutorChat({
  active,
  storedState,
  setStoredState,
  onApplyFileEdits,
  onUndoFileEdits
}: {
  active: ActiveState | null;
  storedState: StoredCourseState;
  setStoredState: Dispatch<SetStateAction<StoredCourseState>>;
  onApplyFileEdits: (course: Course, edits: AiFileEdit[]) => { appliedCount: number };
  onUndoFileEdits: () => boolean;
}) {
  const { isConfigured, user } = useAuth();
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const finishTyping = useCallback(() => setTypingMessageId(null), []);
  const isSupabaseBacked = isConfigured && Boolean(user);

  async function updateCourseChat(course: Course, message: string, lessonIndex: number) {
    await streamTutorMessage({
      course,
      userMessage: message,
      lessonIndex,
      requestKind: "chat"
    });
  }

  async function requestLessonIntro(course: Course, lessonIndex: number, lesson: LessonStep) {
    const generatedKey = `lesson-intro:${lesson.sectionId ?? lessonIndex}`;
    if ((storedState.chatByCourse[course.id] ?? []).some((message) => message.generatedKey === generatedKey)) return;
    await streamTutorMessage({
      course,
      userMessage: `Generate the first teaching message for section ${lessonIndex + 1}: ${lesson.title}.`,
      lessonIndex,
      requestKind: "lesson_intro",
      messageKind: "lesson-intro",
      generatedKey,
      persistUserMessage: false,
      lesson: {
        index: lessonIndex,
        title: lesson.title,
        label: lesson.label,
        kind: lesson.kind,
        sectionId: lesson.sectionId,
        moduleId: lesson.moduleId,
        topicId: lesson.topicId,
        blockId: lesson.blockId,
        blockKind: lesson.blockKind,
        blockStepIndex: lesson.blockStepIndex,
        blockStepCount: lesson.blockStepCount
      }
    });
  }

  async function requestExerciseHint(course: Course, exercise: IndependentExercise, question: string, code: string) {
    const generatedKey = `exercise-hint:${exercise.id}:${getLocalDateKey()}`;
    const existing = (storedState.chatByCourse[course.id] ?? []).find((message) => message.generatedKey === generatedKey);
    if (existing?.content) return existing.content;
    const reply = await streamTutorMessage({
      course,
      userMessage: question,
      lessonIndex: undefined,
      requestKind: "exercise_hint",
      messageKind: "exercise-hint",
      generatedKey,
      persistUserMessage: false,
      exercise: {
        id: exercise.id,
        title: exercise.title,
        scenario: exercise.scenario,
        acceptanceCriteria: exercise.acceptanceCriteria,
        language: exercise.language,
        topic: exercise.topic,
        difficulty: exercise.difficulty,
        xp: exercise.xp,
        currentCode: code
      }
    });
    return reply;
  }

  async function requestExerciseTemplate(course: Course, exercise: IndependentExercise, code: string) {
    const currentFiles = storedState.workspaceFilesByCourse[course.id] ?? [];
    const currentFolders = storedState.workspaceFoldersByCourse[course.id] ?? [];
    const result = await requestTutorReplyStream(
      {
        course,
        files: currentFiles,
        folders: currentFolders,
        currentFile: currentFiles[active?.fileIndex ?? 0] ?? null,
        recentMessages: storedState.chatByCourse[course.id] ?? [],
        userMessage: "Create a concise fill-in template for this exercise answer.",
        requestKind: "exercise_template",
        exercise: {
          id: exercise.id,
          title: exercise.title,
          scenario: exercise.scenario,
          acceptanceCriteria: exercise.acceptanceCriteria,
          language: exercise.language,
          topic: exercise.topic,
          difficulty: exercise.difficulty,
          xp: exercise.xp,
          currentCode: code
        }
      },
      {
        onDelta() {
          // Template drafts are inserted into the composer, not the saved chat transcript.
        }
      }
    );
    return result.reply;
  }

  async function streamTutorMessage({
    course,
    userMessage: message,
    lessonIndex,
    requestKind,
    messageKind = "chat",
    generatedKey = null,
    persistUserMessage = true,
    lesson,
    exercise
  }: {
    course: Course;
    userMessage: string;
    lessonIndex?: number;
    requestKind: "chat" | "lesson_intro" | "exercise_hint" | "exercise_template";
    messageKind?: StoredChatMessage["messageKind"];
    generatedKey?: string | null;
    persistUserMessage?: boolean;
    lesson?: Parameters<typeof requestTutorReplyStream>[0]["lesson"];
    exercise?: Parameters<typeof requestTutorReplyStream>[0]["exercise"];
  }) {
    const existingGenerated = generatedKey
      ? (storedState.chatByCourse[course.id] ?? []).find((entry) => entry.generatedKey === generatedKey)
      : null;
    if (existingGenerated?.content) return existingGenerated.content;

    const userMessage = persistUserMessage ? createStoredMessage("user", message, lessonIndex) : null;
    const assistantMessage = createStoredMessage("assistant", "", lessonIndex, { messageKind, generatedKey });
    const currentFiles = storedState.workspaceFilesByCourse[course.id] ?? [];
    const currentFolders = storedState.workspaceFoldersByCourse[course.id] ?? [];

    setStoredState((current) => ({
      ...current,
      chatByCourse: {
        ...current.chatByCourse,
        [course.id]: [
          ...(current.chatByCourse[course.id] ?? []),
          ...(userMessage ? [userMessage] : []),
          assistantMessage
        ]
      }
    }));
    if (userMessage) persistChatMessage(course.id, userMessage.id, "user", message, lessonIndex, "chat", null, null);
    setTypingMessageId(assistantMessage.id);

    let reply: string;
    let toolPayload: StoredChatMessage["toolPayload"] = null;
    try {
      const result = await requestTutorReplyStream(
        {
          course,
          files: currentFiles,
          folders: currentFolders,
          currentFile: currentFiles[active?.fileIndex ?? 0] ?? null,
          recentMessages: [...(storedState.chatByCourse[course.id] ?? []), ...(userMessage ? [userMessage] : [])],
          userMessage: message,
          requestKind,
          lesson,
          exercise
        },
        {
          onDelta(chunk) {
            setStoredState((current) => ({
              ...current,
              chatByCourse: {
                ...current.chatByCourse,
                [course.id]: (current.chatByCourse[course.id] ?? []).map((entry) =>
                  entry.id === assistantMessage.id
                    ? {
                        ...entry,
                        content: entry.content + chunk
                      }
                    : entry
                )
              }
            }));
          }
        }
      );
      reply = result.reply;
      toolPayload = result.tools.length ? { patches: result.tools } : null;
      if (result.toolErrors.length) {
        reply = `${reply}\n\n_Patch proposal was withheld: ${result.toolErrors.join(" ")}_`.trim();
      }
    } catch (error) {
      reply = `## Tutor unavailable

${error instanceof Error ? error.message : "The tutor request failed."}

\`Next\`: check the server terminal and try again.`;
      setStoredState((current) => ({
        ...current,
        chatByCourse: {
          ...current.chatByCourse,
          [course.id]: (current.chatByCourse[course.id] ?? []).map((entry) =>
            entry.id === assistantMessage.id
              ? {
                  ...entry,
                  content: reply
                }
              : entry
          )
        }
      }));
    }

    if (toolPayload) {
      setStoredState((current) => ({
        ...current,
        chatByCourse: {
          ...current.chatByCourse,
          [course.id]: (current.chatByCourse[course.id] ?? []).map((entry) =>
            entry.id === assistantMessage.id
              ? {
                  ...entry,
                  content: reply,
                  toolPayload
                }
              : entry
          )
        }
      }));
    }

    persistChatMessage(course.id, assistantMessage.id, "assistant", reply, lessonIndex, messageKind, generatedKey, toolPayload);
    setTypingMessageId(null);
    return reply;
  }

  function applyTutorPatch(course: Course, messageId: string, toolCallId: string) {
    const message = (storedState.chatByCourse[course.id] ?? []).find((entry) => entry.id === messageId);
    const patch = message?.toolPayload?.patches.find((entry) => entry.toolCallId === toolCallId);
    if (!message || !patch) throw new Error("Tutor patch not found.");
    const files = storedState.workspaceFilesByCourse[course.id] ?? [];
    const edits = validateClientTutorPatch(patch, files);
    const result = onApplyFileEdits(course, edits);
    if (result.appliedCount !== edits.length) throw new Error("Tutor patch could not be fully applied.");
    setTutorPatchStatus(course.id, messageId, toolCallId, "applied");
  }

  function rejectTutorPatch(course: Course, messageId: string, toolCallId: string) {
    setTutorPatchStatus(course.id, messageId, toolCallId, "rejected");
  }

  function undoTutorPatch(course: Course, messageId: string, toolCallId: string) {
    if (!onUndoFileEdits()) throw new Error("There is no matching tutor edit to undo.");
    setTutorPatchStatus(course.id, messageId, toolCallId, "undone");
  }

  function setTutorPatchStatus(courseId: string, messageId: string, toolCallId: string, status: "applied" | "rejected" | "undone") {
    const currentMessage = (storedState.chatByCourse[courseId] ?? []).find((entry) => entry.id === messageId);
    const nextPayload = updateTutorPatchStatus(currentMessage?.toolPayload ?? undefined, toolCallId, status) ?? null;
    setStoredState((current) => {
      const messages = (current.chatByCourse[courseId] ?? []).map((entry) => {
        if (entry.id !== messageId) return entry;
        return { ...entry, toolPayload: nextPayload };
      });
      return { ...current, chatByCourse: { ...current.chatByCourse, [courseId]: messages } };
    });
    if (isSupabaseBacked) {
      queueMicrotask(() => updateSupabaseChatToolPayload(courseId, messageId, nextPayload ?? null).catch(() => null));
    }
  }

  function persistChatMessage(
    courseId: string,
    clientMessageId: string,
    role: "user" | "assistant",
    content: string,
    lessonIndex: number | undefined,
    messageKind: StoredChatMessage["messageKind"] = "chat",
    generatedKey: string | null = null,
    toolPayload: StoredChatMessage["toolPayload"] = null
  ) {
    if (!isSupabaseBacked) return;
    createSupabaseChatMessage({ courseId, role, content, lessonIndex, messageKind, generatedKey, clientMessageId, toolPayload }).catch(() => {
      // Local UI should keep working when persistence fails; reload will expose durable state.
    });
  }

  function updateLessonView(courseId: string, view: CardView | null) {
    setStoredState((current) => ({
      ...current,
      lessonViewByCourse: {
        ...current.lessonViewByCourse,
        [courseId]: view
      }
    }));
  }

  function updateLessonStep(courseId: string, lessonIndex: number) {
    setStoredState((current) => ({
      ...current,
      lessonStepByCourse: {
        ...current.lessonStepByCourse,
        [courseId]: lessonIndex
      }
    }));
  }

  return {
    typingMessageId,
    finishTyping,
    updateCourseChat,
    requestLessonIntro,
    requestExerciseHint,
    requestExerciseTemplate,
    applyTutorPatch,
    rejectTutorPatch,
    undoTutorPatch,
    updateLessonView,
    updateLessonStep
  };
}

function getLocalDateKey() {
  return new Date().toLocaleDateString("en-CA");
}
