type TilePosition = { x: number; y: number } | null | undefined;

type TileMonster = {
  id: string;
  isSpawned: boolean;
  inBattle?: boolean;
  currentHp: string | number;
  position: { x: number; y: number };
};

export function getMonstersOnTile<T extends TileMonster>(
  monsters: T[],
  position: TilePosition,
): T[] {
  if (!position || (position.x === 0 && position.y === 0)) return [];
  return monsters.filter(
    m =>
      m.isSpawned &&
      !m.inBattle &&
      Number(m.currentHp) > 0 &&
      m.position.x === position.x &&
      m.position.y === position.y,
  );
}
