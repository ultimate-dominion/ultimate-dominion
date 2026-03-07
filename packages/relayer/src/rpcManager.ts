import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { config } from './config.js';

let primaryHealthy = true;
let consecutiveFailures = 0;
let lastCheckTime = 0;
let timer: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_HEALTHY = 15_000;  // 15s when primary is healthy
const CHECK_INTERVAL_FALLBACK = 60_000; // 60s when on fallback (re-check primary)
const FAILURE_THRESHOLD = 2;            // consecutive failures before marking down

// Auth headers for self-hosted RPC
const fetchOptions = config.rpcAuthToken
  ? { headers: { Authorization: `Bearer ${config.rpcAuthToken}` } }
  : undefined;

async function checkPrimary(): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(config.rpcUrl, { fetchOptions, timeout: 10_000 }),
    });
    await client.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

async function tick() {
  const healthy = await checkPrimary();
  lastCheckTime = Date.now();

  if (healthy) {
    if (!primaryHealthy) {
      console.log('[rpc] Primary RPC recovered');
    }
    primaryHealthy = true;
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD && primaryHealthy) {
      primaryHealthy = false;
      console.warn(`[rpc] Primary RPC down (${consecutiveFailures} failures), using fallback`);
    }
  }

  // Adjust check interval based on state
  if (timer) clearInterval(timer);
  const interval = primaryHealthy ? CHECK_INTERVAL_HEALTHY : CHECK_INTERVAL_FALLBACK;
  timer = setInterval(tick, interval);
}

export function startRpcHealthCheck(): void {
  if (!config.rpcFallbackUrl) {
    console.log('[rpc] No RPC_FALLBACK_URL set — fallback disabled');
    return;
  }
  console.log('[rpc] Health check started (primary + fallback configured)');
  timer = setInterval(tick, CHECK_INTERVAL_HEALTHY);
  // Run first check immediately
  tick();
}

export function stopRpcHealthCheck(): void {
  if (timer) clearInterval(timer);
}

export function isUsingFallback(): boolean {
  return !primaryHealthy && !!config.rpcFallbackUrl;
}

export function getRpcStatus() {
  return {
    primaryHealthy,
    consecutiveFailures,
    fallbackConfigured: !!config.rpcFallbackUrl,
    active: !primaryHealthy && config.rpcFallbackUrl ? 'fallback' : 'primary',
    lastCheckTime: lastCheckTime ? new Date(lastCheckTime).toISOString() : null,
  };
}
