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
    // Try to extract the revert reason
    const revertMatch = (error as Error)?.message?.match(
      /reason:\s*(.+?)(?:\n|$)/i,
    );
    if (revertMatch?.[1]) {
      return revertMatch[1].trim();
    }
    return (error as Error)?.message ?? 'Action failed. Please try again.';
  }

  // Default: pass through the error message
  return (error as Error)?.message ?? 'Something went wrong. Please try again.';
};
