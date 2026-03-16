import type { CombatDetails } from '../utils/types';
import type { TableRow } from '../lib/gameStore/types';

/**
 * Resolves which battle (if any) should be shown to the player.
 *
 * Returns null when:
 * - No battles exist
 * - The latest battle was already dismissed (matches BATTLE_OUTCOME_SEEN_KEY)
 * - The store is stale (last-seen battle isn't in store yet) and no active battle exists
 * - The latest completed battle's outcome hasn't synced yet
 */
export function resolveCurrentBattle(
  allBattles: CombatDetails[],
  combatOutcomeTable: Record<string, TableRow>,
  lastSeenEncounterId: string | null,
): CombatDetails | null {
  // A battle is "active" if end===0 AND no CombatOutcome exists yet.
  const activeBattle = allBattles
    .filter(b => b.end === BigInt(0) && !combatOutcomeTable[b.encounterId])
    .pop() ?? null;

  const latestBattle = activeBattle ?? allBattles[allBattles.length - 1];
  if (!latestBattle) return null;

  // Battle is over if end is set OR CombatOutcome exists
  const hasOutcome = !!combatOutcomeTable[latestBattle.encounterId];
  if (latestBattle.end !== BigInt(0) || hasOutcome) {
    // Outcome not synced yet — hide battle until it arrives
    if (!hasOutcome) return null;
  }

  // Already dismissed this battle
  if (lastSeenEncounterId === latestBattle.encounterId) return null;

  // If the player has dismissed a battle that isn't in the store yet, the
  // store data is stale (indexer behind chain head). Suppress completed
  // battles to prevent cycling through old encounters as the store catches up.
  // Only genuinely active battles (end===0, no outcome) should show.
  if (lastSeenEncounterId && !allBattles.some(b => b.encounterId === lastSeenEncounterId)) {
    return activeBattle;
  }

  return latestBattle;
}
