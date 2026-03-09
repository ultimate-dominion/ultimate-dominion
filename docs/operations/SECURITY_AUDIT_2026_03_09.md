# Security Audit Report — Ultimate Dominion

**Date:** March 9, 2026
**Scope:** Full-stack audit — smart contracts, client, API, relayer, indexer, infrastructure, game logic
**Type:** Internal read-only audit (6 parallel auditors)
**Status:** Pre-launch

---

## Executive Summary

This audit identified **8 critical**, **16 high**, **22 medium**, and **20+ low** severity findings across all layers of the stack. The most urgent issues fall into three categories:

1. **Smart contract access control gaps** — Several systems had access checks removed for inter-system calls, leaving them externally callable. `StatSystem.setStats()` is completely unprotected (anyone can set any entity's stats).
2. **Predictable RNG** — All randomness uses `block.prevrandao + userRandomNumber + _msgSender()`, which is fully predictable on Base L2. Every combat outcome, stat roll, and item drop can be manipulated.
3. **Infrastructure secret exposure** — The deployer private key (world owner), Alchemy API key, and Cloudflare Global API key are in plaintext files.

**Recommendation:** Do not launch to production until all CRITICAL findings are resolved. HIGH findings should be resolved or have documented mitigations before launch.

---

## CRITICAL Findings (8)

### SC-1: `StatSystem.setStats()` is completely unprotected
**Source:** Access Control Audit
**File:** `packages/contracts/src/systems/character/StatSystem.sol:190`

`openAccess: true` in mud.config.ts and the function has zero access control. Any external account can call `UD__setStats()` on any character or mob, setting arbitrary strength, agility, intelligence, maxHp, and armor values.

**Impact:** Complete game integrity compromise. Players can make themselves invincible or destroy other characters.
**Fix:** Add `_requireSystemOrAdmin(_msgSender())`.

---

### SC-2: `EncounterResolveSystem.endEncounter()` has no access control
**Source:** Access Control Audit
**File:** `packages/contracts/src/systems/EncounterResolveSystem.sol:21`

Any account can end any active combat encounter and force the outcome (attackersWin = true/false), directing all rewards.

**Impact:** Steal combat rewards, grief players, manipulate PvP outcomes.
**Fix:** Add `_requireSystemOrAdmin(_msgSender())`.

---

### SC-3: Fragment system functions have no caller restriction
**Source:** Access Control Audit
**Files:** `FragmentSystem.sol:46`, `FragmentCombatSystem.sol:21,35`

Any account can trigger any fragment for any character, then claim Fragment NFTs and XP rewards without playing.

**Impact:** Free NFT minting, free XP farming, bypasses game progression.
**Fix:** Add access control to `triggerFragment()` and both `FragmentCombatSystem` functions.

---

### SC-4: Combat Action[] array is not validated — attack target spoofing
**Source:** Game Logic Audit
**Files:** `EncounterSystem.sol:113`, `PvESystem.sol:173`, `PvPSystem.sol:107`

When a player submits `endTurn(encounterId, playerId, attacks)`, the `Action[]` struct contains `attackerEntityId` and `defenderEntityId` that are **fully player-controlled** with no validation that:
- `attackerEntityId` belongs to the player's team
- `defenderEntityId` belongs to the opposing team
- `itemId` is owned/equipped by the attacker

A player can make monsters attack each other, trivializing all PvE combat.

**Impact:** Complete combat bypass. All PvE and PvP outcomes manipulable.
**Fix:** Validate each action's attacker belongs to the submitting player's team and defender belongs to the opposing team.

---

### SC-5: RNG is entirely predictable — all game outcomes manipulable
**Source:** Reentrancy/Overflow Audit
**File:** `packages/contracts/src/systems/RngSystem.sol:54-59`

```solidity
rng = uint256(keccak256(abi.encode(block.prevrandao, userRandomNumber, _msgSender())));
```

On Base L2, `block.prevrandao` is the L1 RANDAO value, publicly known before the block is finalized. `userRandomNumber` is player-chosen. `_msgSender()` is known. All three inputs are predictable or controllable.

**Impact:** Players can guarantee optimal stat rolls, predict item drops, win every fight, and accumulate wealth far above intended rates.
**Fix:** Implement commit-reveal scheme, VRF integration (Chainlink/Pyth), or server-signed randomness.

---

### SC-6: `/fund` endpoint has zero authentication — relayer ETH drainable
**Source:** API/Relayer Audit
**File:** `packages/relayer/src/index.ts:100-163`

Any caller can generate fresh addresses and request 0.001 ETH per call. The `fundedAddresses` dedup set is in-memory (resets on restart). The balance monitor auto-tops-up funded addresses, amplifying the drain.

**Impact:** Entire ETH balance of all relayer wallets drainable.
**Fix:** Require on-chain character proof, wallet signature, or session token. Persist funded addresses to DB.

---

### SC-7: `amountOutMinimum: 1n` on all Uniswap swaps — sandwich vulnerable
**Source:** API/Relayer Audit
**Files:** `relayer/src/index.ts:227`, `relayer/src/gasCharge.ts:211`, `contracts/constants.sol:124`

All swap paths (gold purchase, gas recoup, on-chain GasStation) accept essentially zero output. MEV bots can extract nearly the entire swap value.

**Impact:** Players who paid real USD for gold could receive almost nothing. Relayer gas recoup swaps equally vulnerable.
**Fix:** Calculate proper `amountOutMinimum` using TWAP or oracle price with slippage tolerance.

---

### SC-8: Infrastructure secrets in plaintext
**Source:** Infra Audit
**Files:** `~/.claude/projects/.../memory/infra/tools.md`, `packages/client/.env.production`

- Deployer private key (`0x922673...`) — controls both MUD worlds (world owner)
- Alchemy API key — baked into production JS bundle via `VITE_*` env vars
- Cloudflare Global API Key — full account-level access
- OVH RPC Bearer Token, Discourse API Key

**Impact:** Full world takeover (deployer key), DNS hijacking (Cloudflare key), RPC quota abuse (Alchemy key).
**Fix:** Rotate all keys immediately. Use hardware wallet for deployer. Proxy RPC through `rpc.ultimatedominion.com`. Move secrets to a secret manager.

---

## HIGH Findings (16)

| ID | Finding | Source | File |
|---|---|---|---|
| H-1 | `EffectsSystem.applyStatusEffect/applyWorldEffects/applyDamageOverTime` — no access control (removed for inter-system calls) | Access Control | `EffectsSystem.sol:134,161,238` |
| H-2 | `PvESystem.executePvECombat` and `PvPSystem.executePvPCombat` — no access control | Access Control + Reentrancy | `PvESystem.sol:80`, `PvPSystem.sol:107` |
| H-3 | `MapRemovalSystem.removeEntityFromBoard` — registered systems bypass check, openAccess systems are registered | Access Control | `MapRemovalSystem.sol:50-53` |
| H-4 | `worldAddress` overridable via URL query param; validation only warns | Client | `getNetworkConfig.ts:78`, `env.ts:30-39` |
| H-5 | Gold (ERC20) is freely transferable — no transfer hook, marketplace fee bypassable | Game Logic | No `NoTransferHook` on Gold |
| H-6 | Zero movement cooldown enables unlimited bot farming | Game Logic | `constants.sol:78` (`MOVE_COOLDOWN = 0`) |
| H-7 | PvP collusion for gold/XP transfer between alt accounts | Game Logic | `PvpRewardSystem.sol:36-51` |
| H-8 | CORS `Access-Control-Allow-Origin: *` on all Vercel API handlers | API/Relayer + Client | `vercel.json`, all handler files |
| H-9 | In-memory fund/session dedup lost on relayer restart | API/Relayer | `relayer/src/index.ts:19,26` |
| H-10 | Relayer health endpoint exposes wallet addresses, balances, nonces | API/Relayer | `relayer/src/index.ts:77-97` |
| H-11 | Drip cron skips auth when `CRON_SECRET` not set | API/Relayer | `api/drip.ts:18-23` |
| H-12 | Session cleanup endpoint triggers on-chain txs with no auth | Indexer/Infra | `indexer/src/api/session.ts:16` |
| H-13 | Queue leave/spawned endpoints have no auth — anyone can kick players | Indexer/Infra | `indexer/src/api/queue.ts:211,268` |
| H-14 | Dashboard/status/health endpoints expose infrastructure details publicly | Indexer/Infra | `indexer/src/api/dashboard.ts` |
| H-15 | CAPTCHA disabled without Turnstile secret | Indexer/Infra | `indexer/src/api/captcha.ts:9-13` |
| H-16 | Uncapped gold minting — no global supply cap, any registered system can mint | Reentrancy/Overflow | `LootManagerSystem.sol:79-90` |

---

## MEDIUM Findings (22)

| ID | Finding | Source |
|---|---|---|
| M-1 | `_requireSystemOrAdmin` allows ANY registered MUD system to call privileged functions | Access Control |
| M-2 | Stale system addresses in Admin table after system upgrades | Access Control |
| M-3 | `WorldActionSystem.useWorldConsumableItem` doesn't verify ownership of `receivingEntity` | Access Control |
| M-4 | `MobSystem.spawnMob` has no access control — map flooding possible | Access Control |
| M-5 | `MapSpawnSystem.spawnOnTileEnter` has no access control | Access Control |
| M-6 | `CharacterEnterSystem` mints 100 Gold without updating totalSupply | Reentrancy/Overflow |
| M-7 | Direct table writes bypass ERC20/ERC1155 events — token tracking inconsistency | Reentrancy/Overflow |
| M-8 | GasStationSystem sends ETH without ReentrancyGuard | Reentrancy/Overflow |
| M-9 | PvpRewardSystem integer division dust loss accumulation | Reentrancy/Overflow |
| M-10 | Marketplace front-running — no price slippage protection | Reentrancy/Overflow |
| M-11 | Burner wallet private key in localStorage (MUD design) | Client |
| M-12 | Push Protocol PGP key cached in sessionStorage | Client |
| M-13 | No route-level authentication guards | Client |
| M-14 | Character name accepts any Unicode/special chars | Client |
| M-15 | Vite 4.x has known dev-server vulnerabilities | Client |
| M-16 | `uploadMetadata` accepts arbitrary JSON with no size/schema validation | API/Relayer |
| M-17 | Stripe session redirect URL derived from request Origin header | API/Relayer |
| M-18 | `ALLOWED_WORLD_ADDRESSES` config parsed but never enforced | API/Relayer |
| M-19 | WebSocket has no connection limit or rate limiting | Indexer/Infra |
| M-20 | Docker containers run as root | Indexer/Infra |
| M-21 | Smoke Cloak negates flee penalties — risk-free PvP possible | Game Logic |
| M-22 | Consumables usable from inventory during combat (bypasses 4-slot equip limit) | Game Logic |

---

## Prioritized Remediation Plan

### Before Launch (Blockers)

| Priority | Finding | Effort | Notes |
|---|---|---|---|
| 1 | **SC-8**: Rotate deployer key, Alchemy key, Cloudflare key | 1 hour | Do this first. Cannot be undone if exploited. |
| 2 | **SC-1**: Add access control to `StatSystem.setStats` | 10 min | One-line fix + redeploy |
| 3 | **SC-2**: Add access control to `EncounterResolveSystem.endEncounter` | 10 min | One-line fix + redeploy |
| 4 | **SC-3**: Add access control to Fragment system functions | 10 min | One-line fix + redeploy |
| 5 | **H-1**: Re-add access control to EffectsSystem functions | 10 min | One-line fix + redeploy |
| 6 | **H-2**: Re-add access control to PvE/PvP execute functions | 10 min | One-line fix + redeploy |
| 7 | **SC-4**: Validate combat Action[] array | 2-4 hours | Verify attacker team + defender team + item ownership |
| 8 | **SC-6**: Auth on `/fund` endpoint | 2 hours | Require character proof or session token |
| 9 | **SC-7**: Fix `amountOutMinimum` on swaps | 1 hour | Add TWAP-based minimum |
| 10 | **H-8**: Fix CORS on Vercel handlers | 30 min | Remove manual `*` headers |

### After Launch (Important but not blocking)

| Priority | Finding | Effort |
|---|---|---|
| 11 | **SC-5**: Replace RNG (commit-reveal or VRF) | 1-2 weeks |
| 12 | **H-6**: Set non-zero `MOVE_COOLDOWN` | 10 min + redeploy |
| 13 | **H-5**: Gold transfer restriction or transfer-fee hook | 1-2 days |
| 14 | **H-9**: Persist fund/session dedup to DB | 2 hours |
| 15 | **H-12/H-13**: Auth on indexer mutation endpoints | 2 hours |
| 16 | **H-14**: Auth on dashboard/health endpoints | 1 hour |
| 17 | **M-1**: Replace `_requireSystemOrAdmin` with specific whitelists | 1 day |

### Notes on Accepted Risks

- **RNG predictability** (SC-5): This is the most architecturally significant fix but requires substantial rework. At low initial DAU, the incentive to exploit is minimal. Monitor for anomalous combat win rates.
- **Gold transferability** (H-5): Free gold transfers are needed for `ShopSystem.buy` (uses `transferFrom`). Restricting transfers requires rearchitecting shop payments. Consider a transfer hook that applies the 3% fee.
- **PvP collusion** (H-7): The 20% burn tax makes this expensive. Monitor for repeated PvP between same addresses.
- **Bot farming** (H-6): Setting `MOVE_COOLDOWN` to 3-5 seconds severely limits bots with minimal UX impact.

---

## Methodology

Six parallel auditors examined:
1. **Smart Contract Access Control** — Every system's auth checks, namespace grants, delegation, admin escalation
2. **Reentrancy / Overflow / State** — CEI violations, integer safety, TOCTOU, flash loans, RNG
3. **Client-Side Security** — XSS, wallet exposure, chain validation, input sanitization, dependencies
4. **API & Relayer** — Endpoint auth, input validation, rate limiting, wallet pool, Stripe webhooks
5. **Indexer & Infrastructure** — WS abuse, SQL injection, CI/CD secrets, deploy scripts, Docker
6. **Economic / Game Logic** — Gold farming, duplication, combat manipulation, marketplace abuse

All findings were read-only analysis. No exploits were attempted.

---

*Last updated: March 9, 2026*
