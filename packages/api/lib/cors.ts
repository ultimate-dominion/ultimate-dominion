import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";

const ALLOWED_ORIGINS = [
  "https://ultimatedominion.com",
  "https://beta.ultimatedominion.com",
  "https://www.ultimatedominion.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

type Req = VercelRequest | Request;
type Res = VercelResponse | Response;

/**
 * Set CORS headers with origin allowlist.
 * Returns true if the request is an OPTIONS preflight (caller should return 204).
 */
export function setCors(req: Req, res: Res, methods = "GET, POST, OPTIONS"): boolean {
  const origin = (req.headers.origin as string) || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return req.method === "OPTIONS";
}
