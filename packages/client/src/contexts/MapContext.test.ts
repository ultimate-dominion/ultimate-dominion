import { describe, expect, it } from 'vitest';

import { decodeMobInstancePosition, mobEntityMatchesPosition } from '../utils/helpers';
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

  it('prefers PositionV2 zoneId for zone membership when both tables exist', () => {
    const positionV1 = {
      monster: { x: 1, y: 1 },
    };
    const positionV2 = {
      monster: { zoneId: 2, x: 1, y: 1 },
    };

    expect(entityInZone('monster', 1, positionV2, positionV1, Number)).toBe(false);
    expect(entityInZone('monster', 2, positionV2, positionV1, Number)).toBe(true);
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

  it('prefers legacy Position rows for player position when V2 drifts', () => {
    const positionV1 = {
      player: { x: 0, y: 2 },
    };
    const positionV2 = {
      player: { zoneId: 0, x: 0, y: 0 },
    };

    expect(resolveEntityPositionData('player', positionV2, positionV1, {
      preferLegacyPosition: true,
    })).toEqual({ x: 0, y: 2 });
  });

  it('decodes mob tile coordinates from the entity id', () => {
    const monsterId = '0x000000050000000000000000000000000000000000000000000012f700010003';

    expect(decodeMobInstancePosition(monsterId)).toEqual({ x: 1, y: 3 });
  });

  it('rejects stale tile placement when the monster id encodes a different tile', () => {
    const validTarget = '0x0000000500000000000000000000000000000000000000000000131500010001';
    const staleTarget = '0x000000050000000000000000000000000000000000000000000012f700010003';

    expect(mobEntityMatchesPosition(validTarget, { x: 1, y: 1 })).toBe(true);
    expect(mobEntityMatchesPosition(staleTarget, { x: 1, y: 1 })).toBe(false);
    expect(mobEntityMatchesPosition(staleTarget, { x: 1, y: 3 })).toBe(true);
  });
});
