import {
  Box,
  Text,
  VStack,
  HStack,
  Button,
  keyframes,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';

// ── Color Palette ─────────────────────────────────────────────────────
const C = {
  body: '#0A0A0F',
  card: '#141418',
  panel: '#1A1A20',
  hover: '#222228',
  input: '#0E0E14',

  textPrimary: '#E4E4E8',
  textBody: '#9898A0',
  textMuted: '#585860',

  action: '#4A6FA5',
  glow: '#6B8FCC',
  success: '#3D8A4E',
  danger: '#C44040',
  gold: '#EFD31C',

  borderDefault: '#2A2A30',
  borderAccent: 'rgba(74,111,165,0.2)',
  borderSubtle: 'rgba(228,228,232,0.06)',

  rarityWorn: '#8a8a8a',
  rarityCommon: '#f0f2f5',
  rarityUncommon: '#3d8a4e',
  rarityRare: '#3d6fb5',
  rarityEpic: '#7b4ab5',
  rarityLegendary: '#c47a2a',
};

// ── Animations ────────────────────────────────────────────────────────
const legendaryBreath = keyframes`
  0%   { box-shadow: 0 0 8px  ${C.rarityLegendary}40, 0 0 20px ${C.rarityLegendary}15, inset 0 0 8px ${C.rarityLegendary}10; border-color: ${C.rarityLegendary}60; }
  50%  { box-shadow: 0 0 20px ${C.rarityLegendary}80, 0 0 50px ${C.rarityLegendary}30, inset 0 0 20px ${C.rarityLegendary}20; border-color: ${C.rarityLegendary}cc; }
  100% { box-shadow: 0 0 8px  ${C.rarityLegendary}40, 0 0 20px ${C.rarityLegendary}15, inset 0 0 8px ${C.rarityLegendary}10; border-color: ${C.rarityLegendary}60; }
`;

// Epic breathing glow (subtler than legendary) — used when epic rarity cards are present
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const epicBreath = keyframes`
  0%   { box-shadow: 0 0 4px ${C.rarityEpic}20, 0 0 12px ${C.rarityEpic}08; border-color: ${C.rarityEpic}30; }
  50%  { box-shadow: 0 0 10px ${C.rarityEpic}50, 0 0 25px ${C.rarityEpic}18; border-color: ${C.rarityEpic}70; }
  100% { box-shadow: 0 0 4px ${C.rarityEpic}20, 0 0 12px ${C.rarityEpic}08; border-color: ${C.rarityEpic}30; }
`;

// ── Stat Bar Component ────────────────────────────────────────────────
function StatBar({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const pct = (current / max) * 100;
  return (
    <Box w="100%">
      <HStack justify="space-between" mb="2px">
        <Text fontSize="11px" color={C.textMuted} letterSpacing="0.08em">
          {label}
        </Text>
        <Text fontSize="11px" color={C.textBody}>
          {current}/{max}
        </Text>
      </HStack>
      <Box bg={C.input} borderRadius="2px" h="6px" overflow="hidden">
        <Box bg={color} h="100%" w={`${pct}%`} borderRadius="2px" transition="width 0.4s ease" />
      </Box>
    </Box>
  );
}

// ── Item Card Component ───────────────────────────────────────────────
function ItemCard({
  name,
  rarity,
  rarityLabel,
  rarityColor,
  stat,
  animation,
}: {
  name: string;
  rarity: 'worn' | 'common' | 'rare' | 'epic' | 'legendary';
  rarityLabel: string;
  rarityColor: string;
  stat: string;
  animation?: string;
}) {
  const isWorn = rarity === 'worn';
  const isCommon = rarity === 'common';
  const hasGlow = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary';

  const borderColor = hasGlow ? `${rarityColor}40` : C.borderDefault;
  const nameColor = isWorn ? C.textBody : C.textPrimary;
  const rarityTextColor = isWorn || isCommon ? C.textMuted : rarityColor;
  const statColor = isWorn ? C.textMuted : C.textBody;

  const glowStyles = hasGlow
    ? {
        boxShadow:
          rarity === 'rare'
            ? `0 0 6px ${rarityColor}25, 0 0 15px ${rarityColor}10`
            : undefined,
      }
    : {};

  return (
    <Box
      bg={C.card}
      w={{ base: '140px', md: '150px' }}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="0"
      overflow="hidden"
      animation={animation}
      {...glowStyles}
      flexShrink={0}
    >
      {/* Image placeholder */}
      <Box
        bg={C.panel}
        h="100px"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="28px" color={C.textMuted} opacity={0.3}>
          {rarity === 'legendary' ? '?' : rarity === 'epic' ? '?' : '?'}
        </Text>
      </Box>

      {/* Card body */}
      <Box p="10px">
        <Text
          fontSize="12px"
          fontWeight="600"
          color={nameColor}
          lineHeight="1.3"
          mb="4px"
          noOfLines={1}
        >
          {name}
        </Text>
        <Text fontSize="10px" color={rarityTextColor} letterSpacing="0.06em" mb="6px">
          {rarityLabel}
        </Text>
        <Text fontSize="11px" color={statColor}>
          {stat}
        </Text>
      </Box>
    </Box>
  );
}

// ── Map Tile Component ────────────────────────────────────────────────
function MapTile({
  type,
}: {
  type: 'empty' | 'current' | 'monster' | 'explored';
}) {
  let bg = C.card;
  let borderColor = C.borderSubtle;
  if (type === 'current') {
    bg = C.panel;
    borderColor = C.action;
  } else if (type === 'explored') {
    bg = '#111116';
  }

  return (
    <Box
      w="40px"
      h="40px"
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {type === 'monster' && (
        <Box w="8px" h="8px" borderRadius="50%" bg={C.danger} />
      )}
      {type === 'current' && (
        <Box w="6px" h="6px" borderRadius="50%" bg={C.textBody} />
      )}
    </Box>
  );
}

// ── Combat Log Line Component ─────────────────────────────────────────
function LogLine({ color, children }: { color: string; children: string }) {
  return (
    <Text fontSize="12px" color={color} lineHeight="1.7" fontFamily="monospace">
      {children}
    </Text>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export function ThemeObsidianVoid() {
  const stats = [
    { label: 'ATK', value: 44 },
    { label: 'DEF', value: 24 },
    { label: 'SPD', value: 52 },
    { label: 'LCK', value: 28 },
  ];

  // Map grid: 5x5
  const mapGrid: ('empty' | 'current' | 'monster' | 'explored')[][] = [
    ['explored', 'explored', 'empty', 'empty', 'empty'],
    ['explored', 'current', 'empty', 'monster', 'empty'],
    ['empty', 'explored', 'explored', 'empty', 'empty'],
    ['empty', 'empty', 'explored', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
  ];

  return (
    <Box bg={C.body} minH="100vh" color={C.textPrimary}>
      <Helmet>
        <title>Obsidian Void Theme | Ultimate Dominion</title>
        <meta name="theme-color" content={C.body} />
      </Helmet>

      {/* ── 1. Header Bar ──────────────────────────────────────── */}
      <HStack
        bg={C.card}
        borderBottom="1px solid"
        borderColor={C.borderDefault}
        px={{ base: 4, md: 8 }}
        py={3}
        justify="space-between"
        align="center"
      >
        <Text
          fontSize="12px"
          color={C.textBody}
          letterSpacing="0.25em"
          fontVariant="small-caps"
          fontWeight="500"
        >
          ULTIMATE DOMINION
        </Text>
        <Button
          size="sm"
          bg="transparent"
          border="1px solid"
          borderColor={C.borderDefault}
          color={C.textBody}
          fontSize="12px"
          fontWeight="400"
          borderRadius="0"
          _hover={{ bg: C.hover, borderColor: C.textMuted }}
          _active={{ bg: C.hover }}
        >
          Account
        </Button>
      </HStack>

      {/* ── Page Content ───────────────────────────────────────── */}
      <Box maxW="900px" mx="auto" px={{ base: 4, md: 6 }} py={8}>
        <VStack spacing={8} align="stretch">
          {/* ── 2. Stats Panel ───────────────────────────────────── */}
          <Box>
            {/* Outer clipped container (border effect) */}
            <Box
              bg={C.borderDefault}
              clipPath="polygon(20px 0%, 100% 0%, 100% calc(100% - 25px), calc(100% - 25px) 100%, 0% 100%, 0% 40px)"
              p="1px"
            >
              {/* Inner panel */}
              <Box
                bg={C.card}
                clipPath="polygon(20px 0%, 100% 0%, 100% calc(100% - 25px), calc(100% - 25px) 100%, 0% 100%, 0% 40px)"
                p={{ base: 4, md: 6 }}
              >
                {/* Character name & class */}
                <HStack justify="space-between" align="baseline" mb={4}>
                  <Box>
                    <Text
                      fontSize="18px"
                      fontWeight="600"
                      color={C.textPrimary}
                      letterSpacing="0.04em"
                    >
                      Ashborn
                    </Text>
                    <Text fontSize="12px" color={C.textBody} mt="2px">
                      Level 12 Rogue
                    </Text>
                  </Box>
                  <HStack spacing={1} align="baseline">
                    <Text fontSize="11px" color={C.textMuted}>
                      Gold
                    </Text>
                    <Text
                      fontSize="16px"
                      fontWeight="600"
                      color={C.gold}
                      letterSpacing="0.02em"
                    >
                      956
                    </Text>
                  </HStack>
                </HStack>

                {/* Bars */}
                <VStack spacing={3} mb={5}>
                  <StatBar label="HP" current={160} max={220} color={C.success} />
                  <StatBar label="MP" current={60} max={90} color={C.action} />
                  <StatBar label="XP" current={340} max={800} color={C.textMuted} />
                </VStack>

                {/* Stat numbers */}
                <HStack spacing={{ base: 4, md: 8 }} flexWrap="wrap">
                  {stats.map((s) => (
                    <HStack key={s.label} spacing={2}>
                      <Text
                        fontSize="10px"
                        color={C.textMuted}
                        letterSpacing="0.1em"
                        fontWeight="500"
                      >
                        {s.label}
                      </Text>
                      <Text fontSize="14px" color={C.textPrimary} fontWeight="500">
                        {s.value}
                      </Text>
                    </HStack>
                  ))}
                </HStack>
              </Box>
            </Box>
          </Box>

          {/* ── 3. Item Cards Row ────────────────────────────────── */}
          <HStack
            spacing={4}
            overflowX="auto"
            py={2}
            css={{
              '&::-webkit-scrollbar': { height: '4px' },
              '&::-webkit-scrollbar-track': { background: C.body },
              '&::-webkit-scrollbar-thumb': { background: C.borderDefault },
            }}
          >
            {/* Worn — entirely dead */}
            <ItemCard
              name="Rusty Blade"
              rarity="worn"
              rarityLabel="Worn"
              rarityColor={C.rarityWorn}
              stat="ATK +3"
            />

            {/* Common — barely there */}
            <ItemCard
              name="Steel Gauntlets"
              rarity="common"
              rarityLabel="Common"
              rarityColor={C.rarityCommon}
              stat="DEF +8"
            />

            {/* Rare — color appears */}
            <ItemCard
              name="Sapphire Ring"
              rarity="rare"
              rarityLabel="Rare"
              rarityColor={C.rarityRare}
              stat="MP +25"
            />

            {/* Legendary — beacon in the void */}
            <ItemCard
              name="Inferno Crown"
              rarity="legendary"
              rarityLabel="Legendary"
              rarityColor={C.rarityLegendary}
              stat="ATK +22  SPD +12"
              animation={`${legendaryBreath} 3s ease-in-out infinite`}
            />
          </HStack>

          {/* ── 4. Action Buttons Row ────────────────────────────── */}
          <HStack spacing={3} flexWrap="wrap">
            <Button
              bg={C.action}
              color={C.textPrimary}
              fontSize="13px"
              fontWeight="500"
              borderRadius="0"
              size="sm"
              px={6}
              _hover={{ bg: C.glow }}
              _active={{ bg: C.action }}
            >
              Move
            </Button>
            <Button
              bg={C.action}
              color={C.textPrimary}
              fontSize="13px"
              fontWeight="500"
              borderRadius="0"
              size="sm"
              px={6}
              _hover={{ bg: C.glow }}
              _active={{ bg: C.action }}
            >
              Attack
            </Button>
            <Button
              bg="transparent"
              border="1px solid"
              borderColor={C.borderDefault}
              color={C.textMuted}
              fontSize="13px"
              fontWeight="400"
              borderRadius="0"
              size="sm"
              px={6}
              _hover={{ bg: C.hover, borderColor: C.textMuted }}
              _active={{ bg: C.hover }}
            >
              Rest
            </Button>
            <Button
              bg="transparent"
              border="1px solid"
              borderColor="rgba(196,64,64,0.2)"
              color={C.danger}
              fontSize="13px"
              fontWeight="400"
              borderRadius="0"
              size="sm"
              px={6}
              _hover={{ bg: 'rgba(196,64,64,0.06)', borderColor: 'rgba(196,64,64,0.4)' }}
              _active={{ bg: 'rgba(196,64,64,0.1)' }}
            >
              Flee
            </Button>
          </HStack>

          {/* ── 5. Combat Log ────────────────────────────────────── */}
          <Box
            bg={C.input}
            border="1px solid"
            borderColor={C.borderDefault}
            p={4}
          >
            <Text
              fontSize="10px"
              color={C.textMuted}
              letterSpacing="0.12em"
              mb={3}
              fontWeight="500"
            >
              COMBAT LOG
            </Text>
            <VStack align="start" spacing={0}>
              <LogLine color={C.textPrimary}>
                You backstab the Void Sentinel for 44 damage.
              </LogLine>
              <LogLine color={C.danger}>
                Void Sentinel retaliates for 28 damage.
              </LogLine>
              <LogLine color={C.glow}>
                You activate Shadow Step. SPD +15 for 2 turns.
              </LogLine>
              <LogLine color={C.rarityLegendary}>
                You found: Inferno Crown (Legendary)
              </LogLine>
              <LogLine color={C.gold}>Gold received: 230</LogLine>
            </VStack>
          </Box>

          {/* ── 6. Map Grid ──────────────────────────────────────── */}
          <Box>
            <Text
              fontSize="10px"
              color={C.textMuted}
              letterSpacing="0.12em"
              mb={3}
              fontWeight="500"
            >
              MAP
            </Text>
            <VStack spacing={0} align="start">
              {mapGrid.map((row, y) => (
                <HStack key={y} spacing={0}>
                  {row.map((tile, x) => (
                    <MapTile key={`${x}-${y}`} type={tile} />
                  ))}
                </HStack>
              ))}
            </VStack>
          </Box>

          {/* ── 7. Design Statement ──────────────────────────────── */}
          <Text
            fontSize="12px"
            color={C.textMuted}
            fontStyle="italic"
            textAlign="center"
            mt={4}
          >
            Color belongs to the world, not the interface.
          </Text>

          {/* ── 8. Bottom Label ──────────────────────────────────── */}
          <Text
            fontSize="11px"
            color={C.textMuted}
            textAlign="center"
            letterSpacing="0.2em"
          >
            OBSIDIAN VOID — Theme Preview
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
