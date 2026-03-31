import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster, ChatClient } from './broadcaster.js';
import { persistChatMessage, loadChatHistory, isMuted } from '../db/chatStore.js';
import { sql, mudSchema } from '../db/connection.js';
import type { ChatChannel, ChatMessage, ClientMessage, ServerMessage } from './protocol.js';

const MAX_CONTENT_LENGTH = 300;
const RATE_LIMIT_CAPACITY = 3;
const RATE_LIMIT_REFILL_MS = 2000; // 1 token per 2 seconds

type RateBucket = { tokens: number; lastRefill: number };

/**
 * Decode a MUD hex-encoded character name to UTF-8 string.
 * Duplicated from eventFeed.ts to avoid circular import.
 */
function decodeCharacterName(raw: unknown): string | null {
  if (!raw) return null;
  try {
    let hex: string;
    if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
      hex = Buffer.from(raw).toString('hex');
    } else if (typeof raw === 'string') {
      hex = raw.startsWith('0x') ? raw.slice(2) : raw;
    } else {
      return null;
    }
    const trimmed = hex.replace(/0+$/, '');
    if (trimmed.length === 0) return null;
    return Buffer.from(trimmed, 'hex').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Look up character info from a wallet address.
 * Returns { name, characterId } or null if not found.
 */
async function resolveCharacter(
  walletAddress: string,
  charactersTable: string,
): Promise<{ name: string; characterId: string } | null> {
  if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length < 42) return null;
  try {
    const walletBytes = Buffer.from(walletAddress.slice(2, 42), 'hex');
    const rows = await sql.unsafe(`
      SELECT "name", encode("__key_bytes", 'hex') as key_hex
      FROM "${mudSchema}"."${charactersTable}"
      WHERE substring("__key_bytes" from 1 for 20) = $1 LIMIT 1
    `, [walletBytes]);
    if (rows.length === 0) return null;
    const name = decodeCharacterName(rows[0].name);
    if (!name) return null;
    return { name, characterId: '0x' + rows[0].key_hex };
  } catch {
    return null;
  }
}

/**
 * Check if a wallet address is a member of a guild.
 * Queries the MUD GuildMember table.
 */
async function isGuildMember(
  walletAddress: string,
  guildId: string,
  syncHandle: SyncHandle,
): Promise<boolean> {
  const memberTable = syncHandle.tableNameMap.get('GuildMember');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!memberTable || !charactersTable) return false;

  try {
    // Find the character's key_bytes from wallet
    const walletBytes = Buffer.from(walletAddress.slice(2, 42), 'hex');
    const charRows = await sql.unsafe(`
      SELECT "__key_bytes" FROM "${mudSchema}"."${charactersTable}"
      WHERE substring("__key_bytes" from 1 for 20) = $1 LIMIT 1
    `, [walletBytes]);
    if (charRows.length === 0) return false;

    // Check if that character is in the guild
    const rows = await sql.unsafe(`
      SELECT "guild_id" FROM "${mudSchema}"."${memberTable}"
      WHERE "__key_bytes" = $1 LIMIT 1
    `, [charRows[0].__key_bytes]);
    if (rows.length === 0) return false;

    // Parse the guild_id and compare
    const memberGuildId = String(rows[0].guild_id);
    return memberGuildId === guildId;
  } catch (err) {
    console.error('[chat] Guild membership check failed:', err);
    return false;
  }
}

export type ChatHandler = {
  handleSend(client: ChatClient, msg: Extract<ClientMessage, { type: 'chat:send' }>): Promise<void>;
  handleHistory(client: ChatClient, msg: Extract<ClientMessage, { type: 'chat:history' }>): Promise<void>;
  handleJoin(client: ChatClient, msg: Extract<ClientMessage, { type: 'chat:join' }>): Promise<void>;
  handleLeave(client: ChatClient, msg: Extract<ClientMessage, { type: 'chat:leave' }>): void;
};

export function createChatHandler(broadcaster: Broadcaster, syncHandle: SyncHandle): ChatHandler {
  const rateLimits = new Map<string, RateBucket>();

  function checkRateLimit(address: string): boolean {
    const now = Date.now();
    let bucket = rateLimits.get(address);
    if (!bucket) {
      bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now };
      rateLimits.set(address, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillTokens = Math.floor(elapsed / RATE_LIMIT_REFILL_MS);
    if (refillTokens > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) return false;
    bucket.tokens--;
    return true;
  }

  // Periodically clean up stale rate limit entries (every 5 minutes)
  // .unref() prevents this interval from blocking process shutdown
  setInterval(() => {
    const now = Date.now();
    for (const [address, bucket] of rateLimits) {
      if (now - bucket.lastRefill > 60_000) {
        rateLimits.delete(address);
      }
    }
  }, 5 * 60_000).unref();

  return {
    async handleSend(client, msg) {
      const { channel, content, senderAddress } = msg;

      // Validate channel name
      if (!channel || typeof channel !== 'string') {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'invalid_channel', message: 'Invalid channel' });
        return;
      }
      if (channel !== 'global' && !/^guild:0x[0-9a-fA-F]{1,64}$/.test(channel)) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'invalid_channel', message: 'Invalid channel' });
        return;
      }

      // Validate content
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'invalid_content', message: 'Message cannot be empty' });
        return;
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'content_too_long', message: `Message exceeds ${MAX_CONTENT_LENGTH} characters` });
        return;
      }

      // Establish identity on first send, then use server-verified address
      const charactersTable = syncHandle.tableNameMap.get('Characters');
      if (!charactersTable) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'server_error', message: 'Server not ready' });
        return;
      }

      // First message establishes identity; subsequent messages use the stored address
      const walletAddr = client.walletAddress || senderAddress?.toLowerCase();
      if (!walletAddr || typeof walletAddr !== 'string' || !walletAddr.startsWith('0x')) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'no_identity', message: 'Invalid sender address' });
        return;
      }

      const charInfo = await resolveCharacter(walletAddr, charactersTable);
      if (!charInfo) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'no_character', message: 'You need a character to chat' });
        return;
      }

      // Lock identity to this client after first successful resolution
      if (!client.walletAddress) {
        client.walletAddress = walletAddr;
      }

      // Rate limit on server-verified address (not client-provided)
      if (!checkRateLimit(client.walletAddress)) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'rate_limited', message: 'Slow down' });
        return;
      }

      // Guild channel auth
      if (channel.startsWith('guild:')) {
        const guildId = channel.slice(6);
        const isMember = await isGuildMember(client.walletAddress, guildId, syncHandle);
        if (!isMember) {
          broadcaster.sendToClient(client, { type: 'chat:error', code: 'not_in_guild', message: 'You are not a member of this guild' });
          return;
        }
      }

      // Check mute BEFORE persisting — muted messages are not stored
      const muted = await isMuted(client.walletAddress);

      const timestamp = Date.now();
      const trimmedContent = content.trim();

      if (muted) {
        // Shadow mute: send a fake message back to the sender only (no persist, no broadcast)
        broadcaster.sendToClient(client, {
          type: 'chat:message',
          message: {
            id: crypto.randomUUID(),
            channel: channel as ChatChannel,
            senderAddress: client.walletAddress,
            senderName: charInfo.name,
            senderCharacterId: charInfo.characterId,
            content: trimmedContent,
            timestamp,
          },
        });
        return;
      }

      // Persist and broadcast — use server-verified identity, not client-provided
      let id: string;
      try {
        id = await persistChatMessage({
          channel,
          senderAddress: client.walletAddress,
          senderName: charInfo.name,
          senderCharacterId: charInfo.characterId,
          content: trimmedContent,
          timestamp,
        });
      } catch (err) {
        console.error('[chat] Failed to persist message:', err);
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'server_error', message: 'Failed to send message' });
        return;
      }

      broadcaster.broadcastToChannel(channel, {
        type: 'chat:message',
        message: {
          id,
          channel: channel as ChatChannel,
          senderAddress: client.walletAddress,
          senderName: charInfo.name,
          senderCharacterId: charInfo.characterId,
          content: trimmedContent,
          timestamp,
        },
      });
    },

    async handleHistory(client, msg) {
      const { channel, before } = msg;

      // Guild channels require membership (must have joined the channel)
      if (typeof channel === 'string' && channel.startsWith('guild:') && !client.chatChannels.has(channel)) {
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'not_in_guild', message: 'Join the guild channel first' });
        return;
      }

      try {
        const messages = await loadChatHistory(channel, 50, before);
        broadcaster.sendToClient(client, { type: 'chat:history', channel: channel as ChatChannel, messages });
      } catch (err) {
        console.error('[chat] History load failed:', err);
        broadcaster.sendToClient(client, { type: 'chat:error', code: 'history_failed', message: 'Failed to load history' });
      }
    },

    async handleJoin(client, msg) {
      const { channel } = msg;

      // Global is always joined
      if (channel === 'global') {
        client.chatChannels.add(channel);
        return;
      }

      // Guild channel: verify membership
      if (channel.startsWith('guild:')) {
        if (!client.walletAddress) {
          broadcaster.sendToClient(client, { type: 'chat:error', code: 'no_identity', message: 'Send a message first to establish identity' });
          return;
        }
        const guildId = channel.slice(6);
        const isMember = await isGuildMember(client.walletAddress, guildId, syncHandle);
        if (!isMember) {
          broadcaster.sendToClient(client, { type: 'chat:error', code: 'not_in_guild', message: 'You are not a member of this guild' });
          return;
        }
        client.chatChannels.add(channel);
      }
    },

    handleLeave(client, msg) {
      const { channel } = msg;
      // Don't allow leaving global
      if (channel !== 'global') {
        client.chatChannels.delete(channel);
      }
    },
  };
}
