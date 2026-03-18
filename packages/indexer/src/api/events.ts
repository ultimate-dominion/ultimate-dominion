import { Router } from 'express';
import { getRecentEvents } from '../queue/eventFeed.js';

export function createEventsRouter(): Router {
  const router = Router();

  // GET /api/events — return buffered recent game events
  // Optional ?since=<timestamp_ms> to filter
  router.get('/', (_req, res) => {
    const since = Number(_req.query.since) || 0;
    const events = since > 0
      ? getRecentEvents().filter(e => e.timestamp > since)
      : getRecentEvents();
    res.json(events);
  });

  return router;
}
