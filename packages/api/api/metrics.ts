/**
 * POST /api/metrics — Client performance metrics ingestion.
 * Receives batched metrics and logs structured JSON to stdout
 * for collection by the server-side metrics aggregator.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";

interface MetricEntry {
  type: string;
  name?: string;
  value: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

// Simple rate limit: 20 req/min per IP (metrics flush less often than errors)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 20;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<unknown>;
export default async function handler(req: Request, res: Response): Promise<unknown>;
export default async function handler(req: VercelRequest | Request, res: VercelResponse | Response) {
  const request = req as VercelRequest & Request;
  const response = res as VercelResponse & Response;
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const forwardedFor = request.headers["x-forwarded-for"];
  const realIp = request.headers["x-real-ip"];
  const ip =
    (typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : forwardedFor?.[0]) ||
    (typeof realIp === "string" ? realIp : realIp?.[0]) ||
    "unknown";
  if (isRateLimited(ip)) {
    return response.status(429).json({ error: 'Rate limited' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body?.metrics?.length) {
      return response.status(400).json({ error: 'No metrics in payload' });
    }

    const metrics: MetricEntry[] = body.metrics.slice(0, 100);

    for (const m of metrics) {
      console.log(
        JSON.stringify({
          _tag: 'CLIENT_METRIC',
          type: m.type,
          name: m.name,
          value: m.value,
          timestamp: m.timestamp,
          meta: m.meta,
        }),
      );
    }

    return response.status(200).json({ received: metrics.length });
  } catch {
    return response.status(400).json({ error: 'Invalid payload' });
  }
}
