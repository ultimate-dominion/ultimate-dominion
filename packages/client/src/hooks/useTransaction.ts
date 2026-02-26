import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from './useToast';
import { useTransactionProgress, type TransactionProgress } from './useTransactionProgress';
import { getFriendlyError } from '../utils/errors';
import { withRetry, type RetryStatus } from '../utils/withRetry';

type UseTransactionOptions = {
  actionName: string;
  maxAttempts?: number;
  showSuccessToast?: boolean;
  successMessage?: string;
  /** Silent mode: no toasts at all (e.g. movement) */
  silent?: boolean;
  /** Estimated tx duration for progress bar animation */
  estimatedDurationMs?: number;
};

type UseTransactionReturn = {
  /** Execute a transaction with retry and in-flight guard */
  execute: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  /** Whether a transaction is currently in flight */
  isLoading: boolean;
  /** Progressive status message for UI display */
  statusMessage: string;
  /** Current retry status */
  status: RetryStatus | 'idle';
  /** Progress bar state */
  progress: TransactionProgress;
};

/**
 * React hook for executing on-chain transactions with:
 * - In-flight guard (prevents double-submit)
 * - Auto-retry with exponential backoff
 * - Progressive status messages
 * - Toast integration (error toasts auto, success toasts optional)
 * - Auto-reset after 2s
 */
export function useTransaction(options: UseTransactionOptions): UseTransactionReturn {
  const {
    actionName,
    maxAttempts = 3,
    showSuccessToast = false,
    successMessage,
    silent = false,
    estimatedDurationMs,
  } = options;

  const { renderError, renderSuccess } = useToast();
  const { progress, start: startProgress, complete: completeProgress, fail: failProgress } = useTransactionProgress();
  const inFlight = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [status, setStatus] = useState<RetryStatus | 'idle'>('idle');

  // Clean up reset timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const execute = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setIsLoading(true);
      setStatus('executing');
      setStatusMessage(`${actionName}...`);

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (estimatedDurationMs) startProgress(estimatedDurationMs);

      try {
        const result = await withRetry(fn, {
          maxAttempts,
          actionName,
          onStatusChange: (newStatus, message) => {
            setStatus(newStatus);
            setStatusMessage(message);
          },
        });

        if (estimatedDurationMs) completeProgress();

        if (showSuccessToast && !silent && successMessage) {
          renderSuccess(successMessage);
        }

        // Auto-reset after 2s
        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 2000);

        return result;
      } catch (error) {
        if (estimatedDurationMs) failProgress();

        if (!silent) {
          const friendlyMessage = getFriendlyError(error);
          if (friendlyMessage) {
            renderError(friendlyMessage, error);
          }
        }

        // Auto-reset after 2s
        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 2000);

        return undefined;
      } finally {
        setIsLoading(false);
        inFlight.current = false;
      }
    },
    [actionName, completeProgress, estimatedDurationMs, failProgress, maxAttempts, renderError, renderSuccess, showSuccessToast, silent, startProgress, successMessage],
  );

  return { execute, isLoading, statusMessage, status, progress };
}
