import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WSClient } from './wsClient';
import type { GameStore } from './store';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(_data: string) {}
  close() {
    this.readyState = 3; // CLOSED
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.(new Event('open'));
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

// Stub globals
vi.stubGlobal('WebSocket', MockWebSocket);
Object.defineProperty(MockWebSocket, 'OPEN', { value: 1 });
Object.defineProperty(MockWebSocket, 'CONNECTING', { value: 0 });

// Stub document for visibility handler
const visibilityListeners: Array<() => void> = [];
vi.stubGlobal('document', {
  hidden: false,
  addEventListener: (_event: string, handler: () => void) => { visibilityListeners.push(handler); },
  removeEventListener: () => {},
});

function createMockStore(): GameStore {
  return {
    setConnected: vi.fn(),
    setCurrentBlock: vi.fn(),
    applyBatch: vi.fn(),
  } as unknown as GameStore;
}

describe('WSClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    visibilityListeners.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets consecutive failure counter on successful connection', () => {
    const store = createMockStore();
    const onRequestSnapshot = vi.fn();
    const client = new WSClient('ws://test', store, 0, { onRequestSnapshot });

    client.connect();
    const ws = MockWebSocket.instances[0];

    // Simulate successful connection then close (2 times)
    ws.simulateOpen();
    ws.simulateClose();

    // Reconnect after delay
    vi.advanceTimersByTime(2000);
    const ws2 = MockWebSocket.instances[1];
    ws2.simulateOpen();
    ws2.simulateClose();

    // Even though we've had 2 closes, the counter resets on each open
    // so onRequestSnapshot should NOT have been called
    expect(onRequestSnapshot).not.toHaveBeenCalled();
  });

  it('triggers onRequestSnapshot after 3 consecutive failures', () => {
    const store = createMockStore();
    const onRequestSnapshot = vi.fn();
    const client = new WSClient('ws://test', store, 0, { onRequestSnapshot });

    client.connect();

    // Failure 1: connect and immediately close (no open)
    let ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    expect(onRequestSnapshot).not.toHaveBeenCalled();

    // Failure 2
    vi.advanceTimersByTime(2000);
    ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    expect(onRequestSnapshot).not.toHaveBeenCalled();

    // Failure 3 — should trigger
    vi.advanceTimersByTime(4000);
    ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    expect(onRequestSnapshot).toHaveBeenCalledTimes(1);
  });

  it('resets failure counter after triggering snapshot re-fetch', () => {
    const store = createMockStore();
    const onRequestSnapshot = vi.fn();
    const client = new WSClient('ws://test', store, 0, { onRequestSnapshot });

    client.connect();

    // Trigger 3 consecutive failures
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      ws.simulateClose();
      vi.advanceTimersByTime(2000 * Math.pow(2, i));
    }
    expect(onRequestSnapshot).toHaveBeenCalledTimes(1);

    // 3 more failures needed to trigger again
    for (let i = 0; i < 2; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      ws.simulateClose();
      vi.advanceTimersByTime(2000 * Math.pow(2, i));
    }
    expect(onRequestSnapshot).toHaveBeenCalledTimes(1); // still 1

    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    expect(onRequestSnapshot).toHaveBeenCalledTimes(2); // now 2
  });

  it('successful open between failures resets counter', () => {
    const store = createMockStore();
    const onRequestSnapshot = vi.fn();
    const client = new WSClient('ws://test', store, 0, { onRequestSnapshot });

    client.connect();

    // 2 failures
    let ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    vi.advanceTimersByTime(2000);
    ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();
    vi.advanceTimersByTime(4000);

    // Successful connection resets counter
    ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateOpen();
    ws.simulateClose();

    // Only 1 failure after reset, not 3
    vi.advanceTimersByTime(2000);
    ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    ws.simulateClose();

    expect(onRequestSnapshot).not.toHaveBeenCalled();
  });

  it('does not trigger snapshot when no callback provided', () => {
    const store = createMockStore();
    const client = new WSClient('ws://test', store, 0);

    client.connect();

    // 3 consecutive failures — no crash
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      ws.simulateClose();
      vi.advanceTimersByTime(2000 * Math.pow(2, i));
    }

    // No error thrown — passes
  });
});
