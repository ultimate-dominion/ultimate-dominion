import { useState } from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';
import { usePretextFonts, getFontString } from './hooks/usePretextFonts';
import { useCanvas } from './hooks/useCanvas';
import { COLORS } from './theme';
import { useCallback } from 'react';

type Monster = {
  name: string;
  threat: number; // 1-10
  subtitle: string;
};

const MONSTERS: Monster[] = [
  { name: 'Cave Rat', threat: 1, subtitle: 'Harmless scavenger' },
  { name: 'Hollow Shade', threat: 2, subtitle: 'Fading spirit' },
  { name: 'Bone Stalker', threat: 3, subtitle: 'Restless undead' },
  { name: 'Iron Golem', threat: 5, subtitle: 'Construct guardian' },
  { name: 'Wyvern Matriarch', threat: 6, subtitle: 'Venomous predator' },
  { name: 'Abyssal Knight', threat: 7, subtitle: 'Fallen champion' },
  { name: 'Flame Wyrm', threat: 8, subtitle: 'Ancient dragon' },
  { name: 'The Lich King', threat: 9, subtitle: 'Undead sovereign' },
  { name: 'WRAITHKING ETERNAL', threat: 10, subtitle: 'World boss — run.' },
];

function threatToWeight(threat: number): number {
  if (threat <= 2) return 300;
  if (threat <= 4) return 400;
  if (threat <= 6) return 500;
  if (threat <= 8) return 600;
  return 700;
}

function threatToColor(threat: number): string {
  if (threat <= 2) return COLORS.textMuted;
  if (threat <= 4) return COLORS.textBody;
  if (threat <= 6) return COLORS.textPrimary;
  if (threat <= 8) return COLORS.amber;
  return COLORS.danger;
}

function threatToGlow(threat: number): number {
  if (threat <= 6) return 0;
  if (threat <= 8) return 8;
  return 20;
}

export function MonsterNameWeight() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { ready } = usePretextFonts();

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Draw all monsters stacked
      const lineHeight = Math.max(36, Math.min(52, height / (MONSTERS.length + 2)));
      const startY = (height - MONSTERS.length * lineHeight) / 2;

      for (let i = 0; i < MONSTERS.length; i++) {
        const m = MONSTERS[i];
        const weight = threatToWeight(m.threat);
        const color = threatToColor(m.threat);
        const glow = threatToGlow(m.threat);
        const isSelected = i === selectedIdx;
        const fontSize = isSelected ? 28 : 20;

        const font = getFontString('cinzel-700', fontSize, );
        // Build font string manually for variable weight
        const fontStr = `${weight} ${fontSize}px Cinzel`;
        ctx.font = fontStr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const y = startY + i * lineHeight + lineHeight / 2;
        const alpha = isSelected ? 1 : 0.6;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Glow for high-threat
        if (glow > 0) {
          const pulse = Math.sin(elapsed / 800) * 0.3 + 0.7;
          ctx.shadowColor = color;
          ctx.shadowBlur = glow * pulse;
        }

        ctx.fillStyle = color;
        ctx.fillText(m.name, width / 2, y);

        // Subtitle for selected
        if (isSelected) {
          ctx.shadowBlur = 0;
          ctx.font = `400 14px Cormorant Garamond`;
          ctx.fillStyle = COLORS.textMuted;
          ctx.globalAlpha = 0.8;
          ctx.fillText(m.subtitle, width / 2, y + fontSize * 0.8);

          // Threat level indicator
          ctx.font = `500 12px Fira Code`;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.5;
          ctx.fillText(`THREAT ${m.threat}/10`, width / 2, y - fontSize * 0.8);
        }

        ctx.restore();
      }
    },
    [selectedIdx],
  );

  const { canvasRef } = useCanvas({ onFrame, interactive: true });

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientY = 'touches' in e
        ? (e.touches[0] || e.changedTouches[0]).clientY
        : e.clientY;
      const y = clientY - rect.top;
      const lineHeight = Math.max(36, Math.min(52, rect.height / (MONSTERS.length + 2)));
      const startY = (rect.height - MONSTERS.length * lineHeight) / 2;
      const idx = Math.floor((y - startY) / lineHeight);
      if (idx >= 0 && idx < MONSTERS.length) {
        setSelectedIdx(idx);
      }
    },
    [canvasRef],
  );

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
          onClick={handleClick}
          onTouchStart={handleClick}
          style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={3} left={0} right={0} textAlign="center">
        <Text color={COLORS.textMuted} fontSize="xs" fontFamily="mono">
          Click a name to select. Font weight encodes threat level.
        </Text>
      </Box>
    </Box>
  );
}
