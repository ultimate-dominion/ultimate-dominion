import type { Character } from './types';

type ZoneExitPosition = {
  x: number;
  y: number;
};

type CanUseDarkCaveExitArgs = {
  autoAdventureMode: boolean;
  currentZone: number;
  displayPosition?: ZoneExitPosition | null;
  level?: Character['level'] | number | string | bigint | null;
  showZ2: boolean;
};

export const DARK_CAVE_EXIT_TILE = { x: 5, y: 9 } as const;
export const DARK_CAVE_EXIT_LEVEL = 10;

export const canUseDarkCaveExit = ({
  autoAdventureMode,
  currentZone,
  displayPosition,
  level,
  showZ2,
}: CanUseDarkCaveExitArgs): boolean => {
  return (
    showZ2 &&
    Number(level ?? 1) >= DARK_CAVE_EXIT_LEVEL &&
    currentZone === 1 &&
    displayPosition?.x === DARK_CAVE_EXIT_TILE.x &&
    displayPosition?.y === DARK_CAVE_EXIT_TILE.y &&
    !autoAdventureMode
  );
};
