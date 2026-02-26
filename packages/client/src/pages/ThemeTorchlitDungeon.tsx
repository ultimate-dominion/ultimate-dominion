import {
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  keyframes,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const bg = {
  body: '#12100E',
  card: '#1C1814',
  panel: '#24201A',
  hover: '#2E2820',
  input: '#14120F',
};

const txt = {
  primary: '#E8DCC8',
  body: '#C4B89E',
  muted: '#8A7E6A',
  heading: '#D4A54A',
};

const accent = {
  action: '#C87A2A',
  glow: '#E8A840',
  success: '#5A8A3E',
  danger: '#B83A2A',
  gold: '#EFD31C',
};

const border = {
  default: '#3A3228',
  accent: 'rgba(200,122,42,0.3)',
  subtle: 'rgba(196,184,158,0.1)',
};

const rarity = {
  worn: '#8a8a8a',
  common: '#C4B89E',
  uncommon: '#3d8a4e',
  rare: '#3d6fb5',
  epic: '#7b4ab5',
  legendary: '#c47a2a',
};

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------
const breatheEpic = keyframes`
  0%, 100% {
    box-shadow: 0 0 6px rgba(123,74,181,0.15), inset 0 1px 0 rgba(123,74,181,0.08);
  }
  50% {
    box-shadow: 0 0 14px rgba(123,74,181,0.35), inset 0 1px 0 rgba(123,74,181,0.15);
  }
`;

const breatheLegendary = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(196,122,42,0.2), inset 0 1px 0 rgba(196,122,42,0.1);
  }
  50% {
    box-shadow: 0 0 18px rgba(232,168,64,0.45), inset 0 1px 0 rgba(232,168,64,0.2);
  }
`;

const flickerGlow = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.92; }
  75% { opacity: 0.97; }
`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Clipped polygon stats card */
const StatsPanel = () => {
  const clipPath =
    'polygon(20px 0%, 100% 0%, 100% calc(100% - 25px), calc(100% - 25px) 100%, 0% 100%, 0% 40px)';

  const stats = [
    { label: 'ATK', value: 48 },
    { label: 'DEF', value: 42 },
    { label: 'SPD', value: 22 },
    { label: 'LCK', value: 18 },
  ];

  return (
    <Box w="100%" maxW="400px">
      {/* Outer border shell */}
      <Box bg={border.default} p="1px" clipPath={clipPath}>
        {/* Inner panel */}
        <Box bg={bg.card} p={5} clipPath={clipPath}>
          <Text
            fontSize="18px"
            fontWeight="700"
            color={txt.primary}
            letterSpacing="0.05em"
          >
            Grimjaw
          </Text>
          <Text fontSize="13px" color={txt.body} mb={4}>
            Level 12 Warrior
          </Text>

          {/* HP */}
          <HStack justify="space-between" mb={1}>
            <Text fontSize="12px" color={txt.body}>
              HP
            </Text>
            <Text fontSize="12px" color={txt.body}>
              210 / 280
            </Text>
          </HStack>
          <Progress
            value={(210 / 280) * 100}
            size="sm"
            mb={3}
            borderRadius="2px"
            sx={{
              '& > div': { bg: accent.success },
              bg: bg.input,
            }}
          />

          {/* MP */}
          <HStack justify="space-between" mb={1}>
            <Text fontSize="12px" color={txt.body}>
              MP
            </Text>
            <Text fontSize="12px" color={txt.body}>
              30 / 50
            </Text>
          </HStack>
          <Progress
            value={(30 / 50) * 100}
            size="sm"
            mb={3}
            borderRadius="2px"
            sx={{
              '& > div': { bg: '#4A7EB5' },
              bg: bg.input,
            }}
          />

          {/* XP */}
          <HStack justify="space-between" mb={1}>
            <Text fontSize="12px" color={txt.body}>
              XP
            </Text>
            <Text fontSize="12px" color={txt.body}>
              3,100 / 5,000
            </Text>
          </HStack>
          <Progress
            value={(3100 / 5000) * 100}
            size="sm"
            mb={3}
            borderRadius="2px"
            sx={{
              '& > div': { bg: accent.action },
              bg: bg.input,
            }}
          />

          {/* Stat row */}
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mt={2}>
            {stats.map((s) => (
              <VStack key={s.label} gap={0}>
                <Text fontSize="11px" color={txt.muted} textTransform="uppercase">
                  {s.label}
                </Text>
                <Text fontSize="16px" fontWeight="700" color={txt.primary}>
                  {s.value}
                </Text>
              </VStack>
            ))}
          </Grid>

          {/* Gold */}
          <HStack mt={4} gap={1}>
            <Text fontSize="13px" color={txt.muted}>
              Gold:
            </Text>
            <Text fontSize="14px" fontWeight="700" color={accent.gold}>
              2,891
            </Text>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
};

/** Single item card */
const ItemCard = ({
  name,
  rarityLabel,
  rarityColor,
  animation,
}: {
  name: string;
  rarityLabel: string;
  rarityColor: string;
  animation?: string;
}) => (
  <Box
    bg={bg.card}
    w={{ base: '140px', md: '150px' }}
    border="1px solid"
    borderColor={
      rarityLabel === 'Worn'
        ? border.default
        : `${rarityColor}33` // ~20% opacity hex
    }
    borderRadius="4px"
    overflow="hidden"
    animation={animation}
    flexShrink={0}
  >
    {/* Image placeholder */}
    <Box
      bg={bg.panel}
      h="100px"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Text fontSize="11px" color={txt.muted}>
        [ item art ]
      </Text>
      <Text fontSize="9px" color={txt.muted} mt={1}>
        filter: sepia(0.15)
      </Text>
    </Box>
    {/* Details */}
    <Box p={2}>
      <Text fontSize="13px" fontWeight="600" color={txt.primary} lineHeight="1.3">
        {name}
      </Text>
      <Text fontSize="11px" color={rarityColor} mt={0.5}>
        {rarityLabel}
      </Text>
    </Box>
  </Box>
);

/** Combat log */
const CombatLog = () => {
  const lines: { text: string; color: string }[] = [
    { text: 'You cleave the Bone Wraith for 48 damage.', color: txt.primary },
    { text: 'Bone Wraith strikes back for 22 damage.', color: accent.danger },
    { text: 'You use Healing Salve. HP restored by 35.', color: accent.success },
    { text: 'You found: Venomfang Dagger (Epic)', color: rarity.epic },
    { text: 'Gold received: 120', color: accent.gold },
  ];

  return (
    <Box
      bg={bg.input}
      border="1px solid"
      borderColor={border.default}
      borderRadius="4px"
      p={4}
      w="100%"
      maxW="520px"
      maxH="180px"
      overflowY="auto"
    >
      <Text
        fontSize="11px"
        color={txt.muted}
        textTransform="uppercase"
        letterSpacing="0.15em"
        mb={2}
      >
        Combat Log
      </Text>
      <VStack align="start" gap={1}>
        {lines.map((l, i) => (
          <Text key={i} fontSize="13px" color={l.color} fontFamily="monospace">
            &gt; {l.text}
          </Text>
        ))}
      </VStack>
    </Box>
  );
};

/** Map grid */
const MapGrid = () => {
  // 0 = normal explored, 1 = current, 2 = monster, 3 = dark explored
  const tiles = [
    [3, 3, 0, 0, 0],
    [3, 0, 0, 2, 0],
    [0, 0, 1, 0, 0],
    [0, 2, 0, 0, 3],
    [0, 0, 0, 3, 3],
  ];

  const tileStyle = (type: number) => {
    switch (type) {
      case 1:
        return { bg: bg.hover, borderColor: accent.action };
      case 2:
        return { bg: bg.card, borderColor: border.default };
      case 3:
        return { bg: '#181510', borderColor: border.default };
      default:
        return { bg: bg.card, borderColor: border.default };
    }
  };

  return (
    <Box>
      <Text
        fontSize="11px"
        color={txt.muted}
        textTransform="uppercase"
        letterSpacing="0.15em"
        mb={2}
      >
        Dungeon Map
      </Text>
      <Grid templateColumns="repeat(5, 40px)" templateRows="repeat(5, 40px)" gap="2px">
        {tiles.flat().map((type, i) => {
          const style = tileStyle(type);
          return (
            <GridItem
              key={i}
              bg={style.bg}
              border="1px solid"
              borderColor={style.borderColor}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
            >
              {type === 1 && (
                <Box w="10px" h="10px" borderRadius="50%" bg={accent.action} />
              )}
              {type === 2 && (
                <Box w="8px" h="8px" borderRadius="50%" bg={accent.danger} />
              )}
            </GridItem>
          );
        })}
      </Grid>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export const ThemeTorchlitDungeon = () => {
  return (
    <>
      <Helmet>
        <title>Torchlit Dungeon Theme | Ultimate Dominion</title>
      </Helmet>

      {/* Full-page wrapper */}
      <Box
        minH="100vh"
        bg={bg.body}
        color={txt.body}
        fontFamily="'Inter', 'Segoe UI', sans-serif"
        position="relative"
        overflowX="hidden"
      >
        {/* Atmospheric torchlight overlay */}
        <Box
          position="fixed"
          inset={0}
          pointerEvents="none"
          zIndex={0}
          bgImage="radial-gradient(ellipse at 50% 40%, rgba(200,122,42,0.03) 0%, transparent 70%)"
          animation={`${flickerGlow} 4s ease-in-out infinite`}
        />

        {/* Content */}
        <Box position="relative" zIndex={1}>
          {/* ---- Header Bar ---- */}
          <HStack
            as="header"
            bg={bg.card}
            borderBottom="1px solid"
            borderColor={border.default}
            px={{ base: 4, md: 6 }}
            py={3}
            justify="space-between"
            align="center"
          >
            <Text
              fontSize="14px"
              fontWeight="700"
              color={txt.heading}
              letterSpacing="0.2em"
              textTransform="uppercase"
              css={{ fontVariant: 'small-caps' }}
            >
              Ultimate Dominion
            </Text>
            <Button
              size="sm"
              bg={accent.action}
              color={bg.body}
              fontWeight="600"
              fontSize="13px"
              borderRadius="4px"
              _hover={{ bg: accent.glow }}
            >
              Account
            </Button>
          </HStack>

          {/* ---- Main content ---- */}
          <VStack
            px={{ base: 4, md: 8 }}
            py={8}
            gap={8}
            align="start"
            maxW="800px"
            mx="auto"
          >
            {/* Section: Stats Panel */}
            <StatsPanel />

            {/* Section: Item Cards */}
            <Box w="100%">
              <Text
                fontSize="11px"
                color={txt.muted}
                textTransform="uppercase"
                letterSpacing="0.15em"
                mb={3}
              >
                Inventory
              </Text>
              <HStack
                gap={3}
                overflowX="auto"
                pb={2}
                css={{
                  '&::-webkit-scrollbar': { height: '4px' },
                  '&::-webkit-scrollbar-track': { bg: bg.input },
                  '&::-webkit-scrollbar-thumb': { bg: border.default, borderRadius: '2px' },
                }}
              >
                <ItemCard
                  name="Worn Shield"
                  rarityLabel="Worn"
                  rarityColor={rarity.worn}
                />
                <ItemCard
                  name="Oak Staff"
                  rarityLabel="Common"
                  rarityColor={rarity.common}
                />
                <ItemCard
                  name="Venomfang Dagger"
                  rarityLabel="Epic"
                  rarityColor={rarity.epic}
                  animation={`${breatheEpic} 3s ease-in-out infinite`}
                />
                <ItemCard
                  name="Dragonbone Helm"
                  rarityLabel="Legendary"
                  rarityColor={rarity.legendary}
                  animation={`${breatheLegendary} 2.5s ease-in-out infinite`}
                />
              </HStack>
            </Box>

            {/* Section: Action Buttons */}
            <Box w="100%">
              <Text
                fontSize="11px"
                color={txt.muted}
                textTransform="uppercase"
                letterSpacing="0.15em"
                mb={3}
              >
                Actions
              </Text>
              <HStack gap={3} flexWrap="wrap">
                <Button
                  size="sm"
                  bg={accent.action}
                  color={bg.body}
                  fontWeight="600"
                  borderRadius="4px"
                  _hover={{ bg: accent.glow }}
                >
                  Move
                </Button>
                <Button
                  size="sm"
                  bg={accent.action}
                  color={bg.body}
                  fontWeight="600"
                  borderRadius="4px"
                  _hover={{ bg: accent.glow }}
                >
                  Attack
                </Button>
                <Button
                  size="sm"
                  bg="transparent"
                  color={txt.body}
                  fontWeight="600"
                  borderRadius="4px"
                  border="1px solid"
                  borderColor={border.default}
                  _hover={{ bg: bg.hover }}
                >
                  Rest
                </Button>
                <Button
                  size="sm"
                  bg="transparent"
                  color={accent.danger}
                  fontWeight="600"
                  borderRadius="4px"
                  border="1px solid"
                  borderColor="rgba(184,58,42,0.3)"
                  _hover={{ bg: 'rgba(184,58,42,0.08)' }}
                >
                  Flee
                </Button>
              </HStack>
            </Box>

            {/* Section: Combat Log */}
            <CombatLog />

            {/* Section: Map Grid */}
            <MapGrid />

            {/* Section: Bottom Label */}
            <Box w="100%" pt={6} pb={4}>
              <Text
                fontSize="11px"
                color={txt.muted}
                letterSpacing="0.2em"
                textAlign="center"
                textTransform="uppercase"
              >
                Torchlit Dungeon — Theme Preview
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>
    </>
  );
};

export default ThemeTorchlitDungeon;
