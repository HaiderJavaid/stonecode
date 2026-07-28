import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  Code2,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { useProgression } from "@/hooks/useProgression";
import { useOpenAiCredential } from "@/hooks/useOpenAiCredential";
import { Course } from "@/data/courses";
import { equipProgressionTitle } from "@/services/progression";
import {
  loadProfilePreferences,
  saveProfilePreferences
} from "@/services/profilePreferences";
import { SettingsOverview } from "@/components/stonecode/settings/SettingsOverview";
import { FilePanelBrand } from "@/components/stonecode/FilePanel";
import { StoneSurface } from "@/components/stonecode/StoneSurface";
import {
  BillingSettings,
  ProfileSettings,
  SecuritySettings,
  SupportSettings,
  UsageSettings
} from "@/components/stonecode/settings/SettingsSections";
import "@/components/stonecode/settings/settings.css";

export type StonecodeSettingsSection = "overview" | "profile" | "billing" | "usage" | "security" | "support";
const settingsExitMs = 420;

type SettingsTab = {
  id: StonecodeSettingsSection;
  icon: LucideIcon;
  label: string;
  path: string;
};

const settingsTabs: SettingsTab[] = [
  { id: "overview", icon: Gauge, label: "Overview", path: "/settings/overview" },
  { id: "profile", icon: UserRound, label: "Profile", path: "/settings/profile" },
  { id: "billing", icon: CreditCard, label: "Billing", path: "/settings/billing" },
  { id: "usage", icon: Activity, label: "Usage", path: "/settings/usage" },
  { id: "security", icon: ShieldCheck, label: "Security", path: "/settings/security" },
  { id: "support", icon: LifeBuoy, label: "Support", path: "/settings/support" }
];

export function SettingsScene({
  courses,
  lessonStepByCourse,
  onSignOutTransition,
  returnPath = "/dashboard",
  section
}: {
  courses: Course[];
  lessonStepByCourse: Record<string, number>;
  onSignOutTransition?: () => void;
  returnPath?: string;
  section: StonecodeSettingsSection;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { subscription, isLoading: isSubscriptionLoading, error: subscriptionError } = useSubscriptionState();
  const { usage, isLoading: isUsageLoading, error: usageError } = useUsageSummary(section === "usage");
  const {
    progression,
    isLoading: isProgressionLoading,
    error: progressionError,
    refresh: refreshProgression
  } = useProgression();
  const [displayName, setDisplayName] = useState("");
  const [profileTimezone, setProfileTimezone] = useState("UTC");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  const userEmail = auth.user?.email ?? "stonecode.dev";
  const joinedAt = auth.user?.created_at
    ? new Date(auth.user.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Recently";
  const isVerified = Boolean(auth.user?.email_confirmed_at);
  const resolvedDisplayName = displayName || readDisplayName(userEmail);
  const timezoneOptions = useMemo(() => resolveTimezoneOptions(profileTimezone), [profileTimezone]);
  const openAiCredentialState = useOpenAiCredential({
    accessToken: auth.session?.access_token ?? null,
    enabled: section === "billing" && subscription.requiresOwnOpenAiKey
  });

  useEffect(() => {
    if (!auth.user?.id) return;
    let cancelled = false;
    setIsProfileLoading(true);
    loadProfilePreferences(auth.user.id)
      .then((profile) => {
        if (cancelled) return;
        setDisplayName(profile.displayName || readDisplayName(userEmail));
        setProfileTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      })
      .catch((error) => {
        if (!cancelled) setProfileMessage({ tone: "error", text: error instanceof Error ? error.message : "Failed to load profile." });
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [auth.user?.id, userEmail]);

  useEffect(() => () => {
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
  }, []);

  function beginSettingsExit(onExited: () => void) {
    if (exitTimerRef.current || isExiting) return;
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onExited();
    }, settingsExitMs);
  }

  function handleSettingsLink(event: MouseEvent<HTMLAnchorElement>, target: string) {
    event.preventDefault();
    beginSettingsExit(() => navigate(target));
  }

  function handleSignOut() {
    beginSettingsExit(() => {
      if (onSignOutTransition) {
        onSignOutTransition();
        return;
      }
      void auth.signOut().then(() => navigate("/login", { replace: true }));
    });
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user?.id) return;
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setProfileMessage({ tone: "error", text: "Display name must be at least 2 characters." });
      return;
    }
    setIsProfileSaving(true);
    setProfileMessage(null);
    try {
      await saveProfilePreferences({ userId: auth.user.id, displayName: trimmedName, timezone: profileTimezone });
      setDisplayName(trimmedName);
      setProfileMessage({ tone: "success", text: "Profile saved." });
      await refreshProgression();
    } catch (error) {
      setProfileMessage({ tone: "error", text: error instanceof Error ? error.message : "Failed to save profile." });
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user?.email) return;
    setSecurityError(null);
    setSecurityMessage(null);
    try {
      await auth.resetPassword(auth.user.email);
      setSecurityMessage("Password reset email sent.");
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : "Failed to send password reset.");
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  async function saveOpenAiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openAiKeyInput.trim()) return;
    try {
      await openAiCredentialState.save(openAiKeyInput);
      setOpenAiKeyInput("");
    } catch { /* Shared credential state renders the server error. */ }
  }

  async function deleteOpenAiKey() {
    try { await openAiCredentialState.remove(); } catch { /* Shared state renders the error. */ }
  }

  async function handleEquipTitle(badgeId: string | null) {
    await equipProgressionTitle(badgeId);
    await refreshProgression();
  }

  return (
    <div className={`settings-v2${isExiting ? " is-exiting" : ""}`}>
      <StoneSurface as="aside" variant="side" className="file-panel is-visible settings-v2-nav" aria-label="Settings navigation">
        <FilePanelBrand />
        <div className="settings-v2-nav-group">
          <span>Account</span>
          <nav aria-label="Settings sections">
            {settingsTabs.map((tab) => (
              <NavLink className={({ isActive }) => isActive ? "is-active" : ""} key={tab.id} to={tab.path}>
                <tab.icon aria-hidden="true" />
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="settings-v2-nav-footer">
          <Link onClick={(event) => handleSettingsLink(event, "/dashboard")} to="/dashboard"><LayoutDashboard aria-hidden="true" /><span>Dashboard</span></Link>
          <div className="settings-v2-nav-user file-panel-user">
            <span className="file-panel-user-avatar">{userEmail[0]?.toUpperCase() ?? "S"}</span>
            <div><strong>{resolvedDisplayName}</strong><small>{subscription.planName} plan</small></div>
          </div>
        </div>
      </StoneSurface>

      <section className={`settings-v2-main is-${section}`} aria-labelledby="settings-title">
        <header className="settings-v2-header">
          <div><span>Account settings</span><h1 id="settings-title">{sectionTitleMap[section]}</h1><p>{sectionDescriptionMap[section]}</p></div>
          <Link onClick={(event) => handleSettingsLink(event, returnPath)} to={returnPath}><LayoutDashboard aria-hidden="true" />Return</Link>
        </header>
        <div className="settings-v2-content">
          {section === "overview" && (
            <SettingsOverview
              courses={courses}
              isLoading={isProgressionLoading}
              lessonStepByCourse={lessonStepByCourse}
              onEquipTitle={handleEquipTitle}
              progression={progression}
            />
          )}
          {section === "profile" && (
            <ProfileSettings
              displayName={displayName}
              email={userEmail}
              isLoading={isProfileLoading}
              isSaving={isProfileSaving}
              joinedAt={joinedAt}
              message={profileMessage}
              onDisplayNameChange={setDisplayName}
              onSave={handleProfileSave}
              onTimezoneChange={setProfileTimezone}
              timezone={profileTimezone}
              timezoneOptions={timezoneOptions}
              verified={isVerified}
            />
          )}
          {section === "billing" && (
            <BillingSettings
              billingError={billingError ?? subscriptionError}
              credential={openAiCredentialState.credential}
              credentialError={openAiCredentialState.error}
              isBillingPending={isBillingActionPending}
              isCredentialPending={openAiCredentialState.isLoading || openAiCredentialState.isPending}
              isLoading={isSubscriptionLoading}
              keyInput={openAiKeyInput}
              onCheckout={(plan) => void openCheckout(plan)}
              onKeyInputChange={setOpenAiKeyInput}
              onManageBilling={() => void openBillingPortal()}
              onRemoveKey={() => void deleteOpenAiKey()}
              onSaveKey={saveOpenAiKey}
              subscription={subscription}
            />
          )}
          {section === "usage" && <UsageSettings error={usageError} isLoading={isUsageLoading} subscription={subscription} usage={usage} />}
          {section === "security" && (
            <SecuritySettings
              email={userEmail}
              error={securityError}
              lastSignInAt={auth.user?.last_sign_in_at ?? null}
              message={securityMessage}
              onPasswordReset={handlePasswordReset}
              onSignOut={() => void handleSignOut()}
              verified={isVerified}
            />
          )}
          {section === "support" && <SupportSettings />}
        </div>
      </section>

      <aside className="settings-v2-rail" aria-label="Stonecode environment">
        <div className="settings-v2-rail-heading"><span>Your environment</span><button aria-label="Refresh progression" onClick={() => void refreshProgression()} type="button"><RefreshCw aria-hidden="true" /></button></div>
        <div className="settings-v2-environment">
          <div className="settings-v2-environment-brand">
            <span><Code2 aria-hidden="true" /></span>
            <div><strong>stonecode</strong><small>v1.0.0 · {subscription.planName}</small></div>
          </div>
          <em>{progression.equippedTitle ?? "Learning workspace"}</em>
        </div>
        <div className="settings-v2-rail-stats">
          <div><span>Courses completed</span><strong>{progression.completedCourses}</strong></div>
          <div><span>Current streak</span><strong>{progression.currentStreak} days</strong></div>
          <div><span>Total XP</span><strong>{progression.totalXp}</strong></div>
          <div><span>Exercises solved</span><strong>{progression.solvedExercises}</strong></div>
          <div><span>Title</span><strong>{progression.equippedTitle ?? "Unranked"}</strong></div>
        </div>
        <div className="settings-v2-sync">
          <span className={progressionError ? "is-error" : ""}><ShieldCheck aria-hidden="true" /></span>
          <div><strong>{progressionError ? "Sync needs attention" : "All changes synced"}</strong><small>{isProgressionLoading ? "Refreshing…" : progression.latestActivityAt ? "Progress saved" : "Ready"}</small></div>
        </div>
        <div className="settings-v2-rail-actions">
          <Link onClick={(event) => handleSettingsLink(event, "/dashboard")} to="/dashboard"><LayoutDashboard aria-hidden="true" />Dashboard</Link>
          <NavLink to="/settings/profile"><UserRound aria-hidden="true" />Edit profile</NavLink>
          <button onClick={handleSignOut} type="button"><LogOut aria-hidden="true" />Sign out</button>
        </div>
      </aside>
    </div>
  );
}

function readDisplayName(email: string) {
  const stem = email.split("@")[0] ?? "learner";
  return stem.replace(/[._-]+/g, " ");
}

function resolveTimezoneOptions(current: string) {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return Array.from(new Set([current, browserTimezone, "UTC", ...supported])).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

const sectionTitleMap: Record<StonecodeSettingsSection, string> = {
  overview: "Progression overview",
  profile: "Profile",
  billing: "Billing",
  usage: "Usage",
  security: "Security",
  support: "Support"
};

const sectionDescriptionMap: Record<StonecodeSettingsSection, string> = {
  overview: "Your verified learning activity, strongest languages, titles, and programs.",
  profile: "Manage the essential account details Stonecode uses across your workspace.",
  billing: "Review your plan, learning allowance, billing access, and AI connection.",
  usage: "See recorded tutor activity and the guardrails attached to your plan.",
  security: "Review account verification, recovery, and the current session.",
  support: "Find the right troubleshooting path without leaving your workspace."
};
