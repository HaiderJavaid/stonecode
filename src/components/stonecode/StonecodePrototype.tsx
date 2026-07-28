import { CourseWorkspace } from "@/components/stonecode/CourseWorkspace";
import { CourseSetupCard } from "@/components/stonecode/CourseSetupCard";
import { DashboardPage } from "@/components/stonecode/DashboardPage";
import { SettingsScene, StonecodeSettingsSection } from "@/components/stonecode/SettingsScene";
import { useAuth } from "@/auth/AuthProvider";
import { useCourseWorkspace } from "@/hooks/useCourseWorkspace";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useTerminalRunner } from "@/hooks/useTerminalRunner";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EditorDiagnostic } from "@/components/stonecode/types";
import { promoDiscoveryServices } from "@/components/stonecode/promoDiscoveryScript";
import { AiCredentialGate } from "@/components/stonecode/AiCredentialGate";
import { useOpenAiCredential } from "@/hooks/useOpenAiCredential";

const dashboardBootStorageKey = "stonecode.dashboardBooted.v1";
const onboardingPanelExitMs = 480;
const onboardingDashboardEntranceMs = 960;
type OnboardingDashboardRevealPhase = "idle" | "waiting" | "revealing";

export function StonecodePrototype({
  authRevealActive = false,
  onAuthRevealComplete,
  onSignOutTransition,
  settingsSection = null,
  promoCapture = null
}: {
  authRevealActive?: boolean;
  onAuthRevealComplete?: () => void;
  onSignOutTransition?: () => void;
  settingsSection?: StonecodeSettingsSection | null;
  promoCapture?: "discovery" | null;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = settingsSection !== null;
  const isPromoCapture = promoCapture === "discovery";
  const usesPlainWorkspaceWall = isPromoCapture || isSettingsView || location.pathname === "/dashboard" || location.pathname.startsWith("/courses/");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isFinalizingSetup, setIsFinalizingSetup] = useState(false);
  const [editorDiagnostics, setEditorDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [isAiCredentialGateOpen, setIsAiCredentialGateOpen] = useState(false);
  const [isAiCredentialGateExiting, setIsAiCredentialGateExiting] = useState(false);
  const [onboardingDashboardRevealPhase, setOnboardingDashboardRevealPhase] = useState<OnboardingDashboardRevealPhase>(() => {
    if (typeof window === "undefined") return "idle";
    return location.pathname === "/dashboard" && new URLSearchParams(location.search).get("firstRun") === "1" ? "waiting" : "idle";
  });
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
  const [isBooting, setIsBooting] = useState(() => {
    if (promoCapture) return false;
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(dashboardBootStorageKey) !== "true";
  });
  const [dashboardRevealReady, setDashboardRevealReady] = useState(!authRevealActive);
  const aiGateExitTimerRef = useRef<number | null>(null);
  const onboardingRevealTimerRef = useRef<number | null>(null);
  const workspace = useCourseWorkspace();
  const subscriptionState = useSubscriptionState();
  const openAiCredentialState = useOpenAiCredential({
    accessToken: auth.session?.access_token ?? null,
    enabled: !isPromoCapture
      && !isSettingsView
      && !subscriptionState.isLoading
      && !subscriptionState.error
      && subscriptionState.subscription.requiresOwnOpenAiKey
  });
  const terminal = useTerminalRunner(workspace.selectedFile);
  const tutor = useTutorChat({
    active: workspace.active,
    storedState: workspace.storedState,
    setStoredState: workspace.setStoredState,
    onApplyFileEdits: workspace.applyAiEdits,
    onRunActiveFile: () => terminal.runFile(workspace.selectedFile, "AI")
  });
  const visibleActive = isPromoCapture ? null : workspace.active;
  const visibleActiveCourse = isPromoCapture ? null : workspace.activeCourse;
  const settingsReturnPath = workspace.active?.courseId ? `/courses/${workspace.active.courseId}` : "/dashboard";

  const revealDashboardFromOnboarding = useCallback(() => {
    setIsAiCredentialGateOpen(false);
    setIsAiCredentialGateExiting(false);
    setOnboardingDashboardRevealPhase("revealing");
    navigate("/dashboard", { replace: true });
    if (onboardingRevealTimerRef.current) window.clearTimeout(onboardingRevealTimerRef.current);
    onboardingRevealTimerRef.current = window.setTimeout(() => {
      setOnboardingDashboardRevealPhase("idle");
    }, onboardingDashboardEntranceMs);
  }, [navigate]);

  const exitAiCredentialGate = useCallback((onExited?: () => void) => {
    if (aiGateExitTimerRef.current) return;
    setIsAiCredentialGateExiting(true);
    aiGateExitTimerRef.current = window.setTimeout(() => {
      aiGateExitTimerRef.current = null;
      setIsAiCredentialGateOpen(false);
      setIsAiCredentialGateExiting(false);
      onExited?.();
    }, onboardingPanelExitMs);
  }, []);

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

  useEffect(() => () => {
    if (aiGateExitTimerRef.current) window.clearTimeout(aiGateExitTimerRef.current);
    if (onboardingRevealTimerRef.current) window.clearTimeout(onboardingRevealTimerRef.current);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/dashboard" || isSettingsView || isPromoCapture) return;
    if (subscriptionState.isLoading) return;
    if (subscriptionState.error) {
      if (onboardingDashboardRevealPhase === "waiting") setIsAiCredentialGateOpen(true);
      return;
    }
    if (!subscriptionState.subscription.requiresOwnOpenAiKey) {
      if (onboardingDashboardRevealPhase === "waiting") revealDashboardFromOnboarding();
      return;
    }
    if (openAiCredentialState.isLoading || openAiCredentialState.credential === null) return;
    if (openAiCredentialState.credential.configured) {
      if (onboardingDashboardRevealPhase === "waiting") revealDashboardFromOnboarding();
      return;
    }
    if (onboardingDashboardRevealPhase === "waiting") setIsAiCredentialGateOpen(true);
  }, [
    isPromoCapture,
    isSettingsView,
    location.pathname,
    openAiCredentialState.credential,
    openAiCredentialState.isLoading,
    onboardingDashboardRevealPhase,
    revealDashboardFromOnboarding,
    subscriptionState.error,
    subscriptionState.isLoading,
    subscriptionState.subscription.requiresOwnOpenAiKey
  ]);

  useEffect(() => {
    if (onboardingDashboardRevealPhase !== "waiting") return;
    if (location.pathname !== "/dashboard" || isSettingsView || isPromoCapture) return;
    if (subscriptionState.isLoading || !subscriptionState.subscription.requiresOwnOpenAiKey) return;
    const timer = window.setTimeout(() => setIsAiCredentialGateOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [
    isPromoCapture,
    isSettingsView,
    location.pathname,
    onboardingDashboardRevealPhase,
    subscriptionState.isLoading,
    subscriptionState.subscription.requiresOwnOpenAiKey
  ]);

  function dismissAiCredentialGate() {
    exitAiCredentialGate(onboardingDashboardRevealPhase === "waiting" ? revealDashboardFromOnboarding : undefined);
  }

  function requestAiAccess() {
    if (isPromoCapture || !subscriptionState.subscription.requiresOwnOpenAiKey) return true;
    if (!subscriptionState.isLoading && !subscriptionState.error && openAiCredentialState.credential?.configured) return true;
    setIsAiCredentialGateOpen(true);
    return false;
  }

  async function handleOpenAiKeySave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openAiKeyInput.trim()) return;
    try {
      await openAiCredentialState.save(openAiKeyInput);
      setOpenAiKeyInput("");
      exitAiCredentialGate(onboardingDashboardRevealPhase === "waiting" ? revealDashboardFromOnboarding : undefined);
    } catch { /* The shared hook exposes the server error in the modal. */ }
  }

  async function handleGateSignOut() {
    exitAiCredentialGate(() => {
      void auth.signOut().then(() => navigate("/login", { replace: true }));
    });
  }

  function handleGateUpgrade() {
    exitAiCredentialGate(() => navigate("/onboarding"));
  }

  async function retryAiAccessState() {
    try {
      await subscriptionState.refresh();
      await openAiCredentialState.refresh();
    } catch { /* Both hooks expose retry errors. */ }
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
      setSetupError(error instanceof Error ? error.message : "Failed to create learning conversation.");
      throw error;
    } finally {
      setIsFinalizingSetup(false);
    }
  }

  return (
    <>
    <main
      className={`scene${visibleActive ? " has-panel" : ""}${usesPlainWorkspaceWall ? " is-plain-workspace-wall" : ""}${isSettingsView ? " is-settings is-settings-scene" : ""}${authRevealActive ? " auth-reveal-active" : ""}${dashboardRevealReady ? " auth-dashboard-ready" : ""}${onboardingDashboardRevealPhase === "waiting" ? " onboarding-dashboard-pending" : ""}${onboardingDashboardRevealPhase === "revealing" ? " onboarding-dashboard-revealing" : ""}${isBooting ? " is-booting" : ""}`}
      aria-label="Stonecode programming tutor workspace"
      data-promo-capture={promoCapture ?? undefined}
      style={{ "--code-light": visibleActiveCourse?.light ?? 1 } as React.CSSProperties}
    >
      <div className="wall-grain" aria-hidden="true" />
      <div className="light light-a" aria-hidden="true" />
      <div className="light light-b" aria-hidden="true" />

      <CourseWorkspace
        active={visibleActive}
        activeCourse={visibleActiveCourse}
        activeFiles={isPromoCapture ? [] : workspace.activeFiles}
        activeFolders={isPromoCapture ? [] : workspace.activeFolders}
        activeLessonIndex={visibleActiveCourse ? workspace.storedState.lessonStepByCourse[visibleActiveCourse.id] ?? 0 : 0}
        editorDiagnostics={editorDiagnostics}
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
        selectedFile={isPromoCapture ? null : workspace.selectedFile}
        terminalLogs={terminal.terminalLogs}
        userEmail={auth.user?.email ?? "stonecode.dev"}
      />

      {isSettingsView && settingsSection ? (
        <SettingsScene
          courses={workspace.userCourses}
          lessonStepByCourse={workspace.storedState.lessonStepByCourse}
          returnPath={settingsReturnPath}
          section={settingsSection}
          onSignOutTransition={onSignOutTransition}
        />
      ) : null}

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
          active={visibleActive}
          activeCourseCount={workspace.activeCourseCount}
          courses={isPromoCapture ? [] : workspace.userCourses}
          getCourseFiles={workspace.getCourseFiles}
          isSubscriptionLoading={subscriptionState.isLoading}
          isSetupOpen={isSetupOpen}
          onCardKeyDown={workspace.handleCardKey}
          onChat={(course, message, lessonIndex) => {
            if (requestAiAccess()) void tutor.updateCourseChat(course, message, lessonIndex);
          }}
          onCloseCourse={workspace.closeCourse}
          onExerciseHint={(course, exercise, question, code) => {
            if (!requestAiAccess()) return Promise.reject(new Error("Connect OpenAI to request a hint."));
            return tutor.requestExerciseHint(course, exercise, question, code);
          }}
          onExerciseTemplate={(course, exercise, code) => {
            if (!requestAiAccess()) return Promise.reject(new Error("Connect OpenAI to create an answer template."));
            return tutor.requestExerciseTemplate(course, exercise, code);
          }}
          onGenerateChapter={(course, chapterIndex) => {
            if (!requestAiAccess()) return Promise.reject(new Error("Connect OpenAI to generate the next module."));
            return workspace.generateCourseChapter(course, chapterIndex);
          }}
          onLoadExerciseFile={workspace.loadExerciseFile}
          onLoadExerciseWorkspace={workspace.loadExerciseWorkspace}
          onEditorDiagnosticsChange={setEditorDiagnostics}
          onLessonIndexChange={tutor.updateLessonStep}
          requestLessonIntro={(course, lessonIndex, lesson) => {
            if (requestAiAccess()) void tutor.requestLessonIntro(course, lessonIndex, lesson);
          }}
          onOpenSetup={() => {
            if (!requestAiAccess()) return;
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
            services={isPromoCapture ? promoDiscoveryServices : undefined}
          />
        </div>
      )}

      {!isSettingsView && <p className="caption">stonecode</p>}
    </main>
    {!isSettingsView && !isPromoCapture && (
      <AiCredentialGate
        credential={openAiCredentialState.credential}
        error={subscriptionState.error ?? openAiCredentialState.error}
        isExiting={isAiCredentialGateExiting}
        isLoading={subscriptionState.isLoading || openAiCredentialState.isLoading}
        isOpen={isAiCredentialGateOpen}
        isPending={openAiCredentialState.isPending}
        keyInput={openAiKeyInput}
        onDismiss={dismissAiCredentialGate}
        onKeyInputChange={setOpenAiKeyInput}
        onRetry={() => void retryAiAccessState()}
        onSave={(event) => void handleOpenAiKeySave(event)}
        onSignOut={() => void handleGateSignOut()}
        onUpgrade={handleGateUpgrade}
      />
    )}
    </>
  );
}
