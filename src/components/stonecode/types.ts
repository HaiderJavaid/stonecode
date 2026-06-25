import { Course } from "@/data/courses";
import { StoredChatMessage } from "@/services/courseStorage";
import { KeyboardEvent } from "react";
import { PlanTier } from "@/lib/database.types";

export type ActiveState = {
  courseId: Course["id"];
  fileIndex: number;
};

export type CardView = "resume" | "progress" | "exercises";

export type CourseCardProps = {
  active: boolean;
  hidden: boolean;
  hiddenDirection: "before" | "after";
  course: Course;
  cardIndex: number;
  chatMessages: StoredChatMessage[];
  fileCount: number;
  lessonIndex: number;
  view: CardView | null;
  onOpen: () => void;
  onBack: () => void;
  onChat: (message: string, lessonIndex: number) => void;
  onLessonIndexChange: (lessonIndex: number) => void;
  onViewChange: (view: CardView | null) => void;
  onStartProject: (course: Course) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onTypingComplete: () => void;
  typingMessageId: string | null;
  plan: PlanTier;
};
