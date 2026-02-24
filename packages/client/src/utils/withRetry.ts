import { getFriendlyError } from './errors';

export type TransactionStatus =
  | 'idle'
  | 'submitting'
  | 'confirming'
  | 'retrying'
  | 'success'
  | 'error';

export type StatusUpdate = {
  status: TransactionStatus;
  message: string;
};

export type WithRetryOptions = {
  actionName: string;
  maxAttempts?: number;
  backoffMs?: number;
  onStatusChange?: (update: StatusUpdate) => void;
};

const NON_RETRYABLE_PATTERNS = [
  'user denied',
  'user rejected',
  'insufficient funds',
  'not owner',
  'already spawned',
  'cooldown',
  'not spawned',
  'invalid move',
  'max players',
  'not in battle',
  'no character',
  'character not found',
  'missing delegation',
  'burner not found',
  'position not found',
  'battle not found',
  'opponent not found',
  'cannot flee',
  'must be spawned',
  'not enough gold',
  'item not found',
  'already equipped',
  'inventory full',
  'locked',
];

function isRetryable(error: unknown): boolean {
  const message =
    (error instanceof Error ? error.message : String(error)).toLowerCase();

  return !NON_RETRYABLE_PATTERNS.some(pattern => message.includes(pattern));
}

function getActionMessage(
  actionName: string,
  status: TransactionStatus,
  attempt?: number,
  maxAttempts?: number,
): string {
  const capitalizedAction =
    actionName.charAt(0).toUpperCase() + actionName.slice(1);

  switch (status) {
    case 'submitting':
      return `${capitalizedAction}...`;
    case 'confirming':
      return 'Almost there...';
    case 'retrying':
      return `Trying again... (${attempt}/${maxAttempts})`;
    case 'success':
      return `${capitalizedAction} complete!`;
    case 'error':
      return `${capitalizedAction} failed.`;
    default:
      return '';
  }
}

export async function withRetry<T extends { success: boolean; error?: string }>(
  fn: () => Promise<T>,
  options: WithRetryOptions,
): Promise<T> {
  const {
    actionName,
    maxAttempts = 3,
    backoffMs = 2000,
    onStatusChange,
  } = options;

  const notify = (status: TransactionStatus, message?: string) => {
    onStatusChange?.({
      status,
      message:
        message ?? getActionMessage(actionName, status),
    });
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      notify('submitting');

      // After 3s of waiting, transition to "confirming"
      const confirmingTimer = setTimeout(() => {
        notify('confirming');
      }, 3000);

      const result = await fn();

      clearTimeout(confirmingTimer);

      if (result.error && !result.success) {
        throw new Error(result.error);
      }

      notify('success');
      return result;
    } catch (e) {
      lastError = e;

      if (!isRetryable(e)) {
        const friendly = getFriendlyError(e);
        notify('error', friendly);
        throw e;
      }

      if (attempt < maxAttempts) {
        notify(
          'retrying',
          getActionMessage(actionName, 'retrying', attempt, maxAttempts),
        );
        const delay = backoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const friendly = getFriendlyError(lastError);
  notify('error', friendly);
  throw lastError;
}
