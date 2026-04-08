import { describe, it, expect } from 'vitest';

import {
  computeHitReaction,
  HIT_REACTION_IDLE,
  REACTION_DURATION,
  easeOutCubic,
  easeInQuad,
} from './impactEffects';

describe('impactEffects', () => {
  describe('computeHitReaction', () => {
    it('returns IDLE when elapsed exceeds tier duration', () => {
      expect(computeHitReaction(301, 400, 'hit')).toEqual(HIT_REACTION_IDLE);
      expect(computeHitReaction(401, 400, 'stagger')).toEqual(HIT_REACTION_IDLE);
      expect(computeHitReaction(501, 400, 'critical')).toEqual(HIT_REACTION_IDLE);
    });

    it('returns non-zero recoil at impact start', () => {
      const hit = computeHitReaction(0, 400, 'hit');
      expect(hit.offsetX).toBeGreaterThan(0);
      expect(hit.flash).toBeGreaterThan(0);
    });

    it('critical tier has stronger recoil than hit tier', () => {
      const hit = computeHitReaction(0, 400, 'hit');
      const critical = computeHitReaction(0, 400, 'critical');
      expect(critical.offsetX).toBeGreaterThan(hit.offsetX);
    });

    it('stagger tier is between hit and critical', () => {
      const hit = computeHitReaction(0, 400, 'hit');
      const stagger = computeHitReaction(0, 400, 'stagger');
      const critical = computeHitReaction(0, 400, 'critical');
      expect(stagger.offsetX).toBeGreaterThan(hit.offsetX);
      expect(stagger.offsetX).toBeLessThan(critical.offsetX);
    });

    it('recoil decreases over time', () => {
      const early = computeHitReaction(50, 400, 'hit');
      const late = computeHitReaction(200, 400, 'hit');
      expect(late.offsetX).toBeLessThan(early.offsetX);
    });

    it('defaults to hit tier when no tier specified', () => {
      const defaultTier = computeHitReaction(0, 400);
      const hitTier = computeHitReaction(0, 400, 'hit');
      expect(defaultTier).toEqual(hitTier);
    });
  });

  describe('REACTION_DURATION', () => {
    it('hit is shortest, critical is longest', () => {
      expect(REACTION_DURATION.hit).toBeLessThan(REACTION_DURATION.stagger);
      expect(REACTION_DURATION.stagger).toBeLessThan(REACTION_DURATION.critical);
    });
  });

  describe('easing functions', () => {
    it('easeOutCubic starts at 0 and ends at 1', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
    });

    it('easeInQuad starts at 0 and ends at 1', () => {
      expect(easeInQuad(0)).toBe(0);
      expect(easeInQuad(1)).toBe(1);
    });
  });
});
