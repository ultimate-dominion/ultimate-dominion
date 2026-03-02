/** A row of decoded MUD table data */
export type TableRow = Record<string, unknown>;

/** All table data: tableName → entityKeyBytes → row data */
export type TableData = Record<string, Record<string, TableRow>>;

/** Snapshot from the indexer's GET /snapshot endpoint */
export type FullSnapshot = {
  block: number;
  tables: TableData;
};

/** WebSocket messages from server */
export type ServerMessage =
  | { type: 'connected'; block: number }
  | { type: 'update'; table: string; keyBytes: string; key: Record<string, string>; value: Record<string, unknown>; block: number }
  | { type: 'delete'; table: string; keyBytes: string; key: Record<string, string>; block: number }
  | { type: 'pong' };

/** WebSocket messages to server */
export type ClientMessage =
  | { type: 'subscribe'; tables: string[] }
  | { type: 'ping' }
  | { type: 'resume'; lastBlock: number };
