import { useCallback, useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

const ZONES = [
  { name: 'The Frozen Depths', subtitle: 'Where light fears to tread' },
  { name: 'Molten Core', subtitle: 'Heart of the mountain' },
  { name: 'Abyssal Wastes', subtitle: 'Beyond the edge of reason' },
  { name: 'Thornveil Forest', subtitle: 'The trees remember everything' },
  { name: 'The Shattered Keep', subtitle: 'Once a kingdom, now a grave' },
];

export function ZoneTransition() {
  const { ready } = usePretextFonts();
  const [zoneIdx, setZoneIdx] = useState(0);
  const [key, setKey] = useState(0);
  const zone = ZONES[zoneIdx];

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const totalDuration = 4000;
    if (elapsed > totalDuration) return;

    // Phase timing
    const revealDuration = 1500;
    const holdDuration = 1500;
    const fadeDuration = 1000;

    // Global fade
    let alpha = 1;
    if (elapsed > revealDuration + holdDuration) {
      alpha = 1 - (elapsed - revealDuration - holdDuration) / fadeDuration;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    const name = zone.name;
    const chars = Array.from(name);
    const fontSize = Math.min(48, width / (chars.length * 0.65));

    // Measure total width for centering
    ctx.font = `700 ${fontSize}px Cinzel`;
    const totalWidth = ctx.measureText(name).width;
    const startX = (width - totalWidth) / 2;
    const centerY = height * 0.45;

    // Reveal characters left to right with weight building
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    let x = startX;
    for (let i = 0; i < chars.length; i++) {
      const charDelay = (i / chars.length) * revealDuration;
      const charAge = elapsed - charDelay;

      if (charAge <= 0) break;

      // Weight builds from 300 → 700 over 400ms
      const weightProgress = Math.min(1, charAge / 400);
      const weight = Math.round(300 + weightProgress * 400);
      const charAlpha = Math.min(1, charAge / 300) * alpha;

      ctx.font = `${weight} ${fontSize}px Cinzel`;
      ctx.globalAlpha = charAlpha;
      ctx.fillStyle = COLORS.textPrimary;

      // Subtle glow when fully weighted
      if (weightProgress > 0.8) {
        ctx.shadowColor = COLORS.amber;
        ctx.shadowBlur = 4 * weightProgress;
      }

      ctx.fillText(chars[i], x, centerY);
      x += ctx.measureText(chars[i]).width;

      ctx.shadowBlur = 0;
    }

    // Subtitle fades in after name is revealed
    const subtitleDelay = revealDuration * 0.6;
    if (elapsed > subtitleDelay) {
      const subtitleAlpha = Math.min(0.7, (elapsed - subtitleDelay) / 800) * alpha;
      ctx.globalAlpha = subtitleAlpha;
      ctx.font = 'italic 400 18px Cormorant Garamond';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText(zone.subtitle, width / 2, centerY + fontSize * 0.8);
    }

    // Thin horizontal line accent
    if (elapsed > subtitleDelay) {
      const lineAlpha = Math.min(0.3, (elapsed - subtitleDelay) / 1000) * alpha;
      ctx.globalAlpha = lineAlpha;
      const lineWidth = Math.min(totalWidth * 0.6, (elapsed - subtitleDelay) * 0.3);
      ctx.fillStyle = COLORS.amber;
      ctx.fillRect((width - lineWidth) / 2, centerY - fontSize * 0.6, lineWidth, 1);
    }

    ctx.globalAlpha = 1;
  }, [zone]);

  const { canvasRef } = useCanvas({ onFrame });

  const handleNext = useCallback(() => {
    setZoneIdx(i => (i + 1) % ZONES.length);
    setKey(k => k + 1);
  }, []);

  if (!ready) return null;

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
          Next Zone
        </Button>
      </Box>
    </Box>
  );
}
