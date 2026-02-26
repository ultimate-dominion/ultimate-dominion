import {
  Box,
  HStack,
  Input,
  keyframes,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FormEvent, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import Typist from 'react-typist';

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(200,122,42,0.3), inset 0 0 8px rgba(200,122,42,0.1);
  }
  50% {
    box-shadow: 0 0 16px rgba(200,122,42,0.5), inset 0 0 12px rgba(200,122,42,0.15);
  }
`;

export const LandingPage = (): JSX.Element => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const existing = JSON.parse(localStorage.getItem('ud:signups') || '[]');
    existing.push({ email, ts: Date.now() });
    localStorage.setItem('ud:signups', JSON.stringify(existing));

    setSubmitted(true);
  };

  return (
    <Box
      minH="100vh"
      px={{ base: 2, sm: 12, md: 20 }}
      py={{ base: 4, lg: 12 }}
    >
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
        <title>Ultimate Dominion — A Persistent World</title>
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

          {/* Email signup — replaces the "Enter" button */}
          <VStack spacing={4} w="100%">
            {submitted ? (
              <VStack spacing={2}>
                <Text
                  color="rgba(196, 184, 158, 0.7)"
                  fontSize="14px"
                  fontWeight={500}
                  letterSpacing="0.05em"
                >
                  You&apos;re on the list.
                </Text>
                <Text
                  color="rgba(196, 184, 158, 0.4)"
                  fontSize="13px"
                  fontStyle="italic"
                >
                  We&apos;ll send word when the gates open.
                </Text>
              </VStack>
            ) : (
              <Box as="form" maxW="420px" mx="auto" onSubmit={onSubmit} w="100%">
                <VStack spacing={3}>
                  <Text
                    color="rgba(196, 184, 158, 0.5)"
                    fontFamily="'Cinzel', serif"
                    fontSize={{ base: '11px', sm: '12px' }}
                    letterSpacing="0.15em"
                    textTransform="uppercase"
                  >
                    Get notified when the gates open
                  </Text>
                  <HStack spacing={0} w="100%">
                    <Input
                      bg="rgba(196, 184, 158, 0.06)"
                      border="1px solid"
                      borderColor="rgba(196, 184, 158, 0.2)"
                      borderRadius="0"
                      color="rgba(232, 220, 200, 0.8)"
                      fontSize="14px"
                      h="44px"
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      value={email}
                      _focus={{
                        borderColor: 'rgba(200, 122, 42, 0.6)',
                        boxShadow: 'none',
                      }}
                      _placeholder={{
                        color: 'rgba(196, 184, 158, 0.3)',
                      }}
                    />
                    <Box
                      as="button"
                      animation={`${torchGlow} 3s ease-in-out infinite`}
                      bg="rgba(200, 122, 42, 0.5)"
                      border="1px solid"
                      borderColor="rgba(200, 122, 42, 0.5)"
                      borderLeft="none"
                      color="rgba(232, 220, 200, 0.9)"
                      cursor="pointer"
                      flexShrink={0}
                      fontSize="12px"
                      fontWeight={600}
                      h="44px"
                      letterSpacing="0.15em"
                      px={6}
                      textTransform="uppercase"
                      transition="all 0.2s ease"
                      type="submit"
                      _hover={{
                        bg: 'rgba(200, 122, 42, 0.7)',
                        color: '#E8DCC8',
                      }}
                    >
                      Join
                    </Box>
                  </HStack>
                </VStack>
              </Box>
            )}
          </VStack>

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
    </Box>
  );
};
