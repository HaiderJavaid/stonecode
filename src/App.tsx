import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { useAuth } from "@/auth/AuthProvider";
import { StonecodePrototype } from "@/components/stonecode/StonecodePrototype";

export function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<AuthPage mode="login" />} path="/login" />
      <Route element={<AuthPage mode="signup" />} path="/signup" />
      <Route element={<AuthPage mode="forgot" />} path="/forgot-password" />
      <Route element={<RequireAuth><StonecodePrototype /></RequireAuth>} path="/dashboard" />
      <Route element={<RequireAuth><StonecodePrototype /></RequireAuth>} path="/courses/:courseId" />
      <Route element={<RequireAuth><SettingsPage section="profile" /></RequireAuth>} path="/settings/profile" />
      <Route element={<RequireAuth><SettingsPage section="account" /></RequireAuth>} path="/settings/account" />
      <Route element={<RequireAuth><SettingsPage section="billing" /></RequireAuth>} path="/settings/billing" />
      <Route element={<RequireAuth><SettingsPage section="usage" /></RequireAuth>} path="/settings/usage" />
      <Route element={<TextPage title="Privacy" />} path="/privacy" />
      <Route element={<TextPage title="Terms" />} path="/terms" />
      <Route element={<TextPage title="Support" />} path="/support" />
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  );
}

function LandingPage() {
  return (
    <main className="plain-page">
      <section className="plain-panel">
        <span className="plain-eyebrow">Stonecode</span>
        <h1>Persistent AI programming tutor workspace</h1>
        <p>Open a course, code in the workspace, and keep tutor memory tied to that course.</p>
        <nav className="plain-actions" aria-label="Landing actions">
          <Link to="/signup">Start beta</Link>
          <Link to="/login">Log in</Link>
          <Link to="/dashboard">View demo</Link>
        </nav>
      </section>
    </main>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" | "forgot" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const title = mode === "login" ? "Enter workspace" : mode === "signup" ? "Start the beta" : "Recover access";
  const helper =
    mode === "login"
      ? "Your learning workspace is already staged behind this gate."
      : mode === "signup"
        ? "Create your Stonecode beta account and keep every course workspace persistent."
        : "Send a recovery link and return to the same workspace.";
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
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
        setIsTransitioning(true);
        form.reset();
        transitionTimerRef.current = window.setTimeout(() => {
          navigate(from, { replace: true });
        }, 860);
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
    <main className={`auth-stage auth-${mode}${isTransitioning ? " is-transitioning" : ""}`}>
      <AuthWorkspacePreview />
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
            {isSubmitting ? "Working..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Open dashboard"}
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

function AuthWorkspacePreview() {
  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-wall-grain" />
      <div className="auth-preview-light light-one" />
      <div className="auth-preview-light light-two" />
      <div className="auth-preview-terminal">
        <div className="auth-terminal-head">
          <span />
          <span />
          <span />
        </div>
        <pre>{`01 const path = "beginner-safe";
02 const workspace = await stonecode.resume();
03
04 tutor.keepContext(course.id);
05 files.restore("README.md");
06 progress.sync();
07
08 // dashboard opens after auth`}</pre>
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

function SettingsPage({ section }: { section: "profile" | "account" | "billing" | "usage" }) {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main className="plain-page">
      <section className="plain-panel">
        <span className="plain-eyebrow">Settings</span>
        <h1>{section[0].toUpperCase() + section.slice(1)}</h1>
        <p>{settingsCopy[section]}</p>
        {auth.user?.email && <p className="plain-muted">Signed in as {auth.user.email}</p>}
        <nav className="plain-actions" aria-label="Settings sections">
          <Link to="/settings/profile">Profile</Link>
          <Link to="/settings/account">Account</Link>
          <Link to="/settings/billing">Billing</Link>
          <Link to="/settings/usage">Usage</Link>
          <Link to="/dashboard">Dashboard</Link>
          <button onClick={handleSignOut} type="button">Sign out</button>
        </nav>
      </section>
    </main>
  );
}

function TextPage({ title }: { title: string }) {
  return (
    <main className="plain-page">
      <section className="plain-panel">
        <span className="plain-eyebrow">Stonecode</span>
        <h1>{title}</h1>
        <p>This page is reserved for the paid beta launch content.</p>
        <nav className="plain-actions" aria-label={`${title} links`}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/support">Support</Link>
        </nav>
      </section>
    </main>
  );
}

const settingsCopy = {
  profile: "Learner name, avatar, timezone, and course preferences will live here.",
  account: "Email, password, connected auth providers, and account deletion controls will live here.",
  billing: "Stripe checkout, plan status, invoices, and billing portal access will live here.",
  usage: "AI message usage, course limits, and plan guardrails will live here."
};
