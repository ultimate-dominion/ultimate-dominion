import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'http';
import type { Broadcaster } from './broadcaster.js';

const HEARTBEAT_INTERVAL = 30_000;

export function createWSServer(httpServer: Server, broadcaster: Broadcaster, getCurrentBlock: () => number) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    (ws as any).isAlive = true;

    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    broadcaster.addClient(ws, getCurrentBlock());
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if ((ws as any).isAlive === false) {
        ws.terminate();
        continue;
      }
      (ws as any).isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[ws] WebSocket server ready on /ws');
  return wss;
}
