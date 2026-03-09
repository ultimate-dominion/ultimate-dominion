import { Router } from 'express';
import { getMonitorStatus } from '../monitor/monitor.js';
import { config } from '../config.js';

export function createDashboardRouter(): Router {
  const router = Router();

  // Dashboard requires API key (exposes infrastructure details)
  router.use((req, res, next) => {
    const apiKey = (req.headers['x-api-key'] as string) || req.query.key as string;
    if (!config.auth.apiKey || apiKey !== config.auth.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  router.get('/', (_req, res) => {
    const status = getMonitorStatus();
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(status));
  });

  // JSON data endpoint for auto-refresh
  router.get('/data', (_req, res) => {
    res.json(getMonitorStatus());
  });

  return router;
}

interface ServiceData {
  status: string;
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
  uptimePercent: number;
  lastChange: string;
}

function statusColor(status: string): string {
  switch (status) {
    case 'up': return '#22c55e';
    case 'degraded': return '#eab308';
    case 'down': return '#ef4444';
    default: return '#6b7280';
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'up': return '&#x25CF;'; // filled circle
    case 'degraded': return '&#x25B2;'; // triangle
    case 'down': return '&#x25CF;'; // filled circle (red)
    default: return '&#x25CB;'; // empty circle
  }
}

function overallLabel(status: string): string {
  switch (status) {
    case 'up': return 'ALL SYSTEMS OPERATIONAL';
    case 'degraded': return 'PARTIAL DEGRADATION';
    case 'down': return 'SERVICE DISRUPTION';
    default: return 'CHECKING...';
  }
}

function serviceLabel(name: string): string {
  const labels: Record<string, string> = {
    'base-node': 'BASE NODE',
    'relayer': 'RELAYER',
    'indexer': 'INDEXER',
    'client-prod': 'PROD CLIENT',
    'client-beta': 'BETA CLIENT',
    'api': 'API',
  };
  return labels[name] || name.toUpperCase();
}

function formatDetail(name: string, svc: ServiceData): string {
  const d = svc.details || {};
  const lines: string[] = [];

  switch (name) {
    case 'base-node': {
      if (d.blockLag !== undefined) lines.push(`Lag: ${d.blockLag} blocks`);
      const rm = d.rethMetrics as { memoryMb?: number; activeConnections?: number; peers?: number; dbReadTxOpen?: number } | undefined;
      if (rm) {
        if (rm.memoryMb !== null && rm.memoryMb !== undefined) lines.push(`Mem: ${(rm.memoryMb / 1000).toFixed(1)}G`);
        if (rm.peers !== null && rm.peers !== undefined) lines.push(`Peers: ${rm.peers}`);
        if (rm.activeConnections !== null && rm.activeConnections !== undefined) lines.push(`Conns: ${rm.activeConnections}`);
      }
      break;
    }
    case 'relayer':
      if (d.poolSize !== undefined) lines.push(`Pool: ${d.poolSize}`);
      if (d.totalInflight !== undefined) lines.push(`Inflight: ${d.totalInflight}`);
      if (d.lowBalanceWallets) lines.push(`Low bal: ${d.lowBalanceWallets}`);
      break;
    case 'indexer':
      if (d.lag !== undefined) lines.push(`Lag: ${d.lag}`);
      if (d.wsClients !== undefined) lines.push(`WS: ${d.wsClients}`);
      break;
    default:
      break;
  }

  return lines.join(' &middot; ');
}

function sparkline(services: Record<string, ServiceData>, name: string): string {
  // We don't have history in the status endpoint, so show uptime bar
  const svc = services[name];
  if (!svc) return '';
  const pct = svc.uptimePercent ?? 100;
  const color = pct >= 99 ? '#22c55e' : pct >= 90 ? '#eab308' : '#ef4444';
  return `<div style="display:flex;align-items:center;gap:6px;margin-top:8px">
    <div style="flex:1;height:4px;background:#374151;border-radius:2px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:2px"></div>
    </div>
    <span style="font-size:11px;color:${color}">${pct}%</span>
  </div>`;
}

function renderServiceCard(name: string, svc: ServiceData, allServices: Record<string, ServiceData>): string {
  const color = statusColor(svc.status);
  const latency = svc.latencyMs > 0 ? `${svc.latencyMs}ms` : '--';
  const detail = formatDetail(name, svc);
  const error = svc.error ? `<div style="font-size:11px;color:#f87171;margin-top:4px;word-break:break-word">${escapeHtml(svc.error)}</div>` : '';

  return `<div style="background:#1f2937;border:1px solid #374151;border-radius:8px;padding:16px;min-width:180px;flex:1">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:12px;font-weight:600;letter-spacing:0.05em;color:#9ca3af">${serviceLabel(name)}</span>
      <span style="color:${color};font-size:18px">${statusIcon(svc.status)}</span>
    </div>
    <div style="font-size:20px;font-weight:700;color:${color}">${svc.status.toUpperCase()}</div>
    <div style="font-size:13px;color:#9ca3af;margin-top:4px">${latency}</div>
    ${detail ? `<div style="font-size:12px;color:#d1d5db;margin-top:6px">${detail}</div>` : ''}
    ${error}
    ${sparkline(allServices, name)}
  </div>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderDashboard(status: Record<string, unknown>): string {
  const overallStatus = (status.overallStatus as string) || 'unknown';
  const services = (status.services || {}) as Record<string, ServiceData>;
  const checkedAt = status.checkedAt as string;

  const ago = checkedAt ? Math.round((Date.now() - new Date(checkedAt).getTime()) / 1000) : 0;
  const agoText = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;

  const serviceOrder: string[] = ['base-node', 'relayer', 'indexer', 'client-prod', 'client-beta', 'api'];
  const topRow = serviceOrder.slice(0, 3);
  const bottomRow = serviceOrder.slice(3);

  const topCards = topRow
    .filter(name => services[name])
    .map(name => renderServiceCard(name, services[name], services))
    .join('');

  const bottomCards = bottomRow
    .filter(name => services[name])
    .map(name => renderServiceCard(name, services[name], services))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>UD Infrastructure</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111827; color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; min-height: 100vh; }
    .container { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    .header { text-align: center; margin-bottom: 32px; }
    .title { font-size: 16px; font-weight: 600; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; }
    .overall { font-size: 14px; margin-top: 12px; font-weight: 600; }
    .meta { font-size: 12px; color: #6b7280; margin-top: 8px; }
    .grid { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .grid > div { min-width: 0; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #4b5563; }
    @media (max-width: 600px) { .grid { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">Ultimate Dominion &mdash; Infrastructure</div>
      <div class="overall" style="color:${statusColor(overallStatus)}">
        ${statusIcon(overallStatus)} ${overallLabel(overallStatus)}
      </div>
      <div class="meta">Last check: <span id="ago">${agoText}</span> &middot; Auto-refresh: 30s</div>
    </div>
    <div class="grid" id="top-row">${topCards}</div>
    <div class="grid" id="bottom-row">${bottomCards}</div>
    <div class="footer">Powered by UD Indexer Monitor</div>
  </div>
  <script>
    async function refresh() {
      try {
        const res = await fetch('/dashboard/data');
        if (!res.ok) return;
        // Full page refresh is simplest — server renders HTML
        location.reload();
      } catch {}
    }
    setInterval(refresh, 30000);

    // Update "ago" counter every second
    const checkedAt = ${checkedAt ? `new Date("${checkedAt}").getTime()` : 'Date.now()'};
    setInterval(() => {
      const s = Math.round((Date.now() - checkedAt) / 1000);
      const el = document.getElementById('ago');
      if (el) el.textContent = s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago';
    }, 1000);
  </script>
</body>
</html>`;
}
