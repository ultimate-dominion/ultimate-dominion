import { Router } from 'express';
import { getMonitorStatus } from '../monitor/monitor.js';

export function createStatusRouter(): Router {
  const router = Router();

  // Full infrastructure status
  router.get('/', (_req, res) => {
    const status = getMonitorStatus();
    const code = status.overallStatus === 'down' ? 503 : 200;
    res.status(code).json(status);
  });

  // Single service detail
  router.get('/:service', (req, res) => {
    const status = getMonitorStatus();
    const services = status.services as Record<string, unknown>;
    const service = services[req.params.service];
    if (!service) {
      res.status(404).json({ error: `Unknown service: ${req.params.service}` });
      return;
    }
    res.json({ service: req.params.service, ...service as object });
  });

  return router;
}
