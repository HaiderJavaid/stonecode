import { FormEvent, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useSubscriptionState } from "@/hooks/useSubscriptionState";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { useProgression } from "@/hooks/useProgression";
import {
  equipProgressionTitle,
  ProgressionHeatmapDay
} from "@/services/progression";
import { StoneSurface } from "@/components/stonecode/StoneSurface";

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

export function SettingsScene({ section, returnPath = "/dashboard" }: { section: StonecodeSettingsSection; returnPath?: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { subscription, isLoading, error } = useSubscriptionState();
  const { usage, error: usageError } = useUsageSummary(section === "usage");
  const {
    progression,
    isLoading: isProgressionLoading,
    error: progressionError,
    refresh: refreshProgression
  } = useProgression();
  const [languageFilter, setLanguageFilter] = useState("All");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingActionPending, setIsBillingActionPending] = useState(false);
  const userEmail = auth.user?.email ?? "stonecode.dev";
  const joinedAt = auth.user?.created_at ? new Date(auth.user.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
  const isVerified = Boolean(auth.user?.email_confirmed_at);
  const userInitial = userEmail[0]?.toUpperCase() ?? "S";
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

  async function handleEquipTitle(badgeId: string) {
    await equipProgressionTitle(badgeId);
    await refreshProgression();
  }

  return (
    <>
      <StoneSurface as="aside" variant="side" className="settings-scene-nav settings-pane" aria-label="Settings navigation">
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
      </StoneSurface>

      <StoneSurface as="section" variant="main" className="settings-scene-main settings-pane" aria-label="Account overview">
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
                      {progression.equippedTitle && <em>{progression.equippedTitle}</em>}
                    </div>
                  </div>
                </div>
                <button className="settings-quiet-button" onClick={() => navigate(returnPath)} type="button">Close</button>
              </section>

              <div className="settings-two-column">
                <SolvedExercisesCard
                  byDifficulty={progression.byDifficulty}
                  isLoading={isProgressionLoading}
                  solved={progression.solvedExercises}
                />

                <section className="settings-card progression-badge-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Badges</span>
                      <strong>{progression.badges.length}</strong>
                    </div>
                    <small>Earned titles</small>
                  </div>
                  {progression.badges.length ? (
                    <div className="progression-badge">
                      <div className="progression-badge-shape"><BadgeIcon /><span>01</span></div>
                      <span>Most recent badge</span>
                      <strong>{progression.badges.at(-1)?.title}</strong>
                      <button
                        disabled={progression.equippedBadgeId === progression.badges.at(-1)?.id}
                        onClick={() => void handleEquipTitle(progression.badges.at(-1)?.id ?? "")}
                        type="button"
                      >
                        {progression.equippedBadgeId === progression.badges.at(-1)?.id ? "Equipped" : "Use as title"}
                      </button>
                    </div>
                  ) : (
                    <div className="progression-empty">
                      <strong>No badges yet</strong>
                      <span>Complete your first verified exercise to earn First Steps.</span>
                    </div>
                  )}
                </section>
              </div>

              <section className="settings-card progression-heatmap-card">
                <div className="progression-heatmap-head">
                  <div>
                    <strong>{progression.solvedExercises}</strong>
                    <span>accepted exercises in the last year</span>
                  </div>
                  <div className="progression-heatmap-stats">
                    <span>Active days: <strong>{progression.heatmap.filter((day) => day.xp > 0).length}</strong></span>
                    <span>Current streak: <strong>{progression.currentStreak}</strong></span>
                    <select aria-label="Filter activity by language" onChange={(event) => setLanguageFilter(event.target.value)} value={languageFilter}>
                      <option>All</option>
                      {progression.languageXp.map((item) => <option key={item.language}>{item.language}</option>)}
                    </select>
                  </div>
                </div>
                <ProgressionHeatmap days={progression.heatmap} language={languageFilter} />
              </section>

              <div className="settings-two-column">
                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Language XP</span>
                      <strong>{progression.totalXp} XP</strong>
                    </div>
                  </div>
                  <LanguageXpList items={progression.languageXp} totalXp={progression.totalXp} />
                </section>

                <section className="settings-card progression-courses-card">
                  <div className="settings-card-heading">
                    <div>
                      <span>Courses completed</span>
                      <strong>{progression.completedCourses}</strong>
                    </div>
                    <TrophyIcon />
                  </div>
                  <div className="progression-empty compact">
                    <strong>{progression.completedCourses ? "Course milestones recorded" : "No completed courses yet"}</strong>
                    <span>Every required syllabus section must be completed.</span>
                  </div>
                </section>
              </div>
              {progressionError && (
                <section className="settings-card progression-error">
                  <strong>Progression unavailable</strong>
                  <span>{progressionError}</span>
                  <button onClick={() => void refreshProgression()} type="button">Retry</button>
                </section>
              )}
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
      </StoneSurface>

      <StoneSurface as="aside" variant="card" className="settings-scene-rail settings-pane" aria-label="Progress summary">
        <div className="settings-rail-section">
          <div className="settings-card-heading">
            <div>
              <span>Your environment</span>
              <strong>Stonecode</strong>
            </div>
            <button className="settings-rail-refresh" onClick={() => void refreshProgression()} type="button">Refresh</button>
          </div>
          <div className="settings-environment-header">
            <div className="settings-environment-mark"><StonecodeGlyph /></div>
            <div className="settings-environment-title">
              <strong>stonecode</strong>
              <span>v1.0.0 · {subscription.planName}</span>
            </div>
          </div>
          <div className="settings-environment-stats">
            <EnvironmentStat label="Courses completed" value={progression.completedCourses} />
            <EnvironmentStat label="Current streak" value={`${progression.currentStreak} days`} />
            <EnvironmentStat label="Total XP" value={progression.totalXp} />
            <EnvironmentStat label="Exercises solved" value={progression.solvedExercises} />
            <EnvironmentStat label="Title" value={progression.equippedTitle ?? "Unranked"} />
          </div>
        </div>

        <div className="settings-rail-section">
          <span className="settings-pane-label">Sync status</span>
          <div className="settings-sync-status">
            <div className="settings-sync-icon">✓</div>
            <div>
              <strong>{progressionError ? "Sync needs attention" : "All changes synced"}</strong>
              <span>{isProgressionLoading ? "Refreshing..." : progression.latestActivityAt ? "Progress saved" : "Ready"}</span>
            </div>
          </div>
        </div>
      </StoneSurface>
    </>
  );
}

function SolvedExercisesCard({
  byDifficulty,
  isLoading,
  solved
}: {
  byDifficulty: Record<"Beginner" | "Intermediate" | "Advanced", number>;
  isLoading: boolean;
  solved: number;
}) {
  const maximum = Math.max(...Object.values(byDifficulty), 1);
  return (
    <section className="settings-card progression-solved-card">
      <div className="settings-card-heading">
        <div><span>Solved exercises</span><strong>{isLoading ? "…" : solved}</strong></div>
      </div>
      <div className="progression-solved-layout">
        <div className="progression-ring" style={{ "--ring-progress": `${Math.min(solved * 12, 100)}%` } as React.CSSProperties}>
          <div><strong>{solved}</strong><span>Solved</span></div>
        </div>
        <div className="progression-difficulty-list">
          {(Object.entries(byDifficulty) as Array<[keyof typeof byDifficulty, number]>).map(([label, value], index) => (
            <div className="progression-difficulty" key={label}>
              <div><span>{label}</span><strong>{value}</strong></div>
              <i><b className={`tone-${index + 1}`} style={{ width: `${(value / maximum) * 100}%` }} /></i>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgressionHeatmap({ days, language }: { days: ProgressionHeatmapDay[]; language: string }) {
  return (
    <div className="progression-heatmap-wrap">
      <div className="progression-heatmap" role="img" aria-label={`Yearly XP activity for ${language}`}>
        {days.map((day) => {
          const xp = language === "All" ? day.xp : day.languages[language] ?? 0;
          const band = xp <= 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4;
          return <span className={`heat-band-${band}`} key={day.date} title={`${day.date}: ${xp} XP`} />;
        })}
      </div>
      <div className="progression-heatmap-months">
        {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month) => <span key={month}>{month}</span>)}
      </div>
      <div className="progression-heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((band) => <i className={`heat-band-${band}`} key={band} />)}<span>More</span></div>
    </div>
  );
}

function LanguageXpList({ items, totalXp }: { items: Array<{ language: string; xp: number }>; totalXp: number }) {
  if (!items.length) return <div className="progression-empty compact"><strong>No language XP yet</strong><span>Verified exercises will appear here.</span></div>;
  return (
    <div className="progression-language-list">
      {items.map((item) => (
        <div key={item.language}>
          <p><strong>{item.language}</strong><span>{item.xp} XP</span></p>
          <i><b style={{ width: `${(item.xp / Math.max(totalXp, 1)) * 100}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function EnvironmentStat({ label, value }: { label: string; value: number | string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function BadgeIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="9" fill="none" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="m9 13-1 7 4-2 4 2-1-7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /></svg>;
}

function TrophyIcon() {
  return <svg className="progression-trophy" viewBox="0 0 24 24"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M8 20h8M10 17h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-field-card">
      <span>{label}</span>
      <strong>{value}</strong>
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
  overview: "Progression overview",
  profile: "Profile",
  billing: "Billing",
  usage: "Usage",
  security: "Security",
  support: "Support"
};

const sectionDescriptionMap: Record<StonecodeSettingsSection, string> = {
  overview: "XP, streaks, activity, languages, completed courses, badges, and earned titles.",
  profile: "Learner identity, current focus, and workspace-facing defaults.",
  billing: "Plan state, upgrades, and billing portal access for the paid beta.",
  usage: "Tutor activity, usage guardrails, and practice trend snapshots.",
  security: "Password recovery, email verification state, and session controls.",
  support: "What to send when billing, auth, or tutor behavior needs help."
};
