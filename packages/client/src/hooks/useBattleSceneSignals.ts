import { useEffect, useRef } from 'react';

import type { WeaponAnimType } from '../components/pretext/game/weaponAnimations';
import type { AttackOutcomeType } from '../utils/types';

import { buildBattleSceneSignals } from './buildBattleSceneSignal';

// ── Signal types ────────────────────────────────────────────────────────

export type AttackSignal = {
  weaponType: WeaponAnimType;
  /** Item name from items.json (e.g. "Iron Axe"). Used to load 3D projectile model. */
  weaponName?: string;
  damage: number;
  isCrit: boolean;
  isPlayerAttack: boolean;
  /** Defender blocked the attack (reduced damage, block animation) */
  blocked: boolean;
  /** Attack missed / was dodged (no damage, dodge animation) */
  dodged: boolean;
  didHit: boolean;
  targetDied: boolean;
  isCombo: boolean;
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
  weaponNameForItem,
  opponentName,
}: {
  visibleOutcomes: AttackOutcomeType[];
  characterId: string | undefined;
  sceneRef: React.RefObject<BattleSceneHandle | null>;
  weaponTypeForItem: (itemId: string) => WeaponAnimType;
  /** Returns item name for 3D projectile rendering. Optional — 2D fallback if absent. */
  weaponNameForItem?: (itemId: string) => string | undefined;
  opponentName: string;
}): void {
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
      const signals = buildBattleSceneSignals({
        outcome,
        characterId,
        opponentName,
        weaponTypeForItem,
        weaponNameForItem,
      });

      signals.forEach((signal, index) => {
        const timeoutId = setTimeout(() => {
          sceneRef.current?.triggerAttack(signal);
        }, index * 240);
        pendingTimersRef.current.push(timeoutId);
      });
    }
  }, [visibleOutcomes, characterId, sceneRef, weaponTypeForItem, weaponNameForItem, opponentName]);
}
