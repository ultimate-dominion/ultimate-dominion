import { useCallback, useRef, useState } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts, getFontString } from './hooks/usePretextFonts';
import { COLORS } from './theme';

type Segment = {
  text: string;
  fontKey: 'cormorant' | 'cinzel' | 'firaCode';
  weight?: number;
  speed?: 'fast' | 'normal' | 'slow';
  color?: string;
};

const SPEED_MAP = { fast: 15, normal: 35, slow: 80 };

const DEMO_NARRATIVES: { title: string; segments: Segment[] }[] = [
  {
    title: 'Loot Discovery',
    segments: [
      { text: 'You reach into the darkness and feel something cold. ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'A weapon. ', fontKey: 'cormorant', speed: 'slow', color: COLORS.textPrimary },
      { text: 'You found a ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'Legendary Wraithblade', fontKey: 'cinzel', weight: 700, speed: 'slow', color: COLORS.rarityLegendary },
      { text: '! ', fontKey: 'cormorant', speed: 'fast' },
      { text: 'ATK +47  ', fontKey: 'firaCode', weight: 500, speed: 'normal', color: COLORS.success },
      { text: 'SPD +12  ', fontKey: 'firaCode', weight: 500, speed: 'normal', color: COLORS.amber },
      { text: 'CRIT +8%', fontKey: 'firaCode', weight: 500, speed: 'normal', color: COLORS.danger },
    ],
  },
  {
    title: 'Level Up',
    segments: [
      { text: 'The ground trembles beneath you. ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'Ancient power surges through your veins. ', fontKey: 'cormorant', speed: 'slow', color: COLORS.glow },
      { text: 'You have reached ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'Level 25', fontKey: 'cinzel', weight: 700, speed: 'slow', color: COLORS.amber },
      { text: '. ', fontKey: 'cormorant', speed: 'fast' },
      { text: 'New ability unlocked: ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'Shadow Step', fontKey: 'cinzel', weight: 600, speed: 'slow', color: COLORS.rarityEpic },
    ],
  },
  {
    title: 'Death',
    segments: [
      { text: 'The blade finds its mark. ', fontKey: 'cormorant', speed: 'slow' },
      { text: 'Your vision fades. ', fontKey: 'cormorant', speed: 'slow', color: COLORS.textMuted },
      { text: 'HP: 0', fontKey: 'firaCode', weight: 700, speed: 'slow', color: COLORS.danger },
      { text: '. You have been slain by ', fontKey: 'cormorant', speed: 'normal' },
      { text: 'The Lich King', fontKey: 'cinzel', weight: 700, speed: 'slow', color: COLORS.danger },
      { text: '.', fontKey: 'cormorant', speed: 'fast' },
    ],
  },
];

function getFontForSegment(seg: Segment, size: number): string {
  const weight = seg.weight || 400;
  const family = seg.fontKey === 'cormorant' ? 'Cormorant Garamond'
    : seg.fontKey === 'cinzel' ? 'Cinzel'
    : 'Fira Code';
  return `${weight} ${size}px ${family}`;
}

export function TypewriterNarrative() {
  const { ready } = usePretextFonts();
  const [narrativeIdx, setNarrativeIdx] = useState(0);
  const [key, setKey] = useState(0); // force reset
  const stateRef = useRef({
    charIndex: 0,
    segmentIndex: 0,
    timer: 0,
    done: false,
    cursorVisible: true,
    cursorTimer: 0,
    skipped: false,
  });

  // Reset state on narrative change
  const resetState = useCallback(() => {
    stateRef.current = {
      charIndex: 0,
      segmentIndex: 0,
      timer: 0,
      done: false,
      cursorVisible: true,
      cursorTimer: 0,
      skipped: false,
    };
  }, []);

  const narrative = DEMO_NARRATIVES[narrativeIdx];
  const fontSize = 18;
  const lineHeight = fontSize * 1.6;
  const padding = 24;

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const s = stateRef.current;
    const segs = narrative.segments;
    const maxWidth = width - padding * 2;

    // Advance character reveal
    if (!s.done && !s.skipped) {
      const currentSeg = segs[s.segmentIndex];
      if (currentSeg) {
        const speed = SPEED_MAP[currentSeg.speed || 'normal'];
        s.timer += dt;
        while (s.timer >= speed && !s.done) {
          s.timer -= speed;
          s.charIndex++;
          if (s.charIndex >= currentSeg.text.length) {
            s.charIndex = 0;
            s.segmentIndex++;
            if (s.segmentIndex >= segs.length) {
              s.done = true;
            }
          }
        }
      }
    }

    // Cursor blink
    s.cursorTimer += dt;
    if (s.cursorTimer > 500) {
      s.cursorTimer = 0;
      s.cursorVisible = !s.cursorVisible;
    }

    // Build the visible text string and render
    let x = padding;
    let y = padding + fontSize;
    let lastFont = '';

    const visibleEnd = s.skipped ? segs.length : s.segmentIndex;

    for (let si = 0; si <= visibleEnd && si < segs.length; si++) {
      const seg = segs[si];
      const font = getFontForSegment(seg, fontSize);
      const color = seg.color || COLORS.textBody;
      const text = si < visibleEnd
        ? seg.text
        : si === visibleEnd && !s.done
          ? seg.text.slice(0, s.charIndex)
          : seg.text;

      if (text.length === 0) continue;

      if (font !== lastFont) {
        ctx.font = font;
        lastFont = font;
      }
      ctx.fillStyle = color;

      // Word-wrap manually
      const words = text.split(/(\s+)/);
      for (const word of words) {
        if (word.length === 0) continue;
        const wordWidth = ctx.measureText(word).width;

        // Wrap to next line if needed
        if (x + wordWidth > maxWidth + padding && word.trim().length > 0) {
          x = padding;
          y += lineHeight;
        }

        ctx.fillText(word, x, y);
        x += wordWidth;
      }
    }

    // Draw cursor
    if (!s.done && s.cursorVisible) {
      ctx.fillStyle = COLORS.amber;
      ctx.fillRect(x + 2, y - fontSize * 0.7, 2, fontSize * 0.9);
    }
  }, [narrative, fontSize, lineHeight, padding]);

  const { canvasRef } = useCanvas({ onFrame, interactive: true });

  const handleSkip = useCallback(() => {
    stateRef.current.skipped = true;
    stateRef.current.done = true;
  }, []);

  const handleNext = useCallback(() => {
    setNarrativeIdx(i => (i + 1) % DEMO_NARRATIVES.length);
    resetState();
    setKey(k => k + 1);
  }, [resetState]);

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
          onClick={handleSkip}
          onTouchStart={handleSkip}
          style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={4} left={0} right={0} textAlign="center" zIndex={1}>
        <Text color={COLORS.textMuted} fontSize="xs" fontFamily="mono" mb={2}>
          "{narrative.title}" — Tap to skip, button to cycle
        </Text>
        <Button
          size="xs"
          variant="outline"
          color={COLORS.amber}
          borderColor={COLORS.border}
          onClick={handleNext}
          _hover={{ bg: COLORS.bgHover }}
        >
          Next Narrative
        </Button>
      </Box>
    </Box>
  );
}
