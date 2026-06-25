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
import { Link, useNavigate } from "react-router-dom";

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
  const [isBooting, setIsBooting] = useState(true);
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
        active={isSettingsView ? null : workspace.active}
        activeCourse={isSettingsView ? null : workspace.activeCourse}
        activeFiles={isSettingsView ? [] : workspace.activeFiles}
        activeFolders={isSettingsView ? [] : workspace.activeFolders}
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
        planName={subscriptionState.subscription.planName}
        selectedFile={isSettingsView ? null : workspace.selectedFile}
        terminalLogs={terminal.terminalLogs}
        userEmail={auth.user?.email ?? "stonecode.dev"}
      />

      {isSettingsView && settingsSection ? <SettingsScene section={settingsSection} /> : null}

      {!isSettingsView && (
        <aside className="side-note" aria-label="Figma order note">
          <span>FIGMA STYLE MUST BE IN THIS ORDER</span>
          <i className="dot red" />
          <i className="dot blue" />
          <i className="dot green" />
          <i className="dot purple" />
        </aside>
      )}

      <details className="session-menu">
        <summary aria-label="Open profile menu">
          <span>{auth.user?.email?.[0]?.toUpperCase() ?? "S"}</span>
        </summary>
        <nav aria-label="Profile menu">
          <strong>{auth.user?.email ?? "Stonecode user"}</strong>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/settings/overview">Settings</Link>
          <Link to="/settings/profile">Profile</Link>
          <Link to="/settings/billing">Billing</Link>
          <Link to="/settings/usage">Usage</Link>
          <Link to="/settings/support">Support</Link>
          <button onClick={handleSignOut} type="button">Sign out</button>
        </nav>
      </details>
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
