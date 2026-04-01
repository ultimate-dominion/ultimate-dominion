import { useCallback, useRef, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';

type Props = {
  /** The lore narrative text */
  text: string;
  /** Fragment accent color (from getFragmentColor) */
  accentColor: string;
};

const BODY_FONT = '400 17px Cormorant Garamond';
const DROP_CAP_FONT = '700 48px Cinzel';
const LINE_HEIGHT = 26;
const DROP_CAP_LINES = 3;
const DROP_CAP_WIDTH = 42;

/**
 * Canvas parchment lore reader with drop cap, justified text, and scroll.
 * Replaces the narrative <Text> in FragmentReadModal behind SHOW_Z2.
 */
export function GameLoreReader({ text, accentColor }: Props) {
  const { ready } = usePretextFonts();
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);
  const linesRef = useRef<{ text: string; width: number }[]>([]);
  const measuredWidthRef = useRef(0);

  // Reset scroll when text changes
  useEffect(() => {
    scrollYRef.current = 0;
    linesRef.current = [];
    measuredWidthRef.current = 0;
    totalHeightRef.current = 0;
  }, [text]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Parchment background
      ctx.fillStyle = COLORS.bgPanel;
      ctx.fillRect(0, 0, width, height);

      // Subtle grain
      ctx.globalAlpha = 0.025;
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillStyle = Math.random() > 0.5 ? '#000' : COLORS.textBody;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;

      const padding = Math.max(20, width * 0.06);
      const contentWidth = width - padding * 2;

      if (!text || contentWidth < 40) return;

      // Re-measure if width changed
      if (Math.abs(contentWidth - measuredWidthRef.current) > 2) {
        measuredWidthRef.current = contentWidth;
        const prepared = prepareWithSegments(text, BODY_FONT);
        const result = layoutWithLines(prepared, contentWidth, LINE_HEIGHT);
        linesRef.current = result.lines.map(l => ({ text: l.text, width: l.width }));
        totalHeightRef.current = result.height + 80; // extra padding for drop cap
      }

      const lines = linesRef.current;
      if (lines.length === 0) return;

      // Scroll clamping
      const maxScroll = Math.max(0, totalHeightRef.current - height + padding * 2);
      scrollYRef.current = Math.max(0, Math.min(scrollYRef.current, maxScroll));
      const scrollY = scrollYRef.current;

      let y = padding;

      // Drop cap
      const firstChar = text[0];
      if (firstChar) {
        const dropCapY = y - scrollY;
        if (dropCapY + 48 > 0 && dropCapY < height) {
          ctx.font = DROP_CAP_FONT;
          ctx.fillStyle = accentColor;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 6;
          ctx.fillText(firstChar, padding, dropCapY);
          ctx.shadowBlur = 0;
        }
      }

      // Body text with justification
      ctx.font = BODY_FONT;
      ctx.fillStyle = COLORS.textBody;
      ctx.textBaseline = 'top';

      for (let i = 0; i < lines.length; i++) {
        const textY = y + i * LINE_HEIGHT - scrollY;

        if (textY + LINE_HEIGHT < 0) continue;
        if (textY > height) break;

        let lineText = lines[i].text;
        let lineX = padding;

        // Indent first few lines for drop cap
        if (i < DROP_CAP_LINES) {
          lineX = padding + DROP_CAP_WIDTH;
          if (i === 0) {
            lineText = lineText.slice(1).trimStart();
          }
        }

        // Justified text
        const words = lineText.trimEnd().split(/\s+/);
        if (words.length > 1 && i < lines.length - 1 && !lineText.endsWith('\n')) {
          const availWidth = i < DROP_CAP_LINES ? contentWidth - DROP_CAP_WIDTH : contentWidth;
          const textWidth = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
          const extraSpace = (availWidth - textWidth) / (words.length - 1);

          // Don't over-justify if there's too much extra space
          if (extraSpace < 20) {
            let wx = lineX;
            for (const word of words) {
              ctx.fillText(word, wx, textY);
              wx += ctx.measureText(word).width + extraSpace;
            }
          } else {
            ctx.fillText(lineText, lineX, textY);
          }
        } else {
          ctx.fillText(lineText, lineX, textY);
        }
      }

      // Top and bottom fades
      const fadeH = 24;
      const topGrad = ctx.createLinearGradient(0, 0, 0, fadeH);
      topGrad.addColorStop(0, COLORS.bgPanel);
      topGrad.addColorStop(1, 'rgba(36,32,26,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, fadeH);

      const btmGrad = ctx.createLinearGradient(0, height - fadeH, 0, height);
      btmGrad.addColorStop(0, 'rgba(36,32,26,0)');
      btmGrad.addColorStop(1, COLORS.bgPanel);
      ctx.fillStyle = btmGrad;
      ctx.fillRect(0, height - fadeH, width, fadeH);

      // Decorative border with accent color
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      const inset = padding * 0.3;
      ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
      ctx.globalAlpha = 1;

      // Scroll indicator if content overflows
      if (maxScroll > 0) {
        const scrollFraction = scrollY / maxScroll;
        const trackH = height - padding * 2;
        const thumbH = Math.max(20, (height / totalHeightRef.current) * trackH);
        const thumbY = padding + scrollFraction * (trackH - thumbH);

        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(width - 4, thumbY, 2, thumbH);
        ctx.globalAlpha = 1;
      }
    },
    [text, accentColor],
  );

  const { canvasRef } = useCanvas({ onFrame });

  // Scroll handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollYRef.current += e.deltaY * 0.5;
    };

    let touchStartY = 0;
    let lastScrollY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      lastScrollY = scrollYRef.current;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      scrollYRef.current = lastScrollY + (touchStartY - e.touches[0].clientY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [canvasRef]);

  if (!ready || !text) return null;

  return (
    <Box w="100%" minH="200px" maxH="400px" h="50vh">
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label="Lore narrative"
      />
    </Box>
  );
}
