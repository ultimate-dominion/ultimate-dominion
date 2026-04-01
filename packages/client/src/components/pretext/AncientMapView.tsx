import { useCallback, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { useCanvas, getPointerPos } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

type TerrainType = 'mountain' | 'water' | 'forest' | 'plains' | 'cave' | 'town' | 'void';

const TERRAIN_CONFIG: Record<TerrainType, {
  chars: string[];
  color: string;
  weight: number;
}> = {
  mountain: { chars: ['M', '^', 'A', 'W', 'N'], color: '#8A7E6A', weight: 700 },
  water: { chars: ['~', '-', '=', '.', ','], color: '#3d6fb5', weight: 300 },
  forest: { chars: ['f', 't', 'T', 'Y', 'I'], color: '#3d8a4e', weight: 500 },
  plains: { chars: ['.', ',', '_', '-', '\''], color: '#C4B89E', weight: 300 },
  cave: { chars: ['#', '%', '@', '&', '*'], color: '#5A4A3A', weight: 600 },
  town: { chars: ['H', 'D', 'B', 'P', 'R'], color: COLORS.amber, weight: 500 },
  void: { chars: [' ', ' ', '.', ' ', ' '], color: '#2E2820', weight: 300 },
};

type POI = {
  name: string;
  row: number;
  col: number;
};

// Generate a simple terrain map
function generateMap(cols: number, rows: number): { terrain: TerrainType[][]; pois: POI[] } {
  const terrain: TerrainType[][] = [];
  const pois: POI[] = [];

  // Simple noise-based generation
  for (let r = 0; r < rows; r++) {
    terrain[r] = [];
    for (let c = 0; c < cols; c++) {
      const nx = c / cols;
      const ny = r / rows;

      // Create terrain zones
      const centerDist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2);
      const noise = Math.sin(nx * 12) * Math.cos(ny * 8) * 0.5 + 0.5;

      if (centerDist > 0.45) {
        terrain[r][c] = 'void';
      } else if (ny < 0.2 && noise > 0.4) {
        terrain[r][c] = 'mountain';
      } else if (Math.abs(nx - 0.5) < 0.05 + Math.sin(ny * 6) * 0.03) {
        terrain[r][c] = 'water';
      } else if (nx < 0.35 && ny > 0.4) {
        terrain[r][c] = 'forest';
      } else if (nx > 0.65 && ny > 0.3 && ny < 0.6) {
        terrain[r][c] = 'cave';
      } else {
        terrain[r][c] = 'plains';
      }
    }
  }

  // Place POIs
  const poiDefs = [
    { name: 'Starting Cavern', row: Math.floor(rows * 0.7), col: Math.floor(cols * 0.5) },
    { name: 'Frozen Depths', row: Math.floor(rows * 0.1), col: Math.floor(cols * 0.4) },
    { name: 'Thornveil', row: Math.floor(rows * 0.5), col: Math.floor(cols * 0.2) },
    { name: 'Dark Cave', row: Math.floor(rows * 0.45), col: Math.floor(cols * 0.75) },
    { name: 'The Keep', row: Math.floor(rows * 0.3), col: Math.floor(cols * 0.5) },
  ];

  for (const poi of poiDefs) {
    if (poi.row < rows && poi.col < cols) {
      terrain[poi.row][poi.col] = 'town';
      pois.push(poi);
    }
  }

  return { terrain, pois };
}

export function AncientMapView() {
  const { ready } = usePretextFonts();
  const mapRef = useRef<ReturnType<typeof generateMap> | null>(null);
  const hoverRef = useRef<{ row: number; col: number } | null>(null);
  const mapSizeRef = useRef({ cols: 0, rows: 0 });

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const cellW = Math.max(10, Math.min(16, width / 60));
    const cellH = cellW * 1.3;
    const cols = Math.floor(width / cellW);
    const rows = Math.floor((height - 40) / cellH); // leave room for hover info

    // Regenerate map if size changed
    if (cols !== mapSizeRef.current.cols || rows !== mapSizeRef.current.rows) {
      mapRef.current = generateMap(cols, rows);
      mapSizeRef.current = { cols, rows };
    }

    const map = mapRef.current;
    if (!map) return;

    // Render terrain
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let r = 0; r < rows && r < map.terrain.length; r++) {
      for (let c = 0; c < cols && c < map.terrain[r].length; c++) {
        const type = map.terrain[r][c];
        const config = TERRAIN_CONFIG[type];
        const char = config.chars[Math.floor((r * 7 + c * 13) % config.chars.length)];

        if (char === ' ') continue;

        const isHovered = hoverRef.current?.row === r && hoverRef.current?.col === c;
        ctx.font = `${config.weight} ${cellW}px Cormorant Garamond`;
        ctx.fillStyle = config.color;
        ctx.globalAlpha = type === 'void' ? 0.15 : isHovered ? 1 : 0.6 + Math.sin((r + c + elapsed / 2000) * 0.5) * 0.1;

        ctx.fillText(char, c * cellW + cellW / 2, r * cellH + cellH / 2);
      }
    }

    // Render POI labels
    ctx.globalAlpha = 1;
    for (const poi of map.pois) {
      if (poi.row >= rows || poi.col >= cols) continue;

      ctx.font = '600 11px Cinzel';
      ctx.fillStyle = COLORS.glow;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.bg;
      ctx.shadowBlur = 4;
      ctx.fillText(poi.name, poi.col * cellW + cellW / 2, poi.row * cellH + cellH / 2 - cellH * 0.8);
      ctx.shadowBlur = 0;

      // Dot marker
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(poi.col * cellW + cellW / 2, poi.row * cellH + cellH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover info
    const hover = hoverRef.current;
    if (hover && hover.row < rows && hover.col < cols && hover.row < map.terrain.length) {
      const type = map.terrain[hover.row]?.[hover.col];
      if (type) {
        ctx.font = '400 13px Fira Code';
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText(
          `${type.toUpperCase()} (${hover.col}, ${hover.row})`,
          8,
          height - 12,
        );
      }
    }
  }, []);

  const { canvasRef } = useCanvas({ onFrame, interactive: true });

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPointerPos(e, canvas);
    const { width } = canvas.getBoundingClientRect();
    const cellW = Math.max(10, Math.min(16, width / 60));
    const cellH = cellW * 1.3;
    hoverRef.current = {
      col: Math.floor(pos.x / cellW),
      row: Math.floor(pos.y / cellH),
    };
  }, [canvasRef]);

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

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
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        />
      </Box>
    </Box>
  );
}
