import { useCallback, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

const LORE_TEXT = `In the age before the Shattering, the world was whole. Seven kingdoms stood beneath a single sky, bound not by treaties but by the Weave — an invisible fabric of power that connected all living things to the earth itself.

The Wraithking was not always a being of darkness. Once, he was Aldric of the Silver Dawn, the greatest paladin to walk the mortal realm. His fall began not with malice, but with grief. When the Weave began to fray, taking his beloved queen into the void between worlds, Aldric sought to mend what could not be mended.

He descended into the Frozen Depths, where the Weave's roots touched the primordial darkness. There, he found the First Fragment — a shard of creation itself, pulsing with power older than the gods. It whispered promises of restoration, of a world made whole again.

But the Fragment's price was absolute. To wield its power, one must surrender all warmth, all memory of light. Aldric paid willingly, believing the sacrifice temporary. He was wrong.

What emerged from the Depths was no longer Aldric. The Wraithking rose, and where he walked, the Weave did not mend — it shattered further, each Fragment scattered to the corners of a dying world.

Now, adventurers seek the Fragments, not knowing whether to restore the Weave or to destroy it forever. The choice, when it comes, will not be simple. The Wraithking watches, and waits, and remembers nothing.`;

const BODY_FONT = '400 17px Cormorant Garamond';
const DROP_CAP_FONT = '700 52px Cinzel';

export function LoreFragment() {
  const { ready } = usePretextFonts();
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);
  const linesRef = useRef<{ text: string; width: number }[]>([]);
  const measuredWidthRef = useRef(0);

  // Pre-measure text layout
  useEffect(() => {
    if (!ready) return;
    // Will be measured on first frame when we know width
  }, [ready]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    // Parchment background
    ctx.fillStyle = COLORS.bgPanel;
    ctx.fillRect(0, 0, width, height);

    // Subtle noise texture
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : COLORS.textBody;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    const padding = Math.max(24, width * 0.08);
    const contentWidth = width - padding * 2;
    const lineHeight = 26;

    // Re-measure if width changed
    if (Math.abs(contentWidth - measuredWidthRef.current) > 2) {
      measuredWidthRef.current = contentWidth;
      const prepared = prepareWithSegments(LORE_TEXT, BODY_FONT);
      const result = layoutWithLines(prepared, contentWidth, lineHeight);
      linesRef.current = result.lines.map(l => ({ text: l.text, width: l.width }));
      totalHeightRef.current = result.height + 100; // extra for drop cap
    }

    const lines = linesRef.current;
    if (lines.length === 0) return;

    // Scroll management
    const maxScroll = Math.max(0, totalHeightRef.current - height + padding * 2);
    const scrollY = Math.max(0, Math.min(scrollYRef.current, maxScroll));

    let y = padding - scrollY;

    // Drop cap for first character
    const firstChar = LORE_TEXT[0];
    const dropCapSize = 52;
    const dropCapLines = 3;
    const dropCapWidth = 45;

    ctx.font = DROP_CAP_FONT;
    ctx.fillStyle = COLORS.amber;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    if (y + dropCapSize > 0 && y < height) {
      // Glow on drop cap
      ctx.shadowColor = COLORS.amber;
      ctx.shadowBlur = 6;
      ctx.fillText(firstChar, padding, y);
      ctx.shadowBlur = 0;
    }

    // Body text
    ctx.font = BODY_FONT;
    ctx.fillStyle = COLORS.textBody;
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      const lineY = y + (i === 0 ? 8 : 0); // nudge first line for drop cap alignment
      const textY = padding + i * lineHeight - scrollY;

      if (textY + lineHeight < 0) continue;
      if (textY > height) break;

      let text = lines[i].text;
      let lineX = padding;

      // Indent first few lines for drop cap
      if (i < dropCapLines) {
        lineX = padding + dropCapWidth;
        if (i === 0) {
          text = text.slice(1).trimStart(); // remove drop cap char
        }
      }

      // Justified text: add extra word spacing to fill width
      const words = text.trimEnd().split(/\s+/);
      if (words.length > 1 && i < lines.length - 1 && !text.endsWith('\n')) {
        const textWidth = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
        const availWidth = i < dropCapLines ? contentWidth - dropCapWidth : contentWidth;
        const extraSpace = (availWidth - textWidth) / (words.length - 1);

        let wx = lineX;
        for (const word of words) {
          ctx.fillText(word, wx, textY);
          wx += ctx.measureText(word).width + extraSpace;
        }
      } else {
        ctx.fillText(text, lineX, textY);
      }
    }

    // Top and bottom fades
    const fadeH = 30;
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

    // Decorative border
    ctx.strokeStyle = COLORS.amber;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.strokeRect(padding * 0.4, padding * 0.4, width - padding * 0.8, height - padding * 0.8);
    ctx.globalAlpha = 1;
  }, []);

  const { canvasRef, height: canvasHeight } = useCanvas({ onFrame, interactive: true });

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

  if (!ready) return <Box p={4}><Text color="textBody">Loading fonts...</Text></Box>;

  return (
    <Box position="relative" w="100%" h="100%">
      <Box
        position="absolute"
        top={0} left={0} right={0} bottom={0}
        bg={COLORS.bgPanel}
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
    </Box>
  );
}
