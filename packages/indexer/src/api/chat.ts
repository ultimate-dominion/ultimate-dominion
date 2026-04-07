import { Router } from 'express';
import { config } from '../config.js';
import { loadChatHistory, listMutes, mutePlayer, unmutePlayer } from '../db/chatStore.js';

export function createChatRouter(): Router {
  const router = Router();

  // GET /api/chat/history/:channel — return chat messages for a channel
  // Query params:
  //   ?limit=N          — number of messages (default 50, max 200)
  //   ?before=<ts_ms>   — messages before this timestamp (cursor pagination)
  router.get('/history/:channel', async (req, res) => {
    try {
      const channel = decodeURIComponent(req.params.channel);

      // Guild channels require admin auth on the REST endpoint
      // (players access guild history via WS which has membership checks)
      if (channel.startsWith('guild:')) {
        const apiKey = req.headers['x-api-key'] as string;
        if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
          return res.status(403).json({ error: 'Guild history requires authentication' });
        }
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const before = Number(req.query.before) || undefined;

      const messages = await loadChatHistory(channel, limit, before);
      res.json(messages);
    } catch (err) {
      console.error('[chat] History query failed:', err);
      res.status(500).json({ error: 'Failed to load chat history' });
    }
  });

  // GET /api/chat/mutes — list active mutes (admin only)
  router.get('/mutes', (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    listMutes()
      .then(mutes => res.json(mutes))
      .catch(err => {
        console.error('[chat] List mutes failed:', err);
        res.status(500).json({ error: 'Failed to list mutes' });
      });
  });

  // POST /api/chat/mute — mute a player (admin only)
  // Body: { target: string, reason?: string, durationMinutes?: number }
  router.post('/mute', async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { target, reason, durationMinutes } = req.body;
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Missing target address' });
    }

    try {
      await mutePlayer(target, 'admin', reason, durationMinutes);
      res.json({ ok: true, target: target.toLowerCase() });
    } catch (err) {
      console.error('[chat] Mute failed:', err);
      res.status(500).json({ error: 'Failed to mute player' });
    }
  });

  // DELETE /api/chat/mute/:address — unmute a player (admin only)
  router.delete('/mute/:address', async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      await unmutePlayer(req.params.address);
      res.json({ ok: true });
    } catch (err) {
      console.error('[chat] Unmute failed:', err);
      res.status(500).json({ error: 'Failed to unmute player' });
    }
  });

  return router;
}
