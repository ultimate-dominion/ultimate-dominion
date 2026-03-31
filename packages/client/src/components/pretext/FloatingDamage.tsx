import { useCallback, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { useCanvas, getPointerPos } from './hooks/useCanvas';
import { usePretextFonts, getFontString } from './hooks/usePretextFonts';
import { COLORS } from './theme';

type DamageType = 'damage' | 'crit' | 'heal' | 'gold';

type FloatingNumber = {
  active: boolean;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  scale: number;
  color: string;
  font: string;
  type: DamageType;
  age: number;
};

const POOL_SIZE = 50;
const GRAVITY = -0.03;
const FADE_SPEED = 0.0015;

function createPool(): FloatingNumber[] {
  return Array.from({ length: POOL_SIZE }, () => ({
    active: false,
    text: '',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    opacity: 0,
    scale: 1,
    color: '',
    font: '',
    type: 'damage' as DamageType,
    age: 0,
  }));
}

function getConfig(type: DamageType, value: number) {
  switch (type) {
    case 'crit':
      return {
        text: `${value}!`,
        color: COLORS.danger,
        font: getFontString('cinzel-700', 28),
        vy: -1.8,
        scale: 1.5,
      };
    case 'heal':
      return {
        text: `+${value}`,
        color: COLORS.success,
        font: getFontString('firaCode-500', 18),
        vy: -1.2,
        scale: 1,
      };
    case 'gold':
      return {
        text: `+${value} gold`,
        color: COLORS.glow,
        font: getFontString('firaCode-500', 16),
        vy: -0.8,
        scale: 1,
      };
    default:
      return {
        text: `${value}`,
        color: COLORS.danger,
        font: getFontString('firaCode-600', 20),
        vy: -1.4,
        scale: 1,
      };
  }
}

export function FloatingDamage() {
  const poolRef = useRef<FloatingNumber[]>(createPool());
  const nextIndexRef = useRef(0);
  const { ready } = usePretextFonts();

  const spawn = useCallback((x: number, y: number, type: DamageType) => {
    const pool = poolRef.current;
    const idx = nextIndexRef.current % POOL_SIZE;
    nextIndexRef.current++;

    const value = type === 'gold'
      ? Math.floor(Math.random() * 50) + 5
      : type === 'heal'
        ? Math.floor(Math.random() * 30) + 10
        : type === 'crit'
          ? Math.floor(Math.random() * 100) + 50
          : Math.floor(Math.random() * 40) + 5;

    const config = getConfig(type, value);
    const n = pool[idx];
    n.active = true;
    n.text = config.text;
    n.x = x;
    n.y = y;
    n.vx = (Math.random() - 0.5) * 0.6;
    n.vy = config.vy;
    n.opacity = 1;
    n.scale = config.scale;
    n.color = config.color;
    n.font = config.font;
    n.type = type;
    n.age = 0;
  }, []);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const pool = poolRef.current;
    for (const n of pool) {
      if (!n.active) continue;

      n.age += dt;
      n.x += n.vx;
      n.y += n.vy;
      n.vy += GRAVITY;
      n.opacity -= FADE_SPEED * dt;

      // Crits scale down over time
      if (n.type === 'crit' && n.scale > 1) {
        n.scale = Math.max(1, n.scale - 0.002 * dt);
      }

      if (n.opacity <= 0.01) {
        n.active = false;
        continue;
      }

      ctx.save();
      ctx.globalAlpha = n.opacity;
      ctx.font = n.font;
      ctx.fillStyle = n.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (n.scale !== 1) {
        ctx.translate(n.x, n.y);
        ctx.scale(n.scale, n.scale);
        ctx.fillText(n.text, 0, 0);
      } else {
        ctx.fillText(n.text, n.x, n.y);
      }

      // Crit glow
      if (n.type === 'crit' && n.opacity > 0.5) {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 12;
        ctx.fillText(n.text, n.type === 'crit' && n.scale !== 1 ? 0 : n.x, n.type === 'crit' && n.scale !== 1 ? 0 : n.y);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }
  }, []);

  const { canvasRef, width, height } = useCanvas({
    onFrame,
    interactive: true,
  });

  const handlePointer = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getPointerPos(e, canvas);
      const types: DamageType[] = ['damage', 'crit', 'heal', 'gold'];
      const type = types[Math.floor(Math.random() * types.length)];
      spawn(pos.x, pos.y, type);
    },
    [spawn, canvasRef],
  );

  const spawnBurst = useCallback(() => {
    const w = width || 300;
    const h = height || 300;
    const types: DamageType[] = ['damage', 'crit', 'heal', 'gold'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        spawn(
          w * 0.2 + Math.random() * w * 0.6,
          h * 0.3 + Math.random() * h * 0.4,
          types[Math.floor(Math.random() * types.length)],
        );
      }, i * 80);
    }
  }, [spawn, width, height]);

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

  return (
    <Box position="relative" w="100%" h="100%">
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg={COLORS.bg}
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          onClick={handlePointer}
          onTouchStart={handlePointer}
          style={{ cursor: 'crosshair', display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={4} left={0} right={0} textAlign="center" zIndex={1}>
        <Text
          as="button"
          onClick={spawnBurst}
          color={COLORS.amber}
          fontFamily="heading"
          fontSize="sm"
          cursor="pointer"
          _hover={{ color: COLORS.glow }}
        >
          Click anywhere or tap here for a burst
        </Text>
      </Box>
    </Box>
  );
}
