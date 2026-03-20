import {
  Box,
  HStack,
  Image,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import SafeTypist from '../components/SafeTypist';

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(200,122,42,0.3), inset 0 0 8px rgba(200,122,42,0.1);
  }
  50% {
    box-shadow: 0 0 16px rgba(200,122,42,0.5), inset 0 0 12px rgba(200,122,42,0.15);
  }
`;

export const LandingPage = (): JSX.Element => {
  return (
    <Box
      minH="100vh"
      px={{ base: 2, sm: 12, md: 20 }}
      py={{ base: 4, lg: 12 }}
    >
    {/* Logo — top right, above the frame */}
    <Box display="flex" justifyContent="flex-end" mb={2}>
      <Image
        alt="Ultimate Dominion Logo"
        src="/images/ultimate-dominion-logo.svg"
        width={{ base: '160px', sm: '200px' }}
      />
    </Box>

    <Box
      border="6px solid #3A3228"
      display="flex"
      flexDirection="column"
      minH={{ base: 'calc(100vh - 32px)', lg: 'calc(100vh - 96px)' }}
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
        <title>Ultimate Dominion — Nothing Is Forgotten</title>
      </Helmet>
      <Box
        border="0.5px solid #3A3228"
        flex="1"
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
          backgroundImage="url(/images/ultimate-dominion-logo.svg)"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          backgroundSize="contain"
          height="60%"
          left="50%"
          opacity={0.02}
          pointerEvents="none"
          position="absolute"
          top="50%"
          transform="translate(-50%, -50%)"
          width="60%"
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
            fontSize={{ base: '13px', sm: '15px' }}
            fontStyle="italic"
            letterSpacing="0.3em"
            textAlign="center"
            textTransform="uppercase"
          >
            Nothing Is Forgotten
          </Text>

          <Box position="relative" w="100%">
            {/* Invisible spacer — reserves final text height */}
            <VStack
              fontWeight={500}
              maxW="850px"
              mx="auto"
              spacing={6}
              textAlign="center"
              visibility="hidden"
              aria-hidden="true"
            >
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }}>
                As you awaken, your eyes flutter open to the stark, eerie ambiance
                of a dimly lit cave.
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                Confusion clouds your mind; the cold, hard ground beneath you
                offers no comfort. Glimpses of blood and bruises on your body only
                deepen the mystery, painting a silent story of unseen struggles.
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                Where are you? How did you end up here?
              </Text>
              <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                The shadows around you hold secrets, whispering tales of survival
                and discovery. Gathering your strength, you rise, the weight of
                uncertainty heavy on your shoulders — yet igniting a spark of
                determination within. With a deep breath, you take your first step
                into the unknown, embarking on a journey where every choice carves
                your path through the darkness.
              </Text>
            </VStack>
            {/* Typing animation overlaid at exact same position */}
            <Box position="absolute" top={0} left={0} right={0}>
              <VStack fontWeight={500} maxW="850px" mx="auto" spacing={6} textAlign="center">
                <SafeTypist
                  avgTypingDelay={35}
                  stdTypingDelay={20}
                  cursor={{ show: true, blink: true, element: '\u258C', hideWhenDone: true, hideWhenDoneDelay: 500 }}
                >
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }}>
                    As you awaken, your eyes flutter open to the stark, eerie ambiance
                    of a dimly lit cave.
                  </Text>
                  <SafeTypist.Delay ms={800} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    Confusion clouds your mind; the cold, hard ground beneath you
                    offers no comfort. Glimpses of blood and bruises on your body only
                    deepen the mystery, painting a silent story of unseen struggles.
                  </Text>
                  <SafeTypist.Delay ms={600} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    Where are you? How did you end up here?
                  </Text>
                  <SafeTypist.Delay ms={1000} />
                  <Text size={{ base: 'sm', sm: 'md', md: 'lg' }} mt={10}>
                    The shadows around you hold secrets, whispering tales of survival
                    and discovery. Gathering your strength, you rise, the weight of
                    uncertainty heavy on your shoulders — yet igniting a spark of
                    determination within. With a deep breath, you take your first step
                    into the unknown, embarking on a journey where every choice carves
                    your path through the darkness.
                  </Text>
                </SafeTypist>
              </VStack>
            </Box>
          </Box>

          <Box
            as={RouterLink}
            to="/character-creation"
            animation={`${torchGlow} 3s ease-in-out infinite`}
            bg="rgba(200, 122, 42, 0.5)"
            border="1px solid rgba(200, 122, 42, 0.5)"
            color="#E8DCC8"
            cursor="pointer"
            display="inline-block"
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '14px', sm: '16px' }}
            fontWeight={600}
            letterSpacing="0.3em"
            px={{ base: 10, sm: 12 }}
            py={3}
            textAlign="center"
            textDecoration="none"
            textTransform="uppercase"
            transition="all 0.3s"
            _hover={{ bg: 'rgba(200, 122, 42, 0.7)', color: '#E8DCC8', textDecoration: 'none' }}
          >
            Enter
          </Box>

          <HStack
            fontFamily="'Cinzel', serif"
            fontSize={{ base: '13px', sm: '15px' }}
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
              color="#8A7E6A"
              href="https://tavern.ultimatedominion.com"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Tavern
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              color="#8A7E6A"
              href="https://x.com/DominionMMO"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              X
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              color="#8A7E6A"
              href="https://discord.gg/sSkQW36Fvj"
              isExternal
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Discord
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Box>
    </Box>
  );
};
