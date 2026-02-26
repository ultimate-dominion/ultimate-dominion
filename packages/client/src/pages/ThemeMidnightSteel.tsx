import {
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Image,
  keyframes,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';

/* ─── COLOR TOKENS ─── */
const c = {
  // Backgrounds
  body: '#0C1539',
  card: '#111B42',
  panel: '#162050',
  hover: '#1A2660',
  input: '#0A1230',
  explored: '#0F1840',

  // Text
  textPrimary: '#D0D4DC',
  textBody: '#A2A9B0',
  textMuted: '#6B7280',

  // Accents
  action: '#1633B6',
  glow: '#3B6CE8',
  success: '#22C55E',
  danger: '#EF4444',
  gold: '#EFD31C',

  // Borders
  border: '#1A244E',
  borderAccent: 'rgba(59,130,228,0.3)',
  borderSubtle: 'rgba(162,169,176,0.12)',

  // Rarity
  worn: '#8a8a8a',
  common: '#f0f2f5',
  uncommon: '#3d8a4e',
  rare: '#3d6fb5',
  epic: '#7b4ab5',
  legendary: '#c47a2a',
};

/* ─── ANIMATIONS ─── */
const legendaryGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 6px rgba(196,122,42,0.25),
      0 0 18px rgba(196,122,42,0.15),
      inset 0 0 8px rgba(196,122,42,0.05);
  }
  50% {
    box-shadow:
      0 0 14px rgba(196,122,42,0.5),
      0 0 36px rgba(196,122,42,0.25),
      inset 0 0 14px rgba(196,122,42,0.1);
  }
`;

const cursorBlink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

/* ─── CLIP PATH ─── */
const polygonClip =
  'polygon(20px 0%, 100% 0%, 100% calc(100% - 25px), calc(100% - 25px) 100%, 0% 100%, 0% 40px)';

/* ─── SECTION WRAPPER ─── */
const Section = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <Box w="100%">
    <Text
      color={c.textMuted}
      fontSize="10px"
      fontWeight={600}
      letterSpacing="0.15em"
      mb={3}
      textTransform="uppercase"
    >
      {label}
    </Text>
    {children}
  </Box>
);

/* ─── ITEM CARD ─── */
const ItemCard = ({
  name,
  rarityLabel,
  rarityColor,
  stat,
  imagePlaceholder,
  animated,
  glowShadow,
}: {
  name: string;
  rarityLabel: string;
  rarityColor: string;
  stat: string;
  imagePlaceholder: string;
  animated?: boolean;
  glowShadow?: string;
}) => (
  <Box
    animation={animated ? `${legendaryGlow} 3s ease-in-out infinite` : undefined}
    bg={c.card}
    border="1px solid"
    borderColor={`${rarityColor}33`}
    borderRadius="4px"
    boxShadow={glowShadow}
    minW="140px"
    overflow="hidden"
    transition="all 0.2s"
    w={{ base: 'calc(50% - 6px)', md: '150px' }}
    _hover={{
      borderColor: `${rarityColor}66`,
      transform: 'translateY(-2px)',
    }}
  >
    {/* Image placeholder */}
    <Box
      alignItems="center"
      bg={c.panel}
      display="flex"
      h="100px"
      justifyContent="center"
      position="relative"
    >
      <Image
        alt={name}
        fallback={
          <Text color={c.textMuted} fontSize="11px" fontStyle="italic">
            {imagePlaceholder}
          </Text>
        }
        src=""
      />
      {/* Rarity indicator line */}
      <Box
        bg={rarityColor}
        borderRadius="1px"
        bottom={0}
        h="2px"
        left={0}
        opacity={0.6}
        position="absolute"
        right={0}
      />
    </Box>

    {/* Card body */}
    <Box p={3}>
      <Text color={c.textPrimary} fontSize="13px" fontWeight={600} noOfLines={1}>
        {name}
      </Text>
      <Text color={rarityColor} fontSize="10px" fontWeight={600} letterSpacing="0.05em" mt={0.5}>
        {rarityLabel}
      </Text>
      <Text color={c.textBody} fontSize="11px" mt={1.5}>
        {stat}
      </Text>
    </Box>
  </Box>
);

/* ─── STAT ROW ─── */
const StatRow = ({ label, value }: { label: string; value: string }) => (
  <HStack justifyContent="space-between" w="100%">
    <Text color={c.textMuted} fontSize="12px" fontWeight={500}>
      {label}
    </Text>
    <Text color={c.textPrimary} fontSize="12px" fontFamily="'Fira Code', monospace" fontWeight={600}>
      {value}
    </Text>
  </HStack>
);

/* ─── RARITY SWATCH ─── */
const RaritySwatch = ({ label, color }: { label: string; color: string }) => (
  <HStack spacing={2}>
    <Box bg={color} borderRadius="2px" h="12px" w="12px" />
    <Text color={color} fontSize="11px" fontWeight={600}>
      {label}
    </Text>
  </HStack>
);

/* ─── COMBAT LOG LINE ─── */
const LogLine = ({ text, color }: { text: string; color: string }) => (
  <HStack spacing={2} alignItems="flex-start">
    <Text color={c.textMuted} fontSize="11px" fontFamily="'Fira Code', monospace" flexShrink={0}>
      &gt;
    </Text>
    <Text color={color} fontSize="12px" fontFamily="'Fira Code', monospace" lineHeight="1.5">
      {text}
    </Text>
  </HStack>
);

/* ─── MAP TILE ─── */
const MapTile = ({
  variant,
}: {
  variant: 'empty' | 'current' | 'monster' | 'explored' | 'chest';
}) => {
  const styles: Record<string, { bg: string; border: string; content?: React.ReactNode }> = {
    empty: { bg: c.card, border: `1px solid ${c.border}` },
    current: {
      bg: c.hover,
      border: `1px solid ${c.glow}`,
      content: (
        <Box bg={c.glow} borderRadius="50%" h="6px" opacity={0.9} w="6px" />
      ),
    },
    monster: {
      bg: c.card,
      border: `1px solid ${c.border}`,
      content: (
        <Box bg={c.danger} borderRadius="50%" h="5px" opacity={0.8} w="5px" />
      ),
    },
    explored: { bg: c.explored, border: `1px solid ${c.border}` },
    chest: {
      bg: c.card,
      border: `1px solid ${c.border}`,
      content: (
        <Box bg={c.gold} borderRadius="1px" h="5px" opacity={0.7} w="6px" />
      ),
    },
  };

  const s = styles[variant];
  return (
    <Box
      alignItems="center"
      bg={s.bg}
      border={s.border}
      borderRadius="2px"
      display="flex"
      h={{ base: '36px', md: '40px' }}
      justifyContent="center"
      transition="background 0.15s"
      w={{ base: '36px', md: '40px' }}
    >
      {s.content}
    </Box>
  );
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export const ThemeMidnightSteel = (): JSX.Element => {
  return (
    <Box bg={c.body} minH="100vh" pb={16}>
      <Helmet>
        <title>Midnight Steel Theme | Ultimate Dominion</title>
      </Helmet>

      {/* ── 1. HEADER BAR ── */}
      <Box
        alignItems="center"
        bg={c.card}
        borderBottom={`1px solid ${c.border}`}
        display="flex"
        justifyContent="space-between"
        px={{ base: 4, md: 8 }}
        py={3}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Text
          color={c.textPrimary}
          fontSize={{ base: '11px', md: '13px' }}
          fontWeight={700}
          letterSpacing="0.2em"
          textTransform="uppercase"
        >
          Ultimate Dominion
        </Text>
        <Button
          bg={c.action}
          borderRadius="6px"
          color="white"
          fontSize="12px"
          fontWeight={600}
          h="32px"
          px={4}
          _hover={{ bg: c.glow }}
        >
          Account
        </Button>
      </Box>

      {/* ── CONTENT ── */}
      <VStack
        maxW="780px"
        mx="auto"
        px={{ base: 4, md: 6 }}
        py={{ base: 6, md: 10 }}
        spacing={{ base: 8, md: 10 }}
        w="100%"
      >
        {/* ── 2. STATS PANEL ── */}
        <Section label="Character Stats">
          {/* Outer border shell for polygonal card */}
          <Box bg={c.border} clipPath={polygonClip} p="1px">
            <Box bg={c.card} clipPath={polygonClip} p={{ base: 4, md: 6 }}>
              {/* Character identity */}
              <HStack justifyContent="space-between" mb={5}>
                <Box>
                  <Text color={c.textPrimary} fontSize="18px" fontWeight={700}>
                    Voidwalker
                  </Text>
                  <Text color={c.textBody} fontSize="13px" mt={0.5}>
                    Level 12 Mage
                  </Text>
                </Box>
                <HStack spacing={1.5}>
                  <Box
                    bg={c.gold}
                    borderRadius="50%"
                    h="8px"
                    w="8px"
                  />
                  <Text
                    color={c.gold}
                    fontFamily="'Fira Code', monospace"
                    fontSize="14px"
                    fontWeight={700}
                  >
                    1,247
                  </Text>
                </HStack>
              </HStack>

              {/* HP / MP / XP Bars */}
              <VStack spacing={3} w="100%" mb={5}>
                {/* HP Bar */}
                <Box w="100%">
                  <HStack justifyContent="space-between" mb={1}>
                    <Text color={c.textBody} fontSize="11px" fontWeight={500}>
                      HP
                    </Text>
                    <Text
                      color={c.success}
                      fontFamily="'Fira Code', monospace"
                      fontSize="11px"
                      fontWeight={600}
                    >
                      145 / 200
                    </Text>
                  </HStack>
                  <Progress
                    borderRadius="3px"
                    size="sm"
                    sx={{ '& > div': { bg: c.success }, bg: c.input, boxShadow: 'none' }}
                    value={(145 / 200) * 100}
                  />
                </Box>

                {/* MP Bar */}
                <Box w="100%">
                  <HStack justifyContent="space-between" mb={1}>
                    <Text color={c.textBody} fontSize="11px" fontWeight={500}>
                      MP
                    </Text>
                    <Text
                      color={c.glow}
                      fontFamily="'Fira Code', monospace"
                      fontSize="11px"
                      fontWeight={600}
                    >
                      80 / 120
                    </Text>
                  </HStack>
                  <Progress
                    borderRadius="3px"
                    size="sm"
                    sx={{ '& > div': { bg: c.glow }, bg: c.input, boxShadow: 'none' }}
                    value={(80 / 120) * 100}
                  />
                </Box>

                {/* XP Bar */}
                <Box w="100%">
                  <HStack justifyContent="space-between" mb={1}>
                    <Text color={c.textBody} fontSize="11px" fontWeight={500}>
                      XP
                    </Text>
                    <Text
                      color={c.textMuted}
                      fontFamily="'Fira Code', monospace"
                      fontSize="11px"
                      fontWeight={500}
                    >
                      2,450 / 5,000
                    </Text>
                  </HStack>
                  <Progress
                    borderRadius="3px"
                    size="sm"
                    sx={{ '& > div': { bg: c.action }, bg: c.input, boxShadow: 'none' }}
                    value={(2450 / 5000) * 100}
                  />
                </Box>
              </VStack>

              {/* Stats Grid */}
              <Grid gap={2} templateColumns="repeat(2, 1fr)" w="100%">
                <GridItem>
                  <StatRow label="ATK" value="34" />
                </GridItem>
                <GridItem>
                  <StatRow label="DEF" value="28" />
                </GridItem>
                <GridItem>
                  <StatRow label="SPD" value="42" />
                </GridItem>
                <GridItem>
                  <StatRow label="LCK" value="15" />
                </GridItem>
              </Grid>
            </Box>
          </Box>
        </Section>

        {/* ── RARITY SWATCHES ── */}
        <Section label="Rarity System">
          <HStack
            bg={c.card}
            border={`1px solid ${c.border}`}
            borderRadius="4px"
            flexWrap="wrap"
            gap={4}
            p={4}
          >
            <RaritySwatch label="Worn" color={c.worn} />
            <RaritySwatch label="Common" color={c.common} />
            <RaritySwatch label="Uncommon" color={c.uncommon} />
            <RaritySwatch label="Rare" color={c.rare} />
            <RaritySwatch label="Epic" color={c.epic} />
            <RaritySwatch label="Legendary" color={c.legendary} />
          </HStack>
        </Section>

        {/* ── 3. ITEM CARDS ROW ── */}
        <Section label="Equipment">
          <HStack
            flexWrap="wrap"
            gap={3}
            justifyContent={{ base: 'center', md: 'flex-start' }}
            w="100%"
          >
            <ItemCard
              imagePlaceholder="[ sword ]"
              name="Iron Sword"
              rarityColor={c.common}
              rarityLabel="COMMON"
              stat="ATK +12"
            />
            <ItemCard
              imagePlaceholder="[ staff ]"
              name="Emerald Staff"
              rarityColor={c.uncommon}
              rarityLabel="UNCOMMON"
              stat="MAG +18"
            />
            <ItemCard
              glowShadow={`0 0 8px rgba(61,111,181,0.3), 0 0 20px rgba(61,111,181,0.12)`}
              imagePlaceholder="[ blade ]"
              name="Frostbite Blade"
              rarityColor={c.rare}
              rarityLabel="RARE"
              stat="ATK +24  SPD +8"
            />
            <ItemCard
              animated
              imagePlaceholder="[ axe ]"
              name="Shadowbane Axe"
              rarityColor={c.legendary}
              rarityLabel="LEGENDARY"
              stat="ATK +42  LCK +12"
            />
          </HStack>
        </Section>

        {/* ── 4. ACTION BUTTONS ROW ── */}
        <Section label="Actions">
          <HStack flexWrap="wrap" gap={3}>
            <Button
              bg={c.action}
              borderRadius="6px"
              color="white"
              fontSize="13px"
              fontWeight={600}
              h="38px"
              px={6}
              _hover={{ bg: c.glow }}
            >
              Move
            </Button>
            <Button
              bg={c.action}
              borderRadius="6px"
              color="white"
              fontSize="13px"
              fontWeight={600}
              h="38px"
              px={6}
              _hover={{ bg: c.glow }}
            >
              Attack
            </Button>
            <Button
              bg="transparent"
              border={`1px solid ${c.border}`}
              borderRadius="6px"
              color={c.textBody}
              fontSize="13px"
              fontWeight={500}
              h="38px"
              px={6}
              _hover={{ bg: c.hover, borderColor: c.textMuted }}
            >
              Rest
            </Button>
            <Button
              bg="transparent"
              border="1px solid rgba(239,68,68,0.3)"
              borderRadius="6px"
              color={c.danger}
              fontSize="13px"
              fontWeight={500}
              h="38px"
              px={6}
              _hover={{ bg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.5)' }}
            >
              Flee
            </Button>
          </HStack>
        </Section>

        {/* ── 5. COMBAT LOG ── */}
        <Section label="Combat Log">
          <Box
            bg={c.input}
            border={`1px solid ${c.border}`}
            borderRadius="4px"
            maxH="200px"
            overflowY="auto"
            p={4}
            position="relative"
          >
            <VStack alignItems="flex-start" spacing={1.5}>
              <LogLine color={c.textPrimary} text="You strike the Shadow Drake for 34 damage." />
              <LogLine color={c.danger} text="Shadow Drake retaliates for 18 damage." />
              <LogLine color={c.glow} text="You cast Arcane Shield. DEF +12 for 3 turns." />
              <LogLine color={c.textPrimary} text="You strike the Shadow Drake for 29 damage." />
              <LogLine color={c.danger} text="Shadow Drake breathes dark fire for 22 damage." />
              <LogLine color={c.success} text="Shadow Drake defeated." />
              <LogLine color={c.uncommon} text="You found: Emerald Staff (Uncommon)" />
              <LogLine color={c.gold} text="Gold received: 45" />
              <LogLine color={c.textPrimary} text="You gained 180 XP." />
            </VStack>
            {/* Blinking cursor */}
            <Box
              animation={`${cursorBlink} 1s step-end infinite`}
              bg={c.textMuted}
              h="14px"
              mt={2}
              w="7px"
            />
          </Box>
        </Section>

        {/* ── 6. MAP GRID ── */}
        <Section label="World Map">
          <Box
            bg={c.card}
            border={`1px solid ${c.border}`}
            borderRadius="4px"
            display="inline-block"
            p={4}
          >
            <Grid gap="3px" templateColumns="repeat(5, 1fr)">
              {/* Row 1 */}
              <MapTile variant="explored" />
              <MapTile variant="explored" />
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              {/* Row 2 */}
              <MapTile variant="explored" />
              <MapTile variant="explored" />
              <MapTile variant="explored" />
              <MapTile variant="empty" />
              <MapTile variant="monster" />
              {/* Row 3 */}
              <MapTile variant="empty" />
              <MapTile variant="explored" />
              <MapTile variant="current" />
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              {/* Row 4 */}
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              <MapTile variant="explored" />
              <MapTile variant="chest" />
              <MapTile variant="empty" />
              {/* Row 5 */}
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              <MapTile variant="empty" />
              <MapTile variant="monster" />
              <MapTile variant="empty" />
            </Grid>

            {/* Legend */}
            <HStack flexWrap="wrap" gap={4} mt={3} pt={3} borderTop={`1px solid ${c.border}`}>
              <HStack spacing={1.5}>
                <Box bg={c.glow} borderRadius="50%" h="6px" w="6px" />
                <Text color={c.textMuted} fontSize="10px">
                  You
                </Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box bg={c.danger} borderRadius="50%" h="5px" w="5px" />
                <Text color={c.textMuted} fontSize="10px">
                  Monster
                </Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box bg={c.gold} borderRadius="1px" h="5px" w="6px" />
                <Text color={c.textMuted} fontSize="10px">
                  Chest
                </Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box bg={c.explored} border={`1px solid ${c.border}`} borderRadius="1px" h="8px" w="8px" />
                <Text color={c.textMuted} fontSize="10px">
                  Explored
                </Text>
              </HStack>
            </HStack>
          </Box>
        </Section>

        {/* ── 7. BOTTOM LABEL ── */}
        <Text
          color={c.textMuted}
          fontSize="11px"
          letterSpacing="0.2em"
          mt={12}
          textAlign="center"
          textTransform="uppercase"
          w="100%"
        >
          Midnight Steel — Theme Preview
        </Text>
      </VStack>
    </Box>
  );
};
