import { useCallback, useEffect, useState } from "react";
import { CreditSummary, loadCreditSummary } from "@/services/credits";

export function useCredits(enabled = true) {
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setIsLoading(true);
    setError(null);
    try {
      const next = await loadCreditSummary();
      setCredits(next);
      return next;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load Stones.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return { credits, error, isLoading, refresh };
}
