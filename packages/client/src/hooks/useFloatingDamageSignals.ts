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
      if (anyMiss) {
        damageRef.current.spawn(baseX, baseY, 'miss');
      } else if (totalDamage > 0) {
        const type: DamageType = anyCrit
          ? (isCombo ? 'critDouble' : 'crit')
          : (isCombo ? 'double' : 'damage');
        damageRef.current.spawn(baseX, baseY, type, totalDamage, isCombo ? hitCount : undefined);
      }
    }
  }, [visibleOutcomes, characterId, damageRef, containerWidth, containerHeight]);
}
