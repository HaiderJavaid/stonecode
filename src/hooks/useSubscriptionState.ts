import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultSubscriptionState,
  loadSubscriptionState,
  SubscriptionState
} from "@/services/subscriptionState";

export function useSubscriptionState() {
  const { isConfigured, user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultSubscriptionState);
  const [isLoading, setIsLoading] = useState(() => Boolean(isConfigured && user));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!isConfigured || !user) {
      setSubscription(defaultSubscriptionState);
      setIsLoading(false);
      setError(null);
      return defaultSubscriptionState;
    }

    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const nextSubscription = await loadSubscriptionState(user);
      if (requestId.current === currentRequest) {
        setSubscription(nextSubscription);
      }
      return nextSubscription;
    } catch (caughtError) {
      if (requestId.current === currentRequest) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load subscription.");
      }
      throw caughtError;
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [isConfigured, user]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  return { subscription, isLoading, error, refresh };
}
