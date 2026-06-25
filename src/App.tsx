import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { useAuth } from "@/auth/AuthProvider";
import { StonecodePrototype } from "@/components/stonecode/StonecodePrototype";
import { defaultCourseCodeHtml } from "@/data/courses";
import { LandingPage, LegalPage, SupportPage } from "@/components/app/SitePages";

type AuthRevealPhase = "idle" | "holding" | "revealing";

const AUTH_HOLD_MS = 1300;
const AUTH_ZOOM_MS = 1120;
const AUTH_BRIGHTEN_MS = 780;
const AUTH_BRIGHTEN_DELAY_MS = AUTH_HOLD_MS + AUTH_ZOOM_MS;
const AUTH_DASHBOARD_PRELOAD_MS = 520;
const AUTH_ROUTE_DELAY_MS = AUTH_BRIGHTEN_DELAY_MS + AUTH_BRIGHTEN_MS + 80 - AUTH_DASHBOARD_PRELOAD_MS;

export function App() {
  const auth = useAuth();
  const location = useLocation();
  const [authRevealPhase, setAuthRevealPhase] = useState<AuthRevealPhase>("idle");
  const revealTimerRef = useRef<number | null>(null);
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup" || location.pathname === "/forgot-password";
  const authRevealActive = authRevealPhase !== "idle";

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

  return (
    <>
      <AuthTransitionSurface isAuthRoute={isAuthRoute} phase={authRevealPhase} userEmail={auth.user?.email ?? null} />
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<AuthPage mode="login" onAuthReveal={startAuthReveal} />} path="/login" />
        <Route element={<AuthPage mode="signup" onAuthReveal={startAuthReveal} />} path="/signup" />
        <Route element={<AuthPage mode="forgot" onAuthReveal={startAuthReveal} />} path="/forgot-password" />
        <Route
          element={
            <RequireAuth>
              <StonecodePrototype authRevealActive={authRevealActive} onAuthRevealComplete={() => setAuthRevealPhase("idle")} />
            </RequireAuth>
          }
          path="/dashboard"
        />
        <Route
          element={
            <RequireAuth>
              <StonecodePrototype authRevealActive={authRevealActive} onAuthRevealComplete={() => setAuthRevealPhase("idle")} />
            </RequireAuth>
          }
          path="/courses/:courseId"
        />
        <Route element={<Navigate replace to="/settings/overview" />} path="/settings" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="overview" /></RequireAuth>} path="/settings/overview" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="profile" /></RequireAuth>} path="/settings/profile" />
        <Route element={<Navigate replace to="/settings/security" />} path="/settings/account" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="billing" /></RequireAuth>} path="/settings/billing" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="usage" /></RequireAuth>} path="/settings/usage" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="security" /></RequireAuth>} path="/settings/security" />
        <Route element={<RequireAuth><StonecodePrototype settingsSection="support" /></RequireAuth>} path="/settings/support" />
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
  const transitionTimerRef = useRef<number | null>(null);
  const brightenTimerRef = useRef<number | null>(null);
  const title = mode === "login" ? "Enter workspace" : mode === "signup" ? "Start the beta" : "Recover access";
  const helper =
    mode === "login"
      ? "Where ideas are carved in code."
      : mode === "signup"
        ? "Create your beta workspace and keep every course persistent."
        : "Send a recovery link and return to your workspace.";
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
      if (brightenTimerRef.current) window.clearTimeout(brightenTimerRef.current);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (mode !== "forgot" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await auth.signIn(email, password);
        onAuthReveal();
        setIsTransitioning(true);
        form.reset();
        brightenTimerRef.current = window.setTimeout(() => {
          setIsBrightening(true);
        }, AUTH_BRIGHTEN_DELAY_MS);
        transitionTimerRef.current = window.setTimeout(() => {
          navigate(from, { replace: true });
        }, AUTH_ROUTE_DELAY_MS);
        return;
      } else if (mode === "signup") {
        await auth.signUp(email, password);
        setStatus("Check your email to confirm your account, then log in.");
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
    <main className={`auth-stage auth-${mode}${isTransitioning ? " is-transitioning" : ""}${isBrightening ? " is-brightening" : ""}`}>
      <section className="auth-card" aria-label={title}>
        <div className="auth-brand">
          <span>stonecode</span>
          <i />
        </div>
        <h1>{title}</h1>
        <p>{helper}</p>
        {!auth.isConfigured && <p className="plain-error">Supabase env vars are missing.</p>}
        {status && <p className="plain-success">{status}</p>}
        {error && <p className="plain-error">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input autoComplete="email" name="email" type="email" />
          </label>
          {mode !== "forgot" && (
            <label>
              Password
              <input autoComplete={mode === "login" ? "current-password" : "new-password"} name="password" type="password" />
            </label>
          )}
          <button disabled={isSubmitting || !auth.isConfigured} type="submit">
            {isSubmitting ? "Working..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Log in ->"}
          </button>
        </form>
        <nav className="auth-links" aria-label="Account links">
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
          <Link to="/forgot-password">Forgot password</Link>
        </nav>
      </section>
    </main>
  );
}

function AuthTransitionSurface({
  isAuthRoute,
  phase,
  userEmail
}: {
  isAuthRoute: boolean;
  phase: AuthRevealPhase;
  userEmail: string | null;
}) {
  if (!isAuthRoute && phase === "idle") return null;
  void userEmail;
  const isRevealing = phase === "revealing";
  const isActive = phase !== "idle";

  return (
    <div
      className={`auth-transition-surface${isAuthRoute ? " is-auth-route" : ""}${isActive ? " is-active" : ""}${phase === "holding" ? " is-holding" : ""}${isRevealing ? " is-revealing" : ""}`}
      aria-hidden="true"
    >
      <div className="auth-wall-grain" />
      <div className="auth-preview-light light-one" />
      <div className="auth-preview-light light-two" />
      <div className="auth-global-terminal">
        <pre>
          <code dangerouslySetInnerHTML={{ __html: defaultCourseCodeHtml }} />
        </pre>
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
