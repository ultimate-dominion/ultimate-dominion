import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAttackSfxKey,
  useBattleSceneSignals,
  type AttackSignal,
  type BattleSceneHandle,
} from './useBattleSceneSignals';
import type { AttackOutcomeType } from '../utils/types';

const PLAYER_ID = '0xplayer';
const MONSTER_ID = '0xmonster';
const mockPlaySfx = vi.fn();

vi.mock('../contexts/SoundContext', () => ({
  useGameAudio: () => ({
    soundEnabled: true,
    toggleSound: vi.fn(),
    playSfx: mockPlaySfx,
    duckMusic: vi.fn(),
  }),
}));

function makeOutcome(
  overrides: Partial<AttackOutcomeType> = {},
): AttackOutcomeType {
  return {
    attackerDamageDelt: 10n,
    attackerDied: false,
    attackerId: PLAYER_ID,
    attackNumber: 1n,
    blocked: false,
    blockNumber: 1n,
    crit: [false],
    currentTurn: 1n,
    damagePerHit: [10n],
    defenderDamageDelt: 0n,
    defenderDied: false,
    defenderId: MONSTER_ID,
    doubleStrike: false,
    effectIds: [],
    encounterId: '0xenc1',
    hit: [true],
    itemId: '0xsword',
    miss: [false],
    spellDodged: false,
    timestamp: 1000n,
    ...overrides,
  };
}

describe('useBattleSceneSignals', () => {
  afterEach(() => {
    mockPlaySfx.mockClear();
    vi.restoreAllMocks();
  });

  it('emits hit metadata so misses do not animate as clean hits', () => {
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    renderHook(() =>
      useBattleSceneSignals({
        visibleOutcomes: [
          makeOutcome({
            attackerId: MONSTER_ID,
            defenderId: PLAYER_ID,
            attackerDamageDelt: 0n,
            damagePerHit: [0n],
            hit: [false],
            miss: [true],
          }),
        ],
        characterId: PLAYER_ID,
        opponentName: 'Giant Spider',
        sceneRef,
        weaponTypeForItem: () => 'melee',
      }),
    );

    expect(triggerAttack).toHaveBeenCalledTimes(1);
    expect(mockPlaySfx).toHaveBeenCalledWith('battle-miss');
    expect(triggerAttack).toHaveBeenCalledWith(
      expect.objectContaining({
        weaponType: 'melee',
        damage: 0,
        isCrit: false,
        isPlayerAttack: false,
        didHit: false,
        targetDied: false,
        isCombo: false,
      }),
    );
  });

  it('resets processed outcomes when a new encounter replaces the old one', () => {
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    const { rerender } = renderHook(
      ({ visibleOutcomes }) =>
        useBattleSceneSignals({
          visibleOutcomes,
          characterId: PLAYER_ID,
          opponentName: 'Giant Spider',
          sceneRef,
          weaponTypeForItem: () => 'melee',
        }),
      {
        initialProps: {
          visibleOutcomes: [
            makeOutcome({ encounterId: '0xenc1', attackNumber: 1n }),
          ],
        },
      },
    );

    expect(triggerAttack).toHaveBeenCalledTimes(1);

    rerender({
      visibleOutcomes: [
        makeOutcome({
          encounterId: '0xenc2',
          attackNumber: 1n,
          defenderDied: true,
        }),
      ],
    });

    expect(triggerAttack).toHaveBeenCalledTimes(2);
    expect(triggerAttack).toHaveBeenLastCalledWith(
      expect.objectContaining({
        damage: 10,
        isPlayerAttack: true,
        targetDied: true,
      }),
    );
  });

  it('does NOT replay player attack when counterattack is revealed', () => {
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    const playerAttack = makeOutcome({
      attackerId: PLAYER_ID,
      defenderId: MONSTER_ID,
      attackNumber: 1n,
      currentTurn: 1n,
      encounterId: '0xenc1',
    });

    const counterattack = makeOutcome({
      attackerId: MONSTER_ID,
      defenderId: PLAYER_ID,
      attackNumber: 2n,
      currentTurn: 1n,
      encounterId: '0xenc1',
      damagePerHit: [5n],
      attackerDamageDelt: 5n,
    });

    // Phase 1: only player attack visible (counterattack hidden by useCombatPacing)
    const { rerender } = renderHook(
      ({ visibleOutcomes }) =>
        useBattleSceneSignals({
          visibleOutcomes,
          characterId: PLAYER_ID,
          opponentName: 'Giant Spider',
          sceneRef,
          weaponTypeForItem: () => 'melee',
        }),
      {
        initialProps: {
          visibleOutcomes: [playerAttack],
        },
      },
    );

    expect(triggerAttack).toHaveBeenCalledTimes(1);
    expect(mockPlaySfx).toHaveBeenCalledWith('battle-hit-sword');
    expect(triggerAttack).toHaveBeenCalledWith(
      expect.objectContaining({ isPlayerAttack: true, damage: 10 }),
    );

    // Phase 2: counterattack revealed (600ms later) — visibleOutcomes now has both
    rerender({
      visibleOutcomes: [playerAttack, counterattack],
    });

    // Should fire ONLY the counterattack, NOT replay the player attack
    expect(triggerAttack).toHaveBeenCalledTimes(2);
    expect(triggerAttack).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlayerAttack: false, damage: 5 }),
    );
  });

  it('consolidates multi-hit outcomes into one signal', () => {
    const triggerAttack = vi.fn();
    const sceneRef = {
      current: { triggerAttack },
    } as React.RefObject<BattleSceneHandle | null>;

    renderHook(() =>
      useBattleSceneSignals({
        visibleOutcomes: [
          makeOutcome({
            damagePerHit: [4n, 6n],
            hit: [true, true],
            crit: [false, true],
            miss: [false, false],
            doubleStrike: true,
            defenderDied: true,
          }),
        ],
        characterId: PLAYER_ID,
        opponentName: 'Giant Spider',
        sceneRef,
        weaponTypeForItem: () => 'melee',
      }),
    );

    // Single consolidated signal, not staged beats
    expect(triggerAttack).toHaveBeenCalledTimes(1);
    expect(mockPlaySfx).toHaveBeenCalledTimes(1);
    expect(triggerAttack).toHaveBeenCalledWith(
      expect.objectContaining({
        damage: 10,
        hitCount: 2,
        isCrit: true,
        isCombo: true,
        targetDied: true,
      }),
    );
  });
});

describe('getAttackSfxKey', () => {
  const makeSignal = (overrides: Partial<AttackSignal> = {}): AttackSignal => ({
    weaponType: 'melee',
    weaponName: 'Iron Sword',
    damage: 10,
    hitCount: 1,
    isCrit: false,
    isPlayerAttack: true,
    blocked: false,
    dodged: false,
    didHit: true,
    targetDied: false,
    isCombo: false,
    callout: {
      title: '10 DAMAGE',
      detail: 'You hit Giant Spider.',
      tone: 'player',
    },
    ...overrides,
  });

  it('routes weapon flavor to sword, hammer, arrow, and magic hit SFX', () => {
    expect(getAttackSfxKey(makeSignal({ weaponName: 'Iron Sword' }))).toBe('battle-hit-sword');
    expect(getAttackSfxKey(makeSignal({ weaponName: 'War Hammer' }))).toBe('battle-hit-hammer');
    expect(getAttackSfxKey(makeSignal({ weaponType: 'ranged' }))).toBe('battle-hit-arrow');
    expect(getAttackSfxKey(makeSignal({ weaponType: 'spell' }))).toBe('battle-hit-magic');
  });

  it('prioritizes kill over crit and crit over hit', () => {
    expect(getAttackSfxKey(makeSignal({ targetDied: true, isCrit: true }))).toBe('battle-kill');
    expect(getAttackSfxKey(makeSignal({ isCrit: true }))).toBe('battle-crit');
  });

  it('routes miss, dodge, and enemy damage placeholders', () => {
    expect(getAttackSfxKey(makeSignal({ didHit: false }))).toBe('battle-miss');
    expect(getAttackSfxKey(makeSignal({ didHit: false, dodged: true }))).toBe('battle-dodge');
    expect(getAttackSfxKey(makeSignal({ isPlayerAttack: false, didHit: true }))).toBe(
      'battle-take-damage',
    );
  });
});
