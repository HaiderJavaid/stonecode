import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultSubscriptionState,
  loadSubscriptionState,
  SubscriptionState
} from "@/services/subscriptionState";

export function useSubscriptionState() {
  const { isConfigured, user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultSubscriptionState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !user) {
      setSubscription(defaultSubscriptionState);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    loadSubscriptionState(user)
      .then((nextSubscription) => {
        if (isCancelled) return;
        setSubscription(nextSubscription);
      })
      .catch((caughtError) => {
        if (isCancelled) return;
        setSubscription(defaultSubscriptionState);
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load subscription.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isConfigured, user]);

  return { subscription, isLoading, error };
}
