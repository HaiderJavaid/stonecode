import { CourseWorkspace } from "@/components/stonecode/CourseWorkspace";
import { CourseSetupCard } from "@/components/stonecode/CourseSetupCard";
import { DashboardPage } from "@/components/stonecode/DashboardPage";
import { useCourseWorkspace } from "@/hooks/useCourseWorkspace";
import { useTerminalRunner } from "@/hooks/useTerminalRunner";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useState } from "react";

export function StonecodePrototype() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const workspace = useCourseWorkspace();
  const terminal = useTerminalRunner(workspace.selectedFile);
  const tutor = useTutorChat({
    active: workspace.active,
    storedState: workspace.storedState,
    setStoredState: workspace.setStoredState
  });

  return (
    <main
      className={`scene${workspace.active ? " has-panel" : ""}`}
      aria-label="Stonecode programming tutor workspace"
      style={{ "--code-light": workspace.activeCourse?.light ?? 1 } as React.CSSProperties}
    >
      <div className="wall-grain" aria-hidden="true" />
      <div className="light light-a" aria-hidden="true" />
      <div className="light light-b" aria-hidden="true" />

      <CourseWorkspace
        active={workspace.active}
        activeCourse={workspace.activeCourse}
        activeFiles={workspace.activeFiles}
        activeFolders={workspace.activeFolders}
        isRunningCode={terminal.isRunningCode}
        onClearTerminal={terminal.clearTerminal}
        onCreateFile={workspace.createWorkspaceFile}
        onCreateFolder={workspace.createWorkspaceFolder}
        onDeleteFile={workspace.deleteWorkspaceFile}
        onFileChange={workspace.updateFileContent}
        onMoveFile={workspace.moveWorkspaceFile}
        onMoveFolder={workspace.moveWorkspaceFolder}
        onRenameFile={workspace.renameWorkspaceFile}
        onRun={terminal.runActiveFile}
        onSelectFile={workspace.selectFile}
        selectedFile={workspace.selectedFile}
        terminalLogs={terminal.terminalLogs}
      />

      <aside className="side-note" aria-label="Figma order note">
        <span>FIGMA STYLE MUST BE IN THIS ORDER</span>
        <i className="dot red" />
        <i className="dot blue" />
        <i className="dot green" />
        <i className="dot purple" />
      </aside>

      <DashboardPage
        active={workspace.active}
        activeCourseCount={workspace.activeCourseCount}
        courses={workspace.userCourses}
        getCourseFiles={workspace.getCourseFiles}
        isSetupOpen={isSetupOpen}
        onCardKeyDown={workspace.handleCardKey}
        onChat={tutor.updateCourseChat}
        onCloseCourse={workspace.closeCourse}
        onLessonIndexChange={tutor.updateLessonStep}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenCourse={workspace.openCourse}
        onResetDemoState={workspace.resetDemoState}
        onStartProject={workspace.startProject}
        onTypingComplete={tutor.finishTyping}
        onViewChange={tutor.updateLessonView}
        storedState={workspace.storedState}
        typingMessageId={tutor.typingMessageId}
      />

      {isSetupOpen && !workspace.active && (
        <div className="setup-stage" aria-label="New course setup stage">
          <CourseSetupCard
            isOpen={isSetupOpen}
            onCancel={() => setIsSetupOpen(false)}
            onFinalize={(course) => {
              workspace.addLearningCourse(course);
              setIsSetupOpen(false);
            }}
          />
        </div>
      )}

      <p className="caption">stonecode</p>
    </main>
  );
}
