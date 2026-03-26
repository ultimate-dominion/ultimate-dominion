/**
 * Infrastructure Load Test — 5 minute sustained hammering
 *
 * Tests: Base node RPC (ours vs Alchemy), Relayer, Indexer API
 * Simulates realistic player traffic patterns at increasing concurrency
 */

const DURATION_MS = 5 * 60 * 1000; // 5 minutes
const REPORT_INTERVAL_MS = 15_000; // Print stats every 15s
const RAMP_INTERVAL_MS = 60_000; // Increase concurrency every 60s

// Endpoints
const OUR_RPC = 'https://rpc.ultimatedominion.com?token=3ca953991fbc6a82091005c394d033ce853f3d9807f2366bc1496dad234c57af';
const ALCHEMY_RPC = 'https://base-mainnet.g.alchemy.com/v2/uXm8ZFNQVb8YQausdDqGA';
const RELAYER_URL = 'https://8453.relay.ultimatedominion.com/';
const INDEXER_URL = 'https://indexer-production-d6df.up.railway.app';

// Known addresses for realistic calls
const DEPLOYER = '0xF282dcCB96301C26fc68AA02e7253F90e7D8770f';
const BETA_WORLD = '0x4a54538eCD32E1827121f9edb4a87CC4C08536E5';

// RPC call definitions
const RPC_CALLS: Record<string, () => object> = {
  eth_blockNumber: () => ({
    jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1,
  }),
  eth_getBalance: () => ({
    jsonrpc: '2.0', method: 'eth_getBalance', params: [DEPLOYER, 'latest'], id: 1,
  }),
  eth_getBlockByNumber: () => ({
    jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['latest', false], id: 1,
  }),
  eth_call: () => ({
    // Read maxPlayers from the world contract (a lightweight contract call)
    jsonrpc: '2.0', method: 'eth_call', params: [{
      to: BETA_WORLD,
      data: '0x5c975abb', // paused() — a simple view function
    }, 'latest'], id: 1,
  }),
  eth_getLogs_small: () => ({
    // Small range — last 100 blocks
    jsonrpc: '2.0', method: 'eth_getLogs', params: [{
      fromBlock: 'latest',
      toBlock: 'latest',
      address: BETA_WORLD,
    }], id: 1,
  }),
  eth_chainId: () => ({
    jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1,
  }),
  eth_gasPrice: () => ({
    jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1,
  }),
};

// Weighted distribution to simulate real traffic
// In reality: lots of reads, some getBalance checks, occasional getLogs
const CALL_WEIGHTS: [string, number][] = [
  ['eth_blockNumber', 20],     // Relayer heartbeat, client polling
  ['eth_getBalance', 15],      // Relayer gas checks
  ['eth_call', 25],            // Contract reads (game state)
  ['eth_getBlockByNumber', 10],// Block verification
  ['eth_getLogs_small', 10],   // Indexer sync simulation
  ['eth_chainId', 10],         // Connection verification
  ['eth_gasPrice', 10],        // Gas estimation
];

function pickWeightedCall(): string {
  const total = CALL_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, weight] of CALL_WEIGHTS) {
    r -= weight;
    if (r <= 0) return name;
  }
  return CALL_WEIGHTS[0][0];
}

// Stats tracking
interface MethodStats {
  count: number;
  errors: number;
  latencies: number[];
}

interface EndpointStats {
  methods: Map<string, MethodStats>;
  totalRequests: number;
  totalErrors: number;
}

function newEndpointStats(): EndpointStats {
  return { methods: new Map(), totalRequests: 0, totalErrors: 0 };
}

function getMethodStats(ep: EndpointStats, method: string): MethodStats {
  let m = ep.methods.get(method);
  if (!m) {
    m = { count: 0, errors: 0, latencies: [] };
    ep.methods.set(method, m);
  }
  return m;
}

// Indexer endpoint stats
interface IndexerMethodStats {
  count: number;
  errors: number;
  latencies: number[];
}

const stats = {
  ourNode: newEndpointStats(),
  alchemy: newEndpointStats(),
  relayer: { count: 0, errors: 0, latencies: [] as number[] },
  indexerHealth: { count: 0, errors: 0, latencies: [] as number[] },
  indexerStatus: { count: 0, errors: 0, latencies: [] as number[] },
  indexerApi: { count: 0, errors: 0, latencies: [] as number[] },
};

// Concurrency control
let currentConcurrency = 10;
const CONCURRENCY_RAMP = [10, 25, 50, 75, 100]; // Ramp every 60s
let rampIndex = 0;

let running = true;
let activeRequests = 0;

async function makeRpcCall(url: string, epStats: EndpointStats): Promise<void> {
  const methodName = pickWeightedCall();
  const body = JSON.stringify(RPC_CALLS[methodName]());
  const ms = getMethodStats(epStats, methodName);

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const elapsed = Math.round(performance.now() - start);
    ms.latencies.push(elapsed);
    ms.count++;
    epStats.totalRequests++;

    if (!resp.ok) {
      ms.errors++;
      epStats.totalErrors++;
    } else {
      const data = await resp.json() as { error?: unknown };
      if (data.error) {
        ms.errors++;
        epStats.totalErrors++;
      }
    }
  } catch {
    const elapsed = Math.round(performance.now() - start);
    ms.latencies.push(elapsed);
    ms.count++;
    ms.errors++;
    epStats.totalRequests++;
    epStats.totalErrors++;
  }
}

async function makeIndexerCall(path: string, target: { count: number; errors: number; latencies: number[] }): Promise<void> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(`${INDEXER_URL}${path}`, { signal: controller.signal });
    clearTimeout(timer);

    const elapsed = Math.round(performance.now() - start);
    target.latencies.push(elapsed);
    target.count++;

    if (!resp.ok) target.errors++;
    else await resp.text(); // consume body
  } catch {
    const elapsed = Math.round(performance.now() - start);
    target.latencies.push(elapsed);
    target.count++;
    target.errors++;
  }
}

async function makeRelayerCall(): Promise<void> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(RELAYER_URL, { signal: controller.signal });
    clearTimeout(timer);

    const elapsed = Math.round(performance.now() - start);
    stats.relayer.latencies.push(elapsed);
    stats.relayer.count++;
    if (!resp.ok) stats.relayer.errors++;
    else await resp.text();
  } catch {
    const elapsed = Math.round(performance.now() - start);
    stats.relayer.latencies.push(elapsed);
    stats.relayer.count++;
    stats.relayer.errors++;
  }
}

// Worker that continuously fires requests
async function rpcWorker(url: string, epStats: EndpointStats): Promise<void> {
  while (running) {
    activeRequests++;
    await makeRpcCall(url, epStats);
    activeRequests--;
  }
}

async function indexerWorker(): Promise<void> {
  const paths = ['/api/health', '/api/status', '/api/config'];
  let i = 0;
  while (running) {
    const path = paths[i % paths.length];
    const target = path === '/api/health' ? stats.indexerHealth
      : path === '/api/status' ? stats.indexerStatus
      : stats.indexerApi;
    activeRequests++;
    await makeIndexerCall(path, target);
    activeRequests--;
    i++;
  }
}

async function relayerWorker(): Promise<void> {
  while (running) {
    activeRequests++;
    await makeRelayerCall();
    activeRequests--;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printReport(elapsed: number) {
  const elapsedSec = elapsed / 1000;
  console.log('\n' + '='.repeat(90));
  console.log(`  LOAD TEST REPORT — ${Math.round(elapsedSec)}s elapsed | Concurrency: ${currentConcurrency} | Active: ${activeRequests}`);
  console.log('='.repeat(90));

  // RPC comparison table
  console.log('\n  RPC COMPARISON (Our Node vs Alchemy)');
  console.log('  ' + '-'.repeat(86));
  console.log('  ' + padR('Method', 22) + padR('Endpoint', 12) + padR('Reqs', 8) + padR('Err%', 8) + padR('p50', 8) + padR('p95', 8) + padR('p99', 8) + padR('RPS', 8));
  console.log('  ' + '-'.repeat(86));

  const allMethods = new Set([...stats.ourNode.methods.keys(), ...stats.alchemy.methods.keys()]);
  for (const method of [...allMethods].sort()) {
    for (const [label, ep] of [['OUR', stats.ourNode], ['ALCHEMY', stats.alchemy]] as const) {
      const ms = ep.methods.get(method);
      if (!ms || ms.count === 0) continue;
      const errPct = ((ms.errors / ms.count) * 100).toFixed(1);
      const rps = (ms.count / elapsedSec).toFixed(1);
      console.log('  ' +
        padR(method, 22) +
        padR(label, 12) +
        padR(String(ms.count), 8) +
        padR(errPct + '%', 8) +
        padR(percentile(ms.latencies, 50) + 'ms', 8) +
        padR(percentile(ms.latencies, 95) + 'ms', 8) +
        padR(percentile(ms.latencies, 99) + 'ms', 8) +
        padR(rps, 8)
      );
    }
  }

  // Totals
  console.log('  ' + '-'.repeat(86));
  for (const [label, ep] of [['OUR NODE TOTAL', stats.ourNode], ['ALCHEMY TOTAL', stats.alchemy]] as const) {
    const allLats = [...ep.methods.values()].flatMap(m => m.latencies);
    const errPct = ep.totalRequests > 0 ? ((ep.totalErrors / ep.totalRequests) * 100).toFixed(1) : '0';
    const rps = (ep.totalRequests / elapsedSec).toFixed(1);
    console.log('  ' +
      padR(label, 22) +
      padR('', 12) +
      padR(String(ep.totalRequests), 8) +
      padR(errPct + '%', 8) +
      padR(percentile(allLats, 50) + 'ms', 8) +
      padR(percentile(allLats, 95) + 'ms', 8) +
      padR(percentile(allLats, 99) + 'ms', 8) +
      padR(rps, 8)
    );
  }

  // Infrastructure endpoints
  console.log('\n  INFRASTRUCTURE ENDPOINTS');
  console.log('  ' + '-'.repeat(70));
  console.log('  ' + padR('Endpoint', 22) + padR('Reqs', 8) + padR('Err%', 8) + padR('p50', 8) + padR('p95', 8) + padR('p99', 8) + padR('RPS', 8));
  console.log('  ' + '-'.repeat(70));

  for (const [label, s] of [
    ['Relayer /health', stats.relayer],
    ['Indexer /health', stats.indexerHealth],
    ['Indexer /status', stats.indexerStatus],
    ['Indexer /config', stats.indexerApi],
  ] as const) {
    if (s.count === 0) continue;
    const errPct = ((s.errors / s.count) * 100).toFixed(1);
    const rps = (s.count / elapsedSec).toFixed(1);
    console.log('  ' +
      padR(label, 22) +
      padR(String(s.count), 8) +
      padR(errPct + '%', 8) +
      padR(percentile(s.latencies, 50) + 'ms', 8) +
      padR(percentile(s.latencies, 95) + 'ms', 8) +
      padR(percentile(s.latencies, 99) + 'ms', 8) +
      padR(rps, 8)
    );
  }

  // Capacity estimate
  const ourRps = stats.ourNode.totalRequests / elapsedSec;
  const ourP95 = percentile([...stats.ourNode.methods.values()].flatMap(m => m.latencies), 95);
  const ourErrRate = stats.ourNode.totalRequests > 0 ? stats.ourNode.totalErrors / stats.ourNode.totalRequests : 0;

  console.log('\n  CAPACITY ESTIMATE');
  console.log('  ' + '-'.repeat(70));
  // Each player action ≈ 3-5 RPC calls (estimateGas, sendTx, getReceipt, getLogs)
  // Relayer does ~4 calls per user action
  // With 5 relayers, each can handle ~10 concurrent txs
  const callsPerAction = 4;
  const sustainedRps = ourRps;
  const actionsPerSec = sustainedRps / callsPerAction;
  // A player does ~1 action every 5-10 seconds (combat turns, movement, shop)
  const playersAt5s = Math.floor(actionsPerSec * 5);
  const playersAt10s = Math.floor(actionsPerSec * 10);
  console.log(`  Sustained RPC throughput:    ${sustainedRps.toFixed(1)} req/s at concurrency ${currentConcurrency}`);
  console.log(`  Our node p95 latency:        ${ourP95}ms`);
  console.log(`  Our node error rate:         ${(ourErrRate * 100).toFixed(2)}%`);
  console.log(`  Est. player actions/sec:     ${actionsPerSec.toFixed(1)} (at ${callsPerAction} RPC calls/action)`);
  console.log(`  Est. concurrent players:     ${playersAt5s}-${playersAt10s} (1 action every 5-10s)`);
  console.log(`  Relayer bottleneck:          5 EOAs × ~10 concurrent txs = ~50 inflight txs`);
  console.log('');
}

function padR(s: string, n: number): string {
  return s.padEnd(n);
}

async function main() {
  console.log('=== ULTIMATE DOMINION INFRASTRUCTURE LOAD TEST ===');
  console.log(`Duration: ${DURATION_MS / 1000}s | Starting concurrency: ${currentConcurrency}`);
  console.log(`Ramp schedule: ${CONCURRENCY_RAMP.join(' → ')} (every 60s)`);
  console.log(`Endpoints: Our RPC, Alchemy, Relayer, Indexer`);
  console.log('Starting in 3s...\n');
  await new Promise(r => setTimeout(r, 3000));

  const startTime = Date.now();
  const workers: Promise<void>[] = [];

  // Spawn initial workers
  function spawnWorkers(count: number) {
    // Split: 40% our node, 40% alchemy, 10% indexer, 10% relayer
    const ourCount = Math.ceil(count * 0.4);
    const alchemyCount = Math.ceil(count * 0.4);
    const indexerCount = Math.max(1, Math.ceil(count * 0.1));
    const relayerCount = Math.max(1, Math.ceil(count * 0.1));

    for (let i = 0; i < ourCount; i++) workers.push(rpcWorker(OUR_RPC, stats.ourNode));
    for (let i = 0; i < alchemyCount; i++) workers.push(rpcWorker(ALCHEMY_RPC, stats.alchemy));
    for (let i = 0; i < indexerCount; i++) workers.push(indexerWorker());
    for (let i = 0; i < relayerCount; i++) workers.push(relayerWorker());
  }

  spawnWorkers(currentConcurrency);

  // Periodic report
  const reportTimer = setInterval(() => {
    printReport(Date.now() - startTime);
  }, REPORT_INTERVAL_MS);

  // Concurrency ramp
  const rampTimer = setInterval(() => {
    rampIndex++;
    if (rampIndex < CONCURRENCY_RAMP.length) {
      const newLevel = CONCURRENCY_RAMP[rampIndex];
      const additional = newLevel - currentConcurrency;
      if (additional > 0) {
        console.log(`\n>>> RAMPING CONCURRENCY: ${currentConcurrency} → ${newLevel} (+${additional} workers)`);
        currentConcurrency = newLevel;
        spawnWorkers(additional);
      }
    }
  }, RAMP_INTERVAL_MS);

  // Stop after duration
  await new Promise(r => setTimeout(r, DURATION_MS));
  running = false;
  clearInterval(reportTimer);
  clearInterval(rampTimer);

  // Wait for in-flight requests to finish (max 10s)
  await Promise.race([
    Promise.allSettled(workers),
    new Promise(r => setTimeout(r, 10_000)),
  ]);

  // Final report
  console.log('\n\n');
  console.log('#'.repeat(90));
  console.log('  FINAL REPORT');
  console.log('#'.repeat(90));
  printReport(Date.now() - startTime);

  // getLogs stress test summary
  console.log('  HEAVY CALL ANALYSIS');
  console.log('  ' + '-'.repeat(70));
  const ourGetLogs = stats.ourNode.methods.get('eth_getLogs_small');
  const alchemyGetLogs = stats.alchemy.methods.get('eth_getLogs_small');
  const ourEthCall = stats.ourNode.methods.get('eth_call');
  const alchemyEthCall = stats.alchemy.methods.get('eth_call');

  if (ourGetLogs && alchemyGetLogs) {
    console.log(`  eth_getLogs p95:  OUR=${percentile(ourGetLogs.latencies, 95)}ms  ALCHEMY=${percentile(alchemyGetLogs.latencies, 95)}ms`);
  }
  if (ourEthCall && alchemyEthCall) {
    console.log(`  eth_call p95:    OUR=${percentile(ourEthCall.latencies, 95)}ms  ALCHEMY=${percentile(alchemyEthCall.latencies, 95)}ms`);
  }

  console.log('\n  VERDICT');
  console.log('  ' + '-'.repeat(70));
  const totalOurRps = stats.ourNode.totalRequests / (DURATION_MS / 1000);
  const totalOurErrors = stats.ourNode.totalErrors;
  const allOurLats = [...stats.ourNode.methods.values()].flatMap(m => m.latencies);

  if (totalOurErrors === 0) {
    console.log(`  Our node handled ${stats.ourNode.totalRequests} requests (${totalOurRps.toFixed(1)} RPS) with ZERO errors`);
  } else {
    console.log(`  Our node: ${stats.ourNode.totalRequests} requests, ${totalOurErrors} errors (${((totalOurErrors/stats.ourNode.totalRequests)*100).toFixed(2)}%)`);
  }
  console.log(`  p50=${percentile(allOurLats, 50)}ms  p95=${percentile(allOurLats, 95)}ms  p99=${percentile(allOurLats, 99)}ms`);

  const relayerErrRate = stats.relayer.count > 0 ? stats.relayer.errors / stats.relayer.count : 0;
  const indexerErrRate = (stats.indexerHealth.count + stats.indexerStatus.count + stats.indexerApi.count) > 0
    ? (stats.indexerHealth.errors + stats.indexerStatus.errors + stats.indexerApi.errors) /
      (stats.indexerHealth.count + stats.indexerStatus.count + stats.indexerApi.count)
    : 0;
  console.log(`  Relayer: ${stats.relayer.count} checks, ${(relayerErrRate * 100).toFixed(2)}% errors`);
  console.log(`  Indexer: ${stats.indexerHealth.count + stats.indexerStatus.count + stats.indexerApi.count} checks, ${(indexerErrRate * 100).toFixed(2)}% errors`);
  console.log('');
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
