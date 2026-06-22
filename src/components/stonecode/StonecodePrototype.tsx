import { CourseWorkspace } from "@/components/stonecode/CourseWorkspace";
import { CourseSetupCard } from "@/components/stonecode/CourseSetupCard";
import { DashboardPage } from "@/components/stonecode/DashboardPage";
import { useAuth } from "@/auth/AuthProvider";
import { useCourseWorkspace } from "@/hooks/useCourseWorkspace";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useTerminalRunner } from "@/hooks/useTerminalRunner";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function StonecodePrototype({
  authRevealActive = false,
  onAuthRevealComplete
}: {
  authRevealActive?: boolean;
  onAuthRevealComplete?: () => void;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isFinalizingSetup, setIsFinalizingSetup] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [dashboardRevealReady, setDashboardRevealReady] = useState(!authRevealActive);
  const workspace = useCourseWorkspace();
  const subscriptionState = useSubscriptionState();
  const terminal = useTerminalRunner(workspace.selectedFile);
  const tutor = useTutorChat({
    active: workspace.active,
    storedState: workspace.storedState,
    setStoredState: workspace.setStoredState
  });

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
    const frame = window.requestAnimationFrame(() => setIsBooting(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function handleSignOut() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

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
      className={`scene${workspace.active ? " has-panel" : ""}${authRevealActive ? " auth-reveal-active" : ""}${dashboardRevealReady ? " auth-dashboard-ready" : ""}${isBooting ? " is-booting" : ""}`}
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

      <button className="session-logout" onClick={handleSignOut} type="button">
        Log out
      </button>

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
        onLessonIndexChange={tutor.updateLessonStep}
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

      {isSetupOpen && !workspace.active && (
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

      <p className="caption">stonecode</p>
    </main>
  );
}
