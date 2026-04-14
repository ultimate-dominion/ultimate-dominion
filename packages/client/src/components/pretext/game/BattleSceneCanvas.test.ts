import { describe, expect, it } from 'vitest';

import { spliceSameSideAttacks } from './BattleSceneCanvas';

// Minimal shape for tests — matches ActiveAttack but only the fields the
// splicer actually inspects. Keeps the test decoupled from the full type.
type MinimalAttack = { isPlayerAttack: boolean; tag: string };

function make(isPlayer: boolean, tag: string): MinimalAttack {
  return { isPlayerAttack: isPlayer, tag };
}

describe('spliceSameSideAttacks', () => {
  it('drops a single in-flight player attack when a new player attack arrives', () => {
    const attacks = [make(true, 'a')];
    spliceSameSideAttacks(attacks as never, true);
    expect(attacks).toHaveLength(0);
  });

  it('drops multiple in-flight player attacks when a new player attack arrives', () => {
    const attacks = [make(true, 'a'), make(true, 'b'), make(true, 'c')];
    spliceSameSideAttacks(attacks as never, true);
    expect(attacks).toHaveLength(0);
  });

  it('leaves monster counterattacks alone when splicing for a player attack', () => {
    const attacks = [make(true, 'old-player'), make(false, 'monster-counter')];
    spliceSameSideAttacks(attacks as never, true);
    expect(attacks).toHaveLength(1);
    expect((attacks[0] as MinimalAttack).tag).toBe('monster-counter');
  });

  it('leaves player attacks alone when splicing for a monster counterattack', () => {
    const attacks = [make(true, 'player'), make(false, 'old-counter')];
    spliceSameSideAttacks(attacks as never, false);
    expect(attacks).toHaveLength(1);
    expect((attacks[0] as MinimalAttack).tag).toBe('player');
  });

  it('is a no-op on an empty queue', () => {
    const attacks: MinimalAttack[] = [];
    expect(() => spliceSameSideAttacks(attacks as never, true)).not.toThrow();
    expect(attacks).toHaveLength(0);
  });

  it('handles interleaved queues without skipping entries (backwards iteration)', () => {
    // Backwards iteration is required: if the splicer walked forwards and
    // used indices, removing index 0 would shift index 1 → 0 and the next
    // iteration would skip what used to be index 2. This test exercises a
    // queue with multiple same-side entries in non-contiguous positions.
    const attacks = [
      make(true, 'p1'),
      make(false, 'm1'),
      make(true, 'p2'),
      make(false, 'm2'),
      make(true, 'p3'),
    ];
    spliceSameSideAttacks(attacks as never, true);
    expect(attacks).toHaveLength(2);
    expect((attacks[0] as MinimalAttack).tag).toBe('m1');
    expect((attacks[1] as MinimalAttack).tag).toBe('m2');
  });
});
