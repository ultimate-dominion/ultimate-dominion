import { useMemo } from 'react';
import type { AttackOutcomeType, DotAction } from '../utils/types';

export type CombatLogEntryType = 'attack' | 'crit' | 'miss' | 'heal' | 'dot' | 'death';

export type CombatLogEntry = {
  text: string;
  type: CombatLogEntryType;
  key: string;
};

/**
 * Transforms visibleOutcomes + dotActions into simple text entries
 * for the canvas combat log.
 */
export function useCombatLogEntries({
  visibleOutcomes,
  dotActions,
  characterId,
  opponentName,
}: {
  visibleOutcomes: AttackOutcomeType[];
  dotActions: DotAction[];
  characterId: string | undefined;
  opponentName: string;
}): CombatLogEntry[] {
  return useMemo(() => {
    if (!characterId) return [];

    const entries: CombatLogEntry[] = [];
    const seenDotTurns = new Set<string>();

    for (let i = 0; i < visibleOutcomes.length; i++) {
      const attack = visibleOutcomes[i];
      const isPlayer = attack.attackerId.toLowerCase() === characterId.toLowerCase();
      const isSelfUse = attack.attackerId.toLowerCase() === attack.defenderId.toLowerCase();
      const attacker = isPlayer ? 'You' : opponentName;
      const defender = isPlayer ? opponentName : 'you';

      if (isSelfUse) {
        entries.push({
          text: `> ${attacker} used a consumable`,
          type: 'heal',
          key: `o-${i}`,
        });
        continue;
      }

      const damagePerHit = attack.damagePerHit ?? [];
      const crits = attack.crit ?? [];
      const misses = attack.miss ?? [];

      // Process each hit in multi-hit
      for (let h = 0; h < Math.max(damagePerHit.length, misses.length, 1); h++) {
        const isMiss = misses[h] === true;
        const isCrit = crits[h] === true;
        const dmg = Number(damagePerHit[h] ?? 0n);

        if (isMiss) {
          entries.push({
            text: `> ${attacker} missed ${defender}`,
            type: 'miss',
            key: `o-${i}-h${h}`,
          });
        } else if (isCrit) {
          entries.push({
            text: `> ${attacker} CRITS ${defender} for ${dmg}!`,
            type: 'crit',
            key: `o-${i}-h${h}`,
          });
        } else if (dmg > 0) {
          entries.push({
            text: `> ${attacker} hits ${defender} for ${dmg}`,
            type: 'attack',
            key: `o-${i}-h${h}`,
          });
        }

        if (attack.blocked) {
          entries.push({
            text: `> ${defender === 'you' ? 'You' : defender} blocked the attack!`,
            type: 'attack',
            key: `o-${i}-block`,
          });
        }
      }

      // DoT for this turn (once per turn)
      const turnKey = attack.currentTurn.toString();
      if (!seenDotTurns.has(turnKey)) {
        const dot = dotActions.find(d => d.turnNumber === attack.currentTurn && d.totalDamage > 0n);
        if (dot) {
          seenDotTurns.add(turnKey);
          const victim = dot.entityId.toLowerCase() === characterId.toLowerCase() ? 'you' : opponentName;
          entries.push({
            text: `> Poison deals ${dot.totalDamage.toString()} to ${victim}`,
            type: 'dot',
            key: `dot-${turnKey}`,
          });
        }
      }

      // Death events
      if (attack.defenderDied) {
        entries.push({
          text: `> ${defender === 'you' ? 'You were' : `${defender} was`} defeated!`,
          type: 'death',
          key: `death-${i}`,
        });
      }
      if (attack.attackerDied) {
        entries.push({
          text: `> ${attacker === 'You' ? 'You were' : `${attacker} was`} defeated!`,
          type: 'death',
          key: `adeath-${i}`,
        });
      }
    }

    return entries;
  }, [visibleOutcomes, dotActions, characterId, opponentName]);
}
