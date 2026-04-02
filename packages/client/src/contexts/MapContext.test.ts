import { describe, expect, it } from 'vitest';

import { entityInZone, resolveEntityPositionData } from './mapPosition';

describe('MapContext position resolution', () => {
  it('prefers legacy Position rows for monster placement when both tables exist', () => {
    const positionV1 = {
      monster: { x: 8, y: 8 },
    };
    const positionV2 = {
      monster: { zoneId: 1, x: 2, y: 2 },
    };

    expect(resolveEntityPositionData('monster', positionV2, positionV1, {
      preferLegacyPosition: true,
    })).toEqual({ x: 8, y: 8 });
  });

  it('uses PositionV2 zone filtering for entities that only exist in V2', () => {
    const positionV1 = {};
    const positionV2 = {
      monster: { zoneId: 2, x: 3, y: 3 },
    };

    expect(entityInZone('monster', 2, positionV2, positionV1, Number, {
      preferLegacyPosition: true,
    })).toBe(true);
    expect(entityInZone('monster', 1, positionV2, positionV1, Number, {
      preferLegacyPosition: true,
    })).toBe(false);
  });

  it('ignores stale V2 zone membership when a legacy Position row exists', () => {
    const positionV1 = {
      monster: { x: 5, y: 105 },
    };
    const positionV2 = {
      monster: { zoneId: 1, x: 5, y: 5 },
    };

    expect(entityInZone('monster', 1, positionV2, positionV1, Number, {
      preferLegacyPosition: true,
    })).toBe(false);
    expect(entityInZone('monster', 2, positionV2, positionV1, Number, {
      preferLegacyPosition: true,
    })).toBe(true);
  });
});
