import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { config } from '../config.js';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { ServiceName, ServiceStatus, ServiceCheckResult, ServiceState } from './types.js';
import { checkBaseNode, checkRelayer, checkIndexerSelf, checkClient, checkApi } from './checks.js';
import { sendAlert } from './alerter.js';

const POLL_INTERVAL = 45_000;   // 45 seconds
const HISTORY_SIZE = 60;        // ~45 min of history
const FLAP_THRESHOLD = 2;       // consecutive failures before marking down

const states = new Map<ServiceName, ServiceState>();

function initState(): ServiceState {
  return {
    currentStatus: 'unknown',
    lastChange: Date.now(),
    consecutiveFailures: 0,
    history: [],
    lastCheck: null,
  };
}

function getState(name: ServiceName): ServiceState {
  let s = states.get(name);
  if (!s) {
    s = initState();
    states.set(name, s);
  }
  return s;
}

function pushHistory(state: ServiceState, result: ServiceCheckResult) {
  state.history.push(result);
  if (state.history.length > HISTORY_SIZE) state.history.shift();
  state.lastCheck = result;
}

function resolveStatus(state: ServiceState, rawResult: ServiceCheckResult): ServiceStatus {
  if (rawResult.status === 'up') {
    state.consecutiveFailures = 0;
    return 'up';
  }
  if (rawResult.status === 'degraded') {
    state.consecutiveFailures = 0;
    return 'degraded';
  }
  // down — apply flap protection
  state.consecutiveFailures++;
  if (state.consecutiveFailures >= FLAP_THRESHOLD) return 'down';
  // Not enough failures yet — keep previous status
  return state.currentStatus === 'unknown' ? 'unknown' : state.currentStatus;
}

async function processCheck(name: ServiceName, result: ServiceCheckResult) {
  const state = getState(name);
  pushHistory(state, result);

  const newStatus = resolveStatus(state, result);
  const prevStatus = state.currentStatus;

  if (newStatus !== prevStatus) {
    // Don't alert on unknown→* (startup)
    if (prevStatus !== 'unknown') {
      sendAlert({
        service: name,
        previousStatus: prevStatus,
        newStatus,
        details: result.error,
        timestamp: Date.now(),
      });
    }
    state.currentStatus = newStatus;
    state.lastChange = Date.now();
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let syncHandleRef: SyncHandle | null = null;
let broadcasterRef: Broadcaster | null = null;

async function runChecks() {
  const m = config.monitor;
  const checks: Array<{ name: ServiceName; promise: Promise<ServiceCheckResult> | ServiceCheckResult }> = [];

  // Base node
  if (m.baseNodeUrl && m.alchemyUrl) {
    checks.push({
      name: 'base-node',
      promise: checkBaseNode(m.baseNodeUrl, m.baseNodeToken, m.alchemyUrl),
    });
  }

  // Relayer
  if (m.relayerUrl) {
    checks.push({ name: 'relayer', promise: checkRelayer(m.relayerUrl) });
  }

  // Indexer self-check
  if (syncHandleRef && m.alchemyUrl) {
    try {
      const publicClient = createPublicClient({ chain: base, transport: http(m.alchemyUrl) });
      const chainHead = Number(await publicClient.getBlockNumber());
      checks.push({
        name: 'indexer',
        promise: checkIndexerSelf(
          syncHandleRef.latestBlockNumber,
          chainHead,
          broadcasterRef?.clientCount ?? 0,
        ),
      });
    } catch {
      checks.push({
        name: 'indexer',
        promise: Promise.resolve({ status: 'down' as const, latencyMs: 0, error: 'Failed to get chain head' }),
      });
    }
  }

  // Clients
  if (m.clientProdUrl) {
    checks.push({ name: 'client-prod', promise: checkClient(m.clientProdUrl, 'client-prod') });
  }
  if (m.clientBetaUrl) {
    checks.push({ name: 'client-beta', promise: checkClient(m.clientBetaUrl, 'client-beta') });
  }

  // API
  if (m.apiUrl) {
    checks.push({ name: 'api', promise: checkApi(m.apiUrl) });
  }

  // Run all in parallel
  const results = await Promise.allSettled(
    checks.map(async (c) => {
      const result = await c.promise;
      return { name: c.name, result };
    }),
  );

  const summary: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      await processCheck(r.value.name, r.value.result);
      const s = getState(r.value.name);
      summary.push(`${r.value.name}=${s.currentStatus}`);
    }
  }

  console.log(`[monitor] ${summary.join(' | ')}`);
}

export function startMonitor(syncHandle: SyncHandle, broadcaster: Broadcaster): void {
  syncHandleRef = syncHandle;
  broadcasterRef = broadcaster;
  console.log('[monitor] Starting infrastructure monitor (45s interval)');

  // Initial check after 5s delay (let services warm up)
  setTimeout(() => {
    runChecks();
    timer = setInterval(runChecks, POLL_INTERVAL);
  }, 5_000);
}

export function stopMonitor(): void {
  if (timer) clearInterval(timer);
}

export function getMonitorStatus(): Record<string, unknown> {
  const services: Record<string, unknown> = {};
  let anyDown = false;
  let anyDegraded = false;

  for (const [name, state] of states) {
    const upCount = state.history.filter(h => h.status === 'up').length;
    const uptimePercent = state.history.length > 0
      ? Math.round((upCount / state.history.length) * 100)
      : 100;

    services[name] = {
      status: state.currentStatus,
      latencyMs: state.lastCheck?.latencyMs ?? 0,
      details: state.lastCheck?.details ?? {},
      error: state.lastCheck?.error,
      uptimePercent,
      lastChange: new Date(state.lastChange).toISOString(),
    };

    if (state.currentStatus === 'down') anyDown = true;
    if (state.currentStatus === 'degraded') anyDegraded = true;
  }

  return {
    overallStatus: anyDown ? 'down' : anyDegraded ? 'degraded' : 'up',
    services,
    checkedAt: new Date().toISOString(),
  };
}
