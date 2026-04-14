---
paths:
  - packages/contracts/**/*.sol
  - packages/contracts/**/mud.config.*
---

# Solidity & MUD Contract Rules

## Security
- Check for reentrancy, integer overflow, access control, and input validation on every change.
- Reference `docs/operations/launch_checklist.md` Section 10 for the full checklist.
- Never use `tx.origin`. All systems must use proper access control.
- Never hardcode private keys or secrets. Always use environment variables.

## Access Control — Match the Call Graph
Before adding access control to ANY function:
1. Grep client code for `worldContract.write.UD__functionName` — if found, it's client-callable
2. Grep contracts for `IWorld(_world()).UD__functionName` or `SystemSwitch.call(abi.encodeCall(...)` — if found, it's system-callable
3. Choose the right guard:
   - **Client-only**: ownership check (`Characters.getOwner(id) == _msgSender()`)
   - **System-only**: `_requireSystemOrAdmin(_msgSender())`
   - **Both**: `isOwner || _isSystemOrAdmin(sender)`
- `_msgSender()` in inter-system calls returns World/system address, NOT the player EOA.

## MUD Table Schemas Are Immutable
- Once registered on a live world, schemas CANNOT be modified.
- To add fields: create a NEW table. Never modify existing table schemas in mud.config.ts for live worlds.
- Adding fields changes codegen → changes bytecode of importing systems → MUD redeploys them → cross-namespace access grants break.

## Backwards Compatibility / Migrations
- Before modifying any MUD table schema: check if live player data exists.
- If yes: write a migration script or add a new table.
- Never delete a table with live data without a migration plan.

## address(this) in Non-Root Systems
- Non-root systems (UD:*) run via `call`, not `delegatecall`. `address(this)` = the system's OWN contract address.
- After `mud deploy` upgrades a system, `address(this)` changes → data keyed by old address is orphaned.
- Use `_world()` instead of `address(this)` for stable keys. Ensure unique counterIds per system to avoid collisions.

## Gas Safety
- Non-critical post-combat code must be wrapped in `if (gasleft() > 200_000) { ... }`.
- Each `setStaticField` call costs ~32K gas (external CALL). Batch into single `Table.set()`.
- With `via_ir = true`, `try {} catch {}` with empty blocks gets optimized away. Use low-level `.call()` instead.

## Testing
- Run `forge test` before committing any contract changes.
- Verify function selectors after any `mud deploy`.

## Bytecode Size
- Near the 24,576 limit? Use hardcoded selectors instead of importing contracts. Avoid `Systems.getSystem()` (~400+ bytes overhead).
- `via_ir` + imported contract changes = unpredictable bytecode size variance.
