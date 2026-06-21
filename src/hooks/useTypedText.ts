import { useEffect, useRef, useState } from "react";

type UseTypedTextOptions = {
  delayMs?: number;
  enabled?: boolean;
  maxTicks?: number;
  minFrameMs?: number;
  onComplete?: () => void;
};

export function useTypedText(
  text: string,
  {
    delayMs = 520,
    enabled = true,
    maxTicks = 180,
    minFrameMs = 32,
    onComplete
  }: UseTypedTextOptions = {}
) {
  const [typedText, setTypedText] = useState(enabled ? "" : text);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!enabled) {
      setTypedText(text);
      return;
    }

    if (!text) {
      setTypedText("");
      return;
    }

    let animationFrame = 0;
    let delay = 0;
    let startedAt = 0;
    let lastCommitAt = 0;
    let completed = false;
    const step = Math.max(2, Math.ceil(text.length / maxTicks));
    const duration = Math.max(180, Math.ceil(text.length / step) * 18);

    setTypedText("");

    function complete() {
      if (completed) return;
      completed = true;
      setTypedText(text);
      onCompleteRef.current?.();
    }

    function tick(now: number) {
      const elapsed = now - startedAt;
      const shouldCommit = now - lastCommitAt >= minFrameMs || elapsed >= duration;

      if (shouldCommit) {
        const progress = Math.min(1, elapsed / duration);
        const nextLength = Math.min(text.length, Math.max(1, Math.ceil(text.length * progress)));
        setTypedText(text.slice(0, nextLength));
        lastCommitAt = now;
      }

      if (elapsed >= duration) {
        complete();
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
    }

    delay = window.setTimeout(() => {
      startedAt = window.performance.now();
      lastCommitAt = startedAt;
      animationFrame = window.requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      completed = true;
      window.clearTimeout(delay);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [delayMs, enabled, maxTicks, minFrameMs, text]);

  return {
    isTyping: enabled && typedText.length < text.length,
    typedText
  };
}
