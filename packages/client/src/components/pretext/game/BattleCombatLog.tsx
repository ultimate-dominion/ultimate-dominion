/**
 * Canvas-rendered combat log — virtual-scrolled, auto-scrolling,
 * color-coded by entry type. Driven by useCombatLogEntries.
 *
 * Renders in a compact vertical strip below weapon buttons.
 * Zero DOM nodes for entries — all canvas text.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS, FONTS } from '../theme';
import type { CombatLogEntry, CombatLogEntryType } from '../../../hooks/useCombatLogEntries';

const TYPE_COLORS: Record<CombatLogEntryType, string> = {
  attack: COLORS.textBody,
  crit: COLORS.danger,
  miss: COLORS.textMuted,
  heal: COLORS.success,
  dot: '#9B70B0',
  death: '#8B4040',
};

const NUMBER_COLORS: Record<CombatLogEntryType, string> = {
  attack: COLORS.textPrimary,
  crit: '#FF6B4A',
  miss: COLORS.textMuted,
  heal: '#6ABF5A',
  dot: '#B88AC8',
  death: '#A04040',
};

const FONT_STR = `13px ${FONTS.mono}`;
const LINE_HEIGHT = 18;
const PADDING = 8;

type MeasuredEntry = CombatLogEntry & { height: number };

export function BattleCombatLog({ entries }: { entries: CombatLogEntry[] }) {
  const { ready } = usePretextFonts();
  const measuredRef = useRef<MeasuredEntry[]>([]);
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);
  const autoScrollRef = useRef(true);
  const lastScrollY = useRef(0);
  const prevLenRef = useRef(0);

  // Measure entries when they change
  useEffect(() => {
    if (!ready || entries.length === 0) return;

    // Only measure new entries (append-only)
    if (entries.length > prevLenRef.current) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      ctx.font = FONT_STR;

      for (let i = prevLenRef.current; i < entries.length; i++) {
        const e = entries[i];
        // Approximate wrapping by measuring text width vs available width
        // (we don't know exact container width here, so use a conservative 300px)
        const textWidth = ctx.measureText(e.text).width;
        const lines = Math.max(1, Math.ceil(textWidth / 300));
        const height = lines * LINE_HEIGHT;
        measuredRef.current.push({ ...e, height });
        totalHeightRef.current += height;
      }

      prevLenRef.current = entries.length;
    }
  }, [ready, entries]);

  // Reset when entries are cleared (new battle)
  useEffect(() => {
    if (entries.length === 0) {
      measuredRef.current = [];
      totalHeightRef.current = 0;
      scrollYRef.current = 0;
      prevLenRef.current = 0;
      autoScrollRef.current = true;
    }
  }, [entries.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const measured = measuredRef.current;
    if (measured.length === 0) return;

    const maxScroll = Math.max(0, totalHeightRef.current - height + PADDING * 2);

    // Auto-scroll to bottom
    if (autoScrollRef.current) {
      scrollYRef.current = maxScroll;
    }

    const scrollY = Math.max(0, Math.min(scrollYRef.current, maxScroll));

    // Find first visible entry
    let cumY = 0;
    let firstVisible = 0;
    for (let i = 0; i < measured.length; i++) {
      if (cumY + measured[i].height > scrollY - PADDING) {
        firstVisible = i;
        break;
      }
      cumY += measured[i].height;
    }

    // Render visible entries
    ctx.font = FONT_STR;
    ctx.textBaseline = 'top';
    let y = cumY - scrollY + PADDING;

    for (let i = firstVisible; i < measured.length; i++) {
      const entry = measured[i];
      if (y > height + 20) break;

      if (y + entry.height > -20) {
        // Highlight numbers in the text
        const parts = entry.text.split(/(\d+)/g);
        let x = PADDING;
        for (const part of parts) {
          if (/^\d+$/.test(part)) {
            ctx.fillStyle = NUMBER_COLORS[entry.type];
            ctx.fillText(part, x, y);
            x += ctx.measureText(part).width;
          } else {
            ctx.fillStyle = TYPE_COLORS[entry.type];
            ctx.fillText(part, x, y);
            x += ctx.measureText(part).width;
          }
        }
      }
      y += entry.height;
    }

    // Scrollbar
    if (totalHeightRef.current > height) {
      const barHeight = Math.max(20, (height / totalHeightRef.current) * height);
      const barY = maxScroll > 0 ? (scrollY / maxScroll) * (height - barHeight) : 0;
      ctx.fillStyle = COLORS.border;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.roundRect(width - 5, barY, 3, barHeight, 1.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Top fade
    const fadeH = 16;
    const topGrad = ctx.createLinearGradient(0, 0, 0, fadeH);
    topGrad.addColorStop(0, COLORS.bgCard);
    topGrad.addColorStop(1, 'rgba(28,24,20,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, fadeH);
  }, []);

  const { canvasRef, height: canvasHeight } = useCanvas({ onFrame, interactive: true });

  // Scroll handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollYRef.current += e.deltaY;
      const maxScroll = Math.max(0, totalHeightRef.current - canvasHeight + PADDING * 2);
      scrollYRef.current = Math.max(0, Math.min(scrollYRef.current, maxScroll));
      autoScrollRef.current = scrollYRef.current >= maxScroll - 10;
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      lastScrollY.current = scrollYRef.current;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = touchStartY - e.touches[0].clientY;
      scrollYRef.current = lastScrollY.current + dy;
      const maxScroll = Math.max(0, totalHeightRef.current - canvasHeight + PADDING * 2);
      scrollYRef.current = Math.max(0, Math.min(scrollYRef.current, maxScroll));
      autoScrollRef.current = scrollYRef.current >= maxScroll - 10;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [canvasRef, canvasHeight]);

  if (!ready || entries.length === 0) return null;

  return (
    <Box
      bg={COLORS.bgCard}
      borderRadius="md"
      border="1px solid"
      borderColor={COLORS.border}
      h="120px"
      w="100%"
      overflow="hidden"
      aria-label="Combat log"
    >
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  );
}
