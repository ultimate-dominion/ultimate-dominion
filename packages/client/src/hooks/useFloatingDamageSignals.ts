import { useEffect, useRef } from 'react';
import type { AttackOutcomeType } from '../utils/types';
import type { BattleFloatingDamageHandle, DamageType } from '../components/pretext/game/BattleFloatingDamage';

/**
 * Watches visibleOutcomes from useCombatPacing and spawns floating damage numbers
 * on the BattleFloatingDamage canvas overlay.
 *
 * Player attacks spawn on the RIGHT (monster side, x ~ 60-80%).
 * Monster counterattacks spawn on the LEFT (player side, x ~ 20-40%).
 */
export function useFloatingDamageSignals({
  visibleOutcomes,
  characterId,
  damageRef,
  containerWidth,
  containerHeight,
}: {
  visibleOutcomes: AttackOutcomeType[];
  characterId: string | undefined;
  damageRef: React.RefObject<BattleFloatingDamageHandle | null>;
  containerWidth: number;
  containerHeight: number;
}) {
  /** Set of outcome keys already spawned — survives counterattack reveal without replaying. */
  const spawnedKeysRef = useRef<Set<string>>(new Set());
  const lastEncounterIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!characterId || !damageRef.current) return;
    if (containerWidth === 0 || containerHeight === 0) return;

    const currentEncounterId = visibleOutcomes[0]?.encounterId ?? null;
    if (
      currentEncounterId &&
      lastEncounterIdRef.current &&
      currentEncounterId !== lastEncounterIdRef.current
    ) {
      spawnedKeysRef.current.clear();
    }
    lastEncounterIdRef.current = currentEncounterId;

    for (const outcome of visibleOutcomes) {
      // Unique key per outcome: encounterId + turn + attackNumber + attackerId
      const key = `${outcome.encounterId}:${outcome.currentTurn}:${outcome.attackNumber}:${outcome.attackerId}`;
      if (spawnedKeysRef.current.has(key)) continue;
      spawnedKeysRef.current.add(key);
      if (!damageRef.current) break;

      const isPlayerAttack =
        outcome.attackerId.toLowerCase() === characterId.toLowerCase();

      // Player attacks land on right (monster area), counterattacks land on left (player area)
      const baseX = isPlayerAttack
        ? containerWidth * (0.6 + Math.random() * 0.2)
        : containerWidth * (0.2 + Math.random() * 0.2);
      const baseY = containerHeight * (0.25 + Math.random() * 0.25);

      const damagePerHit = outcome.damagePerHit ?? [];
      const crits = outcome.crit ?? [];
      const misses = outcome.miss ?? [];
      const hitCount = Math.max(damagePerHit.length, misses.length, 1);
      const totalDamage = damagePerHit.reduce((sum, d) => sum + Number(d), 0);
      const anyMiss = misses.some(Boolean) && totalDamage === 0;
      const anyCrit = crits.some(Boolean);
      const isCombo = hitCount > 1 || outcome.doubleStrike;

      // ONE floating number per outcome — total damage, not per-hit
      // Color-coded: red = player damage, white = enemy damage, teal = blocked, gray = miss/dodge
      if (anyMiss) {
        damageRef.current.spawn(baseX, baseY, outcome.spellDodged ? 'dodged' : 'miss');
      } else if (totalDamage > 0) {
        let type: DamageType;
        if (!isPlayerAttack && outcome.blocked) {
          // Player blocked an incoming attack — positive feedback
          type = 'blocked';
        } else if (isPlayerAttack) {
          type = anyCrit
            ? (isCombo ? 'critDouble' : 'crit')
            : (isCombo ? 'double' : 'damage');
        } else {
          // Enemy damage on player — neutral/white color family
          type = anyCrit ? 'enemyCrit' : 'enemyDamage';
        }
        damageRef.current.spawn(baseX, baseY, type, totalDamage, isCombo ? hitCount : undefined);
      }
    }
  }, [visibleOutcomes, characterId, damageRef, containerWidth, containerHeight]);
}
