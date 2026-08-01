import { Course, GeneratedExerciseWorkspaceFile } from "@/data/courses";
import { StoredChatMessage } from "@/services/courseStorage";
import { KeyboardEvent } from "react";
import { PlanTier } from "@/lib/database.types";
import { LessonStep } from "@/components/stonecode/lessonData";
import { IndependentExercise } from "@/features/exercises/challengeData";
import { WorkspaceFile } from "@/services/workspaceFiles";

export type ActiveState = {
  courseId: Course["id"];
  fileIndex: number;
};

export type CardView = "resume" | "exercises";

export type EditorDiagnostic = {
  filePath?: string;
  line: number;
  message: string;
};

export type CourseCardProps = {
  active: boolean;
  hidden: boolean;
  hiddenDirection: "before" | "after";
  course: Course;
  cardIndex: number;
  chatMessages: StoredChatMessage[];
  activeFileContent: string;
  workspaceFiles: WorkspaceFile[];
  fileCount: number;
  lessonIndex: number;
  progress: number;
  view: CardView | null;
  onOpen: () => void;
  onDelete: () => void;
  onBack: () => void;
  onChat: (message: string, lessonIndex: number) => void;
  onApplyTutorPatch: (messageId: string, toolCallId: string) => void;
  onRejectTutorPatch: (messageId: string, toolCallId: string) => void;
  onUndoTutorPatch: (messageId: string, toolCallId: string) => void;
  requestLessonIntro: (lessonIndex: number, lesson: LessonStep) => void;
  onExerciseHint: (exercise: IndependentExercise, question: string, code: string) => Promise<string>;
  onExerciseTemplate: (exercise: IndependentExercise, code: string) => Promise<string>;
  onLoadExerciseFile: (path: string, content: string, replaceExisting?: boolean) => void;
  onLoadExerciseWorkspace: (files: GeneratedExerciseWorkspaceFile[], activeFilePath: string, replaceExisting?: boolean) => void;
  onEditorDiagnosticsChange: (diagnostics: EditorDiagnostic[]) => void;
  onGenerateChapter: (chapterIndex: number) => Promise<void>;
  onLessonIndexChange: (lessonIndex: number) => void;
  onViewChange: (view: CardView | null) => void;
  onStartProject: (course: Course) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onTypingComplete: () => void;
  typingMessageId: string | null;
  plan: PlanTier;
};
