import type { VercelRequest, VercelResponse } from "@vercel/node";

function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const errors = req.body?.errors;

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: "Missing or empty errors array" });
    }

    for (const entry of errors) {
      console.log(JSON.stringify({ _tag: "CLIENT_ERROR", ...entry }));
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: "Invalid request body" });
  }
}
