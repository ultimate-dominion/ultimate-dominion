/// <reference types="node" />
import { type WebSocket } from 'ws';
import type { Server } from 'http';
import type { Broadcaster } from './broadcaster.js';
export declare function createWSServer(httpServer: Server, broadcaster: Broadcaster, getCurrentBlock: () => number): import("ws").Server<typeof WebSocket, typeof import("http").IncomingMessage>;
