import {
  Box,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  keyframes,
  Link,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

/* ────────────────────────── Animations ────────────────────────── */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const torchFlicker = keyframes`
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.09; }
`;

/* ────────────────────────── Sub-components ────────────────────────── */

const SectionDivider = () => (
  <HStack my={{ base: 10, md: 14 }} spacing={4} w="100%">
    <Box bg="rgba(200,122,42,0.15)" flex={1} h="1px" />
    <Box
      bg="rgba(200,122,42,0.4)"
      borderRadius="full"
      h="4px"
      w="4px"
    />
    <Box bg="rgba(200,122,42,0.15)" flex={1} h="1px" />
  </HStack>
);

const ChapterHeading = ({ number, title }: { number: string; title: string }) => (
  <VStack spacing={2} w="100%">
    <Text
      color="rgba(200,122,42,0.5)"
      fontFamily="'Cinzel', serif"
      fontSize={{ base: '10px', sm: '11px' }}
      fontWeight={400}
      letterSpacing="0.35em"
      textTransform="uppercase"
    >
      {number}
    </Text>
    <Heading
      color="#E8DCC8"
      fontFamily="'Cinzel', serif"
      fontSize={{ base: '18px', sm: '22px', md: '26px' }}
      fontWeight={500}
      letterSpacing="0.08em"
      textAlign="center"
    >
      {title}
    </Heading>
  </VStack>
);

const Prose = ({ children }: { children: React.ReactNode }) => (
  <Text
    color="#C4B89E"
    fontSize={{ base: '14px', sm: '15px', md: '16px' }}
    fontWeight={400}
    lineHeight="1.9"
    textAlign="center"
  >
    {children}
  </Text>
);

const ProseItalic = ({ children }: { children: React.ReactNode }) => (
  <Text
    color="rgba(196,184,158,0.7)"
    fontSize={{ base: '14px', sm: '15px', md: '16px' }}
    fontStyle="italic"
    fontWeight={400}
    lineHeight="1.9"
    textAlign="center"
  >
    {children}
  </Text>
);

const StatLabel = ({ label, value }: { label: string; value: string }) => (
  <HStack justify="space-between" w="100%">
    <Text color="#8A7E6A" fontSize="13px" fontWeight={500}>
      {label}
    </Text>
    <Text color="#E8DCC8" fontSize="13px" fontWeight={600}>
      {value}
    </Text>
  </HStack>
);

const ClassCard = ({
  name,
  archetype,
  stats,
  specialty,
}: {
  name: string;
  archetype: string;
  stats: string;
  specialty: string;
}) => (
  <Box
    bg="#1C1814"
    border="1px solid"
    borderColor="rgba(200,122,42,0.15)"
    p={{ base: 4, sm: 5 }}
    transition="all 0.3s ease"
    _hover={{
      borderColor: 'rgba(200,122,42,0.35)',
      bg: '#24201A',
    }}
  >
    <VStack align="flex-start" spacing={2}>
      <Text
        color="#E8DCC8"
        fontFamily="'Cinzel', serif"
        fontSize={{ base: '14px', sm: '15px' }}
        fontWeight={600}
        letterSpacing="0.05em"
      >
        {name}
      </Text>
      <Text
        color="rgba(200,122,42,0.7)"
        fontSize="11px"
        fontWeight={500}
        letterSpacing="0.15em"
        textTransform="uppercase"
      >
        {archetype}
      </Text>
      <Box bg="rgba(200,122,42,0.1)" h="1px" my={1} w="100%" />
      <Text color="#8A7E6A" fontSize="12px" lineHeight="1.7">
        {stats}
      </Text>
      <Text color="#C4B89E" fontSize="12px" fontStyle="italic" lineHeight="1.7">
        {specialty}
      </Text>
    </VStack>
  </Box>
);

const InfoTable = ({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) => (
  <Box
    bg="#14120F"
    border="1px solid"
    borderColor="rgba(58,50,40,0.8)"
    className="data-dense"
    maxW="100%"
    overflowX="auto"
    w="100%"
  >
    <Table size="sm" variant="unstyled">
      <Thead>
        <Tr borderBottom="1px solid rgba(58,50,40,0.6)">
          {headers.map((h, i) => (
            <Th
              key={i}
              color="#8A7E6A"
              fontSize="10px"
              fontWeight={600}
              letterSpacing="0.12em"
              px={{ base: 3, sm: 4 }}
              py={3}
              textTransform="uppercase"
            >
              {h}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, ri) => (
          <Tr
            key={ri}
            borderBottom="1px solid rgba(58,50,40,0.3)"
            _last={{ borderBottom: 'none' }}
          >
            {row.map((cell, ci) => (
              <Td
                key={ci}
                color={ci === 0 ? '#E8DCC8' : '#C4B89E'}
                fontSize={{ base: '12px', sm: '13px' }}
                fontWeight={ci === 0 ? 500 : 400}
                px={{ base: 3, sm: 4 }}
                py={3}
              >
                {cell}
              </Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  </Box>
);

/* ────────────────────────── Chapter Nav (sticky) ────────────────────────── */

const chapters = [
  { id: 'awakening', label: 'Awakening' },
  { id: 'survival', label: 'Survival' },
  { id: 'classes', label: 'Classes' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'pvp', label: 'Danger Zone' },
  { id: 'economy', label: 'Economy' },
  { id: 'fragments', label: 'Fragments' },
];

const ChapterNav = ({ activeId }: { activeId: string }) => (
  <HStack
    bg="rgba(18,16,14,0.95)"
    borderBottom="1px solid rgba(58,50,40,0.5)"
    display={{ base: 'none', lg: 'flex' }}
    justify="center"
    left={0}
    overflowX="auto"
    position="sticky"
    py={3}
    right={0}
    spacing={1}
    top={0}
    zIndex={10}
  >
    {chapters.map(ch => (
      <Link
        key={ch.id}
        color={activeId === ch.id ? '#C87A2A' : '#8A7E6A'}
        fontFamily="'Cinzel', serif"
        fontSize="11px"
        fontWeight={activeId === ch.id ? 600 : 400}
        href={`#${ch.id}`}
        letterSpacing="0.1em"
        px={3}
        py={1}
        textTransform="uppercase"
        transition="color 0.2s"
        _hover={{ color: '#E8A840', textDecoration: 'none' }}
      >
        {ch.label}
      </Link>
    ))}
  </HStack>
);

/* ────────────────────────── Main Guide Page ────────────────────────── */

export const Guide = (): JSX.Element => {
  const navigate = useNavigate();
  const [activeChapter, setActiveChapter] = useState('awakening');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track which chapter heading is in view
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );

    for (const ch of chapters) {
      const el = document.getElementById(ch.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  const handleBack = useCallback(() => navigate(HOME_PATH), [navigate]);

  return (
    <Box
      bg="#12100E"
      minH="100vh"
      position="relative"
      _after={{
        content: '""',
        position: 'fixed',
        inset: 0,
        opacity: 0.04,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    >
      <Helmet>
        <title>Adventurer&apos;s Guide | Ultimate Dominion</title>
      </Helmet>

      {/* Dragon watermark — faint, flickering */}
      <Box
        animation={`${torchFlicker} 6s ease-in-out infinite`}
        backgroundImage="url(/images/ultimate-dominion-logo.svg)"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        backgroundSize="contain"
        height="50%"
        left="50%"
        pointerEvents="none"
        position="fixed"
        top="50%"
        transform="translate(-50%, -50%)"
        width="50%"
        zIndex={0}
      />

      {/* Chapter nav (desktop) */}
      <ChapterNav activeId={activeChapter} />

      {/* Content */}
      <VStack
        animation={`${fadeUp} 0.6s ease-out`}
        maxW="780px"
        mx="auto"
        pb={{ base: 20, md: 28 }}
        position="relative"
        pt={{ base: 14, md: 20 }}
        px={{ base: 5, sm: 8, md: 10 }}
        spacing={0}
        zIndex={2}
      >
        {/* ── Header ── */}
        <VStack spacing={4} mb={{ base: 10, md: 14 }}>
          <Text
            color="rgba(200,122,42,0.5)"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '10px', sm: '11px' }}
            fontWeight={400}
            letterSpacing="0.4em"
            textTransform="uppercase"
          >
            The Adventurer&apos;s Guide
          </Text>
          <Heading
            color="#E8DCC8"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '24px', sm: '32px', md: '38px' }}
            fontWeight={500}
            letterSpacing="0.06em"
            textAlign="center"
          >
            Into the Dark
          </Heading>
          <ProseItalic>
            What you need to know to survive. Not everything &mdash; the
            world teaches its own lessons. But enough to take your first
            steps without stumbling.
          </ProseItalic>
        </VStack>

        {/* ━━━━ Chapter 1: The Awakening ━━━━ */}
        <Box id="awakening" w="100%">
          <ChapterHeading number="Chapter I" title="The Awakening" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              You wake in a cave with no memory and no name. Before you can
              explore, you must decide who you are.
            </ProseItalic>
            <Prose>
              Character creation shapes your starting identity through three
              choices: your race, your power source, and your armor. There
              are no wrong answers &mdash; only different starting points on
              the same long road.
            </Prose>

            <VStack align="stretch" mt={4} spacing={6} w="100%">
              <Box>
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.15em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Races
                </Text>
                <InfoTable
                  headers={['Race', 'STR', 'AGI', 'INT', 'HP', 'Nature']}
                  rows={[
                    ['Human', '+1', '+1', '+1', '—', 'Balanced, versatile'],
                    ['Dwarf', '+2', '-1', '—', '+1', 'Sturdy, enduring'],
                    ['Elf', '-1', '+2', '+1', '-1', 'Agile, attuned'],
                  ]}
                />
              </Box>

              <Box>
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.15em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Power Sources
                </Text>
                <InfoTable
                  headers={['Source', 'Theme', 'Inclination']}
                  rows={[
                    ['Divine', 'Holy & nature magic', 'Healing, protection, smiting'],
                    ['Weave', 'Arcane magic', 'Raw damage, control'],
                    ['Physical', 'Martial prowess', 'Weapons, tactics, brute force'],
                  ]}
                />
              </Box>

              <Box>
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.15em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Starting Armor
                </Text>
                <InfoTable
                  headers={['Armor', 'STR', 'AGI', 'INT', 'HP']}
                  rows={[
                    ['Cloth', '-1', '+1', '+2', '—'],
                    ['Leather', '+1', '+2', '—', '—'],
                    ['Plate', '+2', '-1', '—', '+1'],
                  ]}
                />
              </Box>
            </VStack>

            <Box
              bg="rgba(200,122,42,0.06)"
              border="1px solid rgba(200,122,42,0.12)"
              mt={4}
              p={{ base: 4, sm: 5 }}
              w="100%"
            >
              <Text color="#8A7E6A" fontSize="13px" fontStyle="italic" lineHeight="1.8">
                Your final stats are rolled from a pool of 19 points
                distributed across Strength, Agility, and Intelligence &mdash;
                then modified by your race and armor. No two adventurers begin
                quite the same.
              </Text>
            </Box>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 2: The Art of Survival ━━━━ */}
        <Box id="survival" w="100%">
          <ChapterHeading number="Chapter II" title="The Art of Survival" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              Combat is turn-based and decisive. Every encounter has weight.
              Fifteen turns is all you get &mdash; make them count.
            </ProseItalic>
            <Prose>
              When you engage a monster or another player, you enter a
              turn-based fight. Your chance to hit, your damage, and your
              ability to survive all depend on your stats, your gear, and
              which stat dominates your build.
            </Prose>

            <VStack align="stretch" mt={4} spacing={5} w="100%">
              <Box
                bg="#1C1814"
                border="1px solid rgba(58,50,40,0.6)"
                p={{ base: 4, sm: 5 }}
              >
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.1em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Hit Probability
                </Text>
                <VStack align="stretch" spacing={2}>
                  <StatLabel label="Base chance" value="90%" />
                  <StatLabel label="Minimum" value="5%" />
                  <StatLabel label="Maximum" value="98%" />
                  <Divider borderColor="rgba(58,50,40,0.4)" my={1} />
                  <Text color="#8A7E6A" fontSize="12px" lineHeight="1.7">
                    Modified by the difference between your attacking stat and
                    the defender&apos;s corresponding stat. Dampeners prevent
                    extreme swings in either direction.
                  </Text>
                </VStack>
              </Box>

              <Box
                bg="#1C1814"
                border="1px solid rgba(58,50,40,0.6)"
                p={{ base: 4, sm: 5 }}
              >
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.1em"
                  mb={3}
                  textTransform="uppercase"
                >
                  The Combat Triangle
                </Text>
                <VStack align="stretch" spacing={3}>
                  <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                    Every stat has a natural predator and natural prey.
                  </Text>
                  <HStack justify="center" spacing={{ base: 2, sm: 4 }}>
                    {[
                      { stat: 'STR', beats: 'AGI', color: '#B83A2A' },
                      { stat: 'AGI', beats: 'INT', color: '#5A8A3E' },
                      { stat: 'INT', beats: 'STR', color: '#3d6fb5' },
                    ].map(t => (
                      <VStack
                        key={t.stat}
                        bg="rgba(20,18,15,0.8)"
                        border="1px solid"
                        borderColor={`${t.color}40`}
                        flex={1}
                        p={3}
                        spacing={1}
                      >
                        <Text color={t.color} fontFamily="'Cinzel', serif" fontSize="15px" fontWeight={600}>
                          {t.stat}
                        </Text>
                        <Text color="#8A7E6A" fontSize="10px" letterSpacing="0.1em" textTransform="uppercase">
                          beats
                        </Text>
                        <Text color="#C4B89E" fontFamily="'Cinzel', serif" fontSize="13px" fontWeight={500}>
                          {t.beats}
                        </Text>
                      </VStack>
                    ))}
                  </HStack>
                  <Text color="#8A7E6A" fontSize="12px" fontStyle="italic" lineHeight="1.7" textAlign="center">
                    +5% bonus damage per point of advantage
                  </Text>
                </VStack>
              </Box>

              <Box
                bg="#1C1814"
                border="1px solid rgba(58,50,40,0.6)"
                p={{ base: 4, sm: 5 }}
              >
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.1em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Critical Hits
                </Text>
                <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                  A critical strike deals double damage. Some classes
                  amplify this further. Critical hits can turn a losing
                  fight on its head &mdash; or seal a victory.
                </Text>
              </Box>

              <Box
                bg="#1C1814"
                border="1px solid rgba(58,50,40,0.6)"
                p={{ base: 4, sm: 5 }}
              >
                <Text
                  color="#C87A2A"
                  fontFamily="'Cinzel', serif"
                  fontSize="13px"
                  fontWeight={600}
                  letterSpacing="0.1em"
                  mb={3}
                  textTransform="uppercase"
                >
                  Fleeing
                </Text>
                <VStack align="stretch" spacing={2}>
                  <StatLabel label="Attacker can flee" value="Turn 1" />
                  <StatLabel label="Defender can flee" value="Turn 2" />
                  <StatLabel label="PvP flee penalty" value="25% gold" />
                </VStack>
              </Box>
            </VStack>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 3: The Path Forward ━━━━ */}
        <Box id="classes" w="100%">
          <ChapterHeading number="Chapter III" title="The Path Forward" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              At Level 10, you choose your destiny. Nine paths lie before you
              &mdash; each with its own strengths. None are locked. All are
              permanent.
            </ProseItalic>
            <Prose>
              Classes provide flat stat bonuses and percentage multipliers
              that scale with your gear. A Warrior&apos;s 110% physical
              damage means the better your weapon, the more your class
              matters. Items are power &mdash; classes multiply it.
            </Prose>

            <Grid
              gap={{ base: 3, sm: 4 }}
              mt={4}
              templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
              w="100%"
            >
              <ClassCard
                archetype="Martial"
                name="Warrior"
                specialty="110% physical damage. The front line."
                stats="+3 STR, +10 HP"
              />
              <ClassCard
                archetype="Martial"
                name="Paladin"
                specialty="105% phys, 105% healing. Enduring."
                stats="+2 STR, +15 HP"
              />
              <ClassCard
                archetype="Martial"
                name="Ranger"
                specialty="110% physical damage. Swift strikes."
                stats="+3 AGI"
              />
              <ClassCard
                archetype="Hybrid"
                name="Rogue"
                specialty="115% critical damage. Lethal precision."
                stats="+2 AGI, +1 INT"
              />
              <ClassCard
                archetype="Hybrid"
                name="Druid"
                specialty="105% phys + spell, 105% max HP."
                stats="+2 AGI, +2 STR"
              />
              <ClassCard
                archetype="Hybrid"
                name="Sorcerer"
                specialty="108% spell damage, 105% max HP."
                stats="+2 STR, +2 INT"
              />
              <ClassCard
                archetype="Arcane"
                name="Warlock"
                specialty="110% spell damage. Dark mastery."
                stats="+2 AGI, +2 INT"
              />
              <ClassCard
                archetype="Arcane"
                name="Wizard"
                specialty="115% spell damage. Pure destruction."
                stats="+3 INT"
              />
              <ClassCard
                archetype="Arcane"
                name="Cleric"
                specialty="110% healing. Keeper of life."
                stats="+2 INT, +10 HP"
              />
            </Grid>

            <Box
              bg="rgba(200,122,42,0.06)"
              border="1px solid rgba(200,122,42,0.12)"
              mt={2}
              p={{ base: 4, sm: 5 }}
              w="100%"
            >
              <Text color="#8A7E6A" fontSize="13px" fontStyle="italic" lineHeight="1.8">
                Any race and power source can become any class. A Dwarf Wizard
                is just as valid as an Elf one. The choice is yours &mdash;
                the consequences are permanent.
              </Text>
            </Box>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 4: Arms & Armor ━━━━ */}
        <Box id="equipment" w="100%">
          <ChapterHeading number="Chapter IV" title="Arms & Armor" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              Items are power. Roughly 60% of your strength comes from what
              you carry, not who you are. The best-leveled character with
              poor gear will fall to a well-equipped lesser.
            </ProseItalic>

            <InfoTable
              headers={['Slot', 'Purpose']}
              rows={[
                ['Weapons', 'Physical and magical damage'],
                ['Armor', 'Defense and damage reduction'],
                ['Accessories', 'Mixed utility and stat bonuses'],
                ['Consumables', 'One-time use, effects in combat'],
                ['Spells', 'Magical damage and status effects'],
              ]}
            />

            <Box mt={2} w="100%">
              <Text
                color="#C87A2A"
                fontFamily="'Cinzel', serif"
                fontSize="13px"
                fontWeight={600}
                letterSpacing="0.15em"
                mb={3}
                textTransform="uppercase"
              >
                Rarity
              </Text>
              <HStack
                flexWrap="wrap"
                justify="center"
                spacing={0}
                gap={2}
              >
                {[
                  { name: 'Common', color: '#C4B89E' },
                  { name: 'Uncommon', color: '#3d8a4e' },
                  { name: 'Rare', color: '#3d6fb5' },
                  { name: 'Epic', color: '#7b4ab5' },
                  { name: 'Legendary', color: '#c47a2a' },
                ].map(r => (
                  <Box
                    key={r.name}
                    border="1px solid"
                    borderColor={`${r.color}40`}
                    px={3}
                    py={1.5}
                  >
                    <Text color={r.color} fontSize="12px" fontWeight={500} letterSpacing="0.05em">
                      {r.name}
                    </Text>
                  </Box>
                ))}
              </HStack>
              <Text color="#8A7E6A" fontSize="12px" fontStyle="italic" lineHeight="1.7" mt={3} textAlign="center">
                Higher rarity means greater power and greater scarcity.
                Legendary items are exceedingly rare drops that define builds.
              </Text>
            </Box>

            <Box
              bg="rgba(200,122,42,0.06)"
              border="1px solid rgba(200,122,42,0.12)"
              mt={2}
              p={{ base: 4, sm: 5 }}
              w="100%"
            >
              <Text color="#8A7E6A" fontSize="13px" fontStyle="italic" lineHeight="1.8">
                Every item is an on-chain token. What you find, you own. You
                can trade it, sell it, equip it, or hold it forever. No one
                can take it from you.
              </Text>
            </Box>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 5: The Dark Cave ━━━━ */}
        <Box id="exploration" w="100%">
          <ChapterHeading number="Chapter V" title="The Dark Cave" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              The world is a grid of tiles stretching into darkness. Each step
              may bring combat, discovery, or nothing at all. You begin at the
              mouth of the cave.
            </ProseItalic>

            <Grid
              gap={4}
              mt={2}
              templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}
              w="100%"
            >
              <GridItem>
                <Box bg="#1C1814" border="1px solid rgba(58,50,40,0.6)" h="100%" p={{ base: 4, sm: 5 }}>
                  <Text
                    color="#5A8A3E"
                    fontFamily="'Cinzel', serif"
                    fontSize="13px"
                    fontWeight={600}
                    letterSpacing="0.1em"
                    mb={2}
                    textTransform="uppercase"
                  >
                    Safe Zone
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                      The tiles nearest the cave entrance. PvE only &mdash; no
                      player can attack you here.
                    </Text>
                    <StatLabel label="Mob levels" value="1 to 6" />
                    <StatLabel label="Condition" value="x &lt; 5 or y &lt; 5" />
                  </VStack>
                </Box>
              </GridItem>
              <GridItem>
                <Box bg="#1C1814" border="1px solid rgba(58,50,40,0.6)" h="100%" p={{ base: 4, sm: 5 }}>
                  <Text
                    color="#B83A2A"
                    fontFamily="'Cinzel', serif"
                    fontSize="13px"
                    fontWeight={600}
                    letterSpacing="0.1em"
                    mb={2}
                    textTransform="uppercase"
                  >
                    Danger Zone
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                      Beyond the threshold. PvP is enabled &mdash; other players
                      may attack you for your gold.
                    </Text>
                    <StatLabel label="Mob levels" value="6 to 11" />
                    <StatLabel label="Condition" value="x &ge; 5 and y &ge; 5" />
                  </VStack>
                </Box>
              </GridItem>
            </Grid>

            <Prose>
              Movement costs one action per tile. Each step may spawn monsters.
              A shop waits deep in the cave for those brave enough to reach
              it. And at the heart of the darkness, something stirs.
            </Prose>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 6: The Danger Zone ━━━━ */}
        <Box id="pvp" w="100%">
          <ChapterHeading number="Chapter VI" title="The Danger Zone" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              Past the threshold, other adventurers become threats. Your gold
              is at stake. Trust no one &mdash; or trust wisely.
            </ProseItalic>

            <Box
              bg="#1C1814"
              border="1px solid rgba(184,58,42,0.2)"
              p={{ base: 4, sm: 5 }}
              w="100%"
            >
              <Text
                color="#B83A2A"
                fontFamily="'Cinzel', serif"
                fontSize="13px"
                fontWeight={600}
                letterSpacing="0.1em"
                mb={3}
                textTransform="uppercase"
              >
                PvP Rules
              </Text>
              <VStack align="stretch" spacing={2}>
                <StatLabel label="Location required" value="Danger zone (x&ge;5, y&ge;5)" />
                <StatLabel label="Cooldown between fights" value="30 seconds" />
                <StatLabel label="Gold at stake" value="Escrowed on engagement" />
                <StatLabel label="Winner takes" value="Loser's escrowed gold + XP" />
                <StatLabel label="Flee penalty" value="25% of escrowed gold" />
                <Divider borderColor="rgba(58,50,40,0.4)" my={1} />
                <Text color="#8A7E6A" fontSize="12px" fontStyle="italic" lineHeight="1.7">
                  Group combat is supported &mdash; multiple players can fight on
                  each side. Rewards are split among the victors.
                </Text>
              </VStack>
            </Box>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 7: Gold & Trade ━━━━ */}
        <Box id="economy" w="100%">
          <ChapterHeading number="Chapter VII" title="Gold & Trade" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              Gold is an on-chain token. Earned from monsters, lost in combat,
              spent at shops, traded on the marketplace. It flows through the
              world like blood.
            </ProseItalic>

            <Grid
              gap={4}
              mt={2}
              templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}
              w="100%"
            >
              <GridItem>
                <Box bg="#1C1814" border="1px solid rgba(58,50,40,0.6)" h="100%" p={{ base: 4, sm: 5 }}>
                  <Text
                    color="#C87A2A"
                    fontFamily="'Cinzel', serif"
                    fontSize="13px"
                    fontWeight={600}
                    letterSpacing="0.1em"
                    mb={3}
                    textTransform="uppercase"
                  >
                    The Marketplace
                  </Text>
                  <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                    Player-to-player trading. List items for gold, browse what
                    others have found, or place buy orders for items you need.
                  </Text>
                  <Text color="#8A7E6A" fontSize="12px" mt={2}>
                    Trading fee: ~3%
                  </Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box bg="#1C1814" border="1px solid rgba(58,50,40,0.6)" h="100%" p={{ base: 4, sm: 5 }}>
                  <Text
                    color="#C87A2A"
                    fontFamily="'Cinzel', serif"
                    fontSize="13px"
                    fontWeight={600}
                    letterSpacing="0.1em"
                    mb={3}
                    textTransform="uppercase"
                  >
                    The Shop
                  </Text>
                  <Text color="#C4B89E" fontSize="13px" lineHeight="1.7">
                    An NPC merchant deep in the cave. Buy supplies, sell your
                    loot. Stock refreshes every 12 hours &mdash; rare items
                    appear and vanish.
                  </Text>
                  <Text color="#8A7E6A" fontSize="12px" mt={2}>
                    Location: tile (9, 9)
                  </Text>
                </Box>
              </GridItem>
            </Grid>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ━━━━ Chapter 8: Fragments of the Fallen ━━━━ */}
        <Box id="fragments" w="100%">
          <ChapterHeading number="Chapter VIII" title="Fragments of the Fallen" />
          <VStack mt={6} spacing={5}>
            <ProseItalic>
              Eight shards of a broken story are scattered through the cave.
              Find them to piece together what happened before you woke. Each
              fragment mints as a permanent NFT &mdash; proof of your discovery.
            </ProseItalic>

            <InfoTable
              headers={['#', 'Fragment', 'How to Find']}
              rows={[
                ['I', 'The Awakening', 'Granted at first spawn'],
                ['II', 'The Quartermaster', 'Visit the shop'],
                ['III', 'The Restless', 'Slay your first monster'],
                ['IV', 'Souls That Linger', 'Defeat a Dark Wisp'],
                ['V', 'The Wound', 'Reach the center of the cave'],
                ['VI', 'Death of Death God', 'Defeat a Lich Acolyte'],
                ['VII', 'Betrayer\'s Truth', 'Defeat a Void Whisper'],
                ['VIII', 'Blood Price', 'Your first PvP kill'],
              ]}
            />

            <Box
              bg="rgba(200,122,42,0.06)"
              border="1px solid rgba(200,122,42,0.12)"
              mt={2}
              p={{ base: 4, sm: 5 }}
              w="100%"
            >
              <Text color="#8A7E6A" fontSize="13px" fontStyle="italic" lineHeight="1.8">
                The fragments tell the story of Noctum &mdash; the god of
                death who was killed by the other gods. The cave you woke in
                is the wound his death left on the world.
              </Text>
            </Box>
          </VStack>
        </Box>

        <SectionDivider />

        {/* ── Footer ── */}
        <VStack mt={4} spacing={6}>
          <Text
            color="rgba(196,184,158,0.5)"
            fontSize={{ base: '14px', sm: '15px' }}
            fontStyle="italic"
            lineHeight="1.9"
            textAlign="center"
          >
            This guide covers the known. The unknown is yours to discover.
          </Text>
          <Link
            as={RouterLink}
            color="#8A7E6A"
            fontFamily="'Cinzel', serif"
            fontSize="12px"
            letterSpacing="0.15em"
            textTransform="uppercase"
            to={HOME_PATH}
            _hover={{ color: '#C87A2A', textDecoration: 'none' }}
          >
            &larr; Return
          </Link>
        </VStack>
      </VStack>
    </Box>
  );
};
