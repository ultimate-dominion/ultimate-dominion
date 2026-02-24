export const USER_ERRORS = ['User denied signature'];
export const INSUFFICIENT_FUNDS_MESSAGE =
  'Insufficient funds. Please top off your session account.';

export const getError = (
  error: unknown,
  defaultError: string = 'Unknown error',
): string => {
  if (typeof error === 'string') {
    return error;
  }

  if ((error as Error)?.message?.toLowerCase().includes('user denied')) {
    return USER_ERRORS[0];
  }

  return (error as Error)?.message || defaultError;
};

const FRIENDLY_ERROR_MAP: [RegExp, string][] = [
  [/user denied|user rejected/i, 'Action cancelled.'],
  [/insufficient funds/i, 'You need more resources to do this.'],
  [/userop failed|userOperation/i, 'Action was slow to process. Trying again...'],
  [/nonce/i, 'The server is busy. Please wait a moment and try again.'],
  [/timeout|timed? ?out/i, 'The server is busy. Please wait a moment and try again.'],
  [/execution reverted/i, 'That action couldn\'t be completed. Please try again.'],
  [/an error occurred calling the contract/i, 'Something went wrong. Trying again...'],
];

function isCleanGameError(message: string): boolean {
  if (!message || message.length === 0) return false;
  const firstChar = message.charAt(0);
  if (firstChar !== firstChar.toUpperCase()) return false;
  if (/0x[0-9a-f]{4,}/i.test(message)) return false;
  if (/reverted|userop|nonce|timeout/i.test(message)) return false;
  return true;
}

export function getFriendlyError(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (!raw) return 'Something went wrong. Please try again.';

  for (const [pattern, friendly] of FRIENDLY_ERROR_MAP) {
    if (pattern.test(raw)) return friendly;
  }

  if (isCleanGameError(raw)) return raw;

  return 'That action couldn\'t be completed. Please try again.';
}
