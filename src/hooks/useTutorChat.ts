import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { requestTutorReply } from "@/ai/tutorClient";
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
  setStoredState
}: {
  active: ActiveState | null;
  storedState: StoredCourseState;
  setStoredState: Dispatch<SetStateAction<StoredCourseState>>;
}) {
  const { isConfigured, user } = useAuth();
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const finishTyping = useCallback(() => setTypingMessageId(null), []);
  const isSupabaseBacked = isConfigured && Boolean(user);

  async function updateCourseChat(course: Course, message: string, lessonIndex: number) {
    const userMessage = createStoredMessage("user", message, lessonIndex);
    const currentFiles = storedState.workspaceFilesByCourse[course.id] ?? [];

    setStoredState((current) => ({
      ...current,
      chatByCourse: {
        ...current.chatByCourse,
        [course.id]: [
          ...(current.chatByCourse[course.id] ?? []),
          userMessage
        ]
      }
    }));
    persistChatMessage(course.id, "user", message, lessonIndex);

    let reply: string;
    try {
      reply = await requestTutorReply({
        course,
        files: currentFiles,
        currentFile: currentFiles[active?.fileIndex ?? 0] ?? null,
        recentMessages: [...(storedState.chatByCourse[course.id] ?? []), userMessage],
        userMessage: message
      });
    } catch (error) {
      reply = `## Tutor unavailable

${error instanceof Error ? error.message : "The tutor request failed."}

\`Next\`: check the server terminal and try again.`;
    }

    const assistantMessage = createStoredMessage("assistant", reply, lessonIndex);

    setStoredState((current) => ({
      ...current,
      chatByCourse: {
        ...current.chatByCourse,
        [course.id]: [
          ...(current.chatByCourse[course.id] ?? []),
          assistantMessage
        ]
      }
    }));
    persistChatMessage(course.id, "assistant", reply, lessonIndex);
    setTypingMessageId(assistantMessage.id);
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
