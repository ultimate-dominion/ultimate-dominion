const ZONE_ORIGIN_SPACING = 100;

const ZONE_ORIGINS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: ZONE_ORIGIN_SPACING },
};

/** Check if a raw position falls within a zone's coordinate bounds */
export function isInZone(rawX: number, rawY: number, zoneId: number, gridSize = 10): boolean {
  const origin = ZONE_ORIGINS[zoneId] ?? { x: 0, y: 0 };
  return rawX >= origin.x && rawX < origin.x + gridSize
    && rawY >= origin.y && rawY < origin.y + gridSize;
}

export function resolveEntityPositionData(
  entityId: string,
  posV2Table: Record<string, any>,
  posV1Table: Record<string, any>,
  options?: { preferLegacyPosition?: boolean },
): Record<string, unknown> | undefined {
  const preferLegacyPosition = options?.preferLegacyPosition ?? false;
  const v1 = posV1Table[entityId] as Record<string, unknown> | undefined;
  const v2 = posV2Table[entityId] as Record<string, unknown> | undefined;

  if (preferLegacyPosition && v1) return v1;
  return v2 ?? v1;
}

/**
 * Check if an entity belongs to the given zone using PositionV2 zoneId.
 * PositionV2 stores zone-relative coords (0-9), so coordinate bounds alone
 * can't distinguish zones — we must check the zoneId field directly.
 * Falls back to coordinate bounds for legacy Position-only entities.
 */
export function entityInZone(
  entityId: string,
  targetZone: number,
  posV2Table: Record<string, any>,
  posV1Table: Record<string, any>,
  toNum: (v: unknown) => number,
  options?: { preferLegacyPosition?: boolean },
): boolean {
  const preferLegacyPosition = options?.preferLegacyPosition ?? false;
  const v1 = posV1Table[entityId];
  if (preferLegacyPosition && v1) {
    return isInZone(toNum(v1.x), toNum(v1.y), targetZone);
  }

  const v2 = posV2Table[entityId];
  if (v2) {
    const zoneId = toNum(v2.zoneId);
    return zoneId === 0 ? targetZone === 1 : zoneId === targetZone;
  }
  if (v1) {
    return isInZone(toNum(v1.x), toNum(v1.y), targetZone);
  }
  return false;
}
