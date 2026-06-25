import { FormEvent, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useUsageSummary } from "@/hooks/useUsageSummary";

export type StonecodeSettingsSection = "overview" | "profile" | "billing" | "usage" | "security" | "support";

const settingsTabs: Array<{ id: StonecodeSettingsSection; label: string; path: string }> = [
  { id: "overview", label: "Overview", path: "/settings/overview" },
  { id: "profile", label: "Profile", path: "/settings/profile" },
  { id: "billing", label: "Billing", path: "/settings/billing" },
  { id: "usage", label: "Usage", path: "/settings/usage" },
  { id: "security", label: "Security", path: "/settings/security" },
  { id: "support", label: "Support", path: "/settings/support" }
];

const codingJourney = [
  { label: "JavaScript", streak: "14 day streak", progress: 0.78, note: "Arrays, objects, loops" },
  { label: "TypeScript", streak: "9 day streak", progress: 0.63, note: "Types, narrowing, generics" },
  { label: "Python", streak: "6 day streak", progress: 0.48, note: "Functions, files, problem sets" },
  { label: "HTML/CSS", streak: "11 day streak", progress: 0.72, note: "Layout, forms, responsive polish" }
];

const overviewActivity = [
  { title: "Asked tutor", detail: "Explain BFS complexity", age: "15m ago" },
  { title: "Edited file", detail: "graph.ts", age: "48m ago" },
  { title: "Ran code", detail: "queue.ts", age: "1h ago" },
  { title: "Completed checkpoint", detail: "Trees and traversal", age: "Yesterday" }
];

export function SettingsScene({ section }: { section: StonecodeSettingsSection }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { subscription, isLoading, error } = useSubscriptionState();
  const { usage, isLoading: isUsageLoading, error: usageError } = useUsageSummary(section === "usage" || section === "overview");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const userEmail = auth.user?.email ?? "stonecode.dev";
  const joinedAt = auth.user?.created_at ? new Date(auth.user.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
  const isVerified = Boolean(auth.user?.email_confirmed_at);
  const userInitial = userEmail[0]?.toUpperCase() ?? "S";
  const monthlyUsage = useMemo(() => {
    const tutorMessages = Math.max(usage.totalTutorMessages, 1);
    const planCap = subscription.aiMessagesPerMonth > 0 ? subscription.aiMessagesPerMonth : tutorMessages;
    const usageRatio = Math.min(tutorMessages / planCap, 1);
    const successRatio = tutorMessages > 0 ? usage.statusCounts.success / tutorMessages : 0;
    const blockedRatio = tutorMessages > 0 ? usage.statusCounts.blocked / tutorMessages : 0;

    return [
      { label: "Tutor messages", value: usage.totalTutorMessages, suffix: ` / ${subscription.aiMessagesPerMonth === 0 ? "Unlimited" : subscription.aiMessagesPerMonth}`, ratio: usageRatio },
      { label: "Successful replies", value: usage.statusCounts.success, suffix: " completed", ratio: successRatio },
      { label: "Blocked actions", value: usage.statusCounts.blocked, suffix: " guarded", ratio: blockedRatio }
    ];
  }, [subscription.aiMessagesPerMonth, usage]);

  async function handleSignOut() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user?.email) return;
    await auth.resetPassword(auth.user.email);
  }

  async function openCheckout(plan: "basic" | "pro") {
    await openBillingUrl("/api/billing/checkout", { plan });
  }

  async function openBillingPortal() {
    await openBillingUrl("/api/billing/portal", {});
  }

  async function openBillingUrl(path: string, body: Record<string, string>) {
    setBillingError(null);
    setIsBillingActionPending(true);
    try {
      const token = auth.session?.access_token;
      if (!token) throw new Error("Authentication required.");

      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          successUrl: `${window.location.origin}/settings/billing`,
          cancelUrl: `${window.location.origin}/settings/billing`,
          returnUrl: `${window.location.origin}/settings/billing`
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) throw new Error(payload?.error ?? "Failed to open Stripe.");
      window.location.href = payload.url;
    } catch (caughtError) {
      setBillingError(caughtError instanceof Error ? caughtError.message : "Failed to open Stripe.");
      setIsBillingActionPending(false);
    }
  }

  return (
    <>
      <aside className="settings-scene-nav settings-pane" aria-label="Settings navigation">
        <div className="settings-scene-brand">
          <div className="settings-scene-mark" aria-hidden="true">
            <StonecodeGlyph />
          </div>
          <div>
            <strong>stonecode</strong>
            <span>Account</span>
          </div>
        </div>

        <div className="settings-scene-stack">
          <span className="settings-pane-label">Account</span>
          <nav className="settings-scene-links" aria-label="Settings sections">
            {settingsTabs.map((tab) => (
              <NavLink className={({ isActive }) => isActive ? "is-active" : ""} key={tab.id} to={tab.path}>
                <span className="settings-link-icon" aria-hidden="true">{tab.label[0]}</span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="settings-side-help">
          <span className="settings-pane-label">Need help?</span>
          <p>Use Support for billing issues, access problems, or tutor feedback.</p>
          <NavLink to="/settings/support">Open support</NavLink>
        </div>

        <div className="settings-side-user">
          <div className="settings-side-avatar" aria-hidden="true">{userInitial}</div>
          <div>
            <strong>{userEmail}</strong>
            <span>{subscription.planName}</span>
          </div>
        </div>
      </aside>

      <section className="settings-scene-main settings-pane" aria-label="Account overview">
        <header className="settings-scene-header">
          <div>
            <h1>{sectionTitleMap[section]}</h1>
            <p>{sectionDescriptionMap[section]}</p>
          </div>
        </header>

        <div className="settings-scene-scroll">
          {section === "overview" && (
            <>
              <section className="settings-card settings-hero-card">
                <div className="settings-profile-lockup">
                  <div className="settings-profile-avatar" aria-hidden="true">{userInitial}</div>
                  <div>
                    <strong>{readDisplayName(userEmail)}</strong>
                    <span>{userEmail}</span>
                    <div className="settings-profile-meta">
                      <small>Member since {joinedAt}</small>
                      {isVerified && <em>Email verified</em>}
                    </div>
                  </div>
                </div>
                <button className="settings-quiet-button" type="button">Edit profile</button>
              </section>

              <div className="settings-two-column">
                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Current plan</span>
                      <strong>{isLoading ? "Loading..." : subscription.planName}</strong>
                    </div>
                    <small>{subscription.status}</small>
                  </div>
                  <p>{planCopy(subscription.plan)}</p>
                  <div className="settings-inline-actions">
                    <button disabled={isBillingActionPending} onClick={() => openCheckout("basic")} type="button">Basic</button>
                    <button disabled={isBillingActionPending} onClick={() => openCheckout("pro")} type="button">Pro</button>
                    <button disabled={isBillingActionPending || subscription.plan === "free"} onClick={openBillingPortal} type="button">Portal</button>
                  </div>
                </section>

                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Usage this month</span>
                      <strong>{usage.totalTutorMessages}</strong>
                    </div>
                    <small>{isUsageLoading ? "Syncing..." : "Live"}</small>
                  </div>
                  <div className="settings-meter-list">
                    {monthlyUsage.map((item) => (
                      <UsageBar item={item} key={item.label} />
                    ))}
                  </div>
                </section>
              </div>

              <div className="settings-two-column">
                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Coding journey</span>
                      <strong>By language</strong>
                    </div>
                    <small>Static beta preview</small>
                  </div>
                  <div className="journey-list">
                    {codingJourney.map((item) => (
                      <div className="journey-row" key={item.label}>
                        <div>
                          <strong>{item.label}</strong>
                          <span>{item.note}</span>
                        </div>
                        <small>{item.streak}</small>
                        <div className="journey-meter"><i style={{ width: `${item.progress * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Security shortcuts</span>
                      <strong>Account controls</strong>
                    </div>
                  </div>
                  <div className="security-shortcuts">
                    <button className="settings-shortcut" type="button" onClick={() => navigate("/settings/security")}>
                      <div><strong>Security</strong><span>Password reset and session control</span></div>
                      <small>Open</small>
                    </button>
                    <button className="settings-shortcut" type="button" onClick={() => navigate("/settings/usage")}>
                      <div><strong>Usage</strong><span>Track tutor requests and plan guardrails</span></div>
                      <small>Open</small>
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}

          {section === "profile" && (
            <section className="settings-card">
              <div className="settings-profile-grid">
                <div className="settings-profile-avatar large" aria-hidden="true">{userInitial}</div>
                <div>
                  <strong>{readDisplayName(userEmail)}</strong>
                  <span>{userEmail}</span>
                  <div className="settings-profile-meta">
                    <small>Timezone {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
                    {isVerified && <em>Verified</em>}
                  </div>
                </div>
              </div>

              <div className="settings-form-grid">
                <Field label="Display name" value={readDisplayName(userEmail)} />
                <Field label="Primary focus" value="Algorithms and core CS" />
                <Field label="Weekly cadence" value="4 focused sessions" />
                <Field label="Preferred style" value="Explain, then let me code" />
              </div>
            </section>
          )}

          {section === "billing" && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <span>Billing</span>
                  <strong>{isLoading ? "Loading..." : subscription.planName}</strong>
                </div>
                <small>{subscription.currentPeriodEnd ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : "No renewal date"}</small>
              </div>
              <p>{planCopy(subscription.plan)}</p>
              {error && <p className="settings-inline-error">{error}</p>}
              {billingError && <p className="settings-inline-error">{billingError}</p>}
              <div className="settings-inline-actions">
                <button disabled={isBillingActionPending} onClick={() => openCheckout("basic")} type="button">Upgrade to Basic</button>
                <button disabled={isBillingActionPending} onClick={() => openCheckout("pro")} type="button">Upgrade to Pro</button>
                <button disabled={isBillingActionPending || subscription.plan === "free"} onClick={openBillingPortal} type="button">Manage billing</button>
              </div>
            </section>
          )}

          {section === "usage" && (
            <>
              <section className="settings-card">
                <div className="settings-usage-grid">
                  <UsageStat label="Tutor messages" value={usage.totalTutorMessages} />
                  <UsageStat label="Succeeded" value={usage.statusCounts.success} />
                  <UsageStat label="Failed" value={usage.statusCounts.failed} />
                  <UsageStat label="Blocked" value={usage.statusCounts.blocked} />
                </div>
                {usage.latestEventAt && <p className="settings-meta-line">Last tutor event: {new Date(usage.latestEventAt).toLocaleString()}</p>}
                {usageError && <p className="settings-inline-error">{usageError}</p>}
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <div>
                    <span>Coding journey</span>
                    <strong>Practice split</strong>
                  </div>
                </div>
                <div className="journey-list compact">
                  {codingJourney.map((item) => (
                    <div className="journey-row" key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.note}</span>
                      </div>
                      <small>{item.streak}</small>
                      <div className="journey-meter"><i style={{ width: `${item.progress * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {section === "security" && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <span>Security</span>
                  <strong>Access and recovery</strong>
                </div>
                <small>{isVerified ? "Verified email" : "Email not verified"}</small>
              </div>
              <div className="settings-security-stack">
                <div className="settings-security-row">
                  <div>
                    <strong>Email</strong>
                    <span>{userEmail}</span>
                  </div>
                  <small>{isVerified ? "Confirmed" : "Pending"}</small>
                </div>

                <form className="settings-inline-actions" onSubmit={handlePasswordReset}>
                  <button type="submit">Send password reset</button>
                  <button onClick={handleSignOut} type="button">Sign out</button>
                </form>
              </div>
            </section>
          )}

          {section === "support" && (
            <section className="settings-card">
              <div className="settings-support-grid">
                {[
                  ["Billing help", "Start in Billing. If portal access fails, include your account email and plan."],
                  ["Bug report", "Send route, click path, expected result, and whether learning is blocked."],
                  ["Tutor feedback", "Include course, last prompt, and whether code was edited or run."],
                  ["Account access", "Use password reset first, then report exact auth error text."]
                ].map(([title, copy]) => (
                  <article className="settings-support-card" key={title}>
                    <strong>{title}</strong>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      <aside className="settings-scene-rail settings-pane" aria-label="Recent activity">
        <div className="settings-rail-section">
          <div className="settings-card-heading">
            <div>
              <span>Recent activity</span>
              <strong>Last touches</strong>
            </div>
          </div>
          <div className="settings-activity-list">
            {overviewActivity.map((item) => (
              <div className="settings-activity-row" key={`${item.title}-${item.age}`}>
                <div className="settings-activity-icon" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <small>{item.age}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-rail-section">
          <span className="settings-pane-label">This month</span>
          <div className="settings-mini-metrics">
            <UsageStat label="Messages" value={usage.totalTutorMessages} compact />
            <UsageStat label="Success" value={usage.statusCounts.success} compact />
          </div>
        </div>

        <div className="settings-rail-section">
          <span className="settings-pane-label">Storage</span>
          <div className="settings-storage-row">
            <strong>2.4 MB</strong>
            <span>workspace files and notes</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-field-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UsageBar({
  item
}: {
  item: { label: string; value: number; suffix: string; ratio: number };
}) {
  return (
    <div className="usage-bar">
      <div className="usage-bar-copy">
        <span>{item.label}</span>
        <strong>{item.value}{item.suffix}</strong>
      </div>
      <div className="usage-bar-track"><i style={{ width: `${Math.max(item.ratio * 100, item.value > 0 ? 12 : 0)}%` }} /></div>
    </div>
  );
}

function UsageStat({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={`settings-usage-stat${compact ? " compact" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StonecodeGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" width="18" x="3" y="3" />
      <path d="M10 8.4 7.7 12 10 15.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M14 8.4 16.3 12 14 15.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function readDisplayName(email: string) {
  const stem = email.split("@")[0] ?? "learner";
  return stem.replace(/[._-]+/g, " ");
}

function planCopy(plan: string) {
  if (plan === "pro") return "Unlimited course workspaces, priority access, and the broadest tutor allowance.";
  if (plan === "basic") return "More room for active courses and a higher monthly tutor allowance.";
  return "One active course, guided beta access, and guarded monthly tutor usage.";
}

const sectionTitleMap: Record<StonecodeSettingsSection, string> = {
  overview: "Account overview",
  profile: "Profile",
  billing: "Billing",
  usage: "Usage",
  security: "Security",
  support: "Support"
};

const sectionDescriptionMap: Record<StonecodeSettingsSection, string> = {
  overview: "Manage profile, subscription, streaks, and account controls without leaving the Stonecode scene.",
  profile: "Learner identity, current focus, and workspace-facing defaults.",
  billing: "Plan state, upgrades, and billing portal access for the paid beta.",
  usage: "Tutor activity, usage guardrails, and practice trend snapshots.",
  security: "Password recovery, email verification state, and session controls.",
  support: "What to send when billing, auth, or tutor behavior needs help."
};
