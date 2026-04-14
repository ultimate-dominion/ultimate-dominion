---
paths:
  - packages/indexer/**
---

# Indexer Rules

## Memory Pointers (read on demand)
- `infra/tools.md` — Railway service IDs, URLs, CLI commands, SSH targets
- `infra/deploy-guide.md` — Deploy commands, failure patterns
- `infra/recovery-runbook.md` — Service failure diagnosis
- `infra/gotcha_*.md` — Grep when touching indexer infra

## Architecture
Custom MUD indexer (replaces RECS). Syncs Store events → PostgreSQL, REST API + WebSocket.
- Database: PostgreSQL via `postgres` library, off-chain tables in `queue.` schema
- WS protocol: typed discriminated unions in `ws/protocol.ts`
- Game events: `queue/eventFeed.ts` scans MUD tables every 10s
- Chat: `ws/chatHandler.ts` — rate limiting, shadow mute, guild auth

## Railway Deploy (CRITICAL)
- Beta: `railway service indexer-beta-us && railway up --detach` (service ID: `390336a9`)
- Prod: `railway service indexer && railway up --detach` (**ASK MICHAEL FIRST**, service ID: `61172447`)
- NEVER use `railway redeploy` — reuses cached images
- ALWAYS bump `packages/indexer/package.json` version before deploying
- ALWAYS run from repo root, not from `packages/indexer/`
- ALWAYS verify `railway status` shows the correct service before deploying
- `railway up` from worktrees uploads main checkout files — deploy from main checkout only
- Full service ID table in `.claude/rules/deploy.md`

## Patterns
- Table init: `async function initXxxTables()` with `CREATE TABLE IF NOT EXISTS` in `queue.` schema
- Broadcast: `broadcaster.broadcastToAll(msg)` or `broadcastToChannel(channel, msg)`
- Dedup: `ON CONFLICT ... DO NOTHING`
- WS message handling: `switch (msg.type)` in broadcaster's `addClient()`
