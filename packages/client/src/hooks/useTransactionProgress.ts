import { useCallback, useRef, useState } from 'react';

export type ProgressPhase = 'idle' | 'filling' | 'completing' | 'error' | 'done';

export type TransactionProgress = {
  phase: ProgressPhase;
  percent: number;
  /** CSS transition duration in ms for the current animation */
  transitionMs: number;
};

type UseTransactionProgressReturn = {
  progress: TransactionProgress;
  start: (estimatedMs: number) => void;
  complete: () => void;
  fail: () => void;
  reset: () => void;
};

export function useTransactionProgress(): UseTransactionProgressReturn {
  const [progress, setProgress] = useState<TransactionProgress>({
    phase: 'idle',
    percent: 0,
    transitionMs: 0,
  });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(
    (estimatedMs: number) => {
      clearTimers();
      // Start at 0 immediately
      setProgress({ phase: 'filling', percent: 0, transitionMs: 0 });
      // Next frame: animate to 90% over estimatedMs
      requestAnimationFrame(() => {
        setProgress({ phase: 'filling', percent: 90, transitionMs: estimatedMs });
      });
    },
    [clearTimers],
  );

  const complete = useCallback(() => {
    clearTimers();
    // Snap to 100% quickly
    setProgress({ phase: 'completing', percent: 100, transitionMs: 200 });
    // Fade out after 600ms
    const t = setTimeout(() => {
      setProgress({ phase: 'done', percent: 100, transitionMs: 0 });
      const t2 = setTimeout(() => {
        setProgress({ phase: 'idle', percent: 0, transitionMs: 0 });
      }, 400);
      timers.current.push(t2);
    }, 600);
    timers.current.push(t);
  }, [clearTimers]);

  const fail = useCallback(() => {
    clearTimers();
    setProgress({ phase: 'error', percent: 100, transitionMs: 200 });
    const t = setTimeout(() => {
      setProgress({ phase: 'done', percent: 100, transitionMs: 0 });
      const t2 = setTimeout(() => {
        setProgress({ phase: 'idle', percent: 0, transitionMs: 0 });
      }, 400);
      timers.current.push(t2);
    }, 1200);
    timers.current.push(t);
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setProgress({ phase: 'idle', percent: 0, transitionMs: 0 });
  }, [clearTimers]);

  return { progress, start, complete, fail, reset };
}
