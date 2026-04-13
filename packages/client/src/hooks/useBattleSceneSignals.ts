import { useEffect, useRef } from 'react';

import type { WeaponAnimType } from '../components/pretext/game/weaponAnimations';
import { useGameAudio, type SfxKey } from '../contexts/SoundContext';
import type { AttackOutcomeType } from '../utils/types';

import { buildBattleSceneSignals } from './buildBattleSceneSignal';

// ── Signal types ────────────────────────────────────────────────────────

export type AttackSignal = {
  weaponType: WeaponAnimType;
  /** Item name from items.json (e.g. "Iron Axe"). Used to load 3D projectile model. */
  weaponName?: string;
  damage: number;
  /** Number of individual hits in this attack (multi-hit combos). */
  hitCount: number;
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

const HEAVY_WEAPON_RE = /\b(hammer|mace|maul|club)\b/i;

export const getAttackSfxKey = (signal: AttackSignal): SfxKey => {
  if (signal.isPlayerAttack && signal.targetDied) return 'battle-kill';
  if (signal.isPlayerAttack && signal.isCrit) return 'battle-crit';

  if (signal.isPlayerAttack && signal.didHit) {
    if (signal.weaponType === 'ranged') return 'battle-hit-arrow';
    if (signal.weaponType === 'spell') return 'battle-hit-magic';
    if (signal.weaponName && HEAVY_WEAPON_RE.test(signal.weaponName)) {
      return 'battle-hit-hammer';
    }
    return 'battle-hit-sword';
  }

  if (signal.isPlayerAttack && signal.dodged) return 'battle-dodge';
  if (signal.isPlayerAttack && !signal.didHit) return 'battle-miss';
  if (!signal.isPlayerAttack && signal.didHit) return 'battle-take-damage';

  return 'battle-miss';
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
  const { playSfx } = useGameAudio();
  /** Set of outcome keys already signaled — survives counterattack reveal without replaying. */
  const signaledKeysRef = useRef<Set<string>>(new Set());
  const lastEncounterIdRef = useRef<string | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reset only on character or encounter change — NOT on counterattack reveal
  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!characterId || !sceneRef.current) return;

    const currentEncounterId = visibleOutcomes[0]?.encounterId ?? null;
    if (
      currentEncounterId &&
      lastEncounterIdRef.current &&
      currentEncounterId !== lastEncounterIdRef.current
    ) {
      signaledKeysRef.current.clear();
    }
    lastEncounterIdRef.current = currentEncounterId;

    for (const outcome of visibleOutcomes) {
      // Unique key per outcome: encounterId + turn + attackNumber + attackerId
      const key = `${outcome.encounterId}:${outcome.currentTurn}:${outcome.attackNumber}:${outcome.attackerId}`;
      if (signaledKeysRef.current.has(key)) continue;
      signaledKeysRef.current.add(key);

      const signals = buildBattleSceneSignals({
        outcome,
        characterId,
        opponentName,
        weaponTypeForItem,
        weaponNameForItem,
      });

      for (const signal of signals) {
        playSfx(getAttackSfxKey(signal));
        sceneRef.current?.triggerAttack(signal);
      }
    }
  }, [
    visibleOutcomes,
    characterId,
    sceneRef,
    weaponTypeForItem,
    weaponNameForItem,
    opponentName,
    playSfx,
  ]);
}
