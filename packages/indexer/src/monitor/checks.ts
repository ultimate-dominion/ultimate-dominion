import type { ServiceCheckResult } from './types.js';

/** Fetch with timeout (native AbortSignal) */
async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Measure execution time of an async fn */
async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

/**
 * Check self-hosted Base node.
 * Compares block number against Alchemy to detect lag.
 */
export async function checkBaseNode(
  rpcUrl: string,
  authToken: string,
  alchemyUrl: string,
): Promise<ServiceCheckResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', id: 1 });

    const { result: [selfResp, alchemyResp], ms } = await timed(() =>
      Promise.all([
        timedFetch(rpcUrl, { method: 'POST', headers, body }),
        timedFetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      ]),
    );

    const selfData = (await selfResp.json()) as { result?: string };
    const alchemyData = (await alchemyResp.json()) as { result?: string };

    if (!selfData.result) {
      return { status: 'down', latencyMs: ms, error: 'No block number from self-hosted node' };
    }

    const selfBlock = parseInt(selfData.result, 16);
    const alchemyBlock = alchemyData.result ? parseInt(alchemyData.result, 16) : selfBlock;
    const blockLag = Math.abs(alchemyBlock - selfBlock);

    const details = { selfBlock, alchemyBlock, blockLag };

    if (blockLag > 100) return { status: 'down', latencyMs: ms, details, error: `Block lag: ${blockLag}` };
    if (blockLag > 10) return { status: 'degraded', latencyMs: ms, details };
    return { status: 'up', latencyMs: ms, details };
  } catch (err) {
    return { status: 'down', latencyMs: 0, error: String(err) };
  }
}

/**
 * Check relayer health endpoint.
 */
export async function checkRelayer(url: string): Promise<ServiceCheckResult> {
  try {
    const { result: resp, ms } = await timed(() => timedFetch(url));
    if (!resp.ok) {
      return { status: 'down', latencyMs: ms, error: `HTTP ${resp.status}` };
    }

    const data = (await resp.json()) as {
      status?: string;
      poolSize?: number;
      totalInflight?: number;
      wallets?: Array<{ balance: string }>;
    };

    if (data.status !== 'ok') {
      return { status: 'down', latencyMs: ms, error: `status: ${data.status}` };
    }

    const details: Record<string, unknown> = {
      poolSize: data.poolSize,
      totalInflight: data.totalInflight,
    };

    // Check for low balances (< 0.005 ETH)
    const lowBalanceCount = (data.wallets || []).filter(w => {
      const ethStr = w.balance?.replace(' ETH', '') || '0';
      return parseFloat(ethStr) < 0.005;
    }).length;

    if (lowBalanceCount > 0) details.lowBalanceWallets = lowBalanceCount;

    const highInflight = (data.totalInflight ?? 0) > 10;
    if (lowBalanceCount === (data.poolSize ?? 0)) {
      return { status: 'degraded', latencyMs: ms, details, error: 'All wallets low balance' };
    }
    if (highInflight) {
      return { status: 'degraded', latencyMs: ms, details, error: 'High inflight tx count' };
    }

    return { status: 'up', latencyMs: ms, details };
  } catch (err) {
    return { status: 'down', latencyMs: 0, error: String(err) };
  }
}

/**
 * Check indexer health (self-check — direct data access, no HTTP).
 */
export function checkIndexerSelf(
  latestBlockNumber: number,
  chainHead: number,
  wsClients: number,
): ServiceCheckResult {
  const lag = chainHead - latestBlockNumber;
  const details = { lag, latestBlockNumber, chainHead, wsClients };

  if (lag > 50) return { status: 'down', latencyMs: 0, details, error: `Block lag: ${lag}` };
  if (lag > 10) return { status: 'degraded', latencyMs: 0, details };
  return { status: 'up', latencyMs: 0, details };
}

/**
 * Check a web client (Vercel-hosted frontend).
 */
export async function checkClient(url: string, label: string): Promise<ServiceCheckResult> {
  try {
    const { result: resp, ms } = await timed(() => timedFetch(url, {}, 15_000));
    if (resp.ok) return { status: 'up', latencyMs: ms };
    return { status: 'down', latencyMs: ms, error: `HTTP ${resp.status} from ${label}` };
  } catch (err) {
    return { status: 'down', latencyMs: 0, error: String(err) };
  }
}

/**
 * Check API health endpoint.
 */
export async function checkApi(url: string): Promise<ServiceCheckResult> {
  try {
    const { result: resp, ms } = await timed(() => timedFetch(url));
    if (!resp.ok) return { status: 'down', latencyMs: ms, error: `HTTP ${resp.status}` };

    const data = (await resp.json()) as { status?: string };
    if (data.status === 'ok' || data.status === 'healthy') {
      return { status: 'up', latencyMs: ms };
    }
    return { status: 'degraded', latencyMs: ms, error: `status: ${data.status}` };
  } catch (err) {
    return { status: 'down', latencyMs: 0, error: String(err) };
  }
}
