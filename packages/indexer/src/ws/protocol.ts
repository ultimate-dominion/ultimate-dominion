/** Queue stats broadcast payload */
export type QueueStats = {
  totalInQueue: number;
  slotsAvailable: number;
  currentPlayers: number;
};

/** Chat channel identifier */
export type ChatChannel = 'global' | `guild:${string}`;

/** Chat message payload */
export type ChatMessage = {
  id: string;
  channel: ChatChannel;
  senderAddress: string;
  senderName: string;
  senderCharacterId: string;
  content: string;
  timestamp: number;
};

/** Game event for the live feed */
export type GameEvent = {
  id: string;
  eventType: 'loot_drop' | 'pvp_kill' | 'level_up' | 'rare_find' | 'death' | 'character_created' | 'class_selection' | 'fragment_found' | 'marketplace_listing';
  playerName: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

/** Messages from server to client */
export type ServerMessage =
  | { type: 'connected'; block: number }
  | { type: 'update'; table: string; keyBytes: string; key: Record<string, string>; value: Record<string, unknown>; block: number }
  | { type: 'delete'; table: string; keyBytes: string; key: Record<string, string>; block: number }
  | { type: 'pong' }
  | { type: 'queue:stats'; stats: QueueStats }
  | { type: 'queue:slot_open'; wallet: string; readyUntil: string }
  | { type: 'game:event'; event: GameEvent }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:history'; channel: ChatChannel; messages: ChatMessage[] }
  | { type: 'chat:error'; code: string; message: string };

/** Messages from client to server */
export type ClientMessage =
  | { type: 'subscribe'; tables: string[] }
  | { type: 'ping' }
  | { type: 'resume'; lastBlock: number }
  | { type: 'chat:send'; channel: ChatChannel; content: string; senderAddress: string }
  | { type: 'chat:history'; channel: ChatChannel; before?: number }
  | { type: 'chat:join'; channel: ChatChannel }
  | { type: 'chat:leave'; channel: ChatChannel };

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
