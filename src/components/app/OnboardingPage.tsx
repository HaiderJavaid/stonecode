import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LogOut, Sparkles, WalletCards } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { createBillingSession } from "@/services/billing";

const subscriptionPollLimit = 10;
const panelExitMs = 480;

export function OnboardingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, isLoading, error: subscriptionError, refresh } = useSubscriptionState();
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);
  const hasStartedExit = useRef(false);
  const checkoutState = searchParams.get("checkout");
  const isPaid = subscription.plan === "pro" && subscription.status === "active";

  const beginExit = useCallback((onExited: () => void) => {
    if (hasStartedExit.current) return;
    hasStartedExit.current = true;
    setIsExiting(true);
    exitTimer.current = window.setTimeout(onExited, panelExitMs);
  }, []);

  const enterDashboard = useCallback(() => {
    beginExit(() => navigate("/dashboard?firstRun=1", { replace: true }));
  }, [beginExit, navigate]);

  useEffect(() => {
    if (!isLoading && isPaid) enterDashboard();
  }, [enterDashboard, isLoading, isPaid]);

  useEffect(() => {
    if (checkoutState !== "success" || isPaid || pollAttempt >= subscriptionPollLimit) return;
    pollTimer.current = window.setTimeout(() => {
      void refresh()
        .then((nextSubscription) => {
          if (nextSubscription.plan === "pro" && nextSubscription.status === "active") {
            enterDashboard();
            return;
          }
          setPollAttempt((current) => current + 1);
        })
        .catch(() => setPollAttempt((current) => current + 1));
    }, pollAttempt === 0 ? 300 : 1500);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [checkoutState, enterDashboard, isPaid, pollAttempt, refresh]);

  useEffect(() => () => {
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
  }, []);

  async function choosePro() {
    if (!auth.session) return;
    setCheckoutError(null);
    setIsCheckoutPending(true);
    try {
      const url = await createBillingSession({
        plan: "pro"
      });
      window.location.href = url;
    } catch (caughtError) {
      setCheckoutError(caughtError instanceof Error ? caughtError.message : "Failed to open Stripe checkout.");
      setIsCheckoutPending(false);
    }
  }

  async function signOut() {
    beginExit(() => {
      void auth.signOut().then(() => navigate("/login", { replace: true }));
    });
  }

  const isActivating = checkoutState === "success" && !isPaid && pollAttempt < subscriptionPollLimit;
  const activationTimedOut = checkoutState === "success" && !isPaid && pollAttempt >= subscriptionPollLimit;

  return (
    <main className={`onboarding-stage${isExiting ? " is-exiting" : ""}`}>
      <section className="stone-surface stone-surface-main onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-brand" aria-hidden="true"><i /><span>stonecode</span></div>
        <header>
          <span>Email verified</span>
          <h1 id="onboarding-title">Choose your Stonecode plan</h1>
          <p>Start Free with creation Stones. Upgrade when you need more active learning paths.</p>
        </header>

        {isActivating ? (
          <div className="onboarding-activating" role="status">
            <Sparkles aria-hidden="true" />
            <strong>Activating your Pro workspace…</strong>
            <span>Stripe is confirmed. We’re waiting for subscription sync.</span>
          </div>
        ) : (
          <div className="onboarding-plan-grid">
            <article className="stone-surface stone-surface-card">
              <div><WalletCards aria-hidden="true" /><span>Free</span></div>
              <h2>Start learning</h2>
              <strong>$0</strong>
              <ul>
                <li><Check aria-hidden="true" />10 one-time creation Stones</li>
                <li><Check aria-hidden="true" />1 active learning path</li>
                <li><Check aria-hidden="true" />Tutor usage included</li>
              </ul>
              <button disabled={isExiting} onClick={enterDashboard} type="button">
                Continue with Free <ArrowRight aria-hidden="true" />
              </button>
            </article>
            <article className="stone-surface stone-surface-card is-featured">
              <div><Sparkles aria-hidden="true" /><span>Pro</span></div>
              <h2>Build more paths</h2>
              <strong>$9 <small>/ month</small></strong>
              <ul>
                <li><Check aria-hidden="true" />100 creation Stones monthly</li>
                <li><Check aria-hidden="true" />10 active learning paths</li>
                <li><Check aria-hidden="true" />Higher tutor and runtime caps</li>
              </ul>
              <button disabled={isCheckoutPending || isLoading || isExiting} onClick={() => void choosePro()} type="button">
                {isCheckoutPending ? "Opening checkout…" : "Continue with Pro"} <ArrowRight aria-hidden="true" />
              </button>
            </article>
          </div>
        )}

        {(checkoutState === "cancel" || activationTimedOut) && (
          <p className="onboarding-notice" role="status">
            {activationTimedOut ? "Subscription sync is taking longer than expected. Retry Pro or continue with Free." : "Checkout was canceled. Choose either plan when you’re ready."}
          </p>
        )}
        {(checkoutError || subscriptionError) && <p className="plain-error">{checkoutError ?? subscriptionError}</p>}
        <button className="onboarding-signout" disabled={isExiting} onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" />Sign out</button>
      </section>
    </main>
  );
}
