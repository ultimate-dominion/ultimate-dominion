/**
 * BattleBossSplash — Full-screen ASCII name splash on elite/boss encounter.
 *
 * Renders the boss name as giant ASCII art composed of density-matched
 * characters in an amber-to-gold gradient. Floating particles add atmosphere.
 *
 * Phase timing: fadein (2s) → hold (1.5s) → auto-complete.
 * First-encounter only via localStorage key.
 * Skip on tap/click.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS, FONTS, fontString } from '../theme';

// Character palette sorted by visual density (dark → bright)
const CHAR_PALETTE = ' .`\'-,:;!~+*=?#%@MWBN';

function buildCharBrightness(): number[] {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  return Array.from(CHAR_PALETTE).map(char => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${size}px ${FONTS.serif}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      sum += imageData.data[i];
    }
    return sum / (size * size * 255);
  });
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  brightness: number;
};

const COMPLETE_DELAY = 3500;

/**
 * Check if this boss splash has been shown before.
 * Returns true if already seen (should skip).
 */
export function hasBossSplashBeenSeen(bossName: string): boolean {
  return localStorage.getItem(`boss-splash-seen-${bossName}`) === '1';
}

/** Mark boss splash as seen. */
export function markBossSplashSeen(bossName: string): void {
  localStorage.setItem(`boss-splash-seen-${bossName}`, '1');
}

export function BattleBossSplash({
  bossName,
  onComplete,
}: {
  bossName: string;
  onComplete: () => void;
}) {
  const { ready } = usePretextFonts();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);
  const brightnessRef = useRef<number[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<'fadein' | 'hold' | 'done'>('fadein');
  const phaseTimerRef = useRef(0);

  // Build brightness table
  useEffect(() => {
    if (!ready) return;
    brightnessRef.current = buildCharBrightness();
  }, [ready]);

  // Init particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        brightness: Math.random() * 0.8 + 0.2,
      });
    }
    particlesRef.current = particles;
  }, []);

  // Mark as seen immediately
  useEffect(() => {
    markBossSplashSeen(bossName);
  }, [bossName]);

  // Auto-complete timer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current();
      }
    }, COMPLETE_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const displayName = bossName.toUpperCase();

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const brightness = brightnessRef.current;
    if (brightness.length === 0) return;

    // Phase management
    phaseTimerRef.current += dt;
    const phase = phaseRef.current;
    if (phase === 'fadein' && phaseTimerRef.current > 2000) {
      phaseRef.current = 'hold';
      phaseTimerRef.current = 0;
    }

    let globalAlpha = 1;
    if (phase === 'fadein') globalAlpha = Math.min(1, phaseTimerRef.current / 2000);

    if (globalAlpha <= 0) return;

    // Update particles
    const particles = particlesRef.current;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
      p.x = Math.max(0, Math.min(1, p.x));
      p.y = Math.max(0, Math.min(1, p.y));
    }

    // Grid dimensions
    const cellW = Math.max(8, Math.min(14, width / 80));
    const cellH = cellW * 1.4;
    const cols = Math.floor(width / cellW);
    const rows = Math.floor(height / cellH);

    // Render boss name as brightness field
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = cols;
    nameCanvas.height = rows;
    const nameCtx = nameCanvas.getContext('2d')!;
    nameCtx.fillStyle = '#000';
    nameCtx.fillRect(0, 0, cols, rows);
    nameCtx.fillStyle = '#fff';
    const nameFontSize = Math.max(4, Math.min(cols / (displayName.length * 0.7), rows * 0.6));
    nameCtx.font = `700 ${nameFontSize}px ${FONTS.heading}`;
    nameCtx.textAlign = 'center';
    nameCtx.textBaseline = 'middle';
    nameCtx.fillText(displayName, cols / 2, rows / 2);
    const nameData = nameCtx.getImageData(0, 0, cols, rows);

    // Render ASCII grid
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = (row * cols + col) * 4;
        const nameBrightness = nameData.data[px] / 255;

        const nx = col / cols;
        const ny = row / rows;
        let particleBrightness = 0;
        for (const p of particles) {
          const dx = nx - p.x;
          const dy = ny - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          particleBrightness += p.brightness * Math.max(0, 1 - dist * 6);
        }
        particleBrightness = Math.min(1, particleBrightness);

        const combined = Math.min(1, nameBrightness * 0.7 + particleBrightness * 0.4);
        if (combined < 0.03) continue;

        let bestIdx = 0;
        let bestDiff = 1;
        for (let i = 0; i < brightness.length; i++) {
          const diff = Math.abs(brightness[i] - combined);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }

        const char = CHAR_PALETTE[bestIdx];
        if (char === ' ') continue;

        const weight = combined < 0.3 ? 400 : combined < 0.6 ? 600 : 700;
        const fontSize = cellW * 1.1;
        ctx.font = `${weight} ${fontSize}px ${FONTS.serif}`;

        const r = Math.floor(200 * combined);
        const g = Math.floor(122 * combined);
        const b = Math.floor(42 * combined);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${globalAlpha * (0.3 + combined * 0.7)})`;

        ctx.fillText(char, col * cellW + cellW / 2, row * cellH + cellH / 2);
      }
    }

    // Subtitle
    ctx.globalAlpha = globalAlpha * 0.6;
    ctx.font = fontString('serif', 16);
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('A great terror approaches...', width / 2, height * 0.82);
    ctx.globalAlpha = 1;
  }, [displayName]);

  const handleSkip = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current();
    }
  }, []);

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={999}
      onClick={handleSkip}
      onTouchStart={handleSkip}
      cursor="pointer"
      aria-label="Boss encounter splash"
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}
