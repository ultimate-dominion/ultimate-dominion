/**
 * Detect stale JS chunk errors caused by Vercel deploying new hashes
 * while a player still has the old bundle loaded. Viem's lazy CCIP
 * import is the most common trigger.
 */
export function isStaleChunkError(error: unknown): boolean {
  const msg = ((error as Error)?.message ?? '') + (String(error) ?? '');
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError')
  );
}

/**
 * One-shot reload for stale deploys. Uses sessionStorage to prevent
 * infinite reload loops (only reloads once per session).
 */
export function reloadIfStaleChunk(error: unknown): boolean {
  if (!isStaleChunkError(error)) return false;
  const key = 'stale-chunk-reload';
  if (sessionStorage.getItem(key)) return false; // already tried
  sessionStorage.setItem(key, '1');
  window.location.reload();
  return true; // reload initiated (won't actually reach caller)
}

export const USER_ERRORS = ['User denied signature'];
export const INSUFFICIENT_FUNDS_MESSAGE =
  'A bitter cold seeps from the cave walls, freezing you in place. Wait a moment for the chill to pass.';

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
    return 'A bitter cold seeps from the cave walls, freezing you in place. Wait a moment for the chill to pass.';
  }

  // Gas estimation failures
  if (
    message.includes('gas required exceeds') ||
    message.includes('out of gas') ||
    message.includes('gas estimation')
  ) {
    return 'The ancient wards resist your action. Try again in a moment.';
  }

  // Nonce issues (usually resolved by retry)
  if (message.includes('nonce')) {
    return 'Your actions overlapped. Try again.';
  }

  // Network issues
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('econnrefused')
  ) {
    return 'The cave grows dark and the way forward is unclear. Check your connection and try again.';
  }

  // Contract reverts — match known error signatures, then revert reason
  if (message.includes('execution reverted') || message.includes('revert')) {
    const raw = (error as Error)?.message ?? '';

    // Known custom error signatures
    const KNOWN_REVERTS: Record<string, string> = {
      '0x4a675dad': "The shopkeeper's coffers are empty. Stock replenishes every 12 hours.",
      '0xade1cb41': 'That item is out of stock. Check back after the shop restocks.',
      '0x16a8a709': "You don't have enough of that item to sell.",
      '0xd8deb7b5': 'Something feels off about this encounter. Try leaving and re-entering.',
      '0x6bbd0237': 'The shopkeeper seems confused. Try leaving and re-entering.',
      '0x9d026e7f': "You're too far from the shopkeeper. Move closer first.",
      '0x78d73082': "That shopkeeper is busy with another adventurer.",
    };

    for (const [sig, friendly] of Object.entries(KNOWN_REVERTS)) {
      if (raw.includes(sig)) return friendly;
    }

    const revertMatch = raw.match(/reason:\s*(.+?)(?:\n|$)/i);
    if (revertMatch?.[1]) {
      return revertMatch[1].trim();
    }
    return 'The cave resists your action. Try again.';
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

  return 'Something stirs in the darkness. Try again.';
};
