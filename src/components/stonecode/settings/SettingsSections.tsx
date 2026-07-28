import { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Bug,
  CheckCircle2,
  CreditCard,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircleQuestion,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SubscriptionState } from "@/services/subscriptionState";
import { UsageSummary } from "@/services/usageSummary";
import { OpenAiCredentialStatus } from "@/services/openAiCredentials";

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
  credential,
  credentialError,
  isBillingPending,
  isCredentialPending,
  isLoading,
  keyInput,
  onCheckout,
  onKeyInputChange,
  onManageBilling,
  onRemoveKey,
  onSaveKey,
  subscription
}: {
  billingError: string | null;
  credential: OpenAiCredentialStatus | null;
  credentialError: string | null;
  isBillingPending: boolean;
  isCredentialPending: boolean;
  isLoading: boolean;
  keyInput: string;
  onCheckout: (plan: "basic" | "pro") => void;
  onKeyInputChange: (value: string) => void;
  onManageBilling: () => void;
  onRemoveKey: () => void;
  onSaveKey: (event: FormEvent<HTMLFormElement>) => void;
  subscription: SubscriptionState;
}) {
  const remainingCopy = subscription.monthlyExperienceGenerationLimit === null
    ? "Learning generations included"
    : `${subscription.remainingExperienceGenerations} of ${subscription.monthlyExperienceGenerationLimit} generations left`;

  return (
    <div className="settings-v2-section-grid billing-section-grid">
      <section className="settings-v2-card settings-v2-plan-card">
        <SectionHeading icon={WalletCards} label="Current plan" title={isLoading ? "Loading plan…" : subscription.planName} />
        <div className="settings-v2-plan-summary">
          <div><span>Plan status</span><strong>{subscription.status.replaceAll("_", " ")}</strong></div>
          <div><span>Monthly access</span><strong>{remainingCopy}</strong></div>
          <div><span>Renewal</span><strong>{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "No renewal date"}</strong></div>
        </div>
        {billingError && <InlineNotice tone="error" text={billingError} />}
        <div className="settings-v2-plan-actions">
          {subscription.plan !== "pro" && <button className="is-primary" disabled={isBillingPending} onClick={() => onCheckout("pro")} type="button">Choose Pro</button>}
          {subscription.plan !== "free" && <button disabled={isBillingPending} onClick={onManageBilling} type="button">Manage billing</button>}
        </div>
      </section>

      <section className="settings-v2-card settings-v2-provider-card">
        <SectionHeading icon={Sparkles} label="AI provider" title="OpenAI connection" />
        <div className="settings-v2-provider-status">
          <div className={credential?.configured ? "is-connected" : ""}><KeyRound aria-hidden="true" /></div>
          <div>
            <strong>{credential?.configured ? `Connected ·•••• ${credential.lastFour}` : "Not connected"}</strong>
            <span>{subscription.requiresOwnOpenAiKey ? "Required for Free-plan tutor and generation requests." : "AI usage is included with your plan."}</span>
          </div>
        </div>
        {subscription.requiresOwnOpenAiKey && (
          <form className="settings-v2-key-form" onSubmit={onSaveKey}>
            <label htmlFor="openai-api-key">OpenAI API key</label>
            <div>
              <input
                autoComplete="off"
                id="openai-api-key"
                onChange={(event) => onKeyInputChange(event.target.value)}
                placeholder={credential?.configured ? "Enter replacement key" : "sk-…"}
                type="password"
                value={keyInput}
              />
              <button className="is-primary" disabled={isCredentialPending || !keyInput.trim()} type="submit">
                {isCredentialPending ? "Checking…" : credential?.configured ? "Replace" : "Connect"}
              </button>
              {credential?.configured && <button disabled={isCredentialPending} onClick={onRemoveKey} type="button">Remove</button>}
            </div>
          </form>
        )}
        {credentialError && <InlineNotice tone="error" text={credentialError} />}
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
          <DetailRow label="Tutor messages" value={subscription.aiMessagesPerMonth < 0 ? "Included" : `${subscription.aiMessagesPerMonth} / month`} />
          <DetailRow label="Learning generations" value={subscription.monthlyExperienceGenerationLimit === null ? "Included" : `${subscription.remainingExperienceGenerations} remaining`} />
          <DetailRow label="Course access" value={subscription.firstModuleOnly ? "First module" : "Complete paths"} />
          <DetailRow label="AI provider" value={subscription.requiresOwnOpenAiKey ? "Your OpenAI key" : "Included"} />
        </div>
      </section>
    </div>
  );
}

export function SecuritySettings({
  email,
  error,
  lastSignInAt,
  message,
  onPasswordReset,
  onSignOut,
  verified
}: {
  email: string;
  error: string | null;
  lastSignInAt: string | null;
  message: string | null;
  onPasswordReset: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  verified: boolean;
}) {
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
          <button type="submit"><Send aria-hidden="true" />Send password reset</button>
          <button className="is-danger" onClick={onSignOut} type="button"><LogOut aria-hidden="true" />Sign out</button>
        </form>
        {(message || error) && <InlineNotice tone={error ? "error" : "success"} text={error ?? message ?? ""} />}
      </section>
    </div>
  );
}

export function SupportSettings() {
  const cards = [
    { icon: CreditCard, title: "Billing help", copy: "Plan, checkout, portal, or renewal problems." },
    { icon: Bug, title: "Workspace bug", copy: "Unexpected UI behavior, persistence, or blocked learning." },
    { icon: MessageCircleQuestion, title: "Tutor feedback", copy: "Answers, grading, generated content, or code edits." },
    { icon: Mail, title: "Account access", copy: "Login, verification, recovery, or session problems." }
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
            <div><strong>{card.title}</strong><p>{card.copy}</p></div>
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

function InlineNotice({ text, tone }: { text: string; tone: "error" | "success" }) {
  return <p aria-live="polite" className={`settings-v2-notice is-${tone}`}>{text}</p>;
}
