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
  const processedCountRef = useRef(0);
  const lastEncounterIdRef = useRef<string | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reset when battle changes or the outcomes array is replaced for a new encounter
  useEffect(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    processedCountRef.current = 0;
    lastEncounterIdRef.current = visibleOutcomes[0]?.encounterId ?? null;
  }, [characterId, visibleOutcomes]);

  useEffect(
    () => () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!characterId || !damageRef.current) return;
    if (containerWidth === 0 || containerHeight === 0) return;

    const currentEncounterId = visibleOutcomes[0]?.encounterId ?? null;
    if (
      visibleOutcomes.length < processedCountRef.current ||
      (currentEncounterId && lastEncounterIdRef.current && currentEncounterId !== lastEncounterIdRef.current)
    ) {
      processedCountRef.current = 0;
    }
    lastEncounterIdRef.current = currentEncounterId;

    const newOutcomes = visibleOutcomes.slice(processedCountRef.current);
    if (newOutcomes.length === 0) return;

    processedCountRef.current = visibleOutcomes.length;

    for (const outcome of newOutcomes) {
      const isPlayerAttack =
        outcome.attackerId.toLowerCase() === characterId.toLowerCase();

      // Player attacks land on right (monster area), counterattacks land on left (player area)
      const baseX = isPlayerAttack
        ? containerWidth * (0.6 + Math.random() * 0.2) // 60-80% for monster side
        : containerWidth * (0.2 + Math.random() * 0.2); // 20-40% for player side
      const baseY = containerHeight * (0.25 + Math.random() * 0.25); // 25-50% vertically

      const damagePerHit = outcome.damagePerHit ?? [];
      const crits = outcome.crit ?? [];
      const hits = outcome.hit ?? [];
      const misses = outcome.miss ?? [];
      const isComboAttack =
        outcome.doubleStrike ||
        Math.max(damagePerHit.length, hits.length, misses.length, 1) > 1;

      // Spawn a floating number for each hit in the multi-hit array
      for (let i = 0; i < Math.max(damagePerHit.length, misses.length, 1); i++) {
        const isMiss = misses[i] === true;
        const isCrit = crits[i] === true;
        const isHit = hits[i] === true;
        const dmg = Number(damagePerHit[i] ?? 0n);

        // Stagger multiple hits slightly
        const offsetX = i * 12;
        const delay = i * 120;

        const timeoutId = setTimeout(() => {
          if (!damageRef.current) return;

          if (isMiss) {
            damageRef.current.spawn(baseX + offsetX, baseY, 'miss');
          } else if (isHit || dmg > 0) {
            const type: DamageType = isCrit
              ? (isComboAttack ? 'critDouble' : 'crit')
              : (isComboAttack ? 'double' : 'damage');
            damageRef.current.spawn(baseX + offsetX, baseY, type, dmg);
          }
        }, delay);
        pendingTimersRef.current.push(timeoutId);
      }
    }
  }, [visibleOutcomes, characterId, damageRef, containerWidth, containerHeight]);
}
