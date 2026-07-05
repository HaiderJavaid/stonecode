import { CourseWorkspace } from "@/components/stonecode/CourseWorkspace";
import { CourseSetupCard } from "@/components/stonecode/CourseSetupCard";
import { DashboardPage } from "@/components/stonecode/DashboardPage";
import { SettingsScene, StonecodeSettingsSection } from "@/components/stonecode/SettingsScene";
import { useAuth } from "@/auth/AuthProvider";
import { useCourseWorkspace } from "@/hooks/useCourseWorkspace";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useTerminalRunner } from "@/hooks/useTerminalRunner";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const dashboardBootStorageKey = "stonecode.dashboardBooted.v1";

export function StonecodePrototype({
  authRevealActive = false,
  onAuthRevealComplete,
  settingsSection = null
}: {
  authRevealActive?: boolean;
  onAuthRevealComplete?: () => void;
  settingsSection?: StonecodeSettingsSection | null;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isFinalizingSetup, setIsFinalizingSetup] = useState(false);
  const [isBooting, setIsBooting] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(dashboardBootStorageKey) !== "true";
  });
  const [dashboardRevealReady, setDashboardRevealReady] = useState(!authRevealActive);
  const workspace = useCourseWorkspace();
  const subscriptionState = useSubscriptionState();
  const terminal = useTerminalRunner(workspace.selectedFile);
  const tutor = useTutorChat({
    active: workspace.active,
    storedState: workspace.storedState,
    setStoredState: workspace.setStoredState,
    onApplyFileEdits: workspace.applyAiEdits,
    onRunActiveFile: () => terminal.runFile(workspace.selectedFile, "AI")
  });
  const isSettingsView = settingsSection !== null;
  const settingsReturnPath = workspace.active?.courseId ? `/courses/${workspace.active.courseId}` : "/dashboard";

  useEffect(() => {
    if (!authRevealActive) return;
    const timer = window.setTimeout(() => onAuthRevealComplete?.(), 3400);
    return () => window.clearTimeout(timer);
  }, [authRevealActive, onAuthRevealComplete]);

  useEffect(() => {
    if (!authRevealActive) {
      setDashboardRevealReady(true);
      return;
    }

    setDashboardRevealReady(false);
    if (!workspace.isWorkspaceReady) return;

    let frame = 0;
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => setDashboardRevealReady(true));
    }, 220);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [authRevealActive, workspace.isWorkspaceReady]);

  useEffect(() => {
    if (!isBooting) return;
    const frame = window.requestAnimationFrame(() => setIsBooting(false));
    window.sessionStorage.setItem(dashboardBootStorageKey, "true");
    return () => window.cancelAnimationFrame(frame);
  }, [isBooting]);

  async function handleResetDemoState() {
    try {
      await workspace.resetDemoState();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to reset courses.");
    }
  }

  async function handleFinalizeCourse(course: Parameters<typeof workspace.addLearningCourse>[0]) {
    setSetupError(null);
    setIsFinalizingSetup(true);
    try {
      await workspace.addLearningCourse(course);
      setIsSetupOpen(false);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to create course.");
    } finally {
      setIsFinalizingSetup(false);
    }
  }

  return (
    <main
      className={`scene${workspace.active ? " has-panel" : ""}${isSettingsView ? " is-settings" : ""}${authRevealActive ? " auth-reveal-active" : ""}${dashboardRevealReady ? " auth-dashboard-ready" : ""}${isBooting ? " is-booting" : ""}`}
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
        activeLessonIndex={workspace.activeCourse ? workspace.storedState.lessonStepByCourse[workspace.activeCourse.id] ?? 0 : 0}
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
        onLessonNavigate={(lessonIndex) => {
          if (!workspace.activeCourse) return;
          tutor.updateLessonStep(workspace.activeCourse.id, lessonIndex);
          tutor.updateLessonView(workspace.activeCourse.id, "resume");
        }}
        planName={subscriptionState.subscription.planName}
        selectedFile={workspace.selectedFile}
        terminalLogs={terminal.terminalLogs}
        userEmail={auth.user?.email ?? "stonecode.dev"}
      />

      {isSettingsView && settingsSection ? <SettingsScene returnPath={settingsReturnPath} section={settingsSection} /> : null}

      {!isSettingsView && (
        <aside className="side-note" aria-label="Figma order note">
          <span>FIGMA STYLE MUST BE IN THIS ORDER</span>
          <i className="dot red" />
          <i className="dot blue" />
          <i className="dot green" />
          <i className="dot purple" />
        </aside>
      )}

      {workspace.canUndoAiEdit && (
        <button className="session-logout ai-undo-edit" onClick={workspace.undoLastAiEdit} type="button">
          Undo AI edit
        </button>
      )}

      {!isSettingsView && (
        <DashboardPage
          active={workspace.active}
          activeCourseCount={workspace.activeCourseCount}
          courses={workspace.userCourses}
          getCourseFiles={workspace.getCourseFiles}
          isSubscriptionLoading={subscriptionState.isLoading}
          isSetupOpen={isSetupOpen}
          onCardKeyDown={workspace.handleCardKey}
          onChat={tutor.updateCourseChat}
          onCloseCourse={workspace.closeCourse}
          onExerciseHint={tutor.requestExerciseHint}
          onExerciseTemplate={tutor.requestExerciseTemplate}
          onGenerateChapter={workspace.generateCourseChapter}
          onLoadExerciseFile={workspace.loadExerciseFile}
          onLessonIndexChange={tutor.updateLessonStep}
          requestLessonIntro={tutor.requestLessonIntro}
          onOpenSetup={() => {
            setSetupError(null);
            setIsSetupOpen(true);
          }}
          onOpenCourse={workspace.openCourse}
          onResetDemoState={handleResetDemoState}
          onStartProject={workspace.startProject}
          onTypingComplete={tutor.finishTyping}
          onViewChange={tutor.updateLessonView}
          storedState={workspace.storedState}
          subscription={subscriptionState.subscription}
          subscriptionError={subscriptionState.error}
          typingMessageId={tutor.typingMessageId}
        />
      )}

      {isSetupOpen && !workspace.active && !isSettingsView && (
        <div className="setup-stage" aria-label="New course setup stage">
          <CourseSetupCard
            error={setupError}
            isOpen={isSetupOpen}
            isFinalizing={isFinalizingSetup}
            onCancel={() => {
              setSetupError(null);
              setIsSetupOpen(false);
            }}
            onFinalize={handleFinalizeCourse}
          />
        </div>
      )}

      {!isSettingsView && <p className="caption">stonecode</p>}
    </main>
  );
}
