/**
 * Lightweight client metrics reporter.
 * Tracks performance telemetry and sends to API every 60s.
 * Zero impact when no metrics are recorded.
 *
 * Tracks:
 * - Transaction round-trips (submit → confirmed)
 * - MUD sync latency (block produced → client state updated)
 * - Page load performance (time to interactive)
 * - Memory pressure
 * - RPC call latency
 */

interface MetricEntry {
  type: 'tx_roundtrip' | 'sync_lag' | 'page_load' | 'memory' | 'rpc_latency' | 'render';
  name?: string;           // e.g. system call name, RPC method
  value: number;           // milliseconds (or bytes for memory)
  timestamp: number;
  meta?: Record<string, unknown>;
}

const FLUSH_INTERVAL = 60_000; // 60 seconds
const MAX_BATCH = 100;
const ENDPOINT = '/api/metrics';

let buffer: MetricEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  const body = JSON.stringify({ metrics: batch });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

function push(entry: MetricEntry) {
  buffer.push(entry);
  if (buffer.length >= MAX_BATCH) flush();
}

// --- Public API ---

/**
 * Track a transaction round-trip.
 * Call with startTime = Date.now() before tx, then call again after waitForTransaction.
 */
export function trackTxRoundtrip(systemCall: string, startMs: number, success: boolean) {
  push({
    type: 'tx_roundtrip',
    name: systemCall,
    value: Date.now() - startMs,
    timestamp: Date.now(),
    meta: { success },
  });
}

/**
 * Track MUD sync lag — time between block timestamp and when client processes it.
 * Call from storedBlockLogs$ subscription.
 */
export function trackSyncLag(blockTimestamp: number, blockNumber: bigint) {
  const chainTimeMs = blockTimestamp * 1000; // block timestamp is in seconds
  const lagMs = Date.now() - chainTimeMs;
  push({
    type: 'sync_lag',
    value: lagMs,
    timestamp: Date.now(),
    meta: { blockNumber: Number(blockNumber) },
  });
}

/**
 * Track RPC call latency.
 */
export function trackRpcLatency(method: string, startMs: number, success: boolean) {
  push({
    type: 'rpc_latency',
    name: method,
    value: Date.now() - startMs,
    timestamp: Date.now(),
    meta: { success },
  });
}

/**
 * Track a slow render (call from useEffect or performance observer).
 */
export function trackRender(component: string, durationMs: number) {
  if (durationMs > 50) { // only track slow renders (>50ms)
    push({
      type: 'render',
      name: component,
      value: durationMs,
      timestamp: Date.now(),
    });
  }
}

/**
 * Snapshot memory usage. Called periodically by initMetrics.
 */
function snapshotMemory() {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (perf.memory) {
    push({
      type: 'memory',
      value: perf.memory.usedJSHeapSize,
      timestamp: Date.now(),
      meta: {
        total: perf.memory.totalJSHeapSize,
        limit: perf.memory.jsHeapSizeLimit,
      },
    });
  }
}

/**
 * Track page load performance using Navigation Timing API.
 */
function trackPageLoad() {
  // Wait for load to complete
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => setTimeout(trackPageLoad, 100));
    return;
  }

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    push({
      type: 'page_load',
      name: 'dom_interactive',
      value: nav.domInteractive - nav.startTime,
      timestamp: Date.now(),
    });
    push({
      type: 'page_load',
      name: 'dom_complete',
      value: nav.domComplete - nav.startTime,
      timestamp: Date.now(),
    });
    push({
      type: 'page_load',
      name: 'load_event',
      value: nav.loadEventEnd - nav.startTime,
      timestamp: Date.now(),
    });
  }
}

/**
 * Initialize metrics collection. Call once at app startup.
 */
export function initMetrics() {
  if (flushTimer) return;

  // Flush periodically
  flushTimer = setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  // Track page load
  trackPageLoad();

  // Memory snapshots every 30s
  setInterval(snapshotMemory, 30_000);
}
