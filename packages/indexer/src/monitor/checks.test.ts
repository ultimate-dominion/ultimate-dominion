import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRelayer } from './checks.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('checkRelayer', () => {
  it('returns up when authed response shows healthy wallets', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'ok',
      poolSize: 5,
      wallets: [
        { balance: '0.01 ETH' },
        { balance: '0.01 ETH' },
        { balance: '0.01 ETH' },
        { balance: '0.01 ETH' },
        { balance: '0.01 ETH' },
      ],
      totalInflight: 0,
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('up');
  });

  it('returns degraded when all wallets below threshold', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'ok',
      poolSize: 3,
      wallets: [
        { balance: '0.001 ETH' },
        { balance: '0.002 ETH' },
        { balance: '0.004 ETH' },
      ],
      totalInflight: 0,
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('degraded');
    expect(result.error).toBe('All wallets low balance');
  });

  it('returns up when unauthed response (no wallet data)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'ok',
      service: 'ud-gas-station',
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('up');
  });

  it('returns up when some wallets are low but not all', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'ok',
      poolSize: 3,
      wallets: [
        { balance: '0.001 ETH' },
        { balance: '0.01 ETH' },
        { balance: '0.01 ETH' },
      ],
      totalInflight: 0,
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('up');
    expect(result.details?.lowBalanceWallets).toBe(1);
  });

  it('returns degraded on high inflight count', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'ok',
      poolSize: 5,
      wallets: [
        { balance: '0.05 ETH' },
        { balance: '0.05 ETH' },
        { balance: '0.05 ETH' },
        { balance: '0.05 ETH' },
        { balance: '0.05 ETH' },
      ],
      totalInflight: 15,
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('degraded');
    expect(result.error).toBe('High inflight tx count');
  });

  it('returns down on HTTP error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 503));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('down');
  });

  it('returns down on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('down');
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('returns down when status is not ok', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: 'error',
    }));

    const result = await checkRelayer('http://relayer');
    expect(result.status).toBe('down');
  });
});
