import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

/* ────────────────────────── Animations ────────────────────────── */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const hearthGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 40px rgba(200,122,42,0.08), 0 0 80px rgba(200,122,42,0.04);
  }
  50% {
    box-shadow: 0 0 60px rgba(200,122,42,0.14), 0 0 100px rgba(200,122,42,0.06);
  }
`;

const candleFlicker = keyframes`
  0%, 100% { opacity: 1; }
  25% { opacity: 0.85; }
  50% { opacity: 0.95; }
  75% { opacity: 0.88; }
`;

/* ────────────────────────── Sub-components ────────────────────────── */

const TavernCard = ({
  title,
  subtitle,
  description,
  to,
  accentColor = 'rgba(200,122,42,0.4)',
  external = false,
}: {
  title: string;
  subtitle: string;
  description: string;
  to: string;
  accentColor?: string;
  external?: boolean;
}) => {
  const linkProps = external
    ? { href: to, isExternal: true }
    : { as: RouterLink, to };

  return (
    <Link
      {...linkProps}
      _hover={{ textDecoration: 'none' }}
      display="block"
    >
      <Box
        bg="#1C1814"
        border="1px solid"
        borderColor="rgba(58,50,40,0.5)"
        cursor="pointer"
        h="100%"
        p={{ base: 5, sm: 6 }}
        position="relative"
        transition="all 0.35s ease"
        _hover={{
          bg: '#24201A',
          borderColor: accentColor,
          transform: 'translateY(-2px)',
          '& .card-accent': {
            opacity: 1,
            width: '100%',
          },
        }}
      >
        {/* Top accent line (animates on hover) */}
        <Box
          bg={accentColor}
          className="card-accent"
          h="1px"
          left={0}
          opacity={0}
          position="absolute"
          top={0}
          transition="all 0.4s ease"
          w="0%"
        />

        <VStack align="flex-start" spacing={3}>
          <Box>
            <Text
              color="#E8DCC8"
              fontFamily="'Cinzel', serif"
              fontSize={{ base: '15px', sm: '17px' }}
              fontWeight={600}
              letterSpacing="0.05em"
            >
              {title}
            </Text>
            <Text
              color="rgba(200,122,42,0.6)"
              fontSize="10px"
              fontWeight={500}
              letterSpacing="0.2em"
              mt={1}
              textTransform="uppercase"
            >
              {subtitle}
            </Text>
          </Box>
          <Box bg="rgba(200,122,42,0.08)" h="1px" w="100%" />
          <Text color="#8A7E6A" fontSize={{ base: '13px', sm: '14px' }} lineHeight="1.8">
            {description}
          </Text>
        </VStack>
      </Box>
    </Link>
  );
};

const Bulletin = ({
  title,
  items,
}: {
  title: string;
  items: { text: string; detail: string }[];
}) => (
  <Box
    bg="rgba(20,18,15,0.6)"
    border="1px solid rgba(58,50,40,0.4)"
    p={{ base: 5, sm: 6 }}
    w="100%"
  >
    <HStack mb={4} spacing={3}>
      <Box bg="#C87A2A" borderRadius="full" h="6px" w="6px" />
      <Text
        color="#C87A2A"
        fontFamily="'Cinzel', serif"
        fontSize="13px"
        fontWeight={600}
        letterSpacing="0.15em"
        textTransform="uppercase"
      >
        {title}
      </Text>
    </HStack>
    <VStack align="stretch" spacing={3}>
      {items.map((item, i) => (
        <HStack
          key={i}
          align="flex-start"
          borderBottom={i < items.length - 1 ? '1px solid rgba(58,50,40,0.3)' : 'none'}
          pb={i < items.length - 1 ? 3 : 0}
          spacing={3}
        >
          <Text color="rgba(200,122,42,0.4)" fontSize="12px" fontWeight={600} mt="2px">
            {String(i + 1).padStart(2, '0')}
          </Text>
          <Box>
            <Text color="#C4B89E" fontSize="13px" fontWeight={500} lineHeight="1.6">
              {item.text}
            </Text>
            <Text color="#8A7E6A" fontSize="12px" fontStyle="italic" lineHeight="1.6" mt={0.5}>
              {item.detail}
            </Text>
          </Box>
        </HStack>
      ))}
    </VStack>
  </Box>
);

/* ────────────────────────── Main Tavern Page ────────────────────────── */

export const Tavern = (): JSX.Element => (
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
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }}
  >
    <Helmet>
      <title>The Adventurer&apos;s Codex | Ultimate Dominion</title>
    </Helmet>

    {/* Warm radial hearth glow at center */}
    <Box
      animation={`${hearthGlow} 5s ease-in-out infinite`}
      bg="radial-gradient(ellipse at center, rgba(200,122,42,0.06) 0%, transparent 60%)"
      height="100%"
      left={0}
      pointerEvents="none"
      position="fixed"
      top={0}
      width="100%"
      zIndex={0}
    />

    {/* Content */}
    <VStack
      animation={`${fadeUp} 0.6s ease-out`}
      maxW="860px"
      mx="auto"
      pb={{ base: 20, md: 28 }}
      position="relative"
      pt={{ base: 14, md: 20 }}
      px={{ base: 5, sm: 8, md: 10 }}
      spacing={0}
      zIndex={2}
    >
      {/* ── Header ── */}
      <VStack mb={{ base: 10, md: 14 }} spacing={4}>
        <Text
          color="rgba(200,122,42,0.5)"
          fontFamily="'Cinzel', serif"
          fontSize={{ base: '10px', sm: '11px' }}
          fontWeight={400}
          letterSpacing="0.4em"
          textTransform="uppercase"
        >
          Knowledge for the Bold
        </Text>
        <Heading
          color="#E8DCC8"
          fontFamily="'Cinzel', serif"
          fontSize={{ base: '26px', sm: '34px', md: '42px' }}
          fontWeight={500}
          letterSpacing="0.06em"
          textAlign="center"
        >
          The Adventurer&apos;s Codex
        </Heading>
        <Text
          color="rgba(196,184,158,0.55)"
          fontSize={{ base: '14px', sm: '15px', md: '16px' }}
          fontStyle="italic"
          lineHeight="1.9"
          maxW="600px"
          textAlign="center"
        >
          A worn volume passed between wanderers. Within its pages lie the
          paths forward &mdash; rankings, trade, and the principles that
          govern this world.
        </Text>
      </VStack>

      {/* ── Atmospheric separator ── */}
      <HStack my={{ base: 4, md: 6 }} spacing={4} w="100%">
        <Box bg="rgba(200,122,42,0.1)" flex={1} h="1px" />
        <HStack spacing={2}>
          {[0, 1, 2].map(i => (
            <Box
              key={i}
              animation={`${candleFlicker} ${2 + i * 0.4}s ease-in-out infinite`}
              bg="rgba(200,122,42,0.5)"
              borderRadius="full"
              h="3px"
              w="3px"
            />
          ))}
        </HStack>
        <Box bg="rgba(200,122,42,0.1)" flex={1} h="1px" />
      </HStack>

      {/* ── Board: Announcements ── */}
      <Box mt={{ base: 6, md: 8 }} w="100%">
        <Bulletin
          title="The Board"
          items={[
            {
              text: 'The Dark Cave awaits new challengers.',
              detail: 'First zone — levels 1 through 10. Monsters, loot, and lore fragments.',
            },
            {
              text: 'The marketplace is open for trade.',
              detail: 'Buy and sell items with other adventurers. Every item is permanent.',
            },
            {
              text: 'Zone Conqueror badges are live.',
              detail: 'The first 10 adventurers to reach max level in each zone earn a permanent badge.',
            },
            {
              text: 'Lore fragments are scattered through the world.',
              detail: 'Eight pieces of a broken story. Find them all to learn what happened before you woke.',
            },
          ]}
        />
      </Box>

      {/* ── Tavern destinations ── */}
      <VStack mt={{ base: 10, md: 14 }} spacing={3} w="100%">
        <Text
          color="rgba(200,122,42,0.5)"
          fontFamily="'Cinzel', serif"
          fontSize={{ base: '10px', sm: '11px' }}
          fontWeight={400}
          letterSpacing="0.3em"
          mb={2}
          textTransform="uppercase"
        >
          Where to next
        </Text>

        <Grid
          gap={{ base: 3, sm: 4 }}
          templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}
          w="100%"
        >
          <GridItem>
            <TavernCard
              accentColor="rgba(200,122,42,0.5)"
              description="See who leads in gold, experience, and combat victories. Your rank among all adventurers."
              subtitle="Rankings"
              title="Leaderboard"
              to="/leaderboard"
            />
          </GridItem>
          <GridItem>
            <TavernCard
              accentColor="rgba(61,111,181,0.5)"
              description="Browse items listed by other adventurers. Find the weapon that changes everything."
              subtitle="Player Trade"
              title="Marketplace"
              to="/marketplace"
            />
          </GridItem>
          <GridItem>
            <TavernCard
              accentColor="rgba(196,184,158,0.3)"
              description="The principles that shape this world. What we believe and why we built it."
              subtitle="Our Creed"
              title="Manifesto"
              to="/manifesto"
            />
          </GridItem>
        </Grid>
      </VStack>

      {/* ── Lore teaser ── */}
      <Box
        bg="rgba(200,122,42,0.04)"
        border="1px solid rgba(200,122,42,0.08)"
        mt={{ base: 10, md: 14 }}
        p={{ base: 6, sm: 8 }}
        position="relative"
        w="100%"
      >
        <Box
          bg="radial-gradient(circle at 50% 0%, rgba(200,122,42,0.08) 0%, transparent 70%)"
          height="100%"
          left={0}
          pointerEvents="none"
          position="absolute"
          top={0}
          width="100%"
        />
        <VStack position="relative" spacing={4}>
          <Text
            color="rgba(200,122,42,0.5)"
            fontFamily="'Cinzel', serif"
            fontSize="10px"
            fontWeight={400}
            letterSpacing="0.3em"
            textTransform="uppercase"
          >
            Whispered at the bar
          </Text>
          <Text
            color="rgba(196,184,158,0.5)"
            fontSize={{ base: '14px', sm: '15px' }}
            fontStyle="italic"
            lineHeight="2"
            maxW="550px"
            textAlign="center"
          >
            &ldquo;They say the gods killed one of their own. Noctum,
            lord of death. Cut him down and left the wound to fester.
            This cave &mdash; it&apos;s not natural. It&apos;s what&apos;s
            left when a god bleeds.&rdquo;
          </Text>
          <Text color="rgba(196,184,158,0.3)" fontSize="12px" fontStyle="italic">
            &mdash; An unnamed drinker, several cups deep
          </Text>
        </VStack>
      </Box>

      {/* ── Footer ── */}
      <HStack mt={{ base: 10, md: 14 }} spacing={4}>
        <Box bg="rgba(200,122,42,0.15)" h="1px" w="30px" />
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
        <Box bg="rgba(200,122,42,0.15)" h="1px" w="30px" />
      </HStack>
    </VStack>
  </Box>
);
