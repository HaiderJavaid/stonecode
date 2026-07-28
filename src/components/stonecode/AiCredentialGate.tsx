import { FormEvent, useEffect, useRef } from "react";
import { ArrowUpRight, KeyRound, LockKeyhole, LogOut, Sparkles, X } from "lucide-react";
import type { OpenAiCredentialStatus } from "@/services/openAiCredentials";

export function AiCredentialGate({
  credential,
  error,
  isExiting,
  isLoading,
  isOpen,
  isPending,
  keyInput,
  onDismiss,
  onKeyInputChange,
  onRetry,
  onSave,
  onSignOut,
  onUpgrade
}: {
  credential: OpenAiCredentialStatus | null;
  error: string | null;
  isExiting: boolean;
  isLoading: boolean;
  isOpen: boolean;
  isPending: boolean;
  keyInput: string;
  onDismiss: () => void;
  onKeyInputChange: (value: string) => void;
  onRetry: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onUpgrade: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || isExiting) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending && !isExiting) onDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExiting, isOpen, isPending, onDismiss]);

  if (!isOpen) return null;

  return (
    <div className={`ai-key-gate${isExiting ? " is-exiting" : ""}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isPending && !isExiting) onDismiss();
    }}>
      <section aria-busy={isPending || isExiting} aria-describedby="ai-key-gate-copy" aria-labelledby="ai-key-gate-title" aria-modal="true" className="stone-surface stone-surface-main ai-key-gate-card" role="dialog">
        <button aria-label="Set up later" className="ai-key-gate-close" disabled={isPending || isExiting} onClick={onDismiss} type="button"><X aria-hidden="true" /></button>
        <div className="ai-key-gate-mark" aria-hidden="true"><KeyRound /></div>
        <span className="ai-key-gate-eyebrow">Free plan · AI setup</span>
        <h2 id="ai-key-gate-title">Connect OpenAI when you’re ready to learn</h2>
        <p id="ai-key-gate-copy">You can browse Stonecode now. Starting a course, generating lessons, or messaging the tutor requires one verified OpenAI API key.</p>

        <div className="ai-key-gate-security">
          <LockKeyhole aria-hidden="true" />
          <span>Your key is verified, encrypted server-side, and never returned to the browser.</span>
        </div>

        {isLoading ? (
          <div className="ai-key-gate-loading" role="status"><Sparkles aria-hidden="true" />Checking your connection…</div>
        ) : (
          <form onSubmit={onSave}>
            <label htmlFor="onboarding-openai-key">OpenAI API key</label>
            <input
              autoComplete="off"
              id="onboarding-openai-key"
              onChange={(event) => onKeyInputChange(event.target.value)}
              placeholder={credential?.configured ? `Connected ·•••• ${credential.lastFour}` : "sk-…"}
              ref={inputRef}
              type="password"
              value={keyInput}
            />
            {error && <p className="ai-key-gate-error" role="alert">{error}</p>}
            <button className="ai-key-gate-primary" disabled={isPending || isExiting || !keyInput.trim()} type="submit">
              {isPending ? "Verifying…" : "Connect and continue"}
            </button>
          </form>
        )}

        <div className="ai-key-gate-actions">
          {error && <button disabled={isExiting} onClick={onRetry} type="button">Retry status</button>}
          <button disabled={isExiting} onClick={onUpgrade} type="button">Upgrade to Pro <ArrowUpRight aria-hidden="true" /></button>
          <button disabled={isExiting} onClick={onDismiss} type="button">Not now</button>
        </div>
        <a className="ai-key-gate-help" href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">Where to create an OpenAI API key <ArrowUpRight aria-hidden="true" /></a>
        <button className="ai-key-gate-signout" disabled={isExiting} onClick={onSignOut} type="button"><LogOut aria-hidden="true" />Sign out</button>
      </section>
    </div>
  );
}
