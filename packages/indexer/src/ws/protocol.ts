/** Messages from server to client */
export type ServerMessage =
  | { type: 'connected'; block: number }
  | { type: 'update'; table: string; keyBytes: string; key: Record<string, string>; value: Record<string, unknown>; block: number }
  | { type: 'delete'; table: string; keyBytes: string; key: Record<string, string>; block: number }
  | { type: 'pong' };

/** Messages from client to server */
export type ClientMessage =
  | { type: 'subscribe'; tables: string[] }
  | { type: 'ping' }
  | { type: 'resume'; lastBlock: number };

export function encodeMessage(msg: ServerMessage): string {
  return JSON.stringify(msg, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

export function decodeClientMessage(data: string): ClientMessage | null {
  try {
    return JSON.parse(data) as ClientMessage;
  } catch {
    return null;
  }
}
