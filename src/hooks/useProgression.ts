import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultProgressionSummary,
  equipProgressionTitle,
  loadProgression,
  ProgressionSummary
} from "@/services/progression";

export function useProgression(language: string | null = null) {
  const auth = useAuth();
  const [progression, setProgression] = useState<ProgressionSummary>(defaultProgressionSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const refresh = useCallback(async () => {
    const token = auth.session?.access_token;
    if (!token) {
      setProgression(defaultProgressionSummary);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setProgression(await loadProgression(token, { language, timezone }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load progression.");
    } finally {
      setIsLoading(false);
    }
  }, [auth.session?.access_token, language, timezone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equipTitle = useCallback(async (badgeKey: string | null) => {
    const token = auth.session?.access_token;
    if (!token) throw new Error("Authentication required.");
    await equipProgressionTitle(token, badgeKey);
    await refresh();
  }, [auth.session?.access_token, refresh]);

  return { progression, isLoading, error, refresh, equipTitle };
}
