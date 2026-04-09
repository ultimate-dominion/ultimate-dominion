import { Box } from '@chakra-ui/react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts, getFontString } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';

export type DamageType =
  | 'damage'
  | 'crit'
  | 'double'
  | 'critDouble'
  | 'enemyDamage'
  | 'enemyCrit'
  | 'blocked'
  | 'dodged'
  | 'heal'
  | 'gold'
  | 'miss';

export type BattleFloatingDamageHandle = {
  spawn: (x: number, y: number, type: DamageType, value?: number, hitCount?: number) => void;
};

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
const FADE_SPEED = 0.0013;

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
        text: `CRIT ${value}`,
        color: COLORS.danger,
        font: getFontString('cinzel-700', 26),
        vy: -1.8,
        scale: 1.5,
      };
    case 'double':
      return {
        text: `${value}`,
        color: '#A8DEFF',
        font: getFontString('cinzel-700', 22),
        vy: -1.55,
        scale: 1.25,
      };
    case 'critDouble':
      return {
        text: `CRIT ${value}`,
        color: '#F3D27A',
        font: getFontString('cinzel-700', 28),
        vy: -2.0,
        scale: 1.7,
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
    case 'enemyDamage':
      return {
        text: `${value}`,
        color: '#D4CCC0',
        font: getFontString('firaCode-600', 20),
        vy: -1.4,
        scale: 1,
      };
    case 'enemyCrit':
      return {
        text: `CRIT ${value}`,
        color: '#D98030',
        font: getFontString('cinzel-700', 24),
        vy: -1.7,
        scale: 1.4,
      };
    case 'blocked':
      return {
        text: `BLOCKED ${value}`,
        color: '#5AAFAF',
        font: getFontString('cinzel-700', 20),
        vy: -1.3,
        scale: 1.15,
      };
    case 'dodged':
      return {
        text: 'DODGED',
        color: COLORS.textMuted,
        font: getFontString('cinzel-600', 18),
        vy: -1.0,
        scale: 1.05,
      };
    case 'miss':
      return {
        text: 'MISS',
        color: COLORS.textMuted,
        font: getFontString('cinzel-600', 18),
        vy: -1.0,
        scale: 1.05,
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

/**
 * Canvas overlay that renders floating damage/heal/gold numbers during combat.
 * Exposes an imperative `spawn` method via ref for external triggering.
 */
export const BattleFloatingDamage = forwardRef<BattleFloatingDamageHandle>(
  function BattleFloatingDamage(_props, ref) {
    const poolRef = useRef<FloatingNumber[]>(createPool());
    const nextIndexRef = useRef(0);
    const { ready } = usePretextFonts();

    const spawn = useCallback(
      (x: number, y: number, type: DamageType, value?: number, hitCount?: number) => {
        const pool = poolRef.current;
        const idx = nextIndexRef.current % POOL_SIZE;
        nextIndexRef.current++;

        const config = getConfig(type, value ?? 0);
        // Add combo hit count suffix: "42 x7"
        const text = hitCount && hitCount > 1 ? `${config.text} x${hitCount}` : config.text;
        const n = pool[idx];
        n.active = true;
        n.text = text;
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
      },
      [],
    );

    useImperativeHandle(ref, () => ({ spawn }), [spawn]);

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

        if (
          (n.type === 'crit' || n.type === 'double' || n.type === 'critDouble' ||
           n.type === 'enemyCrit' || n.type === 'blocked') &&
          n.scale > 1
        ) {
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
        if (
          (n.type === 'crit' || n.type === 'double' || n.type === 'critDouble' ||
           n.type === 'enemyCrit' || n.type === 'blocked') &&
          n.opacity > 0.5
        ) {
          ctx.shadowColor = n.color;
          ctx.shadowBlur = n.type === 'critDouble' ? 20 : 12;
          ctx.fillText(
            n.text,
            n.scale !== 1 ? 0 : n.x,
            n.scale !== 1 ? 0 : n.y,
          );
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }
    }, []);

    const { canvasRef } = useCanvas({ onFrame });

    if (!ready) return null;

    return (
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents="none"
        zIndex={10}
        aria-label="Combat damage numbers"
      >
        <canvas
          ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
    );
  },
);
