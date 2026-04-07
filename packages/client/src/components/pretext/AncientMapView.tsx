import { useCallback, useRef, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas, getPointerPos } from './hooks/useCanvas';
import { COLORS } from './theme';
import {
  WORLD_MAP_TERRAIN,
  TERRAIN_CONFIG,
  MAP_ROWS,
  MAP_COLS,
  ZONE_REGIONS,
  RUMORED_ZONES,
  FRAYING_CHARS,
  frayingIntensity,
  getZoneAt,
  getRumoredZoneNear,
  type ZoneRegion,
  type RumoredZone,
} from './worldMapLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ZoneVisibility = 'discovered' | 'rumored' | 'void';

export type WorldMapProps = {
  /** Which zones are discovered/rumored/void. Default: both zones discovered. */
  zoneVisibility?: Record<number, ZoneVisibility>;
  /** Player's current zone (for marker). Default: 1. */
  currentZone?: number;
  /** Called when player clicks a zone region. */
  onZoneClick?: (zoneId: number) => void;
};

// Default: both implemented zones discovered (for pretext-lab standalone)
const DEFAULT_VISIBILITY: Record<number, ZoneVisibility> = { 1: 'discovered', 2: 'discovered' };

// Dragon piece image — reuse the same one from GameAncientMap
let _dragonImg: HTMLImageElement | null = null;
let _dragonLoaded = false;
if (typeof window !== 'undefined') {
  _dragonImg = new Image();
  _dragonImg.onload = () => { _dragonLoaded = true; };
  _dragonImg.src = '/images/ud-dragon.svg';
}

// ---------------------------------------------------------------------------
// Reveal animation tracking
// ---------------------------------------------------------------------------
const REVEAL_DURATION = 1500;

function getZoneVisibility(
  zoneId: number,
  visibilityMap: Record<number, ZoneVisibility>,
): ZoneVisibility {
  return visibilityMap[zoneId] ?? 'void';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AncientMapView({
  zoneVisibility = DEFAULT_VISIBILITY,
  currentZone = 1,
  onZoneClick,
}: WorldMapProps) {
  const hoverRef = useRef<{ row: number; col: number } | null>(null);
  const prevVisibilityRef = useRef<Record<number, ZoneVisibility>>(zoneVisibility);
  const revealAnimRef = useRef<Map<number, number>>(new Map()); // zoneId → timestamp

  // Detect visibility changes for reveal animation
  useEffect(() => {
    const prev = prevVisibilityRef.current;
    const now = performance.now();
    for (const zone of ZONE_REGIONS) {
      const prevVis = prev[zone.zoneId] ?? 'void';
      const newVis = zoneVisibility[zone.zoneId] ?? 'void';
      if (prevVis !== 'discovered' && newVis === 'discovered') {
        revealAnimRef.current.set(zone.zoneId, now);
      }
    }
    prevVisibilityRef.current = { ...zoneVisibility };
  }, [zoneVisibility]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // Cell sizing — fit grid into canvas
      const cellW = Math.max(8, Math.min(16, width / MAP_COLS));
      const cellH = cellW * 1.3;
      const gridW = cellW * MAP_COLS;
      const gridH = cellH * MAP_ROWS;
      const offsetX = Math.floor((width - gridW) / 2);
      const offsetY = Math.floor((height - gridH) / 2);

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const now = performance.now();
      const hover = hoverRef.current;

      // ---------------------------------------------------------------
      // Pass 1: Terrain characters
      // ---------------------------------------------------------------
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          const terrain = WORLD_MAP_TERRAIN[r][c];
          const cx = offsetX + c * cellW + cellW / 2;
          const cy = offsetY + r * cellH + cellH / 2;

          const frayIntensity = frayingIntensity(r, c);
          const zone = getZoneAt(r, c);
          const isHovered = hover?.row === r && hover?.col === c;

          // Determine what visibility state applies to this cell
          let cellVis: ZoneVisibility = 'void';
          if (zone) {
            cellVis = getZoneVisibility(zone.zoneId, zoneVisibility);
          } else if (terrain !== 'void') {
            // Terrain outside any zone bounding box — show at reduced alpha
            cellVis = 'rumored';
          }

          // Fraying overlay — edge cells become void regardless
          if (frayIntensity > 0.8) {
            // Pure Fraying — writhing void chars
            const frayIdx = Math.floor(Math.abs(r * 7 + c * 13) + elapsed / 3000) % FRAYING_CHARS.length;
            ctx.font = `300 ${cellW}px Fira Code`;
            ctx.fillStyle = '#2E2820';
            ctx.globalAlpha = 0.08 + Math.sin((r + c + elapsed / 5000) * 0.4) * 0.03;
            ctx.fillText(FRAYING_CHARS[frayIdx], cx, cy);
            ctx.globalAlpha = 1;
            continue;
          }

          if (terrain === 'void') continue;

          const config = TERRAIN_CONFIG[terrain];
          const charIdx = Math.abs((r * 7 + c * 13) % config.chars.length);
          const ch = config.chars[charIdx];

          // Base alpha by visibility state
          let alpha: number;
          if (cellVis === 'discovered') {
            alpha = isHovered ? 0.9 : 0.5 + Math.sin((r + c + elapsed / 2500) * 0.5) * 0.08;
          } else if (cellVis === 'rumored') {
            alpha = 0.08 + Math.sin((r + c + elapsed / 4000) * 0.3) * 0.03;
          } else {
            alpha = 0;
          }

          // Fraying blend — fade terrain near edges
          if (frayIntensity > 0) {
            alpha *= (1 - frayIntensity);
          }

          // Reveal animation — override alpha during transition
          if (zone) {
            const revealStart = revealAnimRef.current.get(zone.zoneId);
            if (revealStart !== undefined) {
              const age = now - revealStart;
              if (age < REVEAL_DURATION) {
                const t = age / REVEAL_DURATION;
                const eased = t * (2 - t); // ease-out quad
                alpha = eased * alpha;
              } else {
                revealAnimRef.current.delete(zone.zoneId);
              }
            }
          }

          if (alpha <= 0) continue;

          ctx.font = `${config.weight} ${cellW}px Cormorant Garamond`;
          ctx.fillStyle = config.color;
          ctx.globalAlpha = alpha;
          ctx.fillText(ch, cx, cy);
          ctx.globalAlpha = 1;
        }
      }

      // ---------------------------------------------------------------
      // Pass 2: Zone labels (discovered zones)
      // ---------------------------------------------------------------
      for (const zone of ZONE_REGIONS) {
        const vis = getZoneVisibility(zone.zoneId, zoneVisibility);
        if (vis !== 'discovered') continue;

        const lx = offsetX + zone.labelPosition.col * cellW + cellW / 2;
        const ly = offsetY + zone.labelPosition.row * cellH + cellH / 2;

        // Zone name
        const nameFontSize = Math.max(10, Math.min(14, cellW * 1.2));
        ctx.font = `600 ${nameFontSize}px Cinzel`;
        ctx.fillStyle = COLORS.glow;
        ctx.textAlign = 'center';
        ctx.shadowColor = COLORS.bg;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.9;
        ctx.fillText(zone.name.toUpperCase(), lx, ly);
        ctx.shadowBlur = 0;

        // Subtitle
        const subFontSize = Math.max(8, nameFontSize - 3);
        ctx.font = `400 ${subFontSize}px Cormorant Garamond`;
        ctx.fillStyle = COLORS.textMuted;
        ctx.globalAlpha = 0.6;
        ctx.fillText(zone.subtitle, lx, ly + nameFontSize + 2);
        ctx.globalAlpha = 1;

        // Amber dot marker
        ctx.fillStyle = COLORS.amber;
        ctx.beginPath();
        ctx.arc(lx, ly - nameFontSize - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---------------------------------------------------------------
      // Pass 3: Rumored zone names (ghostly, pulsing)
      // ---------------------------------------------------------------
      for (const rz of RUMORED_ZONES) {
        const rx = offsetX + rz.position.col * cellW + cellW / 2;
        const ry = offsetY + rz.position.row * cellH + cellH / 2;

        const nameFontSize = Math.max(9, Math.min(12, cellW * 1.0));
        ctx.font = `italic 400 ${nameFontSize}px Cormorant Garamond`;
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.18 + Math.sin(elapsed / 3000 + rz.position.row * 0.5) * 0.06;
        ctx.fillText(rz.name + ' ?', rx, ry);
        ctx.globalAlpha = 1;
      }

      // ---------------------------------------------------------------
      // Pass 4: Player marker — dragon at current zone
      // ---------------------------------------------------------------
      const currentZoneRegion = ZONE_REGIONS.find(z => z.zoneId === currentZone);
      if (currentZoneRegion) {
        const px = offsetX + currentZoneRegion.labelPosition.col * cellW + cellW / 2;
        const py = offsetY + currentZoneRegion.labelPosition.row * cellH - cellH * 2.5;

        if (_dragonLoaded && _dragonImg) {
          const dragonH = cellH * 2.5;
          const dragonW = dragonH * (_dragonImg.naturalWidth / _dragonImg.naturalHeight);
          ctx.shadowColor = COLORS.amber;
          ctx.shadowBlur = 6 + Math.sin(elapsed / 600) * 3;
          ctx.globalAlpha = 0.9;
          ctx.drawImage(_dragonImg, px - dragonW / 2, py - dragonH / 2, dragonW, dragonH);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        } else {
          // Fallback pulsing diamond
          ctx.fillStyle = COLORS.amber;
          ctx.shadowColor = COLORS.amber;
          ctx.shadowBlur = 6 + Math.sin(elapsed / 600) * 3;
          ctx.globalAlpha = 0.9;
          ctx.font = `700 ${cellW * 1.5}px Fira Code`;
          ctx.textAlign = 'center';
          ctx.fillText('◆', px, py);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      // ---------------------------------------------------------------
      // Pass 5: Zone boundary glow (discovered zones)
      // ---------------------------------------------------------------
      ctx.save();
      for (const zone of ZONE_REGIONS) {
        const vis = getZoneVisibility(zone.zoneId, zoneVisibility);
        if (vis !== 'discovered') continue;

        const { r1, c1, r2, c2 } = zone.boundingBox;
        const x1 = offsetX + c1 * cellW;
        const y1 = offsetY + r1 * cellH;
        const x2 = offsetX + (c2 + 1) * cellW;
        const y2 = offsetY + (r2 + 1) * cellH;

        ctx.strokeStyle = COLORS.amber;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.12 + Math.sin(elapsed / 3000) * 0.04;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
      ctx.restore();

      // ---------------------------------------------------------------
      // Pass 6: Hover info bar
      // ---------------------------------------------------------------
      if (hover && hover.row >= 0 && hover.row < MAP_ROWS && hover.col >= 0 && hover.col < MAP_COLS) {
        const zone = getZoneAt(hover.row, hover.col);
        const rumored = getRumoredZoneNear(hover.row, hover.col);
        let label = '';

        if (zone) {
          const vis = getZoneVisibility(zone.zoneId, zoneVisibility);
          if (vis === 'discovered') {
            label = `${zone.name.toUpperCase()} — ${zone.subtitle}`;
          } else if (vis === 'rumored') {
            label = `${zone.name} — Unexplored`;
          }
        } else if (rumored) {
          label = `${rumored.name} — ${rumored.hint}`;
        } else {
          const terrain = WORLD_MAP_TERRAIN[hover.row][hover.col];
          if (terrain !== 'void') {
            label = terrain.toUpperCase();
          }
        }

        if (label) {
          ctx.font = '400 11px Fira Code';
          ctx.fillStyle = COLORS.textMuted;
          ctx.textAlign = 'left';
          ctx.globalAlpha = 0.7;
          ctx.fillText(label, offsetX + 4, offsetY + gridH + Math.max(10, cellH * 0.8));
          ctx.globalAlpha = 1;
        }
      }
    },
    [zoneVisibility, currentZone],
  );

  const { canvasRef } = useCanvas({ onFrame });

  // Mouse/touch tracking
  const cellDims = useRef({ cellW: 12, cellH: 15.6, offsetX: 0, offsetY: 0 });

  const updateCellDims = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const cellW = Math.max(8, Math.min(16, width / MAP_COLS));
    const cellH = cellW * 1.3;
    const gridW = cellW * MAP_COLS;
    const gridH = cellH * MAP_ROWS;
    cellDims.current = {
      cellW,
      cellH,
      offsetX: Math.floor((width - gridW) / 2),
      offsetY: Math.floor((height - gridH) / 2),
    };
  }, [canvasRef]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    updateCellDims();
    const pos = getPointerPos(e, canvas);
    const { cellW, cellH, offsetX, offsetY } = cellDims.current;
    const col = Math.floor((pos.x - offsetX) / cellW);
    const row = Math.floor((pos.y - offsetY) / cellH);
    hoverRef.current = { row, col };
  }, [canvasRef, updateCellDims]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onZoneClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    updateCellDims();
    const pos = getPointerPos(e, canvas);
    const { cellW, cellH, offsetX, offsetY } = cellDims.current;
    const col = Math.floor((pos.x - offsetX) / cellW);
    const row = Math.floor((pos.y - offsetY) / cellH);
    const zone = getZoneAt(row, col);
    if (zone) onZoneClick(zone.zoneId);
  }, [canvasRef, onZoneClick, updateCellDims]);

  const handleLeave = useCallback(() => {
    hoverRef.current = null;
  }, []);

  return (
    <Box position="relative" w="100%" h="100%">
      <Box
        position="absolute"
        top={0} left={0} right={0} bottom={0}
        bg={COLORS.bg}
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onTouchMove={handleMove}
          onClick={handleClick}
          onMouseLeave={handleLeave}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          aria-label="World map"
        />
      </Box>
    </Box>
  );
}
