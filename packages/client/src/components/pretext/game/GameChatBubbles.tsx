import { useCallback, useRef, useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { prepare, layout } from '@chenglou/pretext';
import { useCanvas } from '../hooks/useCanvas';
import { usePretextFonts } from '../hooks/usePretextFonts';
import { COLORS } from '../theme';
import type { ChatMessage } from '../../../contexts/ChatContext';
import type { Character } from '../../../utils/types';
import { CLASS_COLORS } from '../../../utils/types';

type Props = {
  messages: ChatMessage[];
  allCharacters: Character[];
  /** Current player's character ID, to mark self messages */
  selfCharacterId: string | undefined;
};

type MeasuredMessage = {
  id: string;
  sender: string;
  text: string;
  self: boolean;
  nameColor: string;
  height: number;
  textWidth: number;
};

const MSG_FONT = '400 14px Cormorant Garamond';
const SENDER_FONT = '600 10px Cinzel';
const MAX_BUBBLE_WIDTH_RATIO = 0.78;
const BUBBLE_PAD_X = 10;
const BUBBLE_PAD_Y = 6;
const SENDER_HEIGHT = 14;
const MSG_GAP = 6;
const LINE_HEIGHT = 18;

/**
 * Canvas chat bubbles for player messages.
 * Replaces the DOM ChatTab rendering behind SHOW_Z2.
 */
export function GameChatBubbles({ messages, allCharacters, selfCharacterId }: Props) {
  const { ready } = usePretextFonts();
  const measuredRef = useRef<MeasuredMessage[]>([]);
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const needsRemeasureRef = useRef(true);

  // Mark for re-measure when messages change
  useEffect(() => {
    needsRemeasureRef.current = true;
  }, [messages, allCharacters]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#14120F';
      ctx.fillRect(0, 0, width, height);

      if (messages.length === 0) {
        ctx.font = 'italic 400 13px Cormorant Garamond';
        ctx.fillStyle = COLORS.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No messages yet. Say something.', width / 2, height / 2);
        return;
      }

      const maxBubbleW = width * MAX_BUBBLE_WIDTH_RATIO;

      // Re-measure if needed
      if (needsRemeasureRef.current) {
        needsRemeasureRef.current = false;
        measuredRef.current = messages.map(msg => {
          const isSelf = msg.senderCharacterId === selfCharacterId;
          const char = allCharacters.find(c => c.id === msg.senderCharacterId);
          const nameColor = char ? (CLASS_COLORS[char.entityClass] ?? COLORS.textPrimary) : COLORS.textPrimary;

          const prepared = prepare(msg.content, MSG_FONT);
          const result = layout(prepared, maxBubbleW - BUBBLE_PAD_X * 2, LINE_HEIGHT);
          const msgHeight = result.height + BUBBLE_PAD_Y * 2 + SENDER_HEIGHT;

          // Tight bubble width
          ctx.font = MSG_FONT;
          const words = msg.content.split(' ');
          let lineW = 0;
          let maxLineW = 0;
          for (const word of words) {
            const wordW = ctx.measureText(word + ' ').width;
            if (lineW + wordW > maxBubbleW - BUBBLE_PAD_X * 2 && lineW > 0) {
              maxLineW = Math.max(maxLineW, lineW);
              lineW = wordW;
            } else {
              lineW += wordW;
            }
          }
          maxLineW = Math.max(maxLineW, lineW);

          // Ensure bubble is at least wide enough for sender name
          ctx.font = SENDER_FONT;
          const senderW = ctx.measureText(msg.senderName).width;
          maxLineW = Math.max(maxLineW, senderW);

          return {
            id: msg.id,
            sender: msg.senderName,
            text: msg.content,
            self: isSelf,
            nameColor,
            height: msgHeight,
            textWidth: Math.min(maxBubbleW - BUBBLE_PAD_X * 2, maxLineW),
          };
        });
        totalHeightRef.current = measuredRef.current.reduce((sum, m) => sum + m.height + MSG_GAP, 0);
      }

      const measured = measuredRef.current;
      if (measured.length === 0) return;

      // Auto-scroll to bottom on new messages
      const maxScroll = Math.max(0, totalHeightRef.current - height + 16);
      if (messages.length !== lastMessageCountRef.current) {
        scrollYRef.current = maxScroll;
        lastMessageCountRef.current = messages.length;
      }
      scrollYRef.current = Math.max(0, Math.min(scrollYRef.current, maxScroll));

      let y = 8 - scrollYRef.current;
      const padding = 8;

      for (const msg of measured) {
        if (y + msg.height < -20) { y += msg.height + MSG_GAP; continue; }
        if (y > height + 20) break;

        const bubbleW = msg.textWidth + BUBBLE_PAD_X * 2;
        const bubbleX = msg.self ? width - padding - bubbleW : padding;
        const bubbleColor = msg.self ? '#2A2218' : COLORS.bgCard;
        const borderColor = msg.self ? COLORS.amber : COLORS.border;

        // Bubble background
        ctx.fillStyle = bubbleColor;
        ctx.beginPath();
        ctx.roundRect(bubbleX, y, bubbleW, msg.height, 5);
        ctx.fill();

        // Bubble border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.roundRect(bubbleX, y, bubbleW, msg.height, 5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Sender name
        ctx.font = SENDER_FONT;
        ctx.fillStyle = msg.self ? COLORS.amber : msg.nameColor;
        ctx.textAlign = msg.self ? 'right' : 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          msg.sender,
          msg.self ? bubbleX + bubbleW - BUBBLE_PAD_X : bubbleX + BUBBLE_PAD_X,
          y + BUBBLE_PAD_Y,
        );

        // Message text with word wrap
        ctx.font = MSG_FONT;
        ctx.fillStyle = COLORS.textBody;
        ctx.textAlign = 'left';

        const textX = bubbleX + BUBBLE_PAD_X;
        let textY = y + BUBBLE_PAD_Y + SENDER_HEIGHT;
        const maxTextW = bubbleW - BUBBLE_PAD_X * 2;

        const words = msg.text.split(' ');
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxTextW && line) {
            ctx.fillText(line, textX, textY);
            textY += LINE_HEIGHT;
            line = word;
          } else {
            line = test;
          }
        }
        if (line) ctx.fillText(line, textX, textY);

        y += msg.height + MSG_GAP;
      }
    },
    [messages, allCharacters, selfCharacterId],
  );

  const { canvasRef } = useCanvas({ onFrame });

  // Scroll handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollYRef.current += e.deltaY * 0.5;
      needsRemeasureRef.current = false; // don't re-measure on scroll
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

  if (!ready) return null;

  return (
    <Box w="100%" h="100%">
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label="Chat messages"
      />
    </Box>
  );
}
