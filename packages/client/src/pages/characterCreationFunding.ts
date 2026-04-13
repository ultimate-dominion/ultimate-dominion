/**
 * Determines whether character creation should be blocked pending wallet funding.
 * - External (MetaMask): user must manually deposit, so show "Fund Your Session"
 * - Embedded (Google auth): do not block; system calls request relayer funding on insufficient gas
 */
export function getFundingGate(
  authMethod: 'embedded' | 'external' | null,
  burnerBalanceFetched: boolean,
  burnerBalance: string,
): { needsFunding: boolean; awaitingFunding: boolean } {
  const zeroBalance = burnerBalanceFetched && burnerBalance === '0';
  return {
    needsFunding: authMethod === 'external' && zeroBalance,
    awaitingFunding: false,
  };
}
