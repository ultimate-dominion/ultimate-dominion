import { useCallback, useRef, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';

export type NarrativeSegment = {
  text: string;
  color?: string;
  bold?: boolean;
  mono?: boolean;
  italic?: boolean;
};

type Props = {
  /** Styled text segments to type out */
  segments: NarrativeSegment[];
  /** Changes when new narrative should start typing */
  narrativeKey: string;
  /** Indent + left border for enemy attacks */
  isEnemyAttack?: boolean;
};

const FONT_SIZE = 14;
const LINE_HEIGHT = 21;
const PAD = 10;
const INDENT = 10;
const CHARS_PER_SEC = 60;
const CURSOR_BLINK_MS = 500;

function fontForSegment(seg: NarrativeSegment): string {
  const weight = seg.bold ? 700 : 400;
  const italic = seg.italic ? 'italic ' : '';
  const family = seg.mono ? '"Fira Code"' : '"Cormorant Garamond"';
  return `${italic}${weight} ${FONT_SIZE}px ${family}`;
}

export function CombatTypewriter({ segments, narrativeKey, isEnemyAttack }: Props) {
  const { ready } = usePretextFonts();

  const stateRef = useRef({ chars: 0, done: false, cursorVis: true, cursorT: 0, t: 0 });

  // Reset typewriter when content changes
  useEffect(() => {
    stateRef.current = { chars: 0, done: false, cursorVis: true, cursorT: 0, t: 0 };
  }, [narrativeKey]);

  const totalChars = segments.reduce((n, s) => n + s.text.length, 0);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      const s = stateRef.current;
      const leftPad = isEnemyAttack ? PAD + INDENT : PAD;
      const maxX = width - PAD;

      // Advance
      if (!s.done) {
        s.t += dt;
        s.chars = Math.floor((s.t * CHARS_PER_SEC) / 1000);
        if (s.chars >= totalChars) {
          s.chars = totalChars;
          s.done = true;
        }
      }

      // Cursor blink
      s.cursorT += dt;
      if (s.cursorT > CURSOR_BLINK_MS) {
        s.cursorT -= CURSOR_BLINK_MS;
        s.cursorVis = !s.cursorVis;
      }

      // Enemy attack left bar
      if (isEnemyAttack) {
        ctx.fillStyle = 'rgba(184,92,58,0.3)';
        ctx.fillRect(PAD, PAD - 2, 2, height - PAD * 2 + 4);
      }

      // Render typed segments with word-wrap
      let x = leftPad;
      let y = PAD + FONT_SIZE;
      let charsLeft = s.chars;
      let lastFont = '';

      for (const seg of segments) {
        if (charsLeft <= 0) break;

        const visible = seg.text.slice(0, charsLeft);
        charsLeft -= visible.length;
        if (visible.length === 0) continue;

        const font = fontForSegment(seg);
        if (font !== lastFont) {
          ctx.font = font;
          lastFont = font;
        }
        ctx.fillStyle = seg.color || COLORS.textBody;
        ctx.textBaseline = 'alphabetic';

        // Split on whitespace boundaries for word-wrap
        const tokens = visible.split(/(\s+)/);
        for (const token of tokens) {
          if (token.length === 0) continue;
          const tw = ctx.measureText(token).width;
          if (x + tw > maxX && token.trim().length > 0) {
            x = leftPad;
            y += LINE_HEIGHT;
          }
          ctx.fillText(token, x, y);
          x += tw;
        }
      }

      // Blinking cursor
      if (!s.done && s.cursorVis) {
        ctx.fillStyle = COLORS.amber;
        ctx.fillRect(x + 2, y - FONT_SIZE * 0.72, 2, FONT_SIZE * 0.85);
      }
    },
    [segments, totalChars, isEnemyAttack],
  );

  const { canvasRef } = useCanvas({ onFrame });

  if (!ready || segments.length === 0) return null;

  return (
    <Box w="100%" h="80px">
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label="Combat narration"
      />
    </Box>
  );
}
