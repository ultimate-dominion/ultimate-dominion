/** Messages from server to client */
export type ServerMessage = {
    type: 'connected';
    block: number;
} | {
    type: 'update';
    table: string;
    keyBytes: string;
    key: Record<string, string>;
    value: Record<string, unknown>;
    block: number;
} | {
    type: 'delete';
    table: string;
    keyBytes: string;
    key: Record<string, string>;
    block: number;
} | {
    type: 'pong';
};
/** Messages from client to server */
export type ClientMessage = {
    type: 'subscribe';
    tables: string[];
} | {
    type: 'ping';
} | {
    type: 'resume';
    lastBlock: number;
};
export declare function encodeMessage(msg: ServerMessage): string;
export declare function decodeClientMessage(data: string): ClientMessage | null;
