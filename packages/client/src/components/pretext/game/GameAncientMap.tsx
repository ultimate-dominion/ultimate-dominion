import { useCallback, useRef, useMemo, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { COLORS } from '../theme';
import type { Character, Monster, Npc, Shop, WorldBoss } from '../../../utils/types';

type Props = {
  /** 10x10 grid size */
  gridSize: number;
  /** Player's display position (0-based) */
  displayPosition: { x: number; y: number } | null;
  /** All monsters in the zone */
  allMonsters: Monster[];
  /** All characters in the zone */
  allCharacters: Character[];
  /** All shops in the zone */
  allShops: Shop[];
  /** All NPCs in the zone */
  allNpcs: Npc[];
  /** World bosses */
  worldBosses: WorldBoss[];
  /** Safe zone boundary — col/row ranges (display coords) */
  safeZone: { topLeft: { x: number; y: number }; bottomRight: { x: number; y: number } } | null;
  /** Zone exit tile (display coords) */
  exitTile: { x: number; y: number } | null;
  /** Whether player is spawned */
  isSpawned: boolean;
  /** Current zone number (for terrain variation) */
  currentZone: number;
  /** Delegator address to exclude self from player counts */
  delegatorAddress: string | undefined;
};

// Terrain character sets per zone
const ZONE_TERRAIN: Record<number, { chars: string[]; color: string; weight: number }> = {
  1: { chars: ['#', '%', '@', '&', '*', '.', ','], color: '#3A3228', weight: 400 },  // Dark Cave
  2: { chars: ['^', 'M', 'A', 'W', 'N', '.', ','], color: '#5A5248', weight: 400 },  // Windy Peaks
};

const SAFE_ZONE_CHARS = ['.', ',', '_', '-', "'"];
const SAFE_ZONE_COLOR = '#3A3020';

// Entity marker characters
const PLAYER_CHAR = '@';
const MONSTER_CHAR = 'M';
const SHOP_CHAR = '$';
const NPC_CHAR = '?';
const BOSS_CHAR = 'X';
const EXIT_CHAR = 'O';

// Fog of war characters — dense, mysterious glyphs that writhe in the dark
const FOG_CHARS = ['░', '▒', '▓', '█', '╬', '╫', '╪', '┼', '╳', '◊', '∷', '≈'];
const FOG_COLOR = '#1A1714';
const FOG_REVEAL_DURATION = 1200; // ms for reveal animation

// ---------------------------------------------------------------------------
// Fog persistence — tracks which tiles each character has explored per zone
// ---------------------------------------------------------------------------
function fogStorageKey(zone: number): string {
  return `fog_z${zone}`;
}

function loadVisitedTiles(zone: number): Set<string> {
  try {
    const raw = localStorage.getItem(fogStorageKey(zone));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveVisitedTiles(zone: number, tiles: Set<string>): void {
  try {
    localStorage.setItem(fogStorageKey(zone), JSON.stringify([...tiles]));
  } catch { /* quota exceeded — fog state is cosmetic, ignore */ }
}

/**
 * Canvas ASCII map with fog of war.
 * Tiles are hidden until the player visits them. Current tile + orthogonal
 * neighbors are always visible. Unvisited tiles show writhing dark glyphs.
 */
export function GameAncientMap({
  gridSize,
  displayPosition,
  allMonsters,
  allCharacters,
  allShops,
  allNpcs,
  worldBosses,
  safeZone,
  exitTile,
  isSpawned,
  currentZone,
  delegatorAddress,
}: Props) {
  const hoverRef = useRef<{ col: number; row: number } | null>(null);

  // Fog of war state — persistent across sessions
  const visitedRef = useRef<Set<string>>(loadVisitedTiles(currentZone));
  const revealTimesRef = useRef<Map<string, number>>(new Map()); // key → timestamp when revealed

  // Reload visited tiles when zone changes
  useEffect(() => {
    visitedRef.current = loadVisitedTiles(currentZone);
    revealTimesRef.current.clear();
  }, [currentZone]);

  // Reveal current tile + neighbors when position changes
  useEffect(() => {
    if (!displayPosition || !isSpawned) return;
    const { x, y } = displayPosition;
    const now = performance.now();
    const visited = visitedRef.current;
    const reveals = revealTimesRef.current;
    let changed = false;

    // Current tile + orthogonal neighbors (diamond shape = 1 tile away)
    const tilesToReveal = [
      { x, y },
      { x: x - 1, y }, { x: x + 1, y },
      { x, y: y - 1 }, { x, y: y + 1 },
    ];

    for (const t of tilesToReveal) {
      if (t.x < 0 || t.x >= gridSize || t.y < 0 || t.y >= gridSize) continue;
      const key = `${t.x},${t.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        reveals.set(key, now);
        changed = true;
      }
    }

    if (changed) {
      saveVisitedTiles(currentZone, visited);
    }
  }, [displayPosition, isSpawned, currentZone, gridSize]);

  // Pre-compute entity positions as a lookup map: "col,row" -> entity info
  const entityMap = useMemo(() => {
    const map: Record<string, { monsters: number; players: number; shops: boolean; npcs: boolean; boss: WorldBoss | null; isExit: boolean }> = {};

    const getKey = (x: number, y: number) => `${x},${y}`;
    const ensure = (key: string) => {
      if (!map[key]) map[key] = { monsters: 0, players: 0, shops: false, npcs: false, boss: null, isExit: false };
      return map[key];
    };

    for (const m of allMonsters) {
      if (m.currentHp > 0n && m.isSpawned) {
        const key = getKey(m.position.x, m.position.y);
        ensure(key).monsters++;
      }
    }

    for (const c of allCharacters) {
      if (c.isSpawned && c.owner.toLowerCase() !== delegatorAddress?.toLowerCase()) {
        const key = getKey(c.position.x, c.position.y);
        ensure(key).players++;
      }
    }

    for (const s of allShops) {
      const key = getKey(s.position.x, s.position.y);
      ensure(key).shops = true;
    }

    for (const n of allNpcs) {
      const key = getKey(n.position.x, n.position.y);
      ensure(key).npcs = true;
    }

    for (const b of worldBosses) {
      if (b.isAlive) {
        const key = getKey(b.spawnX, b.spawnY);
        ensure(key).boss = b;
      }
    }

    if (exitTile) {
      const key = getKey(exitTile.x, exitTile.y);
      ensure(key).isExit = true;
    }

    return map;
  }, [allMonsters, allCharacters, allShops, allNpcs, worldBosses, exitTile, delegatorAddress]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // Grid cell sizing — square cells, fit into available space
      const cellSize = Math.floor(Math.min(width, height) / gridSize);
      const offsetX = Math.floor((width - cellSize * gridSize) / 2);
      const offsetY = Math.floor((height - cellSize * gridSize) / 2);
      const fontSize = Math.max(8, Math.floor(cellSize * 0.5));

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const terrain = ZONE_TERRAIN[currentZone] || ZONE_TERRAIN[1];
      const visited = visitedRef.current;
      const reveals = revealTimesRef.current;
      const now = performance.now();

      // Render grid
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          // Display coords: row 0 is top of grid = y=9 in game, row 9 = y=0
          const displayRow = gridSize - 1 - row;
          const cx = offsetX + col * cellSize + cellSize / 2;
          const cy = offsetY + row * cellSize + cellSize / 2;
          const cellX = offsetX + col * cellSize;
          const cellY = offsetY + row * cellSize;

          const tileKey = `${col},${displayRow}`;
          const isVisited = visited.has(tileKey);
          const isPlayerTile = displayPosition && displayPosition.x === col && displayPosition.y === displayRow;
          const entityKey = tileKey;
          const entities = entityMap[entityKey];
          const isHovered = hoverRef.current?.col === col && hoverRef.current?.row === row;

          // Safe zone check
          const inSafeZone = safeZone &&
            col >= safeZone.topLeft.x && col <= safeZone.bottomRight.x &&
            displayRow >= safeZone.bottomRight.y && displayRow <= safeZone.topLeft.y;

          // --- FOG OF WAR: unvisited tiles ---
          if (!isVisited && !isPlayerTile) {
            // Dense dark fog — writhing glyphs
            const fogSeed = Math.abs(displayRow * 7 + col * 13 + currentZone * 5);
            const fogCharIdx = Math.floor(fogSeed + elapsed / 2000) % FOG_CHARS.length;
            const fogChar = FOG_CHARS[fogCharIdx];

            // Very subtle grid line
            ctx.strokeStyle = COLORS.border;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.1;
            ctx.strokeRect(cellX, cellY, cellSize, cellSize);

            // Fog character — dark, slowly shifting
            ctx.font = `400 ${fontSize}px Fira Code`;
            ctx.fillStyle = FOG_COLOR;
            ctx.globalAlpha = 0.15 + Math.sin((fogSeed + elapsed / 4000) * 0.5) * 0.05;
            ctx.fillText(fogChar, cx, cy);

            // Dim silhouette hint for important POIs (boss, shop, exit)
            if (entities?.boss) {
              ctx.fillStyle = COLORS.danger;
              ctx.globalAlpha = 0.08 + Math.sin(elapsed / 2000) * 0.04;
              ctx.font = `700 ${fontSize + 2}px Fira Code`;
              ctx.fillText('?', cx, cy);
            } else if (entities?.shops) {
              ctx.fillStyle = COLORS.glow;
              ctx.globalAlpha = 0.08;
              ctx.font = `700 ${fontSize}px Fira Code`;
              ctx.fillText('?', cx, cy);
            }
            ctx.globalAlpha = 1;
            continue;
          }

          // --- REVEAL ANIMATION ---
          let revealAlpha = 1;
          let revealFlash = 0;
          const revealTime = reveals.get(tileKey);
          if (revealTime !== undefined) {
            const age = now - revealTime;
            if (age < FOG_REVEAL_DURATION) {
              const t = age / FOG_REVEAL_DURATION;
              // Ease-out quad
              revealAlpha = t * (2 - t);
              // Amber flash at start, fading
              revealFlash = Math.max(0, 1 - t * 2);
            } else {
              // Animation done — remove from tracking
              reveals.delete(tileKey);
            }
          }

          // Flash overlay for newly revealed tiles
          if (revealFlash > 0) {
            ctx.fillStyle = COLORS.amber;
            ctx.globalAlpha = revealFlash * 0.15;
            ctx.fillRect(cellX, cellY, cellSize, cellSize);
            ctx.globalAlpha = 1;
          }

          // Grid lines
          ctx.strokeStyle = COLORS.border;
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.3 * revealAlpha;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
          ctx.globalAlpha = 1;

          // Safe zone tint
          if (inSafeZone) {
            ctx.fillStyle = 'rgba(200,122,42,0.06)';
            ctx.globalAlpha = revealAlpha;
            ctx.fillRect(cellX, cellY, cellSize, cellSize);
            ctx.globalAlpha = 1;
          }

          // --- Entity rendering (priority order) ---

          // Player position — bright amber @
          if (isPlayerTile && isSpawned) {
            ctx.font = `700 ${fontSize + 2}px Fira Code`;
            ctx.fillStyle = COLORS.amber;
            ctx.shadowColor = COLORS.amber;
            ctx.shadowBlur = 6 + Math.sin(elapsed / 600) * 3;
            ctx.fillText(PLAYER_CHAR, cx, cy);
            ctx.shadowBlur = 0;
            continue;
          }

          // Boss tile — pulsing red X
          if (entities?.boss) {
            ctx.font = `700 ${fontSize + 2}px Fira Code`;
            ctx.fillStyle = COLORS.danger;
            ctx.shadowColor = COLORS.danger;
            ctx.shadowBlur = 4 + Math.sin(elapsed / 1000) * 4;
            ctx.globalAlpha = (0.7 + Math.sin(elapsed / 1500) * 0.3) * revealAlpha;
            ctx.fillText(BOSS_CHAR, cx, cy);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            continue;
          }

          // Exit tile — pulsing portal
          if (entities?.isExit) {
            ctx.font = `700 ${fontSize}px Fira Code`;
            ctx.fillStyle = '#B4C6D4';
            ctx.shadowColor = '#B4C6D4';
            ctx.shadowBlur = 4 + Math.sin(elapsed / 800) * 4;
            ctx.globalAlpha = (0.5 + Math.sin(elapsed / 1200) * 0.3) * revealAlpha;
            ctx.fillText(EXIT_CHAR, cx, cy);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            continue;
          }

          // Shops
          if (entities?.shops) {
            ctx.font = `700 ${fontSize}px Fira Code`;
            ctx.fillStyle = COLORS.glow;
            ctx.globalAlpha = revealAlpha;
            ctx.fillText(SHOP_CHAR, cx, cy);
            ctx.globalAlpha = 1;
            continue;
          }

          // NPCs
          if (entities?.npcs) {
            ctx.font = `700 ${fontSize}px Fira Code`;
            ctx.fillStyle = '#4fc3f7';
            ctx.globalAlpha = revealAlpha;
            ctx.fillText(NPC_CHAR, cx, cy);
            ctx.globalAlpha = 1;
            continue;
          }

          // Monsters on tile
          if (entities && entities.monsters > 0) {
            ctx.font = `600 ${fontSize}px Fira Code`;
            ctx.fillStyle = '#B85C3A';
            ctx.globalAlpha = (isHovered ? 1 : 0.7) * revealAlpha;
            ctx.fillText(MONSTER_CHAR, cx, cy);
            // Monster count in corner
            if (entities.monsters > 1) {
              ctx.font = `600 ${Math.max(7, fontSize - 4)}px Fira Code`;
              ctx.fillStyle = '#B85C3A';
              ctx.textAlign = 'right';
              ctx.fillText(
                String(entities.monsters),
                offsetX + (col + 1) * cellSize - 2,
                offsetY + (row + 1) * cellSize - fontSize * 0.4,
              );
              ctx.textAlign = 'center';
            }
            ctx.globalAlpha = 1;
            continue;
          }

          // Other players on tile
          if (entities && entities.players > 0) {
            ctx.font = `500 ${fontSize - 1}px Fira Code`;
            ctx.fillStyle = COLORS.success;
            ctx.globalAlpha = 0.6 * revealAlpha;
            ctx.fillText(String(entities.players), cx, cy);
            ctx.globalAlpha = 1;
            continue;
          }

          // Terrain fill — deterministic character based on position
          const charIndex = Math.abs((displayRow * 7 + col * 13 + currentZone * 3) % terrain.chars.length);
          const terrainChar = inSafeZone
            ? SAFE_ZONE_CHARS[charIndex % SAFE_ZONE_CHARS.length]
            : terrain.chars[charIndex];

          ctx.font = `${terrain.weight} ${fontSize - 1}px Cormorant Garamond`;
          ctx.fillStyle = inSafeZone ? SAFE_ZONE_COLOR : terrain.color;
          ctx.globalAlpha = (isHovered
            ? 0.8
            : 0.2 + Math.sin((displayRow + col + elapsed / 3000) * 0.7) * 0.08) * revealAlpha;
          ctx.fillText(terrainChar, cx, cy);
          ctx.globalAlpha = 1;
        }
      }

      // Safe zone border overlay
      if (safeZone) {
        const tlCol = safeZone.topLeft.x;
        const tlRow = gridSize - 1 - safeZone.topLeft.y;  // display y → grid row
        const brCol = safeZone.bottomRight.x;
        const brRow = gridSize - 1 - safeZone.bottomRight.y;

        const x1 = offsetX + tlCol * cellSize;
        const y1 = offsetY + tlRow * cellSize;
        const x2 = offsetX + (brCol + 1) * cellSize;
        const y2 = offsetY + (brRow + 1) * cellSize;

        ctx.strokeStyle = COLORS.amber;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4 + Math.sin(elapsed / 2000) * 0.1;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.globalAlpha = 1;
      }

      // Fog boundary glow — subtle amber line where revealed meets fog
      ctx.save();
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const displayRow = gridSize - 1 - row;
          const tileKey = `${col},${displayRow}`;
          if (!visited.has(tileKey)) continue;

          // Check each edge for fog adjacency
          const neighbors = [
            { dx: 0, dy: 1, edge: 'top' },    // tile above (displayRow+1)
            { dx: 0, dy: -1, edge: 'bottom' }, // tile below (displayRow-1)
            { dx: -1, dy: 0, edge: 'left' },
            { dx: 1, dy: 0, edge: 'right' },
          ];

          for (const n of neighbors) {
            const nx = col + n.dx;
            const ny = displayRow + n.dy;
            if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
            if (visited.has(`${nx},${ny}`)) continue;

            // This edge borders fog — draw a subtle glow line
            const cellX = offsetX + col * cellSize;
            const cellY = offsetY + row * cellSize;
            ctx.strokeStyle = COLORS.amber;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.15 + Math.sin(elapsed / 3000 + col * 0.5 + row * 0.3) * 0.05;

            ctx.beginPath();
            if (n.edge === 'top') {
              ctx.moveTo(cellX, cellY);
              ctx.lineTo(cellX + cellSize, cellY);
            } else if (n.edge === 'bottom') {
              ctx.moveTo(cellX, cellY + cellSize);
              ctx.lineTo(cellX + cellSize, cellY + cellSize);
            } else if (n.edge === 'left') {
              ctx.moveTo(cellX, cellY);
              ctx.lineTo(cellX, cellY + cellSize);
            } else {
              ctx.moveTo(cellX + cellSize, cellY);
              ctx.lineTo(cellX + cellSize, cellY + cellSize);
            }
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // Axis labels
      ctx.font = `500 ${Math.max(7, fontSize - 3)}px Fira Code`;
      ctx.fillStyle = COLORS.textMuted;
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'center';
      for (let i = 0; i < gridSize; i++) {
        // Bottom — column numbers
        ctx.fillText(
          String(i),
          offsetX + i * cellSize + cellSize / 2,
          offsetY + gridSize * cellSize + Math.max(8, fontSize - 2),
        );
        // Left — row numbers (display y)
        ctx.textAlign = 'right';
        ctx.fillText(
          String(gridSize - 1 - i),
          offsetX - 4,
          offsetY + i * cellSize + cellSize / 2,
        );
        ctx.textAlign = 'center';
      }
      ctx.globalAlpha = 1;

      // Hover tooltip
      const hover = hoverRef.current;
      if (hover && hover.col >= 0 && hover.col < gridSize && hover.row >= 0 && hover.row < gridSize) {
        const displayRow = gridSize - 1 - hover.row;
        const key = `${hover.col},${displayRow}`;
        const isHoverVisited = visited.has(key);
        const ent = entityMap[key];
        const parts: string[] = [`(${hover.col},${displayRow})`];

        if (!isHoverVisited) {
          parts.push('Unexplored');
        } else {
          if (ent?.monsters) parts.push(`${ent.monsters} monster${ent.monsters > 1 ? 's' : ''}`);
          if (ent?.players) parts.push(`${ent.players} player${ent.players > 1 ? 's' : ''}`);
          if (ent?.shops) parts.push('Shop');
          if (ent?.npcs) parts.push('NPC');
          if (ent?.boss) parts.push('BOSS');
          if (ent?.isExit) parts.push('Zone Exit');
        }

        const label = parts.join(' | ');
        ctx.font = `400 11px Fira Code`;
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText(label, offsetX, height - 4);
      }
    },
    [gridSize, displayPosition, entityMap, safeZone, isSpawned, currentZone],
  );

  const { canvasRef } = useCanvas({ onFrame });

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        const touch = e.touches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const cellSize = Math.floor(Math.min(rect.width, rect.height) / gridSize);
      const offsetX = Math.floor((rect.width - cellSize * gridSize) / 2);
      const offsetY = Math.floor((rect.height - cellSize * gridSize) / 2);

      const col = Math.floor((mx - offsetX) / cellSize);
      const row = Math.floor((my - offsetY) / cellSize);

      if (col >= 0 && col < gridSize && row >= 0 && row < gridSize) {
        hoverRef.current = { col, row };
      } else {
        hoverRef.current = null;
      }
    },
    [canvasRef, gridSize],
  );

  const handleLeave = useCallback(() => {
    hoverRef.current = null;
  }, []);

  return (
    <Box position="absolute" inset={0}>
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        aria-label="ASCII dungeon map"
      />
    </Box>
  );
}
