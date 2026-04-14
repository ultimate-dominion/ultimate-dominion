import { describe, expect, it } from 'vitest';

import { computeAnimParams, type AnimationState } from './MonsterAsciiRenderer';

// computeAnimParams drives the ASCII-only monster attack (Gelatinous Ooze,
// Carrion Crawler). The easing constants are load-bearing — if the windup
// phase doesn't pull back positive (monster faces LEFT, strikes toward -X)
// the attack looks like a retreat. These tests lock the phase boundaries
// so future tweaks don't accidentally reverse the facing.

function attackAt(startTime: number, elapsed: number, duration = 600): AnimationState {
  return { action: 'attack', startTime, durationOverride: duration };
}

describe('computeAnimParams', () => {
  it('returns base values when no anim is active', () => {
    const params = computeAnimParams(undefined, 0);
    expect(params.translateX).toBe(0);
    expect(params.translateY).toBe(0);
    expect(params.scale).toBe(1);
    expect(params.colorShiftR).toBe(0);
  });

  it('returns base values for idle action', () => {
    const params = computeAnimParams({ action: 'idle', startTime: 0 }, 500);
    expect(params.translateX).toBe(0);
    expect(params.scale).toBe(1);
  });

  describe("action: 'attack'", () => {
    it('windup phase pulls back to +X (monster faces LEFT, so windup is away from player)', () => {
      // t ~ 0.125 is mid-windup (0 .. 0.25)
      const params = computeAnimParams(attackAt(0, 75, 600), 75);
      expect(params.translateX).toBeGreaterThan(0);
      expect(params.translateY).toBeGreaterThan(0);
      expect(params.scale).toBeLessThanOrEqual(1);
    });

    it('strike phase ends deep in -X (lunge toward player on the left)', () => {
      // t ~ 0.54 — just before the strike→recover boundary, peak lunge
      const params = computeAnimParams(attackAt(0, 320, 600), 320);
      expect(params.translateX).toBeLessThan(0);
      // colorShiftR peaks during strike, should be non-zero / warm
      expect(params.colorShiftR).toBeGreaterThan(0);
    });

    it('recover phase settles translateX back to 0', () => {
      // t = 1.0 — animation complete
      const params = computeAnimParams(attackAt(0, 600, 600), 600);
      expect(params.translateX).toBeCloseTo(0, 5);
      expect(params.translateY).toBeCloseTo(0, 5);
      expect(params.scale).toBeCloseTo(1, 5);
      expect(params.colorShiftR).toBe(0);
    });

    it('honors durationOverride so ranged (400ms) and spell (500ms) finish earlier', () => {
      // 400ms duration → at elapsed=400 we should be at t=1 (recovered)
      const ranged = computeAnimParams(attackAt(0, 400, 400), 400);
      expect(ranged.translateX).toBeCloseTo(0, 5);

      // Without durationOverride honor, elapsed=400 against default 600 would
      // still be in strike phase with large negative translateX. Guard against
      // regression:
      const spell = computeAnimParams(attackAt(0, 500, 500), 500);
      expect(spell.translateX).toBeCloseTo(0, 5);
    });

    it('clamps t to 1 beyond the duration window', () => {
      const past = computeAnimParams(attackAt(0, 10_000, 600), 10_000);
      expect(past.translateX).toBeCloseTo(0, 5);
      expect(past.scale).toBeCloseTo(1, 5);
    });

    it('transitions continuously across the windup→strike boundary', () => {
      // Windup ends at t=0.25 (elapsed=150ms), strike begins the same t.
      // Both sides should evaluate to near-identical translateX so the
      // monster doesn't jump visually.
      const justBefore = computeAnimParams(attackAt(0, 149, 600), 149);
      const justAfter = computeAnimParams(attackAt(0, 151, 600), 151);
      expect(Math.abs(justBefore.translateX - justAfter.translateX)).toBeLessThan(2);
    });
  });
});
