import type { VercelRequest, VercelResponse } from "@vercel/node";

const GOLD_TOKEN = "0x0F046E538926760A737761b555fe1074b6B1e16A";
const RPC_URL = process.env.RPC_HTTP_URL || "https://rpc.ultimatedominion.com";

// Team treasury wallet — excluded from circulating supply
const EXCLUDED_WALLETS = [
  "0x99d01939F58B965E6E84a1D167E710Abdf5764b0", // Production World (holds team treasury)
];

// ERC20 selectors
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const BALANCE_OF_PREFIX = "0x70a08231000000000000000000000000";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Fetch total supply
    const supplyRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: GOLD_TOKEN, data: TOTAL_SUPPLY_SELECTOR }, "latest"],
      }),
    });
    const supplyJson = await supplyRes.json();
    const totalWei = BigInt(supplyJson.result as string);

    // Fetch excluded balances
    let excludedWei = BigInt(0);
    for (const wallet of EXCLUDED_WALLETS) {
      const addr = wallet.replace("0x", "").toLowerCase();
      const balRes = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: GOLD_TOKEN, data: BALANCE_OF_PREFIX + addr }, "latest"],
        }),
      });
      const balJson = await balRes.json();
      excludedWei += BigInt(balJson.result as string);
    }

    const circulatingWei = totalWei - excludedWei;
    const circulatingGold = Number(circulatingWei / BigInt(1e18));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(circulatingGold.toString());
  } catch {
    return res.status(500).send("Error fetching circulating supply");
  }
}
