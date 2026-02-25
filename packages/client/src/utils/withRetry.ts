/**
 * Pure retry utility with exponential backoff and error classification.
 *
 * - Classifies errors as retryable (network, nonce, timeout) vs non-retryable (user denied, revert)
 * - Exponential backoff: 1s, 2s, 4s...
 * - Status callbacks for progressive UI feedback
 * - "Confirming..." transition after 3s on final attempt
 */

const RETRYABLE_PATTERNS = [
  'nonce',
  'timeout',
  'network',
  'econnrefused',
  'econnreset',
  'socket hang up',
  'fetch failed',
  'failed to fetch',
  'rate limit',
  '429',
  '502',
  '503',
  '504',
  'internal json-rpc error',
  'replacement transaction underpriced',
  'already known',
];

const NON_RETRYABLE_PATTERNS = [
  'user denied',
  'user rejected',
  'user cancelled',
  'insufficient funds',
  'execution reverted',
  'revert',
  'missing delegation',
  'character not found',
  'not in a shop',
];

export type RetryStatus = 'pending' | 'executing' | 'confirming' | 'retrying' | 'error' | 'success';

export type RetryOptions = {
  maxAttempts?: number;
  onStatusChange?: (status: RetryStatus, message: string) => void;
  actionName?: string;
};

function isRetryable(error: unknown): boolean {
  const message = ((error as Error)?.message ?? '').toLowerCase();

  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) return false;
  }

  for (const pattern of RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) return true;
  }

  // Default: don't retry unknown errors
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, onStatusChange, actionName = 'action' } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt === 1) {
        onStatusChange?.('executing', `${actionName}...`);
      } else {
        onStatusChange?.('retrying', `Retrying ${actionName}... (attempt ${attempt}/${maxAttempts})`);
      }

      // Set a timer to transition to "confirming" after 3s
      let confirmingTimer: ReturnType<typeof setTimeout> | undefined;
      if (attempt === maxAttempts || maxAttempts === 1) {
        confirmingTimer = setTimeout(() => {
          onStatusChange?.('confirming', `Confirming ${actionName}...`);
        }, 3000);
      }

      const result = await fn();

      if (confirmingTimer) clearTimeout(confirmingTimer);
      onStatusChange?.('success', 'Done!');
      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && isRetryable(error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  onStatusChange?.('error', 'Failed');
  throw lastError;
}
