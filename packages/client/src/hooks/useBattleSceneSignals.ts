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
  /** Defender blocked the attack (reduced damage, block animation) */
  blocked: boolean;
  /** Attack missed / was dodged (no damage, dodge animation) */
  dodged: boolean;
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

  // Reset when battle changes
  useEffect(() => {
    processedCountRef.current = 0;
  }, [characterId]);

  useEffect(() => {
    if (!characterId || !sceneRef.current) return;

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
