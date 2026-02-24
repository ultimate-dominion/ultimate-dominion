import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from './useToast';
import { getFriendlyError } from '../utils/errors';
import {
  withRetry,
  type StatusUpdate,
  type TransactionStatus,
} from '../utils/withRetry';

type UseTransactionOptions = {
  actionName: string;
  maxAttempts?: number;
  backoffMs?: number;
  silent?: boolean;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
};

type UseTransactionReturn = {
  execute: <T extends { success: boolean; error?: string }>(
    fn: () => Promise<T>,
  ) => Promise<T | null>;
  status: TransactionStatus;
  statusMessage: string;
  isLoading: boolean;
  reset: () => void;
};

export function useTransaction(
  options: UseTransactionOptions,
): UseTransactionReturn {
  const {
    actionName,
    maxAttempts = 3,
    backoffMs = 2000,
    silent = false,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage,
  } = options;

  const { renderError, renderWarning, renderSuccess } = useToast();

  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const inFlightRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStatusMessage('');
  }, []);

  const execute = useCallback(
    async <T extends { success: boolean; error?: string }>(
      fn: () => Promise<T>,
    ): Promise<T | null> => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

      const onStatusChange = (update: StatusUpdate) => {
        setStatus(update.status);
        setStatusMessage(update.message);

        if (!silent && update.status === 'retrying') {
          renderWarning(`Hang tight, trying again...`);
        }
      };

      try {
        const result = await withRetry(fn, {
          actionName,
          maxAttempts,
          backoffMs,
          onStatusChange,
        });

        if (!silent && showSuccessToast) {
          const capitalizedAction =
            actionName.charAt(0).toUpperCase() + actionName.slice(1);
          renderSuccess(successMessage ?? `${capitalizedAction} complete!`);
        }

        resetTimerRef.current = setTimeout(reset, 2000);
        return result;
      } catch (e) {
        if (!silent && showErrorToast) {
          const friendly = getFriendlyError(e);
          renderError(friendly, e);
        }

        resetTimerRef.current = setTimeout(reset, 2000);
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      actionName,
      backoffMs,
      maxAttempts,
      renderError,
      renderSuccess,
      renderWarning,
      reset,
      showErrorToast,
      showSuccessToast,
      silent,
      successMessage,
    ],
  );

  return {
    execute,
    isLoading: status === 'submitting' || status === 'confirming' || status === 'retrying',
    reset,
    status,
    statusMessage,
  };
}
