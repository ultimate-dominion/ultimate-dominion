import { useEffect, useRef } from 'react';

import type { WeaponAnimType } from '../components/pretext/game/weaponAnimations';
import type { AttackOutcomeType } from '../utils/types';

import { buildBattleSceneSignal } from './buildBattleSceneSignal';

// ── Signal types ────────────────────────────────────────────────────────

export type AttackSignal = {
  weaponType: WeaponAnimType;
  damage: number;
  isCrit: boolean;
  isPlayerAttack: boolean;
  didHit: boolean;
  targetDied: boolean;
  callout: {
    title: string;
    detail: string;
    tone: 'player' | 'enemy' | 'crit' | 'miss';
  };
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
  opponentName,
}: {
  visibleOutcomes: AttackOutcomeType[];
  characterId: string | undefined;
  sceneRef: React.RefObject<BattleSceneHandle | null>;
  weaponTypeForItem: (itemId: string) => WeaponAnimType;
  opponentName: string;
}): void {
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
      (currentEncounterId &&
        lastEncounterIdRef.current &&
        currentEncounterId !== lastEncounterIdRef.current)
    ) {
      processedCountRef.current = 0;
    }
    lastEncounterIdRef.current = currentEncounterId;

    const newOutcomes = visibleOutcomes.slice(processedCountRef.current);
    if (newOutcomes.length === 0) return;

    processedCountRef.current = visibleOutcomes.length;

    for (const outcome of newOutcomes) {
      sceneRef.current.triggerAttack(
        buildBattleSceneSignal({
          outcome,
          characterId,
          opponentName,
          weaponTypeForItem,
        }),
      );
    }
  }, [visibleOutcomes, characterId, sceneRef, weaponTypeForItem, opponentName]);
}
