# MAGIC DOC: Combat Balance State
_Current modifier values, sim results, what's deployed vs experimental. Updated automatically during balance work sessions._

## Current Modifier Values

### On-Chain (Beta)
- ATTACK_MODIFIER: 1.0 (not yet deployed — code has 1.0 but beta chain may differ)
- AGI_ATTACK_MODIFIER: 1.0
- MAGIC_RESIST_PER_INT: 2
- MAGIC_RESIST_CAP: 30

### On-Chain (Prod)
- Check `packages/contracts/src/constants.sol` vs deployed state

### In Sim (Experimental)
- attackModifier: 1.1 (proposed, not deployed)
- agiAttackModifier: 1.0
- magicResistPerInt: 2
- magicResistCap: 30

## Latest Sim Results

### L10 Balance (near-target)
- STR: ~31.8% | AGI: ~31.9% | INT: ~32.6%
- Goal: 33% each (±3%)

### L20 Balance (needs work)
- STR: ~46.9% | AGI: ~42.1% | INT: ~37.7%
- Problem: STR dominance, needs Z2 weapon tuning not modifier tuning

### Known Issues
- Cleric consistently weakest (CLR-S ~16% win rate at L10)
- Blessing spell rated HARMFUL (-4.1% PvE)
- V4 weapons in overrides.ts, not yet in items.json

## Sim Infrastructure
- Main sim: `scripts/balance-layer3-weapons.ts`
- Flags: `--loadouts`, `--slotvalue`, `--goals`, `--pvpsurvival`
- Multi-zone: `--allzones --level N --v4`
- Data loader: `scripts/loader.ts` with `loadMultiZoneGameData()`
- Overrides: `scripts/overrides.ts` (experimental items not yet on-chain)
- Run archives: `docs/combat-stats/sim-runs/`
