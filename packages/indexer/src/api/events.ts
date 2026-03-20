import { Router } from 'express';
import { loadRecentEvents } from '../db/eventStore.js';
import { getRecentEvents } from '../queue/eventFeed.js';

export function createEventsRouter(): Router {
  const router = Router();

  // GET /api/events — return game events from persistent store
  // Query params:
  //   ?limit=N          — number of events (default 50, max 200)
  //   ?before=<ts_ms>   — events before this timestamp (cursor pagination)
  //   ?since=<ts_ms>    — events after this timestamp (live catch-up)
  router.get('/', async (_req, res) => {
    try {
      const limit = Math.min(Math.max(Number(_req.query.limit) || 50, 1), 200);
      const before = Number(_req.query.before) || undefined;
      const since = Number(_req.query.since) || undefined;

      const events = await loadRecentEvents(limit, {
        beforeTimestamp: before,
        sinceTimestamp: since,
      });
      res.json(events);
    } catch (err) {
      // Fallback to in-memory buffer if DB query fails
      console.error('[events] DB query failed, falling back to buffer:', err);
      const since = Number(_req.query.since) || 0;
      const events = since > 0
        ? getRecentEvents().filter(e => e.timestamp > since)
        : getRecentEvents();
      res.json(events);
    }
  });

  return router;
}
