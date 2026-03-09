# Custom MUD Indexer

The Ultimate Dominion indexer is a Node.js service that syncs on-chain MUD table state from Base Mainnet into PostgreSQL, then serves it to the game client via REST and WebSocket APIs. It replaces the stock MUD indexer with a custom implementation that adds player queueing, session cleanup, a live game event feed, an infrastructure monitoring dashboard, and invite code generation.

## Architecture

```
Base Mainnet (chain 8453)
    |
    | Store events (via viem publicClient, WS primary / HTTP fallback)
    v
syncToPostgres (@latticexyz/store-sync)
    |
    | Decoded MUD tables written to Postgres schema "<world_address>"
    v
PostgreSQL (Railway)
    |
    +---> REST API (Express, port 3001)   --> Client reads game state
    +---> WebSocket Server (/ws)          --> Client gets real-time updates
    +---> Cron loop (30s)                 --> Session cleanup + queue advancement
    +---> Milestone watcher (15s)         --> Invite code generation on level-ups
    +---> Event feed (10s)                --> Broadcasts combat/loot/level events
    +---> Infrastructure monitor (45s)    --> Checks all services, sends email alerts
```

### Chain Connection

`startSync()` creates a viem `publicClient` with a fallback transport: WebSocket primary (if `RPC_WS_URL` is set), HTTP secondary. Polling interval is 250ms. The sync engine processes blocks in ranges of up to 10,000 and writes decoded table data into a Postgres schema named after the lowercase world address (e.g., `"0x705607de7f5d..."`).

### What Gets Indexed

All MUD Store tables registered by the world contract. Tables are auto-discovered from `information_schema.columns` after sync starts. A re-discovery pass runs once the indexer catches up to chain head, to pick up tables created during the initial sync window.

Table names follow MUD's convention: `{namespace}__{snake_case_name}` (e.g., `ud__characters`, `gold__balances`). The indexer builds a logical name map that converts these to PascalCase (e.g., `Characters`, `GoldBalances`) and resolves MUD's 16-byte resource ID truncations (e.g., `CharacterEquipme` -> `CharacterEquipment`).

### Data Storage

- **MUD tables**: Written by `syncToPostgres` into the world-address schema. Each table has `__key_bytes` (primary key) and `__last_updated_block_number` (used for incremental queries).
- **Queue tables**: Managed in a separate `queue` schema with four tables: `queue_entries`, `invite_codes`, `referral_activations`, `player_emails`. Created on startup by `initQueueTables()`.

The Postgres connection pool is configured at 20 max connections with 20s idle timeout.

## Directory Structure

```
packages/indexer/
  Dockerfile          Multi-stage Docker build (node:20-slim)
  package.json        @ud/indexer, MUD v2.2.23, viem 2.35.1
  tsconfig.json
  scripts/
    load-test.ts      Load testing utility
  src/
    index.ts          Entry point: Express app, WS server, cron loops, graceful shutdown
    config.ts         Environment variable parsing (required + optional)
    naming.ts         snake_case <-> PascalCase conversion, row serialization, truncation map
    sync/
      startSync.ts    MUD syncToPostgres setup, table discovery, WS broadcast hook
    db/
      connection.ts   PostgresJS client, Drizzle ORM, queryTable/queryUpdatedRows/discoverTables
      queueSchema.ts  Queue table DDL + CRUD (join, leave, advance, expire, stats, emails)
    api/
      router.ts       Mounts all sub-routers under /api
      health.ts       GET /api/health (sync lag, chain head, WS clients, table count)
      snapshot.ts     GET /api/snapshot (full world state dump)
      character.ts    GET /api/character/:owner (character + stats + equipment + encounter)
      items.ts        Item-related queries
      monsters.ts     Monster data queries
      map.ts          Map/zone data queries
      battle.ts       Combat data queries
      orders.ts       Marketplace order queries
      config.ts       GET /api/config (UltimateDominionConfig + GasStationConfig)
      session.ts      POST /api/session/cleanup (removes expired characters from board)
      queue.ts        Queue join/leave/position/stats endpoints with rate limiting + captcha
      invite.ts       Invite code validation and redemption
      captcha.ts      Cloudflare Turnstile verification
      status.ts       GET /api/status (infrastructure monitor status)
      dashboard.ts    GET /dashboard (HTML status page with auto-refresh)
    ws/
      server.ts       WebSocket server on /ws, heartbeat ping/pong (30s)
      broadcaster.ts  Manages client subscriptions, broadcasts table updates + queue + events
      protocol.ts     Message types (ServerMessage / ClientMessage), JSON encode/decode
    queue/
      milestoneWatcher.ts  Polls Stats table, generates invite codes at level 3/10/20
      eventFeed.ts         Polls for combat outcomes, level-ups, loot drops, marketplace sales
    monitor/
      monitor.ts      Runs health checks every 45s, flap protection (2 consecutive failures)
      checks.ts       Check functions: base-node, relayer, indexer, client-prod/beta, API
      alerter.ts       Email alerts via Resend (15-min cooldown per service+status)
      types.ts        ServiceName, ServiceStatus, ServiceCheckResult, AlertEvent types
    lib/
      slotEmail.ts    Sends "your slot is open" emails via Resend
```

## Configuration

All configuration is read from environment variables at startup (`src/config.ts`).

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RPC_HTTP_URL` | Base Mainnet HTTP RPC endpoint |
| `WORLD_ADDRESS` | MUD World contract address (hex) |
| `START_BLOCK` | Block number to begin syncing from |

### Optional

| Variable | Default | Description |
|---|---|---|
| `RPC_WS_URL` | _(none)_ | WebSocket RPC URL (preferred transport) |
| `CHAIN_ID` | `8453` | Chain ID (Base Mainnet) |
| `PORT` | `3001` | HTTP/WS server port |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `PRIVATE_KEY` | _(none)_ | EOA key for session cleanup transactions |
| `TURNSTILE_SECRET_KEY` | _(none)_ | Cloudflare Turnstile secret for queue captcha |
| `RESEND_API_KEY` | _(none)_ | Resend API key for email notifications |
| `ALERT_EMAIL` | _(none)_ | Email address for infrastructure alerts |
| `MONITOR_BASE_NODE_URL` | _(none)_ | Self-hosted Base node RPC URL (for monitoring) |
| `MONITOR_BASE_NODE_TOKEN` | _(none)_ | Auth token for self-hosted node |
| `MONITOR_BASE_NODE_METRICS_URL` | _(none)_ | Prometheus metrics endpoint (reth) |
| `MONITOR_ALCHEMY_URL` | _(none)_ | Alchemy RPC URL (reference for block lag) |
| `MONITOR_RELAYER_URL` | `https://8453.relay.ultimatedominion.com/` | Relayer health endpoint |
| `MONITOR_CLIENT_PROD_URL` | `https://ultimatedominion.com` | Production client URL |
| `MONITOR_CLIENT_BETA_URL` | `https://beta.ultimatedominion.com` | Beta client URL |
| `MONITOR_API_URL` | _(none)_ | API health endpoint URL |

## Deployment

Deployed on Railway via Docker. The `Dockerfile` uses a multi-stage build:

1. **Builder stage**: `node:20-slim`, installs pnpm 9.15.5, runs `pnpm install` + `pnpm build` (TypeScript compilation).
2. **Runtime stage**: `node:20-slim`, installs production dependencies only, copies compiled `dist/` from builder.
3. **Entrypoint**: `node dist/index.js`, exposes port 3001.

Railway provides the `DATABASE_URL` for the attached PostgreSQL instance. All other env vars are set in the Railway service config.

## API Endpoints

### REST (`/api`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Root health check (`{ status: "ok", service: "ud-indexer" }`) |
| GET | `/api/health` | Sync health: indexed block, chain head, lag, WS clients, table count |
| GET | `/api/health/tables` | Lists all discovered Postgres tables and their logical name mappings |
| GET | `/api/snapshot` | Full world state dump (all tables, all rows, keyed by `keyBytes`) |
| GET | `/api/character/:owner` | Character data by owner address (stats, equipment, encounter, etc.) |
| GET | `/api/items/...` | Item queries |
| GET | `/api/monsters/...` | Monster data |
| GET | `/api/map/...` | Map/zone data |
| GET | `/api/battle/...` | Combat data |
| GET | `/api/orders/...` | Marketplace orders |
| GET | `/api/config` | Game config singletons (UltimateDominionConfig, GasStationConfig) |
| POST | `/api/session/cleanup` | Removes expired characters (session timer > 5 min) from the board |
| GET/POST | `/api/queue/...` | Player queue: join, leave, position, stats |
| GET/POST | `/api/invite/...` | Invite code validation and redemption |
| GET | `/api/status` | Infrastructure monitor status (all services). Returns 503 if any service is down |
| GET | `/api/status/:service` | Single service detail |

### Infrastructure Dashboard (`/dashboard`)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | HTML status page with auto-refresh (30s) showing all monitored services |
| GET | `/dashboard/data` | JSON data endpoint for the dashboard |

### WebSocket (`/ws`)

Clients connect to `ws://<host>/ws`. Protocol is JSON over text frames.

**Server -> Client messages:**

| Type | Description |
|---|---|
| `connected` | Sent on connection with current block number |
| `update` | Table row changed: `{ table, keyBytes, value, block }` |
| `delete` | Table row deleted: `{ table, keyBytes, block }` |
| `pong` | Response to client ping |
| `queue:stats` | Queue stats broadcast (every 30s): `{ totalInQueue, slotsAvailable, currentPlayers }` |
| `queue:slot_open` | Slot notification: `{ wallet, readyUntil }` |
| `game:event` | Live feed event: `{ id, eventType, playerName, description, timestamp }` |

**Client -> Server messages:**

| Type | Description |
|---|---|
| `subscribe` | Subscribe to specific tables (empty array = all): `{ tables: ["Characters", "Stats"] }` |
| `resume` | Replay missed updates since a block: `{ lastBlock: 12345 }` |
| `ping` | Keepalive ping |

Connection heartbeat: server pings every 30s, terminates clients that don't respond with pong.

## Monitoring

### Health Check

```
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "indexedBlock": 28495123,
  "chainHead": 28495125,
  "lag": 2,
  "wsClients": 14,
  "tables": 47,
  "worldAddress": "0x705607De7F5dE1e95346Eb8d9Ccc7D69C225C4D7"
}
```

- `status`: `"healthy"` if lag < 50 blocks, `"lagging"` otherwise.
- `lag`: Difference between chain head and last indexed block.

### Infrastructure Monitor

The built-in monitor checks six services every 45 seconds:

| Service | What it checks |
|---|---|
| `base-node` | Block number vs Alchemy reference, reth Prometheus metrics (memory, peers) |
| `relayer` | Health endpoint, pool size, inflight txs, wallet balances |
| `indexer` | Self-check: block lag, WS client count |
| `client-prod` | HTTP 200 from `ultimatedominion.com` |
| `client-beta` | HTTP 200 from `beta.ultimatedominion.com` |
| `api` | API health endpoint |

Flap protection: 2 consecutive failures required before marking a service as `down`. Status transitions trigger email alerts via Resend with a 15-minute cooldown per service+status combination.

View live at: `GET /dashboard`

### Restart

On Railway: redeploy the service (triggers a fresh Docker build) or use the Railway CLI/UI to restart the running instance. The indexer will re-sync from `START_BLOCK`, catching up to chain head before serving full data.

## Troubleshooting

### Sync lag (indexer falling behind chain head)

- Check `/api/health` -- if `lag` is growing, the RPC may be rate-limited or the node is behind.
- If `RPC_WS_URL` is set, check if the WebSocket connection is alive. The indexer falls back to HTTP polling if WS drops.
- Check Railway logs for `[sync] storedBlockLogs$ error` or `[sync] latestBlockNumber$ error`.
- The sync engine processes blocks in chunks of 10,000. Large gaps (initial sync or long downtime) take time.

### Missing tables after deploy

- Tables are discovered 5 seconds after sync starts, then re-discovered when the indexer catches up to chain head.
- If tables are still missing after catchup, check `/api/health/tables` and compare against expected MUD tables.
- A re-discovery safety timeout of 2 minutes applies. If the indexer hasn't caught up by then, it stops polling for new tables. Restart the service if needed.

### Session cleanup not running

- Requires `PRIVATE_KEY` to be set (an EOA with ETH for gas).
- The cron calls `POST /api/session/cleanup` every 30 seconds. Check logs for `[session]` entries.
- If the cleanup EOA is out of gas, the transaction will fail silently in the cron error handler.

### WebSocket clients not receiving updates

- Check that the client is subscribing to the correct table names (PascalCase logical names, e.g., `Characters`, not `ud__characters`).
- Verify the WS connection is alive (heartbeat ping/pong every 30s).
- Dead connections are auto-terminated after missing one heartbeat cycle.
- The `resume` message replays updates since `lastBlock` using `__last_updated_block_number` queries.

### Queue not advancing

- The cron loop (30s) checks actual player count from MUD tables and compares against `maxPlayers` from config.
- If `effectiveSlots` is 0 (all slots full, including `ready` players holding reservations), no one advances.
- Ready entries expire after 2 minutes and are recycled back to `waiting` status.
- Check `queue.queue_entries` table directly for stuck entries.

### Database connection issues

- Pool is configured for 20 max connections, 10s connect timeout, 20s idle timeout.
- If Railway Postgres is at connection limit, the indexer will fail to query. Check Railway metrics.
- `closeDb()` is called on graceful shutdown (SIGINT/SIGTERM).

---

_Last updated: March 9, 2026_
