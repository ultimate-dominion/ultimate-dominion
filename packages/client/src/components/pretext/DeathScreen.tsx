import { useCallback, useRef, useState } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

const DEATHS = [
  { name: 'ShadowBlade', monster: 'The Lich King', zone: 'Frozen Depths', level: 42 },
  { name: 'IronVow', monster: 'Flame Wyrm', zone: 'Molten Core', level: 38 },
  { name: 'NightWhisper', monster: 'Abyssal Knight', zone: 'The Void', level: 25 },
  { name: 'VoidWalker', monster: 'Cave Rat', zone: 'Starting Cavern', level: 3 },
];

type LineSpec = {
  text: string;
  font: string;
  color: string;
  delay: number; // ms before this line starts appearing
};

function buildLines(death: typeof DEATHS[0]): LineSpec[] {
  return [
    { text: 'YOU HAVE FALLEN', font: '700 14px Fira Code', color: COLORS.danger, delay: 500 },
    { text: '', font: '400 16px Cormorant Garamond', color: 'transparent', delay: 0 },
    { text: `Here lies ${death.name}`, font: '700 28px Cinzel', color: COLORS.textPrimary, delay: 1000 },
    { text: '', font: '400 16px Cormorant Garamond', color: 'transparent', delay: 0 },
    { text: 'Felled by', font: '400 18px Cormorant Garamond', color: COLORS.textMuted, delay: 1800 },
    { text: death.monster, font: '700 24px Cinzel', color: COLORS.danger, delay: 2200 },
    { text: '', font: '400 16px Cormorant Garamond', color: 'transparent', delay: 0 },
    { text: `in the ${death.zone}`, font: '400 16px Cormorant Garamond', color: COLORS.textMuted, delay: 2800 },
    { text: `Level ${death.level}`, font: '500 14px Fira Code', color: COLORS.textMuted, delay: 3200 },
  ];
}

export function DeathScreen() {
  const { ready } = usePretextFonts();
  const [deathIdx, setDeathIdx] = useState(0);
  const [key, setKey] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const death = DEATHS[deathIdx];
  const lines = buildLines(death);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();

    // Dark overlay with vignette
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Amber vignette from edges
    const vignetteRadius = Math.max(width, height) * 0.8;
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, vignetteRadius * 0.3,
      width / 2, height / 2, vignetteRadius,
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(200, 122, 42, 0.08)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Calculate total content height
    const lineSpacing = 8;
    let totalHeight = 0;
    for (const line of lines) {
      const fontSize = parseInt(line.font.match(/(\d+)px/)?.[1] || '16');
      totalHeight += fontSize + lineSpacing;
    }

    let y = (height - totalHeight) / 2;

    // Render lines with staggered fade-in
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const line of lines) {
      if (line.color === 'transparent') {
        y += 12;
        continue;
      }

      const fontSize = parseInt(line.font.match(/(\d+)px/)?.[1] || '16');
      const lineAlpha = Math.min(1, Math.max(0, (elapsed - line.delay) / 600));

      if (lineAlpha > 0) {
        ctx.globalAlpha = lineAlpha;
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, width / 2, y + fontSize / 2);
      }

      y += fontSize + lineSpacing;
    }

    // "Respawn" hint after all lines shown
    if (elapsed > 3800) {
      const hintAlpha = Math.min(0.5, (elapsed - 3800) / 1000);
      ctx.globalAlpha = hintAlpha + Math.sin(elapsed / 1000) * 0.1;
      ctx.font = '400 14px Cormorant Garamond';
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText('Tap to respawn', width / 2, height * 0.85);
    }

    ctx.globalAlpha = 1;
  }, [lines]);

  const { canvasRef } = useCanvas({ onFrame });

  const handleNext = useCallback(() => {
    setDeathIdx(i => (i + 1) % DEATHS.length);
    setKey(k => k + 1);
  }, []);

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

  return (
    <Box position="relative" w="100%" h="100%" key={key}>
      <Box
        position="absolute"
        top={0} left={0} right={0} bottom={0}
        bg={COLORS.bg}
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          onClick={handleNext}
          onTouchStart={handleNext}
          style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
    </Box>
  );
}
