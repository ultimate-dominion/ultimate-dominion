// ---------------------------------------------------------------------------
// World Map Layout — Authored ASCII terrain grid + zone definitions
// ---------------------------------------------------------------------------
// 40 rows x 60 cols. Each character maps to a terrain type.
// The map reads top-to-bottom as north-to-south (surface → underground).
// Vertical spine: The Silence (north ruins) → Windy Peaks (mountains) →
//   Mystic Grove (forest) → Dark Cave (underground) → The Blind (deep void)
// ---------------------------------------------------------------------------

export type TerrainType = 'mountain' | 'water' | 'forest' | 'plains' | 'cave' | 'town' | 'void';

export const TERRAIN_CONFIG: Record<TerrainType, {
  chars: string[];
  color: string;
  weight: number;
}> = {
  mountain: { chars: ['M', '^', 'A', 'W', 'N'], color: '#8A7E6A', weight: 700 },
  water:    { chars: ['~', '-', '=', '.', ','], color: '#3d6fb5', weight: 300 },
  forest:   { chars: ['f', 't', 'T', 'Y', 'I'], color: '#3d8a4e', weight: 500 },
  plains:   { chars: ['.', ',', '_', '-', "'"], color: '#C4B89E', weight: 300 },
  cave:     { chars: ['#', '%', '@', '&', '*'], color: '#5A4A3A', weight: 600 },
  town:     { chars: ['H', 'D', 'B', 'P', 'R'], color: '#C87A2A', weight: 500 },
  void:     { chars: [' ', ' ', '.', ' ', ' '], color: '#2E2820', weight: 300 },
};

// Terrain key: single char in the ASCII grid → TerrainType
const TERRAIN_KEY: Record<string, TerrainType> = {
  'M': 'mountain',
  '~': 'water',
  'f': 'forest',
  '.': 'plains',
  '#': 'cave',
  'H': 'town',
  ' ': 'void',
};

// ---------------------------------------------------------------------------
// Authored terrain grid — 40 rows × 60 columns
// The map is intentionally sparse. Void at edges = the Fraying.
// ---------------------------------------------------------------------------
const WORLD_MAP_STRINGS: string[] = [
  //         1111111111222222222233333333334444444444555555555
  //1234567890123456789012345678901234567890123456789012345678901234567890
  '                                                            ', // 0  — void
  '                                                            ', // 1  — void
  '                                                            ', // 2  — void
  '                         . .                                ', // 3  — scattered plains
  '                      ..   ..                               ', // 4  — sparse north
  '                   ...H......                               ', // 5  — The Silence (ruins)
  '                  ....H.......    .                          ', // 6  — ruins + plains
  '              ~~  ...........  .....                         ', // 7  — water + plains
  '             ~~~  .........  ......                          ', // 8  — water + transition
  '            ~~~~  ..MMMM..  .......   .                     ', // 9  — water + mountains begin
  '           ~~~~  .MMMMMMMM.........  ...                    ', // 10 — Windy Peaks west
  '          ~~~~  MMMMMMMMMMM........  ....                   ', // 11 — Windy Peaks
  '          ~~~  MMMMMMMMMMMM.......  ......                  ', // 12 — Windy Peaks core
  '         ~~~  MMMMMMMMMMMMMMM....  .......  ..              ', // 13 — Windy Peaks
  '         ~~  MMMMMMMMMMMMMMMM...  ........  ...             ', // 14 — Windy Peaks
  '         ~  .MMMMMMMMMMMMMMM...  .........  ....            ', // 15 — peaks taper
  '         ~  ..MMMMMMMMMMMM....  ..........  .....           ', // 16 — transition
  '         ~  ...MMMMMMMMM.....  ...........  .....           ', // 17 — transition
  '         ~~  ....MMMM......  ...ffff.....  .....            ', // 18 — grove begins
  '          ~  .............  ...ffffff....  .....             ', // 19 — Mystic Grove
  '          ~  ............  ...ffffffff..  .....              ', // 20 — Mystic Grove core
  '          ~~  ..........  ...ffffffffff  .....              ', // 21 — grove
  '           ~  .........  ...fffffffff.  ....                ', // 22 — grove tapers
  '           ~  ........  ....fffffff..  ....                 ', // 23 — transition
  '           ~~  ......  .....fffff...  ...                   ', // 24 — transition
  '            ~  .....  ......###....  ...                    ', // 25 — cave entrance
  '            ~~  ...  ......####...  ..                      ', // 26 — Dark Cave
  '             ~  ..  ......######.  ..                       ', // 27 — Dark Cave core
  '             ~~    .....########  .                         ', // 28 — Dark Cave
  '              ~   .....########.                            ', // 29 — Dark Cave
  '              ~  .....#######..                             ', // 30 — cave deep
  '              ~~  ....######.                               ', // 31 — cave tapers
  '               ~  ...####..                                 ', // 32 — deep cave
  '               ~~  ..##.                                    ', // 33 — transition to void
  '                ~  ...                                      ', // 34 — sparse
  '                 ~                                          ', // 35 — void
  '                                                            ', // 36 — void
  '                                                            ', // 37 — void
  '                                                            ', // 38 — void
  '                                                            ', // 39 — void
];

// Parse the ASCII grid into a 2D terrain array
function parseGrid(strings: string[]): TerrainType[][] {
  return strings.map(row => {
    // Pad to 60 chars
    const padded = row.padEnd(60);
    return Array.from(padded).map(ch => TERRAIN_KEY[ch] ?? 'void');
  });
}

export const WORLD_MAP_TERRAIN = parseGrid(WORLD_MAP_STRINGS);
export const MAP_ROWS = WORLD_MAP_TERRAIN.length;
export const MAP_COLS = 60;

// ---------------------------------------------------------------------------
// Zone regions — bounding boxes within the terrain grid
// ---------------------------------------------------------------------------
export type ZoneRegion = {
  zoneId: number;
  name: string;
  subtitle: string;
  boundingBox: { r1: number; c1: number; r2: number; c2: number };
  labelPosition: { row: number; col: number };
};

export const ZONE_REGIONS: ZoneRegion[] = [
  {
    zoneId: 1,
    name: 'Dark Cave',
    subtitle: "Noctum's Marrow",
    boundingBox: { r1: 25, c1: 20, r2: 32, c2: 35 },
    labelPosition: { row: 28, col: 27 },
  },
  {
    zoneId: 2,
    name: 'Windy Peaks',
    subtitle: 'Above the god-grave',
    boundingBox: { r1: 9, c1: 16, r2: 17, c2: 35 },
    labelPosition: { row: 12, col: 24 },
  },
];

// ---------------------------------------------------------------------------
// Rumored zones — named landmarks visible before they're reachable
// These create speculation and anticipation.
// ---------------------------------------------------------------------------
export type RumoredZone = {
  name: string;
  hint: string;
  position: { row: number; col: number };
};

export const RUMORED_ZONES: RumoredZone[] = [
  {
    name: 'The Silence',
    hint: 'Abandoned cities where loneliness is a physical force.',
    position: { row: 5, col: 25 },
  },
  {
    name: 'The Undertow',
    hint: 'The sea remembers.',
    position: { row: 14, col: 9 },
  },
  {
    name: 'Mystic Grove',
    hint: 'Ancient and tangled. The only way forward is down.',
    position: { row: 20, col: 28 },
  },
  {
    name: 'The Vigil',
    hint: 'Something still fights here.',
    position: { row: 13, col: 47 },
  },
];

// ---------------------------------------------------------------------------
// The Fraying — edge dissolution config
// ---------------------------------------------------------------------------
export const FRAYING_CHARS = ['░', '▒', '▓', '·', '∷', '╳', '.'];
export const FRAYING_DEPTH = 5; // cells from edge where Fraying is strongest
export const FRAYING_BLEND = 3; // additional cells of blending

/**
 * Returns 0-1 Fraying intensity for a cell. 1 = pure void, 0 = no Fraying.
 * Based on distance from nearest edge AND distance from authored terrain.
 */
export function frayingIntensity(row: number, col: number): number {
  const distTop = row;
  const distBottom = MAP_ROWS - 1 - row;
  const distLeft = col;
  const distRight = MAP_COLS - 1 - col;
  const minEdgeDist = Math.min(distTop, distBottom, distLeft, distRight);

  if (minEdgeDist >= FRAYING_DEPTH + FRAYING_BLEND) return 0;
  if (minEdgeDist <= FRAYING_DEPTH) return 1;
  // Blend zone
  return 1 - (minEdgeDist - FRAYING_DEPTH) / FRAYING_BLEND;
}

// ---------------------------------------------------------------------------
// Utility: find which zone a cell belongs to
// ---------------------------------------------------------------------------
export function getZoneAt(row: number, col: number): ZoneRegion | null {
  for (const zone of ZONE_REGIONS) {
    const { r1, c1, r2, c2 } = zone.boundingBox;
    if (row >= r1 && row <= r2 && col >= c1 && col <= c2) return zone;
  }
  return null;
}

/**
 * Find which rumored zone label is near this cell (within 3 cells of label position).
 */
export function getRumoredZoneNear(row: number, col: number): RumoredZone | null {
  for (const rz of RUMORED_ZONES) {
    const dr = Math.abs(row - rz.position.row);
    const dc = Math.abs(col - rz.position.col);
    if (dr <= 2 && dc <= 6) return rz;
  }
  return null;
}
