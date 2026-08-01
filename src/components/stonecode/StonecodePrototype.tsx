import { CourseWorkspace } from "@/components/stonecode/CourseWorkspace";
import { CourseSetupCard } from "@/components/stonecode/CourseSetupCard";
import { DashboardPage } from "@/components/stonecode/DashboardPage";
import { SettingsScene, StonecodeSettingsSection } from "@/components/stonecode/SettingsScene";
import { useAuth } from "@/auth/AuthProvider";
import { useCourseWorkspace } from "@/hooks/useCourseWorkspace";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useTerminalRunner } from "@/hooks/useTerminalRunner";
import { useTutorChat } from "@/hooks/useTutorChat";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { EditorDiagnostic } from "@/components/stonecode/types";
import { promoDiscoveryServices } from "@/components/stonecode/promoDiscoveryScript";
import { MarketplacePanel } from "@/components/stonecode/MarketplacePanel";
import { clearPendingGenerationJob, generationJobFailureMessage, readPendingGenerationJob, requestGenerationJob, requestProductFeatures } from "@/services/courseGeneration";
import { useCredits } from "@/hooks/useCredits";

const dashboardBootStorageKey = "stonecode.dashboardBooted.v1";
const onboardingDashboardEntranceMs = 960;
const marketplaceReturnAnimationMs = 3020;
type OnboardingDashboardRevealPhase = "idle" | "waiting" | "revealing";
type ProductView = "dashboard" | "marketplace";

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
  const productView: ProductView = location.pathname === "/marketplace" ? "marketplace" : "dashboard";
  const isMarketplaceView = productView === "marketplace";
  const isProductViewRoute = location.pathname === "/dashboard" || isMarketplaceView;
  const usesPlainWorkspaceWall = isPromoCapture || isSettingsView || isProductViewRoute || location.pathname.startsWith("/courses/");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isFinalizingSetup, setIsFinalizingSetup] = useState(false);
  const [editorDiagnostics, setEditorDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [productFeatures, setProductFeatures] = useState<Record<string, boolean>>(() => isPromoCapture ? { dynamic_surfaces: true } : {} as Record<string, boolean>);
  const [onboardingDashboardRevealPhase, setOnboardingDashboardRevealPhase] = useState<OnboardingDashboardRevealPhase>(() => {
    if (typeof window === "undefined") return "idle";
    return location.pathname === "/dashboard" && new URLSearchParams(location.search).get("firstRun") === "1" ? "waiting" : "idle";
  });
  const [isBooting, setIsBooting] = useState(() => {
    if (promoCapture) return false;
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(dashboardBootStorageKey) !== "true";
  });
  const [dashboardRevealReady, setDashboardRevealReady] = useState(!authRevealActive);
  const [isMarketplaceReturning, setIsMarketplaceReturning] = useState(false);
  const onboardingRevealTimerRef = useRef<number | null>(null);
  const marketplaceReturnTimerRef = useRef<number | null>(null);
  const previousProductViewRef = useRef<ProductView>(productView);
  const dashboardCompositionRef = useRef<HTMLDivElement | null>(null);
  const workspace = useCourseWorkspace();
  const openGeneratedCourseRef = useRef(workspace.openGeneratedCourse);
  openGeneratedCourseRef.current = workspace.openGeneratedCourse;
  const subscriptionState = useSubscriptionState();
  const creditState = useCredits(!isPromoCapture && !isSettingsView);
  const tutor = useTutorChat({
    active: workspace.active,
    storedState: workspace.storedState,
    setStoredState: workspace.setStoredState,
    onApplyFileEdits: workspace.applyAiEdits,
    onUndoFileEdits: workspace.undoLastAiEdit
  });
  const visibleActive = isPromoCapture ? null : workspace.active;
  const visibleActiveCourse = isPromoCapture ? null : workspace.activeCourse;
  const activeLessonView = visibleActiveCourse ? workspace.storedState.lessonViewByCourse[visibleActiveCourse.id] ?? null : null;
  const showCourseNavigation = activeLessonView === "resume" || activeLessonView === "exercises";
  const visibleWorkspaceActive = showCourseNavigation ? visibleActive : null;
  const visibleWorkspaceCourse = showCourseNavigation ? visibleActiveCourse : null;
  const visibleWorkspaceFiles = showCourseNavigation && !isPromoCapture ? workspace.activeFiles : [];
  const visibleWorkspaceFolders = showCourseNavigation && !isPromoCapture ? workspace.activeFolders : [];
  const visibleSelectedFile = showCourseNavigation && !isPromoCapture ? workspace.selectedFile : null;
  const terminal = useTerminalRunner(visibleSelectedFile);
  const isDashboardTransitionBlocked = isMarketplaceView || isMarketplaceReturning;
  const settingsReturnPath = workspace.active?.courseId ? `/courses/${workspace.active.courseId}` : "/dashboard";

  useLayoutEffect(() => {
    const previousView = previousProductViewRef.current;
    previousProductViewRef.current = productView;
    if (marketplaceReturnTimerRef.current) window.clearTimeout(marketplaceReturnTimerRef.current);

    const shouldAnimateReturn = previousView === "marketplace"
      && productView === "dashboard"
      && location.pathname === "/dashboard"
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIsMarketplaceReturning(shouldAnimateReturn);
    if (shouldAnimateReturn) {
      marketplaceReturnTimerRef.current = window.setTimeout(() => {
        setIsMarketplaceReturning(false);
        marketplaceReturnTimerRef.current = null;
      }, marketplaceReturnAnimationMs);
    }

    return () => {
      if (marketplaceReturnTimerRef.current) window.clearTimeout(marketplaceReturnTimerRef.current);
    };
  }, [location.pathname, productView]);

  const revealDashboardFromOnboarding = useCallback(() => {
    setOnboardingDashboardRevealPhase("revealing");
    navigate("/dashboard", { replace: true });
    if (onboardingRevealTimerRef.current) window.clearTimeout(onboardingRevealTimerRef.current);
    onboardingRevealTimerRef.current = window.setTimeout(() => {
      setOnboardingDashboardRevealPhase("idle");
    }, onboardingDashboardEntranceMs);
  }, [navigate]);

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
    if (onboardingRevealTimerRef.current) window.clearTimeout(onboardingRevealTimerRef.current);
    if (marketplaceReturnTimerRef.current) window.clearTimeout(marketplaceReturnTimerRef.current);
  }, []);

  useEffect(() => {
    if (isDashboardTransitionBlocked) dashboardCompositionRef.current?.setAttribute("inert", "");
    else dashboardCompositionRef.current?.removeAttribute("inert");
  }, [isDashboardTransitionBlocked]);

  useEffect(() => {
    if (isPromoCapture) return;
    let cancelled = false;
    void requestProductFeatures()
      .then((result) => {
        if (!cancelled) setProductFeatures(result.features);
      })
      .catch(() => {
        if (!cancelled) setProductFeatures({});
      });
    return () => {
      cancelled = true;
    };
  }, [isPromoCapture]);

  useEffect(() => {
    if (location.pathname !== "/dashboard" || isSettingsView || isPromoCapture) return;
    if (subscriptionState.isLoading || onboardingDashboardRevealPhase !== "waiting") return;
    revealDashboardFromOnboarding();
  }, [
    isPromoCapture,
    isSettingsView,
    location.pathname,
    onboardingDashboardRevealPhase,
    revealDashboardFromOnboarding,
    subscriptionState.isLoading
  ]);

  useEffect(() => {
    if (!workspace.isWorkspaceReady || isSetupOpen || isPromoCapture) return;
    const jobId = readPendingGenerationJob();
    if (!jobId) return;
    let cancelled = false;
    let timer = 0;
    const check = async () => {
      try {
        const { job } = await requestGenerationJob(jobId);
        if (cancelled) return;
        if (job.status === "succeeded" && job.result_course_id) {
          clearPendingGenerationJob(jobId);
          await openGeneratedCourseRef.current(job.result_course_id);
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          clearPendingGenerationJob(jobId);
          setSetupError(generationJobFailureMessage(job));
          return;
        }
        timer = window.setTimeout(check, 1800);
      } catch (caughtError) {
        if (!cancelled) setSetupError(caughtError instanceof Error ? caughtError.message : "Could not resume generation.");
      }
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isPromoCapture, isSetupOpen, workspace.isWorkspaceReady]);

  async function handleFinalizeCourse(course: Parameters<typeof workspace.addLearningCourse>[0]) {
    setSetupError(null);
    setIsFinalizingSetup(true);
    try {
      await workspace.addLearningCourse(course);
      await creditState.refresh();
      setIsSetupOpen(false);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to create learning conversation.");
      throw error;
    } finally {
      setIsFinalizingSetup(false);
    }
  }

  async function handleGeneratedCourse(courseId: string) {
    setSetupError(null);
    setIsFinalizingSetup(true);
    try {
      await workspace.openGeneratedCourse(courseId);
      await creditState.refresh();
      setIsSetupOpen(false);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to open generated learning path.");
      throw error;
    } finally {
      setIsFinalizingSetup(false);
    }
  }

  return (
    <>
    <main
      className={`scene${showCourseNavigation ? " has-panel" : ""}${usesPlainWorkspaceWall ? " is-plain-workspace-wall" : ""}${isSettingsView ? " is-settings is-settings-scene" : ""}${isMarketplaceView ? " is-marketplace-open" : ""}${isMarketplaceReturning ? " is-marketplace-returning" : ""}${authRevealActive ? " auth-reveal-active" : ""}${dashboardRevealReady ? " auth-dashboard-ready" : ""}${onboardingDashboardRevealPhase === "waiting" ? " onboarding-dashboard-pending" : ""}${onboardingDashboardRevealPhase === "revealing" ? " onboarding-dashboard-revealing" : ""}${isBooting ? " is-booting" : ""}`}
      aria-label="Stonecode programming tutor workspace"
      data-promo-capture={promoCapture ?? undefined}
      style={{ "--code-light": visibleWorkspaceCourse?.light ?? 1 } as React.CSSProperties}
    >
      <div className="wall-grain" aria-hidden="true" />
      <div className="light light-a" aria-hidden="true" />
      <div className="light light-b" aria-hidden="true" />

      {isProductViewRoute && !isSettingsView && !isPromoCapture && (
        <nav aria-label="Product view" className="product-view-switcher">
          <Link aria-current={productView === "dashboard" ? "page" : undefined} to="/dashboard">Dashboard</Link>
          <Link aria-current={productView === "marketplace" ? "page" : undefined} to="/marketplace">Marketplace</Link>
        </nav>
      )}

      <div
        aria-hidden={isDashboardTransitionBlocked || undefined}
        className="dashboard-composition"
        ref={dashboardCompositionRef}
      >

      <CourseWorkspace
        active={visibleWorkspaceActive}
        activeCourse={visibleWorkspaceCourse}
        activeFiles={visibleWorkspaceFiles}
        activeFolders={visibleWorkspaceFolders}
        activeLessonIndex={visibleWorkspaceCourse ? workspace.storedState.lessonStepByCourse[visibleWorkspaceCourse.id] ?? 0 : 0}
        initialLeftPanelView={workspace.activeLeftPanelView}
        editorDiagnostics={editorDiagnostics}
        dynamicSurfacesEnabled={productFeatures.dynamic_surfaces === true}
        showNavigationPanel={showCourseNavigation}
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
        selectedFile={visibleSelectedFile}
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

      {workspace.canUndoAiEdit && (
        <button className="session-logout ai-undo-edit" onClick={workspace.undoLastAiEdit} type="button">
          Undo AI edit
        </button>
      )}

      {!isSettingsView && (
        <DashboardPage
          active={visibleActive}
          activeCourseCount={workspace.activeCourseCount}
          credits={creditState.credits}
          creditsError={creditState.error}
          courses={isPromoCapture ? [] : workspace.userCourses}
          getCourseFiles={workspace.getCourseFiles}
          isSubscriptionLoading={subscriptionState.isLoading}
          isCreditsLoading={creditState.isLoading}
          isWorkspaceLoading={!workspace.isWorkspaceReady}
          isSetupOpen={isSetupOpen}
          onCardKeyDown={workspace.handleCardKey}
          onChat={(course, message, lessonIndex) => {
            void tutor.updateCourseChat(course, message, lessonIndex);
          }}
          onApplyTutorPatch={(course, messageId, toolCallId) => tutor.applyTutorPatch(course, messageId, toolCallId)}
          onRejectTutorPatch={(course, messageId, toolCallId) => tutor.rejectTutorPatch(course, messageId, toolCallId)}
          onUndoTutorPatch={(course, messageId, toolCallId) => tutor.undoTutorPatch(course, messageId, toolCallId)}
          onCloseCourse={workspace.closeCourse}
          onExerciseHint={(course, exercise, question, code) => {
            return tutor.requestExerciseHint(course, exercise, question, code);
          }}
          onExerciseTemplate={(course, exercise, code) => {
            return tutor.requestExerciseTemplate(course, exercise, code);
          }}
          onGenerateChapter={(course, chapterIndex) => {
            return workspace.generateCourseChapter(course, chapterIndex);
          }}
          onLoadExerciseFile={workspace.loadExerciseFile}
          onLoadExerciseWorkspace={workspace.loadExerciseWorkspace}
          onEditorDiagnosticsChange={setEditorDiagnostics}
          onLessonIndexChange={tutor.updateLessonStep}
          requestLessonIntro={(course, lessonIndex, lesson) => {
            void tutor.requestLessonIntro(course, lessonIndex, lesson);
          }}
          onOpenSetup={() => {
            setSetupError(null);
            setIsSetupOpen(true);
          }}
          onOpenCourse={workspace.openCourse}
          onDeleteCourse={workspace.deleteLearningCourse}
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
            onGenerationComplete={handleGeneratedCourse}
            services={isPromoCapture ? promoDiscoveryServices : undefined}
          />
        </div>
      )}

      {!isSettingsView && <p className="caption">stonecode</p>}
      </div>

      {isProductViewRoute && !isSettingsView && !isPromoCapture && (
        <MarketplacePanel
          active={isMarketplaceView}
          courses={workspace.userCourses}
          enabled={productFeatures.marketplace_v1 === true}
          onCloneComplete={async (courseId) => {
            await workspace.openGeneratedCourse(courseId);
            await creditState.refresh();
          }}
        />
      )}
    </main>
    </>
  );
}
