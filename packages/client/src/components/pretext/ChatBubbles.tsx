import { useCallback, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { prepare, layout } from '@chenglou/pretext';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS } from './theme';

type ChatMessage = {
  sender: string;
  text: string;
  self: boolean;
  height: number;
  textWidth: number;
};

const SAMPLE_MESSAGES: Omit<ChatMessage, 'height' | 'textWidth'>[] = [
  { sender: 'ShadowBlade', text: 'Anyone want to run Frozen Depths? Need a healer.', self: false },
  { sender: 'You', text: 'I can heal. Level 38 cleric.', self: true },
  { sender: 'IronVow', text: 'I\'ll tank. Got my Obsidian Shield finally.', self: false },
  { sender: 'ShadowBlade', text: 'Nice. Meet at the entrance in 5?', self: false },
  { sender: 'You', text: 'On my way', self: true },
  { sender: 'NightWhisper', text: 'Be careful in there. The Lich King spawned twice today already. Lost my best dagger on the second attempt.', self: false },
  { sender: 'You', text: 'We\'ll be fine. ShadowBlade crits like a truck.', self: true },
  { sender: 'IronVow', text: 'Famous last words.', self: false },
  { sender: 'VoidWalker', text: 'Can I join? I have a Legendary Wraithblade and 200 potions.', self: false },
  { sender: 'ShadowBlade', text: 'The more the merrier. Party invite sent.', self: false },
  { sender: 'You', text: 'Let\'s do this.', self: true },
];

const MSG_FONT = '400 15px Cormorant Garamond';
const SENDER_FONT = '600 11px Cinzel';
const MAX_BUBBLE_WIDTH_RATIO = 0.75;
const BUBBLE_PAD_X = 12;
const BUBBLE_PAD_Y = 8;
const SENDER_HEIGHT = 16;
const MSG_GAP = 10;

export function ChatBubbles() {
  const { ready } = usePretextFonts();
  const messagesRef = useRef<ChatMessage[]>([]);
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);

  // Measure messages
  useEffect(() => {
    if (!ready) return;
    // Defer measurement to frame callback when we know width
    messagesRef.current = SAMPLE_MESSAGES.map(m => ({
      ...m,
      height: 0,
      textWidth: 0,
    }));
  }, [ready]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const messages = messagesRef.current;
    if (messages.length === 0) return;

    const maxBubbleW = width * MAX_BUBBLE_WIDTH_RATIO;
    const lineHeight = 20;

    // Measure messages if not yet measured or width changed
    if (messages[0].height === 0) {
      for (const msg of messages) {
        const prepared = prepare(msg.text, MSG_FONT);
        const result = layout(prepared, maxBubbleW - BUBBLE_PAD_X * 2, lineHeight);
        msg.height = result.height + BUBBLE_PAD_Y * 2 + SENDER_HEIGHT;

        // Get actual max line width for tight bubbles
        ctx.font = MSG_FONT;
        const words = msg.text.split(' ');
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
        msg.textWidth = Math.min(maxBubbleW - BUBBLE_PAD_X * 2, maxLineW);
      }
      totalHeightRef.current = messages.reduce((sum, m) => sum + m.height + MSG_GAP, 0);
    }

    // Auto-scroll to bottom
    const maxScroll = Math.max(0, totalHeightRef.current - height + 20);
    scrollYRef.current = maxScroll;

    let y = 12 - scrollYRef.current;
    const padding = 12;

    for (const msg of messages) {
      if (y + msg.height < -20) { y += msg.height + MSG_GAP; continue; }
      if (y > height + 20) break;

      const bubbleW = msg.textWidth + BUBBLE_PAD_X * 2;
      const bubbleX = msg.self ? width - padding - bubbleW : padding;
      const bubbleColor = msg.self ? '#2A2218' : COLORS.bgCard;
      const borderColor = msg.self ? COLORS.amber : COLORS.border;

      // Bubble background
      ctx.fillStyle = bubbleColor;
      ctx.beginPath();
      ctx.roundRect(bubbleX, y, bubbleW, msg.height, 6);
      ctx.fill();

      // Bubble border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.roundRect(bubbleX, y, bubbleW, msg.height, 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Sender name
      ctx.font = SENDER_FONT;
      ctx.fillStyle = msg.self ? COLORS.amber : COLORS.textMuted;
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
          textY += 20;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, textX, textY);

      y += msg.height + MSG_GAP;
    }
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
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </Box>
      <Box position="absolute" bottom={3} left={0} right={0} textAlign="center">
        <Text color={COLORS.textMuted} fontSize="xs" fontFamily="mono">
          Pre-measured bubble sizing. Zero layout shift.
        </Text>
      </Box>
    </Box>
  );
}
