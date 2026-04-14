import { describe, expect, it } from 'vitest';

import { canUseDarkCaveExit } from './zoneExit';

const baseArgs = {
  autoAdventureMode: false,
  currentZone: 1,
  displayPosition: { x: 5, y: 9 },
  level: 10,
  showZ2: true,
};

describe('canUseDarkCaveExit', () => {
  it('allows the Windy Peaks exit at level 10 without requiring advanced class selection', () => {
    expect(canUseDarkCaveExit(baseArgs)).toBe(true);
  });

  it('blocks the exit before level 10', () => {
    expect(canUseDarkCaveExit({ ...baseArgs, level: 9 })).toBe(false);
  });

  it('blocks the exit off the Dark Cave exit tile', () => {
    expect(
      canUseDarkCaveExit({ ...baseArgs, displayPosition: { x: 5, y: 8 } }),
    ).toBe(false);
  });

  it('blocks the exit when Z2 is disabled or auto-adventure is active', () => {
    expect(canUseDarkCaveExit({ ...baseArgs, showZ2: false })).toBe(false);
    expect(canUseDarkCaveExit({ ...baseArgs, autoAdventureMode: true })).toBe(
      false,
    );
  });
});
