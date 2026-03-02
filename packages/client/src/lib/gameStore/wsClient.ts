import type { ServerMessage, ClientMessage } from './types';
import type { GameStore } from './store';

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
  private lastBlock = 0;
  private disposed = false;

  constructor(url: string, store: GameStore) {
    this.url = url;
    this.store = store;
  }

  connect() {
    if (this.disposed) return;
    this.cleanup();

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
  }

  private handleMessage(raw: string) {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'connected':
        this.lastBlock = msg.block;
        this.store.setCurrentBlock(msg.block);
        break;

      case 'update':
        this.store.setRow(msg.table, msg.keyBytes, msg.value);
        if (msg.block > this.lastBlock) {
          this.lastBlock = msg.block;
          this.store.setCurrentBlock(msg.block);
        }
        break;

      case 'delete':
        this.store.deleteRow(msg.table, msg.keyBytes);
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

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
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
