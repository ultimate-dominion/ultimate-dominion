import { describe, it, expect } from 'vitest';
import { parseEther } from 'viem';
import { calculateSwapAmount, calculateMinEthOutput } from './useGasStation';

describe('calculateSwapAmount', () => {
  it('returns null when gold is below minimum (1)', () => {
    expect(calculateSwapAmount(parseEther('0.5'))).toBeNull();
    expect(calculateSwapAmount(0n)).toBeNull();
  });

  it('returns exact gold when between min and max', () => {
    const fifty = parseEther('50');
    expect(calculateSwapAmount(fifty)).toBe(fifty);
  });

  it('caps at 100 Gold when above max', () => {
    expect(calculateSwapAmount(parseEther('200'))).toBe(parseEther('100'));
  });

  it('returns exact gold at exactly 1 (minimum)', () => {
    const one = parseEther('1');
    expect(calculateSwapAmount(one)).toBe(one);
  });

  it('returns max at exactly 100', () => {
    const hundred = parseEther('100');
    expect(calculateSwapAmount(hundred)).toBe(hundred);
  });
});

describe('calculateMinEthOutput', () => {
  it('calculates expected ETH for 100 Gold', () => {
    const result = calculateMinEthOutput(parseEther('100'));
    // 100 Gold * 800000 / 1e18 = 80000000 wei = 0.00000008 ETH
    expect(result).toBe(80_000_000n);
  });

  it('returns 0 for dust amounts', () => {
    // Very small gold amounts may round to 0 — that's fine
    expect(calculateMinEthOutput(1n)).toBe(0n);
  });

  it('scales linearly with gold amount', () => {
    const single = calculateMinEthOutput(parseEther('1'));
    const ten = calculateMinEthOutput(parseEther('10'));
    expect(ten).toBe(single * 10n);
  });
});
