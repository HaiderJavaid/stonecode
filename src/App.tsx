import { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { useAuth } from "@/auth/AuthProvider";
import { StonecodePrototype } from "@/components/stonecode/StonecodePrototype";
import { StonecodeLogoMark } from "@/components/stonecode/StonecodeBrand";
import { defaultCourseCodeHtml } from "@/data/courses";
import { LandingPage, LegalPage, SupportPage } from "@/components/app/SitePages";
import { OnboardingPage } from "@/components/app/OnboardingPage";
import SideRays from "@/components/effects/SideRays";

type AuthRevealPhase = "idle" | "holding" | "revealing" | "returning";

const AUTH_HOLD_MS = 1300;
const AUTH_ZOOM_MS = 1120;
const AUTH_BRIGHTEN_MS = 780;
const AUTH_BRIGHTEN_DELAY_MS = AUTH_HOLD_MS + AUTH_ZOOM_MS;
const AUTH_DASHBOARD_PRELOAD_MS = 520;
const AUTH_ROUTE_DELAY_MS = AUTH_BRIGHTEN_DELAY_MS + AUTH_BRIGHTEN_MS + 80 - AUTH_DASHBOARD_PRELOAD_MS;
const AUTH_RETURN_TOTAL_MS = 1900;
const AUTH_PANEL_SWITCH_MS = 220;
const SIGNUP_VERIFICATION_CODE_LENGTH = 8;

export function App() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authRevealPhase, setAuthRevealPhase] = useState<AuthRevealPhase>("idle");
  const [isAuthReturnCycle, setIsAuthReturnCycle] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup" || location.pathname === "/forgot-password";
  const isLandingRoute = location.pathname === "/";
  const authRevealActive = authRevealPhase === "holding" || authRevealPhase === "revealing";

  useSubtleParallax();

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  function startAuthReveal() {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    setAuthRevealPhase("holding");
    revealTimerRef.current = window.setTimeout(() => {
      setAuthRevealPhase("revealing");
    }, AUTH_HOLD_MS);
  }

  function finishAuthReveal() {
    setAuthRevealPhase("idle");
    setIsAuthReturnCycle(false);
  }

  function startWorkspaceSignOut() {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    setIsAuthReturnCycle(true);
    setAuthRevealPhase("returning");
    window.requestAnimationFrame(() => {
      navigate("/login", { replace: true, state: { authWorkspaceReturn: true } });
      void auth.signOut();
    });
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      setAuthRevealPhase("idle");
    }, AUTH_RETURN_TOTAL_MS);
  }

  return (
    <>
      {!isLandingRoute && (
        <SideRays
          className="app-side-rays"
          rayColor1="#94a3b8"
          rayColor2="#e4e8ed"
          origin="top-right"
          speed={2.8}
          intensity={2}
          spread={2.1}
          tilt={0}
          saturation={1.5}
          blend={0.75}
          falloff={1.6}
          opacity={1}
        />
      )}
      <AuthTransitionSurface isAuthReturnCycle={isAuthReturnCycle} isAuthRoute={isAuthRoute} phase={authRevealPhase} userEmail={auth.user?.email ?? null} />
      <Routes>
        <Route element={<LandingPage />} path="/" />
        {import.meta.env.DEV && <Route element={<StonecodePrototype promoCapture="discovery" />} path="/promo/discovery" />}
        <Route element={<AuthPage mode="login" onAuthReveal={startAuthReveal} />} path="/login" />
        <Route element={<AuthPage mode="signup" onAuthReveal={startAuthReveal} />} path="/signup" />
        <Route element={<AuthPage mode="forgot" onAuthReveal={startAuthReveal} />} path="/forgot-password" />
        <Route element={<RequireAuth><OnboardingPage /></RequireAuth>} path="/onboarding" />
        <Route
          element={
            <RequireAuth>
              <StonecodePrototype authRevealActive={authRevealActive} onAuthRevealComplete={finishAuthReveal} />
            </RequireAuth>
          }
          path="/dashboard"
        />
        <Route
          element={
            <RequireAuth>
              <StonecodePrototype authRevealActive={authRevealActive} onAuthRevealComplete={finishAuthReveal} />
            </RequireAuth>
          }
          path="/courses/:courseId"
        />
        <Route element={<Navigate replace to="/settings/overview" />} path="/settings" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="overview" /></RequireAuth>} path="/settings/overview" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="profile" /></RequireAuth>} path="/settings/profile" />
        <Route element={<Navigate replace to="/settings/security" />} path="/settings/account" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="billing" /></RequireAuth>} path="/settings/billing" />
        <Route element={<Navigate replace to="/settings/security" />} path="/settings/api-keys" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="usage" /></RequireAuth>} path="/settings/usage" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="security" /></RequireAuth>} path="/settings/security" />
        <Route element={<Navigate replace to="/settings/profile" />} path="/settings/preferences" />
        <Route element={<RequireAuth><StonecodePrototype onSignOutTransition={startWorkspaceSignOut} settingsSection="support" /></RequireAuth>} path="/settings/support" />
        <Route element={<LegalPage type="privacy" />} path="/privacy" />
        <Route element={<LegalPage type="terms" />} path="/terms" />
        <Route element={<SupportPage />} path="/support" />
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Routes>
    </>
  );
}

function AuthPage({ mode, onAuthReveal }: { mode: "login" | "signup" | "forgot"; onAuthReveal: () => void }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isBrightening, setIsBrightening] = useState(false);
  const [isVerificationComplete, setIsVerificationComplete] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<"login" | "signup" | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const brightenTimerRef = useRef<number | null>(null);
  const panelSwitchTimerRef = useRef<number | null>(null);
  const title = mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Recover access";
  const routeState = location.state as { authPanelSwitch?: boolean; authWorkspaceReturn?: boolean; from?: { pathname?: string } } | null;
  const from = routeState?.from?.pathname ?? "/dashboard";
  const arrivedFromPanelSwitch = Boolean(routeState?.authPanelSwitch);
  const arrivedFromWorkspace = Boolean(routeState?.authWorkspaceReturn);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      if (brightenTimerRef.current) window.clearTimeout(brightenTimerRef.current);
      if (panelSwitchTimerRef.current) window.clearTimeout(panelSwitchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSwitchingTo(null);
  }, [mode]);

  function switchAuthPanel(event: MouseEvent<HTMLAnchorElement>, target: "login" | "signup") {
    event.preventDefault();
    if (target === mode || switchingTo) return;
    setSwitchingTo(target);
    panelSwitchTimerRef.current = window.setTimeout(() => {
      navigate(`/${target}`, { state: { authPanelSwitch: true } });
    }, AUTH_PANEL_SWITCH_MS);
  }

  function beginDashboardReveal(target: string) {
    onAuthReveal();
    setIsTransitioning(true);
    brightenTimerRef.current = window.setTimeout(() => {
      setIsBrightening(true);
    }, AUTH_BRIGHTEN_DELAY_MS);
    transitionTimerRef.current = window.setTimeout(() => {
      navigate(target, { replace: true });
    }, AUTH_ROUTE_DELAY_MS);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const acceptedTerms = formData.get("terms") === "on";

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (mode === "signup" && (displayName.length < 2 || displayName.length > 50)) {
      setError("Display name must be between 2 and 50 characters.");
      return;
    }

    if (mode !== "forgot" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (mode === "signup" && !acceptedTerms) {
      setError("Accept the Terms and Privacy Policy to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await auth.signIn(email, password);
        beginDashboardReveal(from);
        form.reset();
        return;
      } else if (mode === "signup") {
        await auth.signUp({ displayName, email, password, termsAcceptedAt: new Date().toISOString() });
        setVerificationEmail(email);
      } else {
        await auth.resetPassword(email);
        setStatus("Password reset email sent.");
      }
      form.reset();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <main className={`auth-stage auth-${mode}${arrivedFromPanelSwitch ? " is-panel-switch" : ""}${arrivedFromWorkspace ? " is-workspace-return" : ""}${isTransitioning ? " is-transitioning" : ""}${isBrightening ? " is-brightening" : ""}${isVerificationComplete ? " is-verification-complete" : ""}${switchingTo ? ` is-switching-${switchingTo}` : ""}`}>
        <section className="auth-card" aria-label={title}>
        <div className="auth-card-header">
          <div className="auth-brand">
            <span>stonecode</span>
            <StonecodeLogoMark className="auth-brand-mark" />
          </div>
          {mode === "forgot" && <><h1>{title}</h1><p>We’ll send a reset link to your email.</p></>}
        </div>
        {!auth.isConfigured && <p className="plain-error">Supabase env vars are missing.</p>}
        {status && <p className="plain-success auth-verification-success">{status}</p>}
        {error && <p className="plain-error">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Display name
              <input autoComplete="name" maxLength={50} minLength={2} name="displayName" placeholder="Your name" type="text" />
            </label>
          )}
          <label>
            Email
            <input autoComplete="email" name="email" placeholder="you@example.com" type="email" />
          </label>
          {mode !== "forgot" && (
            <label>
              Password
              <input autoComplete={mode === "login" ? "current-password" : "new-password"} name="password" placeholder="At least 6 characters" type="password" />
            </label>
          )}
          {mode === "signup" && (
            <>
              <label>
                Confirm password
                <input autoComplete="new-password" name="confirmPassword" placeholder="Repeat password" type="password" />
              </label>
              <label className="auth-terms">
                <input name="terms" type="checkbox" />
                <span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span>
              </label>
            </>
          )}
          <button disabled={isSubmitting || !auth.isConfigured} type="submit">
            {isSubmitting ? "Working..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <nav className="auth-links" aria-label="Account links">
          {mode === "login" ? (
            <>
              <Link className="auth-secondary-link" onClick={(event) => switchAuthPanel(event, "signup")} to="/signup">Create account</Link>
              <Link className="auth-text-link" to="/forgot-password">Forgot password?</Link>
            </>
          ) : (
            <Link className="auth-secondary-link" onClick={(event) => switchAuthPanel(event, "login")} to="/login">
              {mode === "signup" ? "Back to sign in" : "Back to sign in"}
            </Link>
          )}
        </nav>
        </section>
      </main>
      {verificationEmail && (
        <SignupVerificationModal
          email={verificationEmail}
          onClose={() => setVerificationEmail(null)}
          onVerified={() => {
            setIsVerificationComplete(true);
            beginDashboardReveal("/dashboard");
          }}
        />
      )}
    </>
  );
}

function SignupVerificationModal({
  email,
  onClose,
  onVerified
}: {
  email: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const auth = useAuth();
  const [digits, setDigits] = useState(() => Array.from({ length: SIGNUP_VERIFICATION_CODE_LENGTH }, () => ""));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function setCodeDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < SIGNUP_VERIFICATION_CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, SIGNUP_VERIFICATION_CODE_LENGTH);
    if (!pastedCode) return;
    event.preventDefault();
    setDigits(Array.from({ length: SIGNUP_VERIFICATION_CODE_LENGTH }, (_, index) => pastedCode[index] ?? ""));
    inputRefs.current[Math.min(pastedCode.length, SIGNUP_VERIFICATION_CODE_LENGTH) - 1]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length !== SIGNUP_VERIFICATION_CODE_LENGTH) {
      setError(`Enter all ${SIGNUP_VERIFICATION_CODE_LENGTH} digits.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await auth.verifySignupCode(email, code);
      setIsExiting(true);
      onVerified();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "That code could not be verified.");
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await auth.resendSignupCode(email);
      setDigits(Array.from({ length: SIGNUP_VERIFICATION_CODE_LENGTH }, () => ""));
      setNotice("A fresh code is on its way.");
      inputRefs.current[0]?.focus();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We could not send another code.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div aria-modal="true" className={`signup-verification-modal${isExiting ? " is-exiting" : ""}`} role="dialog" aria-labelledby="signup-verification-title">
      <form aria-busy={isSubmitting || isExiting} className="stone-surface stone-surface-main signup-verification-card" onSubmit={handleVerify}>
        <button aria-label="Close verification" className="signup-verification-close" disabled={isSubmitting || isExiting} onClick={onClose} type="button">×</button>
        <StonecodeLogoMark className="signup-verification-mark" />
        <p className="signup-verification-eyebrow">Email verification</p>
        <h2 id="signup-verification-title">Enter your {SIGNUP_VERIFICATION_CODE_LENGTH}-digit code</h2>
        <p>We sent it to <strong>{email}</strong>.</p>
        <div className="signup-code-inputs" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              aria-label={`Digit ${index + 1} of ${SIGNUP_VERIFICATION_CODE_LENGTH}`}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCodeDigit(index, event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleKeyDown(event, index)}
              ref={(element) => { inputRefs.current[index] = element; }}
              value={digit}
            />
          ))}
        </div>
        {error && <p className="signup-verification-error">{error}</p>}
        {notice && <p className="signup-verification-notice">{notice}</p>}
        <button className="signup-verification-primary" disabled={isSubmitting || isExiting} type="submit">{isSubmitting ? "Verifying…" : "Verify email"}</button>
        <button className="signup-verification-resend" disabled={isResending || isExiting} onClick={handleResend} type="button">{isResending ? "Sending…" : "Send a new code"}</button>
      </form>
    </div>
  );
}

function AuthTransitionSurface({
  isAuthReturnCycle,
  isAuthRoute,
  phase,
  userEmail
}: {
  isAuthReturnCycle: boolean;
  isAuthRoute: boolean;
  phase: AuthRevealPhase;
  userEmail: string | null;
}) {
  if (!isAuthRoute && phase === "idle") return null;
  void userEmail;
  const isRevealing = phase === "revealing";
  const isReturning = phase === "returning";
  const isActive = phase !== "idle";

  return (
    <div
      className={`auth-transition-surface${isAuthRoute ? " is-auth-route" : ""}${isActive ? " is-active" : ""}${phase === "holding" ? " is-holding" : ""}${isRevealing ? " is-revealing" : ""}${isReturning ? " is-returning" : ""}${isAuthReturnCycle ? " is-return-cycle" : ""}`}
      aria-hidden="true"
    >
      <div className="auth-wall-grain" />
      <div className="auth-preview-light light-one" />
      <div className="auth-preview-light light-two" />
      <div className="auth-parallax-ide">
        <div className="auth-global-terminal">
          <pre>
            <code dangerouslySetInnerHTML={{ __html: defaultCourseCodeHtml }} />
          </pre>
        </div>
      </div>
      <div className="auth-preview-panel panel-left">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="auth-preview-panel panel-right">
        <strong />
        <span />
        <span />
      </div>
      <p className="auth-preview-caption">dashboard staged</p>
    </div>
  );
}

function useSubtleParallax() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");

    const resetProperties = () => {
      root.style.setProperty("--parallax-mid-x", "0px");
      root.style.setProperty("--parallax-mid-y", "0px");
    };

    if (reducedMotion.matches || !finePointer.matches) {
      resetProperties();
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrame = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;

      root.style.setProperty("--parallax-mid-x", `${(currentX * 4.5).toFixed(2)}px`);
      root.style.setProperty("--parallax-mid-y", `${(currentY * 3).toFixed(2)}px`);

      if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
        animationFrame = window.requestAnimationFrame(render);
      } else {
        animationFrame = 0;
      }
    };

    const requestRender = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      requestRender();
    };

    const resetPosition = () => {
      targetX = 0;
      targetY = 0;
      requestRender();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPosition);
    document.documentElement.addEventListener("mouseleave", resetPosition);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPosition);
      document.documentElement.removeEventListener("mouseleave", resetPosition);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resetProperties();
    };
  }, []);
}
