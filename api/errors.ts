function setCors(res: any): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default function handler(req: any, res: any) {
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

    const tagged = errors.map((entry: any) => ({ _tag: "CLIENT_ERROR", ...entry }));

    for (const entry of tagged) {
      console.log(JSON.stringify(entry));
    }

    const forwardUrl = process.env.TELEMETRY_FORWARD_URL;
    if (forwardUrl) {
      fetch(forwardUrl + "/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errors: tagged }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: "Invalid request body" });
  }
}
