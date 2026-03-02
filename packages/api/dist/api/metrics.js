/**
 * POST /api/metrics — Client performance metrics ingestion.
 * Receives batched metrics and logs structured JSON to stdout
 * for collection by the server-side metrics aggregator.
 */
// Simple rate limit: 20 req/min per IP (metrics flush less often than errors)
const rateLimitMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
        return false;
    }
    entry.count++;
    return entry.count > 20;
}
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt)
            rateLimitMap.delete(ip);
    }
}, 300000);
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'Rate limited' });
    }
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!body?.metrics?.length) {
            return res.status(400).json({ error: 'No metrics in payload' });
        }
        const metrics = body.metrics.slice(0, 100);
        for (const m of metrics) {
            console.log(JSON.stringify({
                _tag: 'CLIENT_METRIC',
                type: m.type,
                name: m.name,
                value: m.value,
                timestamp: m.timestamp,
                meta: m.meta,
            }));
        }
        return res.status(200).json({ received: metrics.length });
    }
    catch {
        return res.status(400).json({ error: 'Invalid payload' });
    }
}
