function setCors(res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  setCors(res);

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

    const tagged = metrics.map((entry: any) => ({ _tag: "CLIENT_METRIC", ...entry }));

    for (const entry of tagged) {
      console.log(JSON.stringify(entry));
    }

    const forwardUrl = process.env.TELEMETRY_FORWARD_URL;
    if (forwardUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        await fetch(forwardUrl + "/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metrics: tagged }),
          signal: controller.signal,
        });
      } catch {
        // Forward failed or timed out — non-fatal
      } finally {
        clearTimeout(timeout);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: "Invalid request body" });
  }
}
