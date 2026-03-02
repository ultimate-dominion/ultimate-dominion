/**
 * POST /api/errors — Client error ingestion endpoint.
 * Receives batched errors from the client reporter and logs them
 * to stdout (picked up by Vercel runtime logs).
 *
 * Rate limited to prevent abuse.
 */
// Simple in-memory rate limit: max 10 requests per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;
function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}
// Cleanup stale entries every 5 min
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
        if (!body?.errors?.length) {
            return res.status(400).json({ error: 'No errors in payload' });
        }
        // Cap at 50 per batch
        const errors = body.errors.slice(0, 50);
        for (const err of errors) {
            // Log with structured prefix so our collector can parse it
            console.error(JSON.stringify({
                _tag: 'CLIENT_ERROR',
                type: err.type,
                message: err.message?.slice(0, 500),
                source: err.source,
                stack: err.stack?.slice(0, 1000),
                url: err.url,
                timestamp: err.timestamp,
                meta: err.meta,
            }));
        }
        return res.status(200).json({ received: errors.length });
    }
    catch {
        return res.status(400).json({ error: 'Invalid payload' });
    }
}
