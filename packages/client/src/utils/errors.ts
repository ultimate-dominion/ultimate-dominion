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

/**
 * Maps technical blockchain/network errors to player-friendly messages.
 * Returns null for errors that should be silently ignored (e.g. user denied).
 */
export const getFriendlyError = (error: unknown): string | null => {
  const message = ((error as Error)?.message ?? '').toLowerCase();

  // User cancelled — silent, no toast
  if (
    message.includes('user denied') ||
    message.includes('user rejected') ||
    message.includes('user cancelled')
  ) {
    return null;
  }

  // Insufficient gas/funds
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds. Please top off your session account.';
  }

  // Gas estimation failures
  if (
    message.includes('gas required exceeds') ||
    message.includes('out of gas') ||
    message.includes('gas estimation')
  ) {
    return "The game couldn't process your action. Please try again.";
  }

  // Nonce issues (usually resolved by retry)
  if (message.includes('nonce')) {
    return 'Transaction conflict. Please try again.';
  }

  // Network issues
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('econnrefused')
  ) {
    return 'Connection issue. Check your internet and try again.';
  }

  // Contract reverts — pass through the revert reason if available
  if (message.includes('execution reverted') || message.includes('revert')) {
    const revertMatch = (error as Error)?.message?.match(
      /reason:\s*(.+?)(?:\n|$)/i,
    );
    if (revertMatch?.[1]) {
      return revertMatch[1].trim();
    }
    return "That action couldn't be completed. Please try again.";
  }

  // Clean game errors (starts with uppercase, no hex/technical jargon) — pass through
  const raw = (error as Error)?.message ?? '';
  if (raw.length > 0) {
    const firstChar = raw.charAt(0);
    if (
      firstChar === firstChar.toUpperCase() &&
      !/0x[0-9a-f]{4,}/i.test(raw) &&
      !/reverted|nonce|timeout/i.test(raw)
    ) {
      return raw;
    }
  }

  return 'Something went wrong. Please try again.';
};
