/**
 * Lightweight client error reporter.
 * Batches errors and sends them to the API every 30s (or on page unload).
 * ~1KB, zero dependencies, zero impact unless errors actually occur.
 */

interface ErrorEntry {
  message: string;
  source?: string;
  stack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  type: 'js' | 'promise' | 'react' | 'rpc' | 'contract';
  meta?: Record<string, unknown>;
}

const FLUSH_INTERVAL = 30_000; // 30 seconds
const MAX_BATCH = 50; // prevent runaway
const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL
  ? `${import.meta.env.VITE_TELEMETRY_URL}/errors`
  : '/api/errors';

let buffer: ErrorEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function makeEntry(
  partial: Partial<ErrorEntry> & Pick<ErrorEntry, 'message' | 'type'>,
): ErrorEntry {
  return {
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...partial,
  };
}

function flush() {
  if (buffer.length === 0) return;
  // Skip if no telemetry URL configured (default /api/errors returns 404)
  if (!import.meta.env.VITE_TELEMETRY_URL) {
    buffer.length = 0;
    return;
  }
  const batch = buffer.splice(0, MAX_BATCH);
  const body = JSON.stringify({ errors: batch });

  // Use sendBeacon for reliability (works on unload), fallback to fetch
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {}); // fire and forget
  }
}

/** Report a caught error (call from error boundaries, RPC catches, etc.) */
export function reportError(
  type: ErrorEntry['type'],
  error: unknown,
  meta?: Record<string, unknown>,
) {
  const err = error instanceof Error ? error : new Error(String(error));
  buffer.push(
    makeEntry({
      type,
      message: err.message,
      stack: err.stack?.slice(0, 2000),
      meta,
    }),
  );
  if (buffer.length >= MAX_BATCH) flush();
}

/** Initialize global error handlers. Call once at app startup. */
export function initErrorReporter() {
  if (flushTimer) return; // already initialized

  // JS errors
  window.addEventListener('error', (event) => {
    buffer.push(
      makeEntry({
        type: 'js',
        message: event.message,
        source: `${event.filename}:${event.lineno}:${event.colno}`,
        stack: event.error?.stack?.slice(0, 2000),
      }),
    );
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 2000) : undefined;

    // Detect contract reverts
    const isContractRevert =
      message.includes('revert') ||
      message.includes('execution reverted') ||
      message.includes('CALL_EXCEPTION');

    buffer.push(
      makeEntry({
        type: isContractRevert ? 'contract' : 'promise',
        message,
        stack,
      }),
    );
  });

  // Flush periodically (pauses when tab hidden)
  flushTimer = setInterval(flush, FLUSH_INTERVAL);

  // Pause/resume on visibility; flush when hiding
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flush();
      if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    } else if (!flushTimer) {
      flushTimer = setInterval(flush, FLUSH_INTERVAL);
    }
  });
}
