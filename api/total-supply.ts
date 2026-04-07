import type { VercelRequest, VercelResponse } from "@vercel/node";

const GOLD_TOKEN = "0x0F046E538926760A737761b555fe1074b6B1e16A";
const RPC_URL = process.env.RPC_HTTP_URL || "https://rpc.ultimatedominion.com";

// ERC20 totalSupply() selector
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: GOLD_TOKEN, data: TOTAL_SUPPLY_SELECTOR }, "latest"],
      }),
    });

    const json = await response.json();
    const rawHex = json.result as string;
    const totalWei = BigInt(rawHex);
    const totalGold = Number(totalWei / BigInt(1e18));

    // CoinGecko expects plain number, no JSON wrapper
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(totalGold.toString());
  } catch {
    return res.status(500).send("Error fetching total supply");
  }
}
