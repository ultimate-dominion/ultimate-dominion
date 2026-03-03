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

/**
 * Optimistic progress bar that fills quickly at first, then decelerates
 * asymptotically — never reaching 100% until the actual request completes.
 *
 * Phase timeline (for a 2000ms estimated duration):
 *   0→60%  in ~30% of estimated time (fast burst — feels responsive)
 *   60→85% in ~40% of estimated time (steady progress)
 *   85→95% in ~30% of estimated time (slowing down)
 *   95→98% over 5s extra crawl    (asymptotic — request taking longer)
 *
 * When complete() is called, snaps to 100% instantly.
 */
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

      const phase1Duration = estimatedMs * 0.3;  // Fast burst
      const phase2Duration = estimatedMs * 0.4;  // Steady
      const phase3Duration = estimatedMs * 0.3;  // Decelerating
      const phase4Duration = 5000;                // Asymptotic crawl

      // Start at 0
      setProgress({ phase: 'filling', percent: 0, transitionMs: 0 });

      // Phase 1: 0→60% (fast burst, ease-out feel via short duration)
      requestAnimationFrame(() => {
        setProgress({ phase: 'filling', percent: 60, transitionMs: phase1Duration });
      });

      // Phase 2: 60→85% (steady)
      const t1 = setTimeout(() => {
        setProgress({ phase: 'filling', percent: 85, transitionMs: phase2Duration });
      }, phase1Duration);
      timers.current.push(t1);

      // Phase 3: 85→95% (slowing)
      const t2 = setTimeout(() => {
        setProgress({ phase: 'filling', percent: 95, transitionMs: phase3Duration });
      }, phase1Duration + phase2Duration);
      timers.current.push(t2);

      // Phase 4: 95→98% (asymptotic crawl — request taking longer than expected)
      const t3 = setTimeout(() => {
        setProgress({ phase: 'filling', percent: 98, transitionMs: phase4Duration });
      }, phase1Duration + phase2Duration + phase3Duration);
      timers.current.push(t3);
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
