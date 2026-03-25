/**
 * Gas Analysis: UD World contract vs Base chain
 * Queries every block (no sampling) for accurate picture.
 * Monitors RPC latency throughout to stress-test the node.
 */

function formatEther(wei: bigint): string {
  const str = wei.toString().padStart(19, "0");
  const whole = str.slice(0, str.length - 18) || "0";
  const frac = str.slice(str.length - 18, str.length - 12);
  return `${whole}.${frac}`;
}

const RPC_URL =
  "https://rpc.ultimatedominion.com?token=3ca953991fbc6a82091005c394d033ce853f3d9807f2366bc1496dad234c57af";
const WORLD_ADDRESS = "0x99d01939F58B965E6E84a1D167E710Abdf5764b0".toLowerCase();
const DEPLOY_BLOCK = 43_183_002n;

// Tuning — adjust if node struggles
const BLOCK_BATCH_SIZE = 500; // blocks per batch RPC call
const LOG_BATCH_SIZE = 50_000; // block range per eth_getLogs call
const RECEIPT_BATCH_SIZE = 200; // receipts per batch RPC call
const CONCURRENCY = 10; // parallel batch requests
const LATENCY_SAMPLE_INTERVAL = 50; // measure latency every N batches

interface LatencySample {
  timestamp: number;
  ms: number;
  batchType: string;
}

const latencySamples: LatencySample[] = [];

async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
  const body = calls.map((c, i) => ({
    jsonrpc: "2.0",
    method: c.method,
    params: c.params,
    id: i,
  }));

  const start = performance.now();
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`RPC batch failed: ${res.status} ${res.statusText}`);
  }

  const elapsed = performance.now() - start;
  const results = (await res.json()) as any[];
  results.sort((a: any, b: any) => a.id - b.id);

  return { results: results.map((r: any) => r.result), elapsed } as any;
}

function toHex(n: bigint): string {
  return "0x" + n.toString(16);
}

async function measureLatency(): Promise<number> {
  const start = performance.now();
  await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      id: 1,
    }),
  });
  return performance.now() - start;
}

async function getBlockGasUsed(
  fromBlock: bigint,
  toBlock: bigint,
  onProgress: (done: number, total: number) => void
): Promise<{ totalGas: bigint; blockCount: number }> {
  let totalGas = 0n;
  let blockCount = 0;
  const total = Number(toBlock - fromBlock + 1n);

  // Build all batch requests
  const batches: bigint[][] = [];
  for (let b = fromBlock; b <= toBlock; b += BigInt(BLOCK_BATCH_SIZE)) {
    const end = b + BigInt(BLOCK_BATCH_SIZE) - 1n > toBlock ? toBlock : b + BigInt(BLOCK_BATCH_SIZE) - 1n;
    const range: bigint[] = [];
    for (let i = b; i <= end; i++) range.push(i);
    batches.push(range);
  }

  let batchesDone = 0;
  // Process with concurrency limit
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (blockNums) => {
      const calls = blockNums.map((bn) => ({
        method: "eth_getBlockByNumber",
        params: [toHex(bn), false],
      }));
      const { results, elapsed } = (await rpcBatch(calls)) as any;

      if (batchesDone % LATENCY_SAMPLE_INTERVAL === 0) {
        latencySamples.push({
          timestamp: Date.now(),
          ms: elapsed,
          batchType: `block_batch_${calls.length}`,
        });
      }

      let gas = 0n;
      let count = 0;
      for (const block of results) {
        if (block && block.gasUsed) {
          gas += BigInt(block.gasUsed);
          count++;
        }
      }
      return { gas, count };
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      totalGas += r.gas;
      blockCount += r.count;
    }
    batchesDone += chunk.length;
    onProgress(blockCount, total);
  }

  return { totalGas, blockCount };
}

async function getUDTransactions(
  fromBlock: bigint,
  toBlock: bigint
): Promise<Set<string>> {
  const txHashes = new Set<string>();
  console.log(`  Fetching logs from block ${fromBlock} to ${toBlock}...`);

  for (let b = fromBlock; b <= toBlock; b += BigInt(LOG_BATCH_SIZE)) {
    const end =
      b + BigInt(LOG_BATCH_SIZE) - 1n > toBlock
        ? toBlock
        : b + BigInt(LOG_BATCH_SIZE) - 1n;

    const start = performance.now();
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            fromBlock: toHex(b),
            toBlock: toHex(end),
            address: WORLD_ADDRESS,
          },
        ],
        id: 1,
      }),
    });

    const elapsed = performance.now() - start;
    latencySamples.push({
      timestamp: Date.now(),
      ms: elapsed,
      batchType: `logs_${Number(end - b + 1n)}_blocks`,
    });

    const data = await res.json();
    if (data.result) {
      for (const log of data.result) {
        if (log.transactionHash) {
          txHashes.add(log.transactionHash);
        }
      }
    }
    console.log(
      `  Logs: blocks ${b}-${end} → ${txHashes.size} unique txs so far (${elapsed.toFixed(0)}ms)`
    );
  }

  return txHashes;
}

async function getTransactionGas(
  txHashes: Set<string>
): Promise<{ totalGas: bigint; totalFee: bigint; txCount: number }> {
  const hashes = Array.from(txHashes);
  let totalGas = 0n;
  let totalFee = 0n;
  let txCount = 0;

  const batches: string[][] = [];
  for (let i = 0; i < hashes.length; i += RECEIPT_BATCH_SIZE) {
    batches.push(hashes.slice(i, i + RECEIPT_BATCH_SIZE));
  }

  console.log(
    `  Fetching ${hashes.length} receipts in ${batches.length} batches...`
  );

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (batch) => {
      const calls = batch.map((hash) => ({
        method: "eth_getTransactionReceipt",
        params: [hash],
      }));
      const { results, elapsed } = (await rpcBatch(calls)) as any;

      latencySamples.push({
        timestamp: Date.now(),
        ms: elapsed,
        batchType: `receipt_batch_${calls.length}`,
      });

      let gas = 0n;
      let fee = 0n;
      let count = 0;
      for (const receipt of results) {
        if (receipt) {
          const gasUsed = BigInt(receipt.gasUsed);
          const effectiveGasPrice = BigInt(receipt.effectiveGasPrice || "0x0");
          gas += gasUsed;
          fee += gasUsed * effectiveGasPrice;
          count++;
        }
      }
      return { gas, fee, count };
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      totalGas += r.gas;
      totalFee += r.fee;
      txCount += r.count;
    }
    process.stdout.write(
      `\r  Receipts: ${txCount}/${hashes.length} processed`
    );
  }
  console.log();

  return { totalGas, totalFee, txCount };
}

function printLatencyReport() {
  if (latencySamples.length === 0) return;

  const sorted = [...latencySamples].sort((a, b) => a.ms - b.ms);
  const p50 = sorted[Math.floor(sorted.length * 0.5)].ms;
  const p95 = sorted[Math.floor(sorted.length * 0.95)].ms;
  const p99 = sorted[Math.floor(sorted.length * 0.99)].ms;
  const max = sorted[sorted.length - 1].ms;
  const avg =
    latencySamples.reduce((s, l) => s + l.ms, 0) / latencySamples.length;

  console.log("\n=== RPC NODE LATENCY REPORT ===");
  console.log(`Total requests sampled: ${latencySamples.length}`);
  console.log(`Avg: ${avg.toFixed(0)}ms | P50: ${p50.toFixed(0)}ms | P95: ${p95.toFixed(0)}ms | P99: ${p99.toFixed(0)}ms | Max: ${max.toFixed(0)}ms`);

  // Check for degradation over time
  const firstQuarter = latencySamples.slice(0, Math.floor(latencySamples.length / 4));
  const lastQuarter = latencySamples.slice(Math.floor((latencySamples.length * 3) / 4));
  const avgFirst = firstQuarter.reduce((s, l) => s + l.ms, 0) / firstQuarter.length;
  const avgLast = lastQuarter.reduce((s, l) => s + l.ms, 0) / lastQuarter.length;

  console.log(`First quarter avg: ${avgFirst.toFixed(0)}ms | Last quarter avg: ${avgLast.toFixed(0)}ms`);
  if (avgLast > avgFirst * 1.5) {
    console.log("⚠ DEGRADATION DETECTED: latency increased >50% over the run");
  } else {
    console.log("✓ No significant latency degradation detected");
  }
}

async function analyzeRange(label: string, fromBlock: bigint, toBlock: bigint) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label}: blocks ${fromBlock} → ${toBlock} (${Number(toBlock - fromBlock + 1n).toLocaleString()} blocks)`);
  console.log("=".repeat(60));

  // 1. Get UD transactions
  console.log("\n[1/3] Finding UD World transactions...");
  const txHashes = await getUDTransactions(fromBlock, toBlock);
  console.log(`  Found ${txHashes.size} unique UD transactions`);

  // 2. Get UD gas details
  console.log("\n[2/3] Fetching UD transaction receipts...");
  const udGas = await getTransactionGas(txHashes);

  // 3. Get chain-wide gas
  console.log("\n[3/3] Fetching chain-wide block gas...");
  const chainGas = await getBlockGasUsed(fromBlock, toBlock, (done, total) => {
    process.stdout.write(
      `\r  Blocks: ${done.toLocaleString()}/${total.toLocaleString()} (${((done / total) * 100).toFixed(1)}%)`
    );
  });
  console.log();

  // Results
  const pct =
    chainGas.totalGas > 0n
      ? (Number((udGas.totalGas * 10000n) / chainGas.totalGas) / 100).toFixed(4)
      : "N/A";

  const blockRange = Number(toBlock - fromBlock + 1n);
  const seconds = blockRange * 2; // ~2s per block on Base
  const hours = seconds / 3600;

  console.log(`\n--- ${label} Results ---`);
  console.log(`Time span: ~${hours.toFixed(1)} hours`);
  console.log(`UD transactions: ${udGas.txCount.toLocaleString()}`);
  console.log(`UD gas used: ${udGas.totalGas.toLocaleString()}`);
  console.log(`UD gas cost: ${formatEther(udGas.totalFee)} ETH`);
  console.log(`UD avg gas/tx: ${udGas.txCount > 0 ? (udGas.totalGas / BigInt(udGas.txCount)).toLocaleString() : "N/A"}`);
  console.log(`Chain total gas: ${chainGas.totalGas.toLocaleString()}`);
  console.log(`UD % of chain gas: ${pct}%`);
  console.log(`UD tx/hour: ${(udGas.txCount / hours).toFixed(1)}`);

  return { udGas, chainGas, txHashes };
}

async function main() {
  console.log("Gas Analysis: Ultimate Dominion vs Base Chain");
  console.log(`World: ${WORLD_ADDRESS}`);
  console.log(`RPC: rpc.ultimatedominion.com`);

  // Baseline latency
  const baseline = await measureLatency();
  console.log(`\nBaseline RPC latency: ${baseline.toFixed(0)}ms`);
  latencySamples.push({ timestamp: Date.now(), ms: baseline, batchType: "baseline" });

  const currentBlock = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
  })
    .then((r) => r.json())
    .then((r: any) => BigInt(r.result));

  console.log(`Current block: ${currentBlock}`);

  // 48h = ~86,400 blocks (2s per block)
  const blocks48h = 86_400n;
  const from48h = currentBlock - blocks48h;

  // 2 weeks = ~604,800 blocks — but cap at deploy block
  const blocks2w = 604_800n;
  const from2w = currentBlock - blocks2w > DEPLOY_BLOCK ? currentBlock - blocks2w : DEPLOY_BLOCK;

  // Run 48h first (smaller, faster)
  await analyzeRange("LAST 48 HOURS", from48h, currentBlock);

  // Mid-run latency check
  const midLatency = await measureLatency();
  console.log(`\nMid-run RPC latency: ${midLatency.toFixed(0)}ms (baseline: ${baseline.toFixed(0)}ms)`);

  // Run full range
  await analyzeRange("SINCE LAUNCH", from2w, currentBlock);

  // Final latency
  const finalLatency = await measureLatency();
  console.log(`\nFinal RPC latency: ${finalLatency.toFixed(0)}ms (baseline: ${baseline.toFixed(0)}ms)`);

  printLatencyReport();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
