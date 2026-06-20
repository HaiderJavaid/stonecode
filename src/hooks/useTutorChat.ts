import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { requestTutorReply } from "@/ai/tutorClient";
import { Course } from "@/data/courses";
import {
  createStoredMessage,
  StoredCourseState
} from "@/services/courseStorage";
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
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const finishTyping = useCallback(() => setTypingMessageId(null), []);

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
    setTypingMessageId(assistantMessage.id);
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
