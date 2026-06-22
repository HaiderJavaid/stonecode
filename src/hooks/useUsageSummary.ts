import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultUsageSummary,
  loadUsageSummary,
  UsageSummary
} from "@/services/usageSummary";

export function useUsageSummary(isEnabled = true) {
  const { isConfigured, user } = useAuth();
  const [usage, setUsage] = useState<UsageSummary>(defaultUsageSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled || !isConfigured || !user) {
      setUsage(defaultUsageSummary);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    loadUsageSummary(user)
      .then((nextUsage) => {
        if (isCancelled) return;
        setUsage(nextUsage);
      })
      .catch((caughtError) => {
        if (isCancelled) return;
        setUsage(defaultUsageSummary);
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load usage.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isEnabled, isConfigured, user]);

  return { usage, isLoading, error };
}
