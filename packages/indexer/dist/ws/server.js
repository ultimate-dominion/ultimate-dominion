import { WebSocketServer } from 'ws';
const HEARTBEAT_INTERVAL = 30000;
export function createWSServer(httpServer, broadcaster, getCurrentBlock) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    wss.on('connection', (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        broadcaster.addClient(ws, getCurrentBlock());
    });
    // Heartbeat to detect dead connections
    const interval = setInterval(() => {
        for (const ws of wss.clients) {
            if (ws.isAlive === false) {
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }, HEARTBEAT_INTERVAL);
    wss.on('close', () => {
        clearInterval(interval);
    });
    console.log('[ws] WebSocket server ready on /ws');
    return wss;
}
//# sourceMappingURL=server.js.map