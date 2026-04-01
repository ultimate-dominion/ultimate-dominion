import { useCallback, useRef, useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';

type CharParticle = {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
};

type Props = {
  /** Text to dissolve */
  text: string;
  /** Text color (particles inherit this) */
  color: string;
  /** When true, triggers the dissolve animation */
  active: boolean;
  /** Font size in px (default 28) */
  fontSize?: number;
  /** Called when all particles have fully faded */
  onComplete?: () => void;
};

const GRAVITY = 0.004;
const FADE_RATE = 0.0007;
const FONT_FAMILY = 'Cinzel';

/**
 * Dissolves text into flying character particles.
 * Characters scatter outward with gravity, rotation, and fade.
 * Render as absolute overlay on the target element.
 */
export function TextDissolve({ text, color, active, fontSize = 28, onComplete }: Props) {
  const { ready } = usePretextFonts();
  const [dissolving, setDissolving] = useState(false);
  const particlesRef = useRef<CharParticle[]>([]);
  const completedRef = useRef(false);

  // Trigger dissolve when active transitions to true
  useEffect(() => {
    if (!active || !ready) return;

    // Measure character positions
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d')!;
    offCtx.font = `700 ${fontSize}px ${FONT_FAMILY}`;

    const chars = Array.from(text);
    let x = 0;
    const positions: { char: string; x: number; width: number }[] = [];
    for (const char of chars) {
      const w = offCtx.measureText(char).width;
      positions.push({ char, x, width: w });
      x += w;
    }
    const totalWidth = x;

    // Create particles
    particlesRef.current = positions.map((p, i) => {
      const angle = (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 1.2 + Math.random() * 2.5;
      const side = i < chars.length / 2 ? -1 : 1;
      return {
        char: p.char,
        x: p.x - totalWidth / 2,
        y: 0,
        vx: Math.sin(angle) * speed * side,
        vy: -Math.random() * 2 - 0.8,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.06,
        opacity: 1,
      };
    });

    completedRef.current = false;
    setDissolving(true);
  }, [active, ready, text, fontSize]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      if (!dissolving) {
        // Show intact text centered
        if (active) return; // waiting for dissolve trigger
        ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillText(text, width / 2, height / 2);
        ctx.shadowBlur = 0;
        return;
      }

      const particles = particlesRef.current;
      const cx = width / 2;
      const cy = height / 2;
      let anyAlive = false;

      for (const p of particles) {
        if (p.opacity <= 0.01) continue;
        anyAlive = true;

        // Physics
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt * 0.3;
        p.y += p.vy * dt * 0.3;
        p.rotation += p.rotationSpeed * dt;
        p.opacity -= FADE_RATE * dt;

        // Render
        ctx.save();
        ctx.translate(cx + p.x, cy + p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      }

      if (!anyAlive && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    },
    [dissolving, active, text, color, fontSize, onComplete],
  );

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
      zIndex={2}
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label={`${text} dissolving`}
      />
    </Box>
  );
}
