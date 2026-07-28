import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyOpenAiCredential,
  loadOpenAiCredential,
  OpenAiCredentialStatus,
  removeOpenAiCredential,
  saveOpenAiCredential
} from "@/services/openAiCredentials";

export function useOpenAiCredential({ accessToken, enabled }: { accessToken: string | null; enabled: boolean }) {
  const requestId = useRef(0);
  const [credential, setCredential] = useState<OpenAiCredentialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !accessToken) {
      setCredential(null);
      setIsLoading(false);
      setError(null);
      return null;
    }
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const nextCredential = await loadOpenAiCredential(accessToken);
      if (requestId.current === currentRequest) setCredential(nextCredential);
      return nextCredential;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load OpenAI connection.";
      if (requestId.current === currentRequest) setError(message);
      throw caughtError;
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [accessToken, enabled]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    return () => { requestId.current += 1; };
  }, [refresh]);

  const save = useCallback(async (apiKey: string) => {
    if (!accessToken) throw new Error("Authentication required.");
    setIsPending(true);
    setError(null);
    try {
      const nextCredential = await saveOpenAiCredential(accessToken, apiKey);
      setCredential(nextCredential);
      return nextCredential;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to connect OpenAI.");
      throw caughtError;
    } finally {
      setIsPending(false);
    }
  }, [accessToken]);

  const remove = useCallback(async () => {
    if (!accessToken) throw new Error("Authentication required.");
    setIsPending(true);
    setError(null);
    try {
      const nextCredential = await removeOpenAiCredential(accessToken);
      setCredential(nextCredential);
      return nextCredential;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to remove OpenAI key.");
      throw caughtError;
    } finally {
      setIsPending(false);
    }
  }, [accessToken]);

  return {
    credential: enabled ? credential : emptyOpenAiCredential,
    error,
    isLoading,
    isPending,
    refresh,
    remove,
    save
  };
}
