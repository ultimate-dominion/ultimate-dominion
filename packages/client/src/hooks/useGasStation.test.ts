import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RELAYER_FUND_THRESHOLD, shouldRequestRelayerFunding, useGasStation } from './useGasStation';

let mockAuthMethod: 'embedded' | 'external' | null = 'embedded';
let mockBurnerAddress = '0x1111111111111111111111111111111111111111';
let mockBurnerBalance = '0';
const mockBuyGas = vi.fn();

vi.mock('../contexts/MUDContext', () => ({
  useMUD: () => ({
    authMethod: mockAuthMethod,
    burnerAddress: mockBurnerAddress,
    burnerBalance: mockBurnerBalance,
    systemCalls: { buyGas: mockBuyGas },
  }),
}));

describe('shouldRequestRelayerFunding', () => {
  it('returns true below the relayer threshold', () => {
    expect(shouldRequestRelayerFunding(RELAYER_FUND_THRESHOLD - 1n)).toBe(true);
  });

  it('returns false at or above the relayer threshold', () => {
    expect(shouldRequestRelayerFunding(RELAYER_FUND_THRESHOLD)).toBe(false);
    expect(shouldRequestRelayerFunding(RELAYER_FUND_THRESHOLD + 1n)).toBe(false);
  });
});

describe('useGasStation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RELAYER_URL', 'https://relayer.example');
    vi.stubEnv('VITE_FUND_API_KEY', 'test-key');
    mockAuthMethod = 'embedded';
    mockBurnerAddress = '0x1111111111111111111111111111111111111111';
    mockBurnerBalance = '0';
    mockBuyGas.mockReset();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'funded' }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('requests relayer funding for embedded wallets below threshold', () => {
    mockBurnerBalance = '0.00001';

    renderHook(() => useGasStation());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://relayer.example/fund',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
        },
        body: JSON.stringify({ address: mockBurnerAddress }),
      }),
    );
    expect(mockBuyGas).not.toHaveBeenCalled();
  });

  it('does not request funding for external wallets', () => {
    mockAuthMethod = 'external';
    mockBurnerBalance = '0.00001';

    renderHook(() => useGasStation());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockBuyGas).not.toHaveBeenCalled();
  });

  it('rate limits repeated relayer requests to once every 15 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
    mockBurnerBalance = '0.00001';

    const { rerender } = renderHook(() => useGasStation());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    mockBurnerBalance = '0.000009';
    rerender();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15_000);
    mockBurnerBalance = '0.000008';
    rerender();
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
