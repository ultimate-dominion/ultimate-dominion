import { useCallback, useRef, useEffect, useState } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

// Character palette sorted by visual density (dark → bright)
const CHAR_PALETTE = ' .`\'-,:;!~+*=?#%@MWBN';

// Build brightness table for characters
function buildCharBrightness(): number[] {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  return Array.from(CHAR_PALETTE).map(char => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${size}px Cormorant Garamond`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      sum += imageData.data[i]; // alpha channel = coverage
    }
    return sum / (size * size * 255);
  });
}

const BOSS_NAMES = [
  'WRAITHKING',
  'LICH LORD',
  'FLAME WYRM',
  'VOID TITAN',
  'BONE GOD',
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  brightness: number;
  decay: number;
};

export function BossAsciiSplash() {
  const { ready } = usePretextFonts();
  const [bossIdx, setBossIdx] = useState(0);
  const [key, setKey] = useState(0);
  const brightnessRef = useRef<number[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<'fadein' | 'hold' | 'fadeout'>('fadein');
  const phaseTimerRef = useRef(0);

  // Build brightness table once
  useEffect(() => {
    if (!ready) return;
    brightnessRef.current = buildCharBrightness();
  }, [ready]);

  // Reset particles on boss change
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        brightness: Math.random() * 0.8 + 0.2,
        decay: 0.998 + Math.random() * 0.002,
      });
    }
    particlesRef.current = particles;
    phaseRef.current = 'fadein';
    phaseTimerRef.current = 0;
  }, [bossIdx, key]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    // Fill background
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
    } else if (phase === 'hold' && phaseTimerRef.current > 1500) {
      phaseRef.current = 'fadeout';
      phaseTimerRef.current = 0;
    }

    // Global alpha for phase
    let globalAlpha = 1;
    if (phase === 'fadein') globalAlpha = Math.min(1, phaseTimerRef.current / 2000);
    else if (phase === 'fadeout') globalAlpha = Math.max(0, 1 - phaseTimerRef.current / 1500);

    if (globalAlpha <= 0) return;

    // Update particles
    const particles = particlesRef.current;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Bounce off edges
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

    // Render the boss name as large centered text to a temporary brightness field
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = cols;
    nameCanvas.height = rows;
    const nameCtx = nameCanvas.getContext('2d')!;
    nameCtx.fillStyle = '#000';
    nameCtx.fillRect(0, 0, cols, rows);
    nameCtx.fillStyle = '#fff';
    const nameFontSize = Math.max(4, Math.min(cols / (BOSS_NAMES[bossIdx].length * 0.7), rows * 0.6));
    nameCtx.font = `700 ${nameFontSize}px Cinzel`;
    nameCtx.textAlign = 'center';
    nameCtx.textBaseline = 'middle';
    nameCtx.fillText(BOSS_NAMES[bossIdx], cols / 2, rows / 2);
    const nameData = nameCtx.getImageData(0, 0, cols, rows);

    // Render ASCII grid
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Sample name brightness
        const px = (row * cols + col) * 4;
        const nameBrightness = nameData.data[px] / 255;

        // Sample particle field
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

        // Combine: name shape + particle atmosphere
        const combined = Math.min(1, nameBrightness * 0.7 + particleBrightness * 0.4);
        if (combined < 0.03) continue;

        // Find best character
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

        // Weight based on brightness
        const weight = combined < 0.3 ? 400 : combined < 0.6 ? 600 : 700;
        const fontSize = cellW * 1.1;
        ctx.font = `${weight} ${fontSize}px Cormorant Garamond`;

        // Color: amber gradient based on brightness
        const r = Math.floor(200 * combined);
        const g = Math.floor(122 * combined);
        const b = Math.floor(42 * combined);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${globalAlpha * (0.3 + combined * 0.7)})`;

        ctx.fillText(char, col * cellW + cellW / 2, row * cellH + cellH / 2);
      }
    }

    // Boss name subtitle (below the ASCII art)
    ctx.globalAlpha = globalAlpha * 0.6;
    ctx.font = '400 16px Cormorant Garamond';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('A great terror approaches...', width / 2, height * 0.82);
    ctx.globalAlpha = 1;
  }, [bossIdx]);

  const { canvasRef } = useCanvas({ onFrame });

  const handleNext = useCallback(() => {
    setBossIdx(i => (i + 1) % BOSS_NAMES.length);
    setKey(k => k + 1);
  }, []);

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
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={4} left={0} right={0} textAlign="center" zIndex={1}>
        <Button
          size="xs"
          variant="outline"
          color={COLORS.amber}
          borderColor={COLORS.border}
          onClick={handleNext}
          _hover={{ bg: COLORS.bgHover }}
        >
          Next Boss
        </Button>
      </Box>
    </Box>
  );
}
