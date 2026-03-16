import { describe, it, expect } from 'vitest';
import { getFundingGate } from './CharacterCreation';

describe('getFundingGate', () => {
  // --- Embedded (Google auth) path ---

  it('blocks embedded users with 0 balance (awaitingFunding)', () => {
    const result = getFundingGate('embedded', true, '0');
    expect(result.awaitingFunding).toBe(true);
    expect(result.needsFunding).toBe(false);
  });

  it('does not block embedded users once funded', () => {
    const result = getFundingGate('embedded', true, '0.001');
    expect(result.awaitingFunding).toBe(false);
    expect(result.needsFunding).toBe(false);
  });

  it('does not block embedded users before balance is fetched', () => {
    const result = getFundingGate('embedded', false, '0');
    expect(result.awaitingFunding).toBe(false);
    expect(result.needsFunding).toBe(false);
  });

  // --- External (MetaMask) path ---

  it('blocks external users with 0 balance (needsFunding)', () => {
    const result = getFundingGate('external', true, '0');
    expect(result.needsFunding).toBe(true);
    expect(result.awaitingFunding).toBe(false);
  });

  it('does not block external users once funded', () => {
    const result = getFundingGate('external', true, '0.005');
    expect(result.needsFunding).toBe(false);
    expect(result.awaitingFunding).toBe(false);
  });

  // --- No auth ---

  it('does not block when not authenticated', () => {
    const result = getFundingGate(null, true, '0');
    expect(result.needsFunding).toBe(false);
    expect(result.awaitingFunding).toBe(false);
  });
});
