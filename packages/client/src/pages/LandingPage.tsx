/**
 * Production landing page — exact visual clone of Welcome.tsx
 * without MUD/Auth/Web3 dependencies (runs in placeholder mode).
 */
import {
  Box,
  Button,
  HStack,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import Typist from 'react-typist';

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 12px rgba(200,122,42,0.3), 0 0 24px rgba(200,122,42,0.15);
  }
  50% {
    box-shadow: 0 0 20px rgba(232,168,64,0.5), 0 0 40px rgba(200,122,42,0.25);
  }
`;

export const LandingPage = (): JSX.Element => {
  return (
    <Box
      border="6px solid #3A3228"
      p={1.5}
      _after={{
        content: '""',
        position: 'fixed',
        inset: 0,
        opacity: 0.05,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    >
      <Helmet>
        <title>Ultimate Dominion — A Persistent World</title>
      </Helmet>
      <Box
        border="0.5px solid #3A3228"
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,8,6,0.6) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Dragon watermark */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          width="60%"
          height="60%"
          backgroundImage="url(/images/ultimate-dominion-logo.svg)"
          backgroundRepeat="no-repeat"
          backgroundPosition="center"
          backgroundSize="contain"
          opacity={0.02}
          pointerEvents="none"
          zIndex={0}
        />

        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 14, sm: 20 }}
          position="relative"
          px={{ base: 2, sm: 14, md: 18 }}
          spacing={{ base: 14, md: 18 }}
          zIndex={2}
        >
          <Text
            color="#8A7E6A"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '11px', sm: '13px' }}
            fontStyle="italic"
            letterSpacing="0.3em"
            textAlign="center"
            textTransform="uppercase"
          >
            A Persistent World
          </Text>

          <VStack fontWeight={500} maxW="850px" spacing={6} textAlign="center">
            <Typist
              avgTypingDelay={35}
              stdTypingDelay={20}
              cursor={{ show: true, blink: true, element: '\u258C', hideWhenDone: true, hideWhenDoneDelay: 500 }}
            >
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }}>
                As you awaken, your eyes flutter open to the stark, eerie ambiance
                of a dimly lit cave.
              </Text>
              <Typist.Delay ms={800} />
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                Confusion clouds your mind; the cold, hard ground beneath you
                offers no comfort. Glimpses of blood and bruises on your body only
                deepen the mystery, painting a silent story of unseen struggles.
              </Text>
              <Typist.Delay ms={600} />
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                Where are you? How did you end up here?
              </Text>
              <Typist.Delay ms={1000} />
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                The shadows around you hold secrets, whispering tales of survival
                and discovery. Gathering your strength, you rise, the weight of
                uncertainty heavy on your shoulders — yet igniting a spark of
                determination within. With a deep breath, you take your first step
                into the unknown, embarking on a journey where every choice carves
                your path through the darkness.
              </Text>
            </Typist>
          </VStack>

          <Button
            animation={`${torchGlow} 4s ease-in-out infinite`}
            color="#12100E"
            letterSpacing="0.15em"
            px={{ base: 16, sm: 24 }}
            textTransform="uppercase"
          >
            Enter
          </Button>

          <HStack
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '11px', sm: '13px' }}
            spacing={3}
          >
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to="/manifesto"
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Manifesto
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to="/guide"
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Guide
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to="/tavern"
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Tavern
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};
