import { useCallback, useEffect, useState } from "react";
import {
  emptyProgression,
  loadProgression,
  ProgressionSummary
} from "@/services/progression";

export function useProgression(enabled = true) {
  const [progression, setProgression] = useState<ProgressionSummary>(emptyProgression);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      setProgression(await loadProgression());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load progression.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { progression, isLoading, error, refresh };
}
