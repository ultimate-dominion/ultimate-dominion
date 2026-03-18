/** Queue stats broadcast payload */
export type QueueStats = {
  totalInQueue: number;
  slotsAvailable: number;
  currentPlayers: number;
};

/** Game event for the live feed */
export type GameEvent = {
  id: string;
  eventType: 'loot_drop' | 'pvp_kill' | 'level_up' | 'rare_find' | 'death' | 'character_created' | 'class_selection' | 'fragment_found';
  playerName: string;
  description: string;
  timestamp: number;
};

/** Messages from server to client */
export type ServerMessage =
  | { type: 'connected'; block: number }
  | { type: 'update'; table: string; keyBytes: string; key: Record<string, string>; value: Record<string, unknown>; block: number }
  | { type: 'delete'; table: string; keyBytes: string; key: Record<string, string>; block: number }
  | { type: 'pong' }
  | { type: 'queue:stats'; stats: QueueStats }
  | { type: 'queue:slot_open'; wallet: string; readyUntil: string }
  | { type: 'game:event'; event: GameEvent };

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
