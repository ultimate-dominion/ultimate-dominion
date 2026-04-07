import { useCallback, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { prepare, layout } from '@chenglou/pretext';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts, getFontString } from './hooks/usePretextFonts';
import { COLORS } from './theme';

const SAMPLE_EVENTS = [
  { text: 'Xar\'thul found a Legendary Wraithblade', color: COLORS.rarityLegendary },
  { text: 'Guild IRON claimed the Northern Keep', color: COLORS.amber },
  { text: 'DarkPaladin99 defeated the Flame Wyrm', color: COLORS.danger },
  { text: 'ShadowMerchant listed a Rare Obsidian Shield for 450 Gold', color: COLORS.rarityRare },
  { text: 'NightWhisper reached Level 50', color: COLORS.success },
  { text: 'World Boss spawned: The Lich King awakens in the Frozen Depths', color: COLORS.danger },
  { text: 'VoidWalker found an Epic Spectral Cloak', color: COLORS.rarityEpic },
  { text: 'Tournament begins in 5 minutes — register at the Arena', color: COLORS.glow },
  { text: 'IronForge crafted a Legendary Dragonscale Plate', color: COLORS.rarityLegendary },
  { text: 'The Dark Cave trembles... something stirs below', color: COLORS.textMuted },
];

const SEPARATOR = '  \u25C6  '; // diamond
const SCROLL_SPEED = 0.06; // px per ms
const FONT = getFontString('cormorant-500', 15);
const SEPARATOR_FONT = getFontString('cormorant-400', 13);

type MeasuredEvent = {
  text: string;
  color: string;
  width: number;
};

export function WorldEventTicker() {
  const { ready } = usePretextFonts();
  const measuredRef = useRef<MeasuredEvent[]>([]);
  const totalWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const separatorWidthRef = useRef(0);

  // Measure event widths once fonts are ready
  useEffect(() => {
    if (!ready) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Measure separator
    ctx.font = SEPARATOR_FONT;
    separatorWidthRef.current = ctx.measureText(SEPARATOR).width;

    // Measure each event
    ctx.font = FONT;
    const measured = SAMPLE_EVENTS.map(e => ({
      ...e,
      width: ctx.measureText(e.text).width,
    }));
    measuredRef.current = measured;

    // Total width of one full cycle
    totalWidthRef.current = measured.reduce(
      (sum, e) => sum + e.width + separatorWidthRef.current,
      0,
    );
  }, [ready]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const events = measuredRef.current;
    const totalW = totalWidthRef.current;
    const sepW = separatorWidthRef.current;
    if (events.length === 0 || totalW === 0) return;

    // Advance scroll
    offsetRef.current = (offsetRef.current + SCROLL_SPEED * dt) % totalW;

    // Draw subtle gradient edges
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, COLORS.bg);
    gradient.addColorStop(0.05, 'transparent');
    gradient.addColorStop(0.95, 'transparent');
    gradient.addColorStop(1, COLORS.bg);

    // Draw events
    const y = height / 2;
    ctx.textBaseline = 'middle';

    // We need to render enough copies to fill the viewport
    let x = -offsetRef.current;
    const passes = Math.ceil(width / totalW) + 2;

    for (let pass = 0; pass < passes; pass++) {
      for (const event of events) {
        // Skip if entirely off-screen right
        if (x > width + 50) break;

        // Draw event text if visible
        if (x + event.width > -50) {
          ctx.font = FONT;
          ctx.fillStyle = event.color;
          ctx.fillText(event.text, x, y);
        }
        x += event.width;

        // Draw separator
        if (x + sepW > -50 && x < width + 50) {
          ctx.font = SEPARATOR_FONT;
          ctx.fillStyle = COLORS.textMuted;
          ctx.fillText(SEPARATOR, x, y);
        }
        x += sepW;
      }
    }

    // Fade edges
    ctx.fillStyle = COLORS.bg;
    ctx.globalAlpha = 1;
    // Left fade
    const fadeW = Math.min(40, width * 0.08);
    const leftGrad = ctx.createLinearGradient(0, 0, fadeW, 0);
    leftGrad.addColorStop(0, COLORS.bg);
    leftGrad.addColorStop(1, 'rgba(18,16,14,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, fadeW, height);
    // Right fade
    const rightGrad = ctx.createLinearGradient(width - fadeW, 0, width, 0);
    rightGrad.addColorStop(0, 'rgba(18,16,14,0)');
    rightGrad.addColorStop(1, COLORS.bg);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - fadeW, 0, fadeW, height);
  }, []);

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

  return (
    <Box position="relative" w="100%" h="100%">
      <Box
        position="absolute"
        top={0} left={0} right={0} bottom={0}
        bg={COLORS.bg}
        borderRadius="md"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {/* Ticker area */}
        <Box flex={1} position="relative" minH="50px">
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </Box>
      </Box>
      <Box position="absolute" bottom={3} left={0} right={0} textAlign="center">
        <Text color={COLORS.textMuted} fontSize="xs" fontFamily="mono">
          Smooth-scrolling world event ticker. Zero DOM nodes.
        </Text>
      </Box>
    </Box>
  );
}
