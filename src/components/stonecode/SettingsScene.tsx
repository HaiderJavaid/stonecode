import { FormEvent, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  BookOpen,
  CircleHelp,
  CreditCard,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Sparkles,
  Clock3,
  Flame,
  Trophy,
  BookOpenCheck,
  UserRound
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useProgression } from "@/hooks/useProgression";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { ProgressionOverview } from "@/components/stonecode/ProgressionOverview";
import { saveProfilePreferences } from "@/services/profilePreferences";

export type StonecodeSettingsSection = "overview" | "profile" | "billing" | "api-keys" | "security" | "preferences";

const settingsTabs = [
  { id: "overview", label: "Overview", path: "/settings/overview", icon: LayoutDashboard },
  { id: "profile", label: "Profile", path: "/settings/profile", icon: UserRound },
  { id: "billing", label: "Billing", path: "/settings/billing", icon: CreditCard },
  { id: "api-keys", label: "API Keys", path: "/settings/api-keys", icon: KeyRound },
  { id: "security", label: "Security", path: "/settings/security", icon: ShieldCheck },
  { id: "preferences", label: "Preferences", path: "/settings/preferences", icon: Settings2 }
] satisfies Array<{
  id: StonecodeSettingsSection;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}>;

export function SettingsScene({ section }: { section: StonecodeSettingsSection }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState("All");
  const { progression, isLoading: progressionLoading, error: progressionError, refresh, equipTitle } =
    useProgression(language === "All" ? null : language);
  const { subscription, isLoading: subscriptionLoading, error: subscriptionError } = useSubscriptionState();
  const { usage, isLoading: usageLoading, error: usageError } = useUsageSummary(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [learningStyle, setLearningStyle] = useState(() => window.localStorage.getItem("stonecode.learningStyle") ?? "explain-then-code");
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const userEmail = auth.user?.email ?? "stonecode.dev";
  const userInitial = userEmail[0]?.toUpperCase() ?? "S";
  const isVerified = Boolean(auth.user?.email_confirmed_at);
  const syncState = progressionLoading || subscriptionLoading || usageLoading
    ? "Syncing"
    : progressionError || subscriptionError || usageError
      ? "Needs attention"
      : "Synced";

  useEffect(() => {
    setDisplayName(progression.displayName ?? readDisplayName(userEmail));
    setTimezone(progression.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, [progression.displayName, progression.timezone, userEmail]);

  async function handleSignOut() {
    await auth.signOut();
    navigate("/login", { replace: true });
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user?.email) return;
    await auth.resetPassword(auth.user.email);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user) return;
    setProfileStatus(null);
    try {
      await saveProfilePreferences({ userId: auth.user.id, displayName });
      await refresh();
      setProfileStatus("Profile saved.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Profile save failed.");
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user) return;
    setPreferenceStatus(null);
    try {
      await saveProfilePreferences({ userId: auth.user.id, timezone });
      window.localStorage.setItem("stonecode.learningStyle", learningStyle);
      await refresh();
      setPreferenceStatus("Preferences saved.");
    } catch (error) {
      setPreferenceStatus(error instanceof Error ? error.message : "Preference save failed.");
    }
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
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Failed to open Stripe.");
      setIsBillingActionPending(false);
    }
  }

  return (
    <div className="settings-workspace">
      <aside className="file-panel is-visible settings-left-panel" aria-label="Settings navigation">
        <NavLink className="file-panel-brand settings-left-brand" to="/dashboard">
          <div className="file-panel-mark"><StonecodeGlyph /></div>
          <strong>stonecode</strong>
        </NavLink>

        <div className="settings-left-navigation">
          <span className="settings-pane-label">Account</span>
          <nav className="settings-scene-links" aria-label="Settings sections">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink className={({ isActive }) => isActive ? "is-active" : ""} key={tab.id} to={tab.path}>
                  <Icon aria-hidden="true" size={16} />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="settings-side-help settings-left-help">
          <CircleHelp size={18} />
          <strong>Need help?</strong>
          <p>Read the docs or contact support.</p>
          <NavLink to="/support">View docs <ExternalLink size={12} /></NavLink>
        </div>

        <div className="file-panel-footer settings-left-footer">
          <div className="file-panel-user">
          <div className="file-panel-user-avatar">{userInitial}</div>
          <div><strong>{displayName || userEmail}</strong><span>{subscription.planName} plan</span></div>
          <i>⌄</i>
          </div>
        </div>
      </aside>

      <section className="settings-scene-main settings-pane" aria-label={sectionTitleMap[section]}>
        <header className="settings-scene-header">
          <div>
            <h1>{sectionTitleMap[section]}</h1>
            <p>{sectionDescriptionMap[section]}</p>
          </div>
          <NavLink className="settings-dashboard-link" to="/dashboard"><BookOpen size={15} />Dashboard</NavLink>
        </header>

        <div className="settings-scene-scroll">
          {progressionError && <p className="settings-inline-error">{progressionError}</p>}
          {section === "overview" && (
            <ProgressionOverview
              language={language}
              onEquipTitle={equipTitle}
              onLanguageChange={setLanguage}
              progression={progression}
              userEmail={userEmail}
              userInitial={userInitial}
            />
          )}

          {section === "profile" && (
            <form className="settings-card settings-form-section" onSubmit={saveProfile}>
              <div className="settings-profile-grid">
                <div className="settings-profile-avatar large">{userInitial}</div>
                <div>
                  <span className="settings-eyebrow">Public learner identity</span>
                  <strong>{displayName || readDisplayName(userEmail)}</strong>
                  <span>{userEmail}</span>
                </div>
              </div>
              <label className="settings-input">
                <span>Display name</span>
                <input onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
              </label>
              <div className="settings-readonly-grid">
                <Field label="Email" value={userEmail} />
                <Field label="Equipped title" value={progression.badges.find((badge) => badge.equipped)?.title ?? "None"} />
                <Field label="Member since" value={formatDate(auth.user?.created_at)} />
                <Field label="Verification" value={isVerified ? "Email verified" : "Pending"} />
              </div>
              <button className="settings-primary-button" type="submit">Save profile</button>
              {profileStatus && <p className="settings-meta-line">{profileStatus}</p>}
            </form>
          )}

          {section === "billing" && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div><span>Current plan</span><strong>{subscriptionLoading ? "Loading..." : subscription.planName}</strong></div>
                <small>{subscription.status}</small>
              </div>
              <p>{planCopy(subscription.plan)}</p>
              <div className="settings-readonly-grid">
                <Field label="Active course limit" value={subscription.activeCourseLimit} />
                <Field label="Tutor messages" value={subscription.aiMessagesPerMonth || "Unlimited"} />
                <Field label="Renewal" value={formatDate(subscription.currentPeriodEnd)} />
                <Field label="Billing state" value={subscription.status} />
              </div>
              {(subscriptionError || billingError) && <p className="settings-inline-error">{subscriptionError ?? billingError}</p>}
              <div className="settings-inline-actions">
                <button disabled={isBillingActionPending} onClick={() => void openCheckout("basic")} type="button">Upgrade Basic</button>
                <button disabled={isBillingActionPending} onClick={() => void openCheckout("pro")} type="button">Upgrade Pro</button>
                <button disabled={isBillingActionPending || subscription.plan === "free"} onClick={() => void openBillingPortal()} type="button">Billing portal</button>
              </div>
            </section>
          )}

          {section === "api-keys" && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div><span>Provider access</span><strong>API keys</strong></div>
                <small>Server managed</small>
              </div>
              <p>Stonecode beta keeps model-provider keys on the server. Personal browser-stored keys are disabled to prevent accidental exposure.</p>
              <div className="settings-security-stack">
                <div className="settings-security-row">
                  <KeyRound size={18} />
                  <div><strong>Tutor provider</strong><span>Configured through protected server environment variables.</span></div>
                </div>
                <div className="settings-security-row">
                  <ShieldCheck size={18} />
                  <div><strong>Client safety</strong><span>No secret model key is sent to the browser.</span></div>
                </div>
              </div>
            </section>
          )}

          {section === "security" && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div><span>Access</span><strong>Security controls</strong></div>
                <small>{isVerified ? "Verified" : "Verification pending"}</small>
              </div>
              <div className="settings-security-stack">
                <div className="settings-security-row">
                  <KeyRound size={18} />
                  <div><strong>Password recovery</strong><span>Send a secure reset link to {userEmail}.</span></div>
                </div>
                <div className="settings-security-row">
                  <ShieldCheck size={18} />
                  <div><strong>Session</strong><span>Sign out this browser session immediately.</span></div>
                </div>
              </div>
              <form className="settings-inline-actions" onSubmit={handlePasswordReset}>
                <button type="submit">Send password reset</button>
                <button onClick={() => void handleSignOut()} type="button">Sign out</button>
              </form>
            </section>
          )}

          {section === "preferences" && (
            <form className="settings-card settings-form-section" onSubmit={savePreferences}>
              <label className="settings-input">
                <span>Display</span>
                <select defaultValue="stone-dark">
                  <option value="stone-dark">Stone dark</option>
                </select>
              </label>
              <label className="settings-input">
                <span>Timezone</span>
                <input onChange={(event) => setTimezone(event.target.value)} value={timezone} />
                <small>Used for heatmap dates, daily limits, and streak boundaries.</small>
              </label>
              <label className="settings-input">
                <span>Learning default</span>
                <select onChange={(event) => setLearningStyle(event.target.value)} value={learningStyle}>
                  <option value="explain-then-code">Explain, then let me code</option>
                  <option value="challenge-first">Challenge first</option>
                  <option value="guided">Step-by-step guidance</option>
                </select>
              </label>
              <button className="settings-primary-button" type="submit">Save preferences</button>
              {preferenceStatus && <p className="settings-meta-line">{preferenceStatus}</p>}
            </form>
          )}
        </div>
      </section>

      <aside className="settings-scene-rail settings-pane" aria-label="Your environment">
        <header className="settings-rail-header">
          <strong>Your Environment</strong>
          <button onClick={() => void refresh()} type="button">Refresh</button>
        </header>

        <section className="settings-environment-card">
          <div className="settings-environment-brand">
            <div className="settings-environment-mark"><Sparkles size={25} /></div>
            <div><strong>stonecode</strong><span>v1.0.0 <em>{subscription.planName}</em></span></div>
          </div>
          <div className="settings-environment-rows">
            <EnvironmentRow icon={<BookOpenCheck />} label="Courses completed" value={progression.completedCourses} />
            <EnvironmentRow icon={<Flame />} label="Current streak" value={`${progression.currentStreak} days`} />
            <EnvironmentRow icon={<Trophy />} label="Total XP" value={progression.totalXp.toLocaleString()} />
            <EnvironmentRow icon={<BadgeDollarSign />} label="Challenges solved" value={progression.solvedChallenges} />
            <EnvironmentRow icon={<Clock3 />} label="Last active" value={formatRelativeDate(progression.lastActiveAt)} active />
          </div>
        </section>

        <section className="settings-rail-section settings-sync-card">
          <strong>Sync status</strong>
          <div>
            <ShieldCheck size={18} />
            <span><b>{syncState === "Synced" ? "All changes synced" : syncState}</b><small>{syncState === "Synced" ? "Just now" : "Check connection"}</small></span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="settings-field-card"><span>{label}</span><strong>{value}</strong></div>;
}

function EnvironmentRow({
  icon,
  label,
  value,
  active = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  active?: boolean;
}) {
  return (
    <div>
      <span>{icon}{label}</span>
      <strong className={active ? "is-active" : ""}>{value}</strong>
    </div>
  );
}

function StonecodeGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect fill="none" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="3" />
      <path d="M10 8.6 7.7 12 10 15.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M14 8.6 16.3 12 14 15.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function readDisplayName(email: string) {
  return (email.split("@")[0] ?? "learner").replace(/[._-]+/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeDate(value?: string | null) {
  if (!value) return "Not yet";
  const difference = Date.now() - new Date(value).getTime();
  if (difference < 60_000) return "Just now";
  if (difference < 3_600_000) return `${Math.max(Math.floor(difference / 60_000), 1)}m ago`;
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`;
  return formatDate(value);
}

function planCopy(plan: string) {
  if (plan === "pro") return "Unlimited course workspaces, priority access, and the broadest tutor allowance.";
  if (plan === "basic") return "More active courses and a higher monthly tutor allowance.";
  return "One active course with guarded monthly tutor usage.";
}

const sectionTitleMap: Record<StonecodeSettingsSection, string> = {
  overview: "Progression overview",
  profile: "Profile",
  billing: "Billing",
  "api-keys": "API Keys",
  security: "Security",
  preferences: "Preferences"
};

const sectionDescriptionMap: Record<StonecodeSettingsSection, string> = {
  overview: "XP, streaks, activity, courses, badges, and earned titles.",
  profile: "Learner identity and the title shown across Stonecode.",
  billing: "Plan limits, upgrades, renewal state, and Stripe controls.",
  "api-keys": "How Stonecode protects model-provider credentials.",
  security: "Password recovery, verification state, and session controls.",
  preferences: "Display, timezone boundaries, and learning defaults."
};
