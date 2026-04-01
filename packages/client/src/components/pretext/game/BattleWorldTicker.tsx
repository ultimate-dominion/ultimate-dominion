import { useCallback, useRef, useEffect, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts, getFontString } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';
import { useQueue } from '../../../contexts/QueueContext';

const SEPARATOR = '  \u25C6  ';
const SCROLL_SPEED = 0.06;
const FONT = getFontString('cormorant-500', 15);
const SEPARATOR_FONT = getFontString('cormorant-400', 13);

type MeasuredEvent = {
  text: string;
  color: string;
  width: number;
};

function eventToText(event: {
  eventType: string;
  playerName: string;
  description: string;
  metadata?: Record<string, unknown>;
}): { text: string; color: string } {
  const meta = event.metadata || {};
  const name = event.playerName || 'A player';

  switch (event.eventType) {
    case 'loot_drop':
    case 'rare_find': {
      const itemName = (meta.itemName as string) || 'an item';
      return { text: `${name} found ${itemName}`, color: COLORS.glow };
    }
    case 'pvp_kill': {
      const opponent = (meta.opponentName as string) || 'an opponent';
      return { text: `${name} defeated ${opponent} in PvP`, color: COLORS.danger };
    }
    case 'death': {
      const mob = (meta.mobName as string) || 'a monster';
      return { text: `${name} was slain by ${mob}`, color: '#8B4040' };
    }
    case 'level_up':
      return { text: `${name} reached a new level`, color: COLORS.success };
    case 'character_created':
      return { text: `${name} entered the cave`, color: '#9B8EC4' };
    case 'marketplace_listing': {
      const itemName = (meta.itemName as string) || 'an item';
      return { text: `${name} listed ${itemName}`, color: COLORS.amber };
    }
    default:
      return { text: event.description || `${name} did something`, color: COLORS.textMuted };
  }
}

/**
 * Smooth-scrolling world event ticker. Shows live game events
 * (kills, loot drops, level-ups) as a canvas marquee.
 */
export function BattleWorldTicker() {
  const { ready } = usePretextFonts();
  const { gameEvents } = useQueue();
  const measuredRef = useRef<MeasuredEvent[]>([]);
  const totalWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const separatorWidthRef = useRef(0);
  const prevEventCountRef = useRef(0);

  // Convert game events to ticker format
  const tickerEvents = useMemo(() => {
    return gameEvents.slice(-20).map(e => eventToText(e));
  }, [gameEvents]);

  // Re-measure when events change
  useEffect(() => {
    if (!ready || tickerEvents.length === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    ctx.font = SEPARATOR_FONT;
    separatorWidthRef.current = ctx.measureText(SEPARATOR).width;

    ctx.font = FONT;
    const measured = tickerEvents.map(e => ({
      ...e,
      width: ctx.measureText(e.text).width,
    }));
    measuredRef.current = measured;

    totalWidthRef.current = measured.reduce(
      (sum, e) => sum + e.width + separatorWidthRef.current,
      0,
    );

    // Keep scroll position proportional when events change
    if (totalWidthRef.current > 0) {
      offsetRef.current = offsetRef.current % totalWidthRef.current;
    }

    prevEventCountRef.current = tickerEvents.length;
  }, [ready, tickerEvents]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const events = measuredRef.current;
    const totalW = totalWidthRef.current;
    const sepW = separatorWidthRef.current;
    if (events.length === 0 || totalW === 0) return;

    offsetRef.current = (offsetRef.current + SCROLL_SPEED * dt) % totalW;

    const y = height / 2;
    ctx.textBaseline = 'middle';

    let x = -offsetRef.current;
    const passes = Math.ceil(width / totalW) + 2;

    for (let pass = 0; pass < passes; pass++) {
      for (const event of events) {
        if (x > width + 50) break;

        if (x + event.width > -50) {
          ctx.font = FONT;
          ctx.fillStyle = event.color;
          ctx.fillText(event.text, x, y);
        }
        x += event.width;

        if (x + sepW > -50 && x < width + 50) {
          ctx.font = SEPARATOR_FONT;
          ctx.fillStyle = COLORS.textMuted;
          ctx.fillText(SEPARATOR, x, y);
        }
        x += sepW;
      }
    }

    // Fade edges
    const fadeW = Math.min(40, width * 0.08);
    const leftGrad = ctx.createLinearGradient(0, 0, fadeW, 0);
    leftGrad.addColorStop(0, COLORS.bg);
    leftGrad.addColorStop(1, 'rgba(18,16,14,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, fadeW, height);

    const rightGrad = ctx.createLinearGradient(width - fadeW, 0, width, 0);
    rightGrad.addColorStop(0, 'rgba(18,16,14,0)');
    rightGrad.addColorStop(1, COLORS.bg);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - fadeW, 0, fadeW, height);
  }, []);

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready || tickerEvents.length === 0) return null;

  return (
    <Box
      h="32px"
      w="100%"
      bg={COLORS.bg}
      borderBottom="1px solid"
      borderColor={COLORS.border}
      overflow="hidden"
      aria-label="World event ticker"
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}
