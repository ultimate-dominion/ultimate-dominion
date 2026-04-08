import { useEffect, useRef } from 'react';
import type { AttackOutcomeType } from '../utils/types';
import type { WeaponAnimType } from '../components/pretext/game/weaponAnimations';

// ── Signal types ────────────────────────────────────────────────────────

export type AttackSignal = {
  weaponType: WeaponAnimType;
  damage: number;
  isCrit: boolean;
  isPlayerAttack: boolean;
  didHit: boolean;
  targetDied: boolean;
};

export type BattleSceneHandle = {
  triggerAttack: (signal: AttackSignal) => void;
};

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Watches visibleOutcomes from useCombatPacing and emits AttackSignals
 * to the BattleSceneCanvas imperative handle.
 *
 * Signal flow:
 *   BattleContext.attackOutcomes
 *     → useCombatPacing (600ms counterattack delay)
 *       → useBattleSceneSignals
 *         → canvas.triggerAttack(signal)
 *
 * Weapon type is determined by the attackingItemId from BattleContext:
 *   - Spells → 'spell' animation
 *   - Weapons with AGI stat restriction → 'ranged'
 *   - Otherwise → 'melee'
 *
 * This hook does NOT classify weapons itself — the caller provides
 * a weaponTypeForItem callback that maps itemId → WeaponAnimType.
 */
export function useBattleSceneSignals({
  visibleOutcomes,
  characterId,
  sceneRef,
  weaponTypeForItem,
}: {
  visibleOutcomes: AttackOutcomeType[];
  characterId: string | undefined;
  sceneRef: React.RefObject<BattleSceneHandle | null>;
  weaponTypeForItem: (itemId: string) => WeaponAnimType;
}) {
  const processedCountRef = useRef(0);
  const lastEncounterIdRef = useRef<string | null>(null);

  // Reset when battle changes or the outcomes array is replaced for a new encounter
  useEffect(() => {
    processedCountRef.current = 0;
    lastEncounterIdRef.current = visibleOutcomes[0]?.encounterId ?? null;
  }, [characterId, visibleOutcomes]);

  useEffect(() => {
    if (!characterId || !sceneRef.current) return;

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

      // Sum total damage from all hits
      const damagePerHit = outcome.damagePerHit ?? [];
      const totalDamage = damagePerHit.reduce(
        (sum, d) => sum + Number(d),
        0,
      );

      // Check if any hit was a crit
      const crits = outcome.crit ?? [];
      const isCrit = crits.some(Boolean);
      const hits = outcome.hit ?? [];
      const didHit =
        hits.some(Boolean) ||
        damagePerHit.some(d => d > 0n) ||
        outcome.attackerDamageDelt > 0n;

      // Determine weapon animation type from the item used
      const weaponType = weaponTypeForItem(outcome.itemId);

      sceneRef.current.triggerAttack({
        weaponType,
        damage: totalDamage,
        isCrit,
        isPlayerAttack,
        didHit,
        targetDied: outcome.defenderDied,
      });
    }
  }, [visibleOutcomes, characterId, sceneRef, weaponTypeForItem]);
}
