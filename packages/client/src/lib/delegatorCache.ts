/**
 * Caches the delegator address in localStorage so returning players can
 * resolve their character from snapshot data immediately on refresh,
 * without waiting for the full auth chain (wagmi reconnect → MUD sync →
 * delegation check → delegatorAddress).
 *
 * Key format: `ud:delegator:{worldAddress.toLowerCase()}`
 */

function cacheKey(worldAddress: string): string {
  return `ud:delegator:${worldAddress.toLowerCase()}`;
}

export function getCachedDelegator(worldAddress: string): string | null {
  try {
    if (!worldAddress) return null;
    return localStorage.getItem(cacheKey(worldAddress));
  } catch {
    return null;
  }
}

export function setCachedDelegator(worldAddress: string, delegatorAddress: string): void {
  try {
    if (!worldAddress) return;
    localStorage.setItem(cacheKey(worldAddress), delegatorAddress);
  } catch { /* localStorage unavailable */ }
}

export function clearCachedDelegator(worldAddress: string): void {
  try {
    if (!worldAddress) return;
    localStorage.removeItem(cacheKey(worldAddress));
  } catch { /* localStorage unavailable */ }
}
