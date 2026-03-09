import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_ORIGINS = [
  "https://ultimatedominion.com",
  "https://beta.ultimatedominion.com",
  "https://www.ultimatedominion.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const metrics = req.body?.metrics;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({ error: "Missing or empty metrics array" });
    }

    for (const entry of metrics) {
      console.log(JSON.stringify({ _tag: "CLIENT_METRIC", ...entry }));
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: "Invalid request body" });
  }
}
