import type { ServerMessage, ClientMessage } from './types';
import type { GameStore, BatchUpdate } from './store';
import { isStaleForRow } from './store';

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = 25000;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private store: GameStore;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastBlock: number;
  private disposed = false;
  private pendingUpdates: BatchUpdate[] = [];
  private flushScheduled = false;
  private visibilityHandler: (() => void) | null = null;
  private wsMessageCount = 0;
  private wsUpdateCount = 0;

  constructor(url: string, store: GameStore, initialBlock = 0) {
    this.url = url;
    this.store = store;
    this.lastBlock = initialBlock;
  }

  connect() {
    if (this.disposed) return;
    this.cleanup();
    this.setupVisibilityHandler();

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[ws] Connected to indexer');
      this.reconnectAttempts = 0;
      this.store.setConnected(true);
      this.startHeartbeat();

      // Subscribe to all tables
      this.send({ type: 'subscribe', tables: [] });

      // Resume from last known block if we have one
      if (this.lastBlock > 0) {
        console.log(`[ws] resume from block ${this.lastBlock}`);
        this.send({ type: 'resume', lastBlock: this.lastBlock });
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = () => {
      console.log('[ws] Disconnected');
      this.store.setConnected(false);
      this.stopHeartbeat();
      if (!this.disposed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this — reconnect handled there
    };
  }

  dispose() {
    this.disposed = true;
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private handleMessage(raw: string) {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    this.wsMessageCount++;
    // Log WS traffic every 50 messages
    if (this.wsMessageCount % 50 === 0) {
      console.log(`[ws] msgs=${this.wsMessageCount} updates=${this.wsUpdateCount} block=${this.lastBlock}`);
    }

    switch (msg.type) {
      case 'connected':
        this.lastBlock = msg.block;
        this.store.setCurrentBlock(msg.block);
        break;

      case 'update':
        // Skip if a receipt already applied a newer value for this row —
        // WS lags behind receipts and would overwrite with stale data.
        if (!isStaleForRow(msg.table, msg.keyBytes, msg.block)) {
          this.wsUpdateCount++;
          this.queueUpdate({ type: 'set', table: msg.table, keyBytes: msg.keyBytes, data: msg.value });
        } else {
          console.log(`[ws] STALE skip: ${msg.table} block=${msg.block}`);
        }
        if (msg.block > this.lastBlock) {
          this.lastBlock = msg.block;
          this.store.setCurrentBlock(msg.block);
        }
        break;

      case 'delete':
        this.queueUpdate({ type: 'delete', table: msg.table, keyBytes: msg.keyBytes });
        if (msg.block > this.lastBlock) {
          this.lastBlock = msg.block;
          this.store.setCurrentBlock(msg.block);
        }
        break;

      case 'pong':
        // Heartbeat response received
        break;
    }
  }

  private queueUpdate(update: BatchUpdate) {
    this.pendingUpdates.push(update);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => {
        this.flushScheduled = false;
        const batch = this.pendingUpdates;
        this.pendingUpdates = [];
        if (batch.length > 0) {
          this.store.applyBatch(batch);
        }
      });
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (document.hidden) return; // don't start if tab is hidden
    this.heartbeatTimer = setInterval(() => {
      if (document.hidden) {
        this.stopHeartbeat();
        return;
      }
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setupVisibilityHandler() {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopHeartbeat();
      } else if (this.ws?.readyState === WebSocket.OPEN) {
        this.startHeartbeat();
      } else if (!this.disposed) {
        // WS died while tab was hidden — reconnect immediately
        console.log('[ws] Tab visible, connection dead — reconnecting');
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.connect();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private scheduleReconnect() {
    if (this.disposed) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempts++;
    console.log(`[ws] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
