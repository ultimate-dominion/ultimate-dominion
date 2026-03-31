import { useCallback, useRef, useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { prepare, layout } from '@chenglou/pretext';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts, getFontString } from './hooks/usePretextFonts';
import { COLORS } from './theme';

type LogEntryType = 'attack' | 'crit' | 'heal' | 'gold' | 'death' | 'levelup';

type LogEntry = {
  text: string;
  type: LogEntryType;
  height: number;
};

const TYPE_COLORS: Record<LogEntryType, string> = {
  attack: COLORS.textBody,
  crit: COLORS.danger,
  heal: COLORS.success,
  gold: COLORS.glow,
  death: '#8B4040',
  levelup: '#4A8B4A',
};

const NAMES = ['ShadowBlade', 'IronVow', 'NightWhisper', 'VoidWalker', 'FlameSeeker', 'DarkPaladin'];
const MONSTERS = ['Cave Rat', 'Bone Stalker', 'Iron Golem', 'Wyvern', 'Abyssal Knight', 'Flame Wyrm'];

function randomName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
function randomMonster() { return MONSTERS[Math.floor(Math.random() * MONSTERS.length)]; }
function randomDmg() { return Math.floor(Math.random() * 80) + 5; }
function randomGold() { return Math.floor(Math.random() * 200) + 10; }
function randomHeal() { return Math.floor(Math.random() * 50) + 10; }

function generateEntry(): Omit<LogEntry, 'height'> {
  const roll = Math.random();
  if (roll < 0.35) return { text: `> ${randomName()} attacks ${randomMonster()} for ${randomDmg()} damage`, type: 'attack' };
  if (roll < 0.50) return { text: `> ${randomName()} CRITS ${randomMonster()} for ${randomDmg() * 2} damage!`, type: 'crit' };
  if (roll < 0.65) return { text: `> ${randomName()} heals for ${randomHeal()} HP`, type: 'heal' };
  if (roll < 0.80) return { text: `> ${randomName()} loots ${randomGold()} gold from ${randomMonster()}`, type: 'gold' };
  if (roll < 0.92) return { text: `> ${randomName()} was slain by ${randomMonster()}`, type: 'death' };
  return { text: `> ${randomName()} reached Level ${Math.floor(Math.random() * 45) + 5}!`, type: 'levelup' };
}

const FONT_STR = '14px Fira Code';
const LINE_HEIGHT = 20;
const PADDING = 12;

export function CanvasCombatLog() {
  const { ready } = usePretextFonts();
  const entriesRef = useRef<LogEntry[]>([]);
  const scrollYRef = useRef(0);
  const totalHeightRef = useRef(0);
  const autoScrollRef = useRef(true);
  const lastScrollY = useRef(0);

  // Generate initial entries
  useEffect(() => {
    if (!ready) return;

    const entries: LogEntry[] = [];
    for (let i = 0; i < 200; i++) {
      const e = generateEntry();
      const prepared = prepare(e.text, FONT_STR);
      const result = layout(prepared, 800, LINE_HEIGHT);
      entries.push({ ...e, height: result.height + 4 });
    }
    entriesRef.current = entries;
    totalHeightRef.current = entries.reduce((sum, e) => sum + e.height, 0);
    scrollYRef.current = totalHeightRef.current; // Start at bottom
  }, [ready]);

  // Add new entries periodically
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const e = generateEntry();
      const prepared = prepare(e.text, FONT_STR);
      const result = layout(prepared, 800, LINE_HEIGHT);
      const entry = { ...e, height: result.height + 4 };
      entriesRef.current.push(entry);
      totalHeightRef.current += entry.height;

      // Keep max 2000 entries
      if (entriesRef.current.length > 2000) {
        const removed = entriesRef.current.shift()!;
        totalHeightRef.current -= removed.height;
        scrollYRef.current = Math.max(0, scrollYRef.current - removed.height);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [ready]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const entries = entriesRef.current;
    if (entries.length === 0) return;

    const maxScroll = Math.max(0, totalHeightRef.current - height + PADDING * 2);

    // Auto-scroll to bottom
    if (autoScrollRef.current) {
      scrollYRef.current = maxScroll;
    }

    const scrollY = Math.max(0, Math.min(scrollYRef.current, maxScroll));

    // Find first visible entry
    let cumY = 0;
    let firstVisible = 0;
    for (let i = 0; i < entries.length; i++) {
      if (cumY + entries[i].height > scrollY - PADDING) {
        firstVisible = i;
        break;
      }
      cumY += entries[i].height;
    }

    // Render visible entries
    ctx.font = FONT_STR;
    ctx.textBaseline = 'top';
    let y = cumY - scrollY + PADDING;

    for (let i = firstVisible; i < entries.length; i++) {
      const entry = entries[i];
      if (y > height + 20) break;

      if (y + entry.height > -20) {
        ctx.fillStyle = TYPE_COLORS[entry.type];

        // Highlight numbers in the text
        const parts = entry.text.split(/(\d+)/g);
        let x = PADDING;
        for (const part of parts) {
          if (/^\d+$/.test(part)) {
            // Number - use brighter color
            ctx.fillStyle = entry.type === 'gold' ? COLORS.glow
              : entry.type === 'heal' ? '#6ABF5A'
              : entry.type === 'crit' ? '#FF6B4A'
              : COLORS.textPrimary;
            ctx.fillText(part, x, y);
            x += ctx.measureText(part).width;
            ctx.fillStyle = TYPE_COLORS[entry.type];
          } else {
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
      const barY = (scrollY / maxScroll) * (height - barHeight);
      ctx.fillStyle = COLORS.border;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(width - 6, barY, 4, barHeight);
      ctx.globalAlpha = 1;
    }

    // Top fade
    const fadeH = 20;
    const topGrad = ctx.createLinearGradient(0, 0, 0, fadeH);
    topGrad.addColorStop(0, COLORS.bg);
    topGrad.addColorStop(1, 'rgba(18,16,14,0)');
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
      // Disable auto-scroll if user scrolls up
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
          {entriesRef.current.length} entries, zero DOM nodes. Scroll to browse, new events every 400ms.
        </Text>
      </Box>
    </Box>
  );
}
