import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Bug,
  CheckCircle2,
  CreditCard,
  Download,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircleQuestion,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SubscriptionState } from "@/services/subscriptionState";
import { UsageSummary } from "@/services/usageSummary";
import { CreditSummary } from "@/services/credits";

export function ProfileSettings({
  displayName,
  email,
  isLoading,
  isSaving,
  joinedAt,
  message,
  onDisplayNameChange,
  onSave,
  onTimezoneChange,
  timezone,
  timezoneOptions,
  verified
}: {
  displayName: string;
  email: string;
  isLoading: boolean;
  isSaving: boolean;
  joinedAt: string;
  message: { tone: "error" | "success"; text: string } | null;
  onDisplayNameChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onTimezoneChange: (value: string) => void;
  timezone: string;
  timezoneOptions: string[];
  verified: boolean;
}) {
  return (
    <div className="settings-v2-section-grid profile-section-grid">
      <form className="settings-v2-card settings-v2-form-card" onSubmit={onSave}>
        <SectionHeading icon={UserRound} label="Profile essentials" title="How you appear in Stonecode" />
        <div className="settings-v2-field-grid">
          <label className="settings-v2-field">
            <span>Display name</span>
            <input
              disabled={isLoading || isSaving}
              maxLength={50}
              minLength={2}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="Your name"
              required
              value={displayName}
            />
            <small>Shown in your workspace and progression profile.</small>
          </label>
          <label className="settings-v2-field">
            <span>Timezone</span>
            <select disabled={isLoading || isSaving} onChange={(event) => onTimezoneChange(event.target.value)} value={timezone}>
              {timezoneOptions.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
            <small>Used for streaks and activity dates.</small>
          </label>
        </div>
        <div className="settings-v2-form-actions">
          <button className="is-primary" disabled={isLoading || isSaving || displayName.trim().length < 2} type="submit">
            {isSaving ? "Saving…" : "Save changes"}
          </button>
          {message && <span aria-live="polite" className={`settings-v2-form-message is-${message.tone}`}>{message.text}</span>}
        </div>
      </form>

      <section className="settings-v2-card settings-v2-account-card">
        <SectionHeading icon={BadgeCheck} label="Account record" title="Verified account details" />
        <div className="settings-v2-detail-list">
          <DetailRow label="Email" value={email} />
          <DetailRow label="Status" tone={verified ? "success" : "warning"} value={verified ? "Verified" : "Pending verification"} />
          <DetailRow label="Member since" value={joinedAt} />
        </div>
      </section>
    </div>
  );
}

export function BillingSettings({
  billingError,
  credits,
  isBillingPending,
  isLoading,
  onCheckout,
  onManageBilling,
  subscription
}: {
  billingError: string | null;
  credits: CreditSummary | null;
  isBillingPending: boolean;
  isLoading: boolean;
  onCheckout: (plan: "pro") => void;
  onManageBilling: () => void;
  subscription: SubscriptionState;
}) {
  const remainingCopy = `${subscription.activeCourseLimit} active learning path${subscription.activeCourseLimit === 1 ? "" : "s"}`;

  return (
    <div className="settings-v2-section-grid billing-section-grid">
      <section className="settings-v2-card settings-v2-plan-card">
        <SectionHeading icon={WalletCards} label="Current plan" title={isLoading ? "Loading plan…" : subscription.planName} />
        <div className="settings-v2-plan-summary">
          <div><span>Plan status</span><strong>{subscription.status.replaceAll("_", " ")}</strong></div>
          <div><span>Path allowance</span><strong>{remainingCopy}</strong></div>
          <div><span>Renewal</span><strong>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "No renewal date"}</strong></div>
        </div>
        {billingError && <InlineNotice tone="error" text={billingError} />}
        <div className="settings-v2-plan-actions">
          {subscription.plan !== "pro" && <button className="is-primary" disabled={isBillingPending} onClick={() => onCheckout("pro")} type="button">Choose Pro</button>}
          {subscription.plan !== "free" && <button disabled={isBillingPending} onClick={onManageBilling} type="button">Manage billing</button>}
        </div>
      </section>

      <section className="settings-v2-card settings-v2-provider-card">
        <SectionHeading icon={Sparkles} label="Creation balance" title="Stones" />
        <div className="settings-v2-provider-status">
          <div className="is-connected"><WalletCards aria-hidden="true" /></div>
          <div>
            <strong>{credits ? `${credits.available} Stones available` : isLoading ? "Loading Stones…" : `${subscription.registrationCredits + subscription.monthlyCredits} plan Stones`}</strong>
            <span>Stones create courses, projects, exercise packs, and Marketplace clones. Tutor usage is included.</span>
          </div>
        </div>
        {credits?.reserved ? <InlineNotice tone="warning" text={`${credits.reserved} Stones reserved for generation in progress.`} /> : null}
      </section>
    </div>
  );
}

export function UsageSettings({ error, isLoading, subscription, usage }: { error: string | null; isLoading: boolean; subscription: SubscriptionState; usage: UsageSummary }) {
  const total = Math.max(usage.totalTutorMessages, 1);
  const rows = [
    { label: "Succeeded", value: usage.statusCounts.success, tone: "success" },
    { label: "Failed", value: usage.statusCounts.failed, tone: "error" },
    { label: "Blocked", value: usage.statusCounts.blocked, tone: "warning" }
  ];
  const allowanceRows = [
    { label: "Tutor replies", allowance: usage.allowances.tutorReplies },
    { label: "AI images", allowance: usage.allowances.aiImages },
    { label: "Judge0 actions", allowance: usage.allowances.judge0Actions },
    { label: "Free proposals", allowance: usage.allowances.proposals },
    { label: "Active paths", allowance: usage.allowances.activePaths }
  ];

  return (
    <div className="settings-v2-section-grid usage-section-grid">
      <section className="settings-v2-card settings-v2-usage-summary">
        <SectionHeading icon={Zap} label="Recorded activity" title={isLoading ? "Loading usage…" : `${usage.totalTutorMessages} tutor events`} />
        <div className="settings-v2-usage-metrics">
          {rows.map((row) => <Metric key={row.label} label={row.label} tone={row.tone} value={row.value} />)}
        </div>
        <div className="settings-v2-status-bars">
          {rows.map((row) => (
            <div key={row.label}>
              <p><span>{row.label}</span><strong>{Math.round(row.value / total * 100)}%</strong></p>
              <i><b className={`is-${row.tone}`} style={{ "--settings-progress": `${row.value / total * 100}%` } as CSSProperties} /></i>
            </div>
          ))}
        </div>
        {usage.latestEventAt && <small className="settings-v2-last-event">Last event {new Date(usage.latestEventAt).toLocaleString()}</small>}
        {error && <InlineNotice tone="error" text={error} />}
      </section>

      <section className="settings-v2-card settings-v2-limits-card">
        <SectionHeading icon={CreditCard} label="Plan guardrails" title={`${subscription.planName} allowance`} />
        <div className="settings-v2-limit-list">
          {allowanceRows.map(({ label, allowance }) => (
            <DetailRow key={label} label={label} value={`${allowance.remaining} left · ${allowance.used}/${allowance.limit} ${allowance.period === "current" ? "used" : allowance.period}`} />
          ))}
          <DetailRow label="Browser execution" value="Unlimited" />
        </div>
      </section>
    </div>
  );
}

export function SecuritySettings({
  email,
  error,
  isPending,
  lastSignInAt,
  message,
  onDeleteAccount,
  onExportAccount,
  onPasswordReset,
  onSignOut,
  verified
}: {
  email: string;
  error: string | null;
  isPending: boolean;
  lastSignInAt: string | null;
  message: string | null;
  onDeleteAccount: () => Promise<void>;
  onExportAccount: () => Promise<void>;
  onPasswordReset: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  verified: boolean;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  function closeDeleteDialog() {
    setIsDeleteOpen(false);
    setConfirmation("");
    window.setTimeout(() => deleteTriggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!isDeleteOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) closeDeleteDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDeleteOpen, isPending]);

  async function confirmDeletion() {
    if (confirmation !== "DELETE" || isPending) return;
    try {
      await onDeleteAccount();
    } catch {
      closeDeleteDialog();
    }
  }

  return (
    <div className="settings-v2-section-grid security-section-grid">
      <section className="settings-v2-card">
        <SectionHeading icon={ShieldCheck} label="Account security" title="Access and recovery" />
        <div className="settings-v2-security-hero">
          <div className={verified ? "is-verified" : ""}>{verified ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}</div>
          <div><strong>{verified ? "Email verified" : "Verification pending"}</strong><span>{email}</span></div>
        </div>
        <div className="settings-v2-detail-list">
          <DetailRow label="Last sign in" value={lastSignInAt ? new Date(lastSignInAt).toLocaleString() : "Current session"} />
          <DetailRow label="Session" tone="success" value="Active on this device" />
        </div>
      </section>

      <section className="settings-v2-card settings-v2-security-actions">
        <SectionHeading icon={LockKeyhole} label="Session controls" title="Recovery and sign out" />
        <form onSubmit={onPasswordReset}>
          <button disabled={isPending} type="submit"><Send aria-hidden="true" />Send password reset</button>
          <button disabled={isPending} onClick={() => void onExportAccount()} type="button"><Download aria-hidden="true" />Download my data</button>
          <button className="is-danger" disabled={isPending} onClick={onSignOut} type="button"><LogOut aria-hidden="true" />Sign out</button>
        </form>
        {(message || error) && <InlineNotice tone={error ? "error" : "success"} text={error ?? message ?? ""} />}
      </section>

      <section className="settings-v2-card settings-v2-danger-zone">
        <SectionHeading icon={Trash2} label="Danger zone" title="Permanently delete account" />
        <p>Deletes courses, files, chat, progress, private visuals, and account data. An active Stripe subscription is canceled first. This cannot be undone.</p>
        <button className="is-danger" disabled={isPending} onClick={() => setIsDeleteOpen(true)} ref={deleteTriggerRef} type="button">
          <Trash2 aria-hidden="true" />Delete account
        </button>
      </section>

      {isDeleteOpen && (
        <div className="settings-v2-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) closeDeleteDialog();
        }}>
          <div aria-describedby="account-delete-copy" aria-labelledby="account-delete-title" aria-modal="true" className="settings-v2-dialog" role="dialog">
            <button aria-label="Close account deletion dialog" disabled={isPending} onClick={closeDeleteDialog} ref={closeRef} type="button">Close</button>
            <h2 id="account-delete-title">Delete your Stonecode account?</h2>
            <p id="account-delete-copy">Download your data first if needed. Type <strong>DELETE</strong> to confirm permanent deletion.</p>
            <label className="settings-v2-field">
              <span>Confirmation</span>
              <input autoComplete="off" disabled={isPending} onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
            </label>
            <div className="settings-v2-dialog-actions">
              <button disabled={isPending} onClick={closeDeleteDialog} type="button">Keep account</button>
              <button className="is-danger" disabled={confirmation !== "DELETE" || isPending} onClick={() => void confirmDeletion()} type="button">
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SupportSettings() {
  const cards = [
    { icon: CreditCard, title: "Billing help", copy: "Plan, checkout, portal, or renewal problems.", topic: "Billing help" },
    { icon: Bug, title: "Workspace bug", copy: "Unexpected UI behavior, persistence, or blocked learning.", topic: "Workspace bug" },
    { icon: MessageCircleQuestion, title: "Tutor feedback", copy: "Answers, grading, generated content, or code edits.", topic: "Tutor feedback" },
    { icon: Mail, title: "Account access", copy: "Login, verification, recovery, or session problems.", topic: "Account access" }
  ];
  return (
    <div className="settings-v2-support">
      <section className="settings-v2-card settings-v2-support-intro">
        <SectionHeading icon={LifeBuoy} label="Support" title="Get the right help quickly" />
        <p>Include the route, exact action, expected result, and whether learning is blocked.</p>
        <Link to="/support">Open full support guide</Link>
      </section>
      <div className="settings-v2-support-grid">
        {cards.map((card) => (
          <article className="settings-v2-card" key={card.title}>
            <card.icon aria-hidden="true" />
            <div><strong>{card.title}</strong><p>{card.copy}</p><Link to={`/support?topic=${encodeURIComponent(card.topic)}`}>Contact support</Link></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, label, title }: { icon: LucideIcon; label: string; title: string }) {
  return <div className="settings-v2-section-heading"><div><span>{label}</span><strong>{title}</strong></div><Icon aria-hidden="true" /></div>;
}

function DetailRow({ label, tone, value }: { label: string; tone?: "success" | "warning"; value: string }) {
  return <div><span>{label}</span><strong className={tone ? `is-${tone}` : ""}>{value}</strong></div>;
}

function Metric({ label, tone, value }: { label: string; tone: string; value: number }) {
  return <div><span className={`is-${tone}`}><Zap aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function InlineNotice({ text, tone }: { text: string; tone: "error" | "success" | "warning" }) {
  return <p aria-live="polite" className={`settings-v2-notice is-${tone}`}>{text}</p>;
}
