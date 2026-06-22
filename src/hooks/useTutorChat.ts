import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { extractAiFileEdits, extractAiRunCommand, AiFileEdit } from "@/ai/fileEditCommands";
import { requestTutorReplyStream } from "@/ai/tutorClient";
import { useAuth } from "@/auth/AuthProvider";
import { Course } from "@/data/courses";
import {
  createStoredMessage,
  StoredCourseState
} from "@/services/courseStorage";
import { createSupabaseChatMessage } from "@/services/supabaseCourseStorage";
import { ActiveState, CardView } from "@/components/stonecode/types";

export function useTutorChat({
  active,
  storedState,
  setStoredState,
  onApplyFileEdits,
  onRunActiveFile
}: {
  active: ActiveState | null;
  storedState: StoredCourseState;
  setStoredState: Dispatch<SetStateAction<StoredCourseState>>;
  onApplyFileEdits: (course: Course, edits: AiFileEdit[]) => { appliedCount: number };
  onRunActiveFile: () => void;
}) {
  const { isConfigured, user } = useAuth();
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const finishTyping = useCallback(() => setTypingMessageId(null), []);
  const isSupabaseBacked = isConfigured && Boolean(user);

  async function updateCourseChat(course: Course, message: string, lessonIndex: number) {
    const userMessage = createStoredMessage("user", message, lessonIndex);
    const assistantMessage = createStoredMessage("assistant", "", lessonIndex);
    const currentFiles = storedState.workspaceFilesByCourse[course.id] ?? [];

    setStoredState((current) => ({
      ...current,
      chatByCourse: {
        ...current.chatByCourse,
        [course.id]: [
          ...(current.chatByCourse[course.id] ?? []),
          userMessage,
          assistantMessage
        ]
      }
    }));
    persistChatMessage(course.id, "user", message, lessonIndex);
    setTypingMessageId(assistantMessage.id);

    let reply: string;
    try {
      reply = await requestTutorReplyStream(
        {
          course,
          files: currentFiles,
          currentFile: currentFiles[active?.fileIndex ?? 0] ?? null,
          recentMessages: [...(storedState.chatByCourse[course.id] ?? []), userMessage],
          userMessage: message
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

    const fileExtraction = extractAiFileEdits(reply);
    const runExtraction = extractAiRunCommand(fileExtraction.displayReply);
    const applied = onApplyFileEdits(course, fileExtraction.edits);
    if (runExtraction.shouldRunActiveFile) onRunActiveFile();
    const finalReply = formatFinalReply(runExtraction.displayReply, applied.appliedCount, runExtraction.shouldRunActiveFile);

    if (finalReply !== reply) {
      setStoredState((current) => ({
        ...current,
        chatByCourse: {
          ...current.chatByCourse,
          [course.id]: (current.chatByCourse[course.id] ?? []).map((entry) =>
            entry.id === assistantMessage.id
              ? {
                  ...entry,
                  content: finalReply
                }
              : entry
          )
        }
      }));
    }

    persistChatMessage(course.id, "assistant", finalReply, lessonIndex);
    setTypingMessageId(null);
  }

  function persistChatMessage(courseId: string, role: "user" | "assistant", content: string, lessonIndex: number) {
    if (!isSupabaseBacked) return;
    createSupabaseChatMessage({ courseId, role, content, lessonIndex }).catch(() => {
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
    updateLessonView,
    updateLessonStep
  };
}

function formatFinalReply(reply: string, appliedCount: number, didRunFile: boolean) {
  if (!appliedCount && !didRunFile) return reply;
  const baseReply = reply.trim() || "Updated the workspace.";
  const notes = [];
  if (appliedCount) notes.push(`applied ${appliedCount} file edit${appliedCount === 1 ? "" : "s"}`);
  if (didRunFile) notes.push("ran the active file in the terminal");
  return `${baseReply}\n\n_Stonecode ${notes.join(" and ")}._`;
}
