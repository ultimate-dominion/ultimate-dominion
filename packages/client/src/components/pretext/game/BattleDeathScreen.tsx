/**
 * BattleDeathScreen — Full-screen canvas overlay on player defeat.
 *
 * Shows a staggered cinematic reveal:
 *   "YOU HAVE FALLEN"  (500ms)
 *   "Here lies {name}" (1000ms)
 *   "Felled by"        (1800ms)
 *   "{monster}"         (2200ms)
 *   "in the {zone}"    (2800ms)
 *   "Level {level}"    (3200ms)
 *
 * After ~4s, fires onComplete to hand off to the BattleOutcomeModal.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS, fontString } from '../theme';

type LineSpec = {
  text: string;
  font: string;
  color: string;
  delay: number;
};

function buildLines(
  characterName: string,
  monsterName: string,
  zoneName: string,
  level: number,
): LineSpec[] {
  return [
    { text: 'YOU HAVE FALLEN', font: fontString('mono', 14, 700), color: COLORS.danger, delay: 500 },
    { text: '', font: fontString('serif', 16), color: 'transparent', delay: 0 },
    { text: `Here lies ${characterName}`, font: fontString('heading', 28, 700), color: COLORS.textPrimary, delay: 1000 },
    { text: '', font: fontString('serif', 16), color: 'transparent', delay: 0 },
    { text: 'Felled by', font: fontString('serif', 18), color: COLORS.textMuted, delay: 1800 },
    { text: monsterName, font: fontString('heading', 24, 700), color: COLORS.danger, delay: 2200 },
    { text: '', font: fontString('serif', 16), color: 'transparent', delay: 0 },
    { text: `in the ${zoneName}`, font: fontString('serif', 16), color: COLORS.textMuted, delay: 2800 },
    { text: `Level ${level}`, font: fontString('mono', 14, 500), color: COLORS.textMuted, delay: 3200 },
  ];
}

const COMPLETE_DELAY = 4200;

export function BattleDeathScreen({
  characterName,
  monsterName,
  zoneName,
  level,
  onComplete,
}: {
  characterName: string;
  monsterName: string;
  zoneName: string;
  level: number;
  onComplete: () => void;
}) {
  const { ready } = usePretextFonts();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  const lines = buildLines(characterName, monsterName, zoneName, level);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Auto-complete after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current();
      }
    }, COMPLETE_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();

    // Dark overlay
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
    const currentLines = linesRef.current;
    let totalHeight = 0;
    for (const line of currentLines) {
      const fontSize = parseInt(line.font.match(/(\d+)px/)?.[1] || '16');
      totalHeight += fontSize + lineSpacing;
    }

    let y = (height - totalHeight) / 2;

    // Render lines with staggered fade-in
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const line of currentLines) {
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

        // Glow on the monster name and "YOU HAVE FALLEN"
        if (line.color === COLORS.danger) {
          ctx.save();
          ctx.shadowColor = COLORS.danger;
          ctx.shadowBlur = 12 * lineAlpha;
          ctx.fillText(line.text, width / 2, y + fontSize / 2);
          ctx.restore();
        }

        ctx.fillText(line.text, width / 2, y + fontSize / 2);
      }

      y += fontSize + lineSpacing;
    }

    ctx.globalAlpha = 1;
  }, []);

  // Allow click/tap to skip
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
      zIndex={1000}
      onClick={handleSkip}
      onTouchStart={handleSkip}
      cursor="pointer"
      aria-label="Death screen"
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}
