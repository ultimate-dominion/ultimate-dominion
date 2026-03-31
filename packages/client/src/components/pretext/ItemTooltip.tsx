import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, Grid, GridItem } from '@chakra-ui/react';
import { prepare, layout } from '@chenglou/pretext';
import { useCanvas } from './hooks/useCanvas';
import { usePretextFonts } from './hooks/usePretextFonts';
import { COLORS, rarityColor } from './theme';

type ItemStat = { label: string; value: string; color?: string };

type Item = {
  name: string;
  rarity: string;
  type: string;
  stats: ItemStat[];
  flavor: string;
};

const ITEMS: Item[] = [
  {
    name: 'Wraithblade',
    rarity: 'legendary',
    type: 'Sword',
    stats: [
      { label: 'ATK', value: '+47', color: COLORS.success },
      { label: 'SPD', value: '+12', color: COLORS.amber },
      { label: 'CRIT', value: '+8%', color: COLORS.danger },
      { label: 'DUR', value: '180/180' },
    ],
    flavor: 'Forged in the screams of a dying wraith. Each strike echoes with the lamentations of the damned.',
  },
  {
    name: 'Obsidian Shield',
    rarity: 'rare',
    type: 'Shield',
    stats: [
      { label: 'DEF', value: '+32', color: COLORS.success },
      { label: 'BLK', value: '+15%', color: COLORS.amber },
      { label: 'DUR', value: '220/220' },
    ],
    flavor: 'Hewn from volcanic glass, it drinks in the light.',
  },
  {
    name: 'Spectral Cloak',
    rarity: 'epic',
    type: 'Armor',
    stats: [
      { label: 'DEF', value: '+18', color: COLORS.success },
      { label: 'EVD', value: '+22%', color: COLORS.amber },
      { label: 'MGC', value: '+10', color: '#9B8EC4' },
      { label: 'DUR', value: '95/95' },
    ],
    flavor: 'Neither fully here nor fully gone. The wearer exists between worlds.',
  },
  {
    name: 'Rusted Iron Dagger',
    rarity: 'worn',
    type: 'Dagger',
    stats: [
      { label: 'ATK', value: '+3' },
      { label: 'DUR', value: '12/30' },
    ],
    flavor: 'It has seen better days. Many, many better days.',
  },
];

const NAME_FONT = '700 20px Cinzel';
const STAT_FONT = '500 14px Fira Code';
const FLAVOR_FONT = 'italic 400 15px Cormorant Garamond';
const TYPE_FONT = '400 12px Fira Code';

export function ItemTooltip() {
  const { ready } = usePretextFonts();
  const [activeItem, setActiveItem] = useState(0);
  const tooltipRef = useRef<{
    nameHeight: number;
    statsHeight: number;
    flavorHeight: number;
    totalHeight: number;
    totalWidth: number;
  } | null>(null);

  // Pre-measure tooltip dimensions
  useEffect(() => {
    if (!ready) return;
    const item = ITEMS[activeItem];
    const tooltipWidth = 280;

    const namePrepared = prepare(item.name, NAME_FONT);
    const nameResult = layout(namePrepared, tooltipWidth - 32, 26);

    const flavorPrepared = prepare(item.flavor, FLAVOR_FONT);
    const flavorResult = layout(flavorPrepared, tooltipWidth - 32, 20);

    const statsHeight = item.stats.length * 22 + 8;

    tooltipRef.current = {
      nameHeight: nameResult.height + 8,
      statsHeight,
      flavorHeight: flavorResult.height + 8,
      totalHeight: nameResult.height + statsHeight + flavorResult.height + 72,
      totalWidth: tooltipWidth,
    };
  }, [ready, activeItem]);

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _dt: number, elapsed: number) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const item = ITEMS[activeItem];
    const color = rarityColor(item.rarity);
    const dims = tooltipRef.current;
    if (!dims) return;

    // Center the tooltip
    const tx = (width - dims.totalWidth) / 2;
    const ty = (height - dims.totalHeight) / 2;
    const tw = dims.totalWidth;
    const th = dims.totalHeight;
    const pad = 16;

    // Background
    ctx.fillStyle = COLORS.bgCard;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.fill();

    // Rarity border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + Math.sin(elapsed / 1000) * 0.2;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Rarity glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + Math.sin(elapsed / 800) * 4;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    let y = ty + pad;

    // Item type
    ctx.font = TYPE_FONT;
    ctx.fillStyle = COLORS.textMuted;
    ctx.textBaseline = 'top';
    ctx.fillText(item.type.toUpperCase(), tx + pad, y);
    y += 18;

    // Item name
    ctx.font = NAME_FONT;
    ctx.fillStyle = color;
    ctx.fillText(item.name, tx + pad, y);
    y += dims.nameHeight + 4;

    // Divider
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(tx + pad, y, tw - pad * 2, 1);
    y += 10;

    // Stats
    ctx.font = STAT_FONT;
    for (const stat of item.stats) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(stat.label, tx + pad, y);
      ctx.fillStyle = stat.color || COLORS.textBody;
      ctx.textAlign = 'right';
      ctx.fillText(stat.value, tx + tw - pad, y);
      ctx.textAlign = 'left';
      y += 22;
    }
    y += 4;

    // Divider
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(tx + pad, y, tw - pad * 2, 1);
    y += 10;

    // Flavor text — word wrap
    ctx.font = FLAVOR_FONT;
    ctx.fillStyle = COLORS.textMuted;
    const maxFlavorWidth = tw - pad * 2;
    const words = item.flavor.split(' ');
    let lineX = tx + pad;
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxFlavorWidth && line) {
        ctx.fillText(line, lineX, y);
        y += 20;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, lineX, y);
  }, [activeItem]);

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
      <Box position="absolute" bottom={4} left={0} right={0} textAlign="center" zIndex={1}>
        <Grid templateColumns={`repeat(${ITEMS.length}, auto)`} gap={2} justifyContent="center">
          {ITEMS.map((item, i) => (
            <GridItem key={item.name}>
              <Text
                as="button"
                onClick={() => setActiveItem(i)}
                color={i === activeItem ? rarityColor(item.rarity) : COLORS.textMuted}
                fontFamily="heading"
                fontSize="xs"
                cursor="pointer"
                textDecoration={i === activeItem ? 'underline' : 'none'}
                _hover={{ color: rarityColor(item.rarity) }}
              >
                {item.name}
              </Text>
            </GridItem>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
