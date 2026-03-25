/**
 * Hourly gas breakdown: UD % of chain gas over time
 * Shows when UD is punching above its weight
 */

const RPC_URL =
  "https://rpc.ultimatedominion.com?token=3ca953991fbc6a82091005c394d033ce853f3d9807f2366bc1496dad234c57af";
const WORLD_ADDRESS = "0x99d01939F58B965E6E84a1D167E710Abdf5764b0".toLowerCase();
const DEPLOY_BLOCK = 43_183_002n;
const BLOCKS_PER_HOUR = 1800n; // ~2s per block

const BLOCK_BATCH_SIZE = 500;
const LOG_BATCH_SIZE = 50_000;
const RECEIPT_BATCH_SIZE = 200;
const CONCURRENCY = 10;

function toHex(n: bigint): string {
  return "0x" + n.toString(16);
}

async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
  const body = calls.map((c, i) => ({
    jsonrpc: "2.0",
    method: c.method,
    params: c.params,
    id: i,
  }));
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC batch failed: ${res.status}`);
  const results = (await res.json()) as any[];
  results.sort((a: any, b: any) => a.id - b.id);
  return results.map((r: any) => r.result);
}

// Get all UD tx hashes with their block numbers
async function getUDTxsByBlock(
  fromBlock: bigint,
  toBlock: bigint
): Promise<Map<bigint, Set<string>>> {
  const txsByBlock = new Map<bigint, Set<string>>();

  for (let b = fromBlock; b <= toBlock; b += BigInt(LOG_BATCH_SIZE)) {
    const end = b + BigInt(LOG_BATCH_SIZE) - 1n > toBlock ? toBlock : b + BigInt(LOG_BATCH_SIZE) - 1n;
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [{ fromBlock: toHex(b), toBlock: toHex(end), address: WORLD_ADDRESS }],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data.result) {
      for (const log of data.result) {
        const blockNum = BigInt(log.blockNumber);
        if (!txsByBlock.has(blockNum)) txsByBlock.set(blockNum, new Set());
        txsByBlock.get(blockNum)!.add(log.transactionHash);
      }
    }
    process.stdout.write(`\r  Logs: scanned to block ${end}`);
  }
  console.log();
  return txsByBlock;
}

// Get gas for a set of tx hashes
async function getTxGas(hashes: string[]): Promise<Map<string, bigint>> {
  const gasMap = new Map<string, bigint>();
  const batches: string[][] = [];
  for (let i = 0; i < hashes.length; i += RECEIPT_BATCH_SIZE) {
    batches.push(hashes.slice(i, i + RECEIPT_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (batch) => {
      const calls = batch.map((hash) => ({
        method: "eth_getTransactionReceipt",
        params: [hash],
      }));
      const results = await rpcBatch(calls);
      for (const receipt of results) {
        if (receipt) {
          gasMap.set(receipt.transactionHash, BigInt(receipt.gasUsed));
        }
      }
    });
    await Promise.all(promises);
    process.stdout.write(`\r  Receipts: ${gasMap.size}/${hashes.length}`);
  }
  console.log();
  return gasMap;
}

// Get block gasUsed for a range
async function getBlockGas(
  fromBlock: bigint,
  toBlock: bigint
): Promise<Map<bigint, bigint>> {
  const gasMap = new Map<bigint, bigint>();
  const batches: bigint[][] = [];

  for (let b = fromBlock; b <= toBlock; b += BigInt(BLOCK_BATCH_SIZE)) {
    const end = b + BigInt(BLOCK_BATCH_SIZE) - 1n > toBlock ? toBlock : b + BigInt(BLOCK_BATCH_SIZE) - 1n;
    const range: bigint[] = [];
    for (let i = b; i <= end; i++) range.push(i);
    batches.push(range);
  }

  let done = 0;
  const total = Number(toBlock - fromBlock + 1n);

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (blockNums) => {
      const calls = blockNums.map((bn) => ({
        method: "eth_getBlockByNumber",
        params: [toHex(bn), false],
      }));
      const results = await rpcBatch(calls);
      for (let j = 0; j < results.length; j++) {
        if (results[j]) {
          gasMap.set(blockNums[j], BigInt(results[j].gasUsed));
        }
      }
    });
    await Promise.all(promises);
    done += chunk.reduce((s, b) => s + b.length, 0);
    process.stdout.write(`\r  Blocks: ${done.toLocaleString()}/${total.toLocaleString()} (${((done / total) * 100).toFixed(1)}%)`);
  }
  console.log();
  return gasMap;
}

interface HourBucket {
  hour: number;
  fromBlock: bigint;
  toBlock: bigint;
  udGas: bigint;
  udTxCount: number;
  chainGas: bigint;
  pct: number;
}

async function main() {
  console.log("Hourly Gas Analysis: UD vs Base Chain\n");

  const currentBlock = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
  })
    .then((r) => r.json())
    .then((r: any) => BigInt(r.result));

  const fromBlock = DEPLOY_BLOCK;
  const totalBlocks = currentBlock - fromBlock;
  const totalHours = Number(totalBlocks / BLOCKS_PER_HOUR);

  console.log(`Block range: ${fromBlock} → ${currentBlock} (~${totalHours} hours since launch)`);

  // Step 1: Get all UD txs grouped by block
  console.log("\n[1/3] Finding UD transactions by block...");
  const txsByBlock = await getUDTxsByBlock(fromBlock, currentBlock);
  const allTxHashes = new Set<string>();
  for (const txs of txsByBlock.values()) {
    for (const tx of txs) allTxHashes.add(tx);
  }
  console.log(`  Total unique UD txs: ${allTxHashes.size}`);

  // Step 2: Get gas for all UD txs
  console.log("\n[2/3] Fetching UD transaction gas...");
  const txGasMap = await getTxGas(Array.from(allTxHashes));

  // Step 3: Get chain gas for all blocks
  console.log("\n[3/3] Fetching chain-wide block gas...");
  const blockGasMap = await getBlockGas(fromBlock, currentBlock);

  // Bucket into hours
  const buckets: HourBucket[] = [];
  for (let h = 0; h < totalHours; h++) {
    const hFrom = fromBlock + BigInt(h) * BLOCKS_PER_HOUR;
    const hTo = hFrom + BLOCKS_PER_HOUR - 1n > currentBlock ? currentBlock : hFrom + BLOCKS_PER_HOUR - 1n;

    let udGas = 0n;
    let udTxCount = 0;
    let chainGas = 0n;

    for (let b = hFrom; b <= hTo; b++) {
      chainGas += blockGasMap.get(b) || 0n;
      const txs = txsByBlock.get(b);
      if (txs) {
        for (const txHash of txs) {
          const gas = txGasMap.get(txHash);
          if (gas) {
            udGas += gas;
            udTxCount++;
          }
        }
      }
    }

    const pct = chainGas > 0n ? Number((udGas * 1_000_000n) / chainGas) / 10_000 : 0;
    buckets.push({ hour: h, fromBlock: hFrom, toBlock: hTo, udGas, udTxCount, chainGas, pct });
  }

  // Find peaks
  const sorted = [...buckets].filter(b => b.udTxCount > 0).sort((a, b) => b.pct - a.pct);
  const top10 = sorted.slice(0, 10);

  // Print full timeline
  console.log("\n=== HOURLY TIMELINE (hours with UD activity) ===");
  console.log("Hour | UD Txs | UD Gas | Chain Gas | UD % | Bar");
  console.log("-----|--------|--------|-----------|------|----");

  const maxPct = Math.max(...buckets.map(b => b.pct));
  const barScale = maxPct > 0 ? 40 / maxPct : 1;

  for (const b of buckets) {
    if (b.udTxCount === 0 && b.chainGas === 0n) continue;
    const bar = b.pct > 0 ? "#".repeat(Math.max(1, Math.round(b.pct * barScale))) : "";
    const date = new Date(Date.now() - (buckets.length - b.hour) * 3600_000);
    const dateStr = date.toISOString().slice(5, 16).replace("T", " ");
    console.log(
      `${dateStr} | ${String(b.udTxCount).padStart(6)} | ${(Number(b.udGas) / 1e6).toFixed(0).padStart(6)}M | ${(Number(b.chainGas) / 1e9).toFixed(1).padStart(8)}B | ${b.pct.toFixed(3).padStart(6)}% | ${bar}`
    );
  }

  // Summary
  console.log("\n=== TOP 10 PEAK HOURS ===");
  console.log("Hour | UD Txs | UD % of Chain | Date (approx)");
  console.log("-----|--------|---------------|---------------");
  for (const b of top10) {
    const date = new Date(Date.now() - (buckets.length - b.hour) * 3600_000);
    const dateStr = date.toISOString().slice(0, 16).replace("T", " ");
    console.log(
      `${String(b.hour).padStart(4)} | ${String(b.udTxCount).padStart(6)} | ${b.pct.toFixed(4).padStart(12)}% | ${dateStr}`
    );
  }

  // Daily aggregates
  console.log("\n=== DAILY SUMMARY ===");
  console.log("Day | UD Txs | UD Gas (M) | Chain Gas (B) | UD %");
  console.log("----|--------|------------|---------------|------");
  for (let d = 0; d < Math.ceil(totalHours / 24); d++) {
    const dayBuckets = buckets.slice(d * 24, (d + 1) * 24);
    const udGas = dayBuckets.reduce((s, b) => s + b.udGas, 0n);
    const chainGas = dayBuckets.reduce((s, b) => s + b.chainGas, 0n);
    const txCount = dayBuckets.reduce((s, b) => s + b.udTxCount, 0);
    const pct = chainGas > 0n ? Number((udGas * 1_000_000n) / chainGas) / 10_000 : 0;
    const date = new Date(Date.now() - (Math.ceil(totalHours / 24) - d) * 86400_000);
    const dateStr = date.toISOString().slice(0, 10);
    console.log(
      `${dateStr} | ${String(txCount).padStart(6)} | ${(Number(udGas) / 1e6).toFixed(0).padStart(10)} | ${(Number(chainGas) / 1e9).toFixed(1).padStart(13)} | ${pct.toFixed(4)}%`
    );
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
