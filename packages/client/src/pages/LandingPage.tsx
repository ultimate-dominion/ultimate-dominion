/**
 * Production landing page — exact visual replica of the beta Welcome page
 * including the App shell layout (header with logo, padded content area).
 * No MUD/Auth/Web3 dependencies — runs in placeholder mode.
 */
import {
  Box,
  Button,
  Grid,
  HStack,
  Image,
  Input,
  keyframes,
  Link,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FormEvent, useState } from 'react';
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
    <Grid
      minHeight="100vh"
      templateColumns="100%"
      templateRows="auto 1fr"
      w="100%"
    >
      <Helmet>
        <title>Ultimate Dominion — Nothing Is Forgotten</title>
      </Helmet>

      {/* Header — matches beta Header on HOME_PATH (transparent bg, logo right) */}
      <Box as="header" mt={4} px={4} py={2} w="100%">
        <Stack direction={{ base: 'column-reverse', lg: 'row' }} justify="end">
          <Button
            mb={{ base: 0, sm: 2 }}
            mt={{ base: 0, sm: -1 }}
            variant="unstyled"
          >
            <Image
              alt="Ultimate Dominion Logo"
              src="/images/ultimate-dominion-logo.svg"
              width={{ base: '200px', sm: '225px' }}
            />
          </Button>
        </Stack>
      </Box>

      {/* Content area — matches beta App shell wrapper */}
      <Box
        m="0 auto"
        maxW="1800px"
        my={{ base: 4, lg: 12 }}
        px={{ base: 2, sm: 12, md: 20 }}
        w="100%"
      >
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
                Nothing Is Forgotten
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

              {submitted ? (
                <Text
                  color="#8A7E6A"
                  fontFamily="'Cinzel', serif"
                  fontSize={{ base: '12px', sm: '14px' }}
                  fontStyle="italic"
                  letterSpacing="0.15em"
                >
                  The ravens will find you when the gates open.
                </Text>
              ) : (
                <VStack as="form" onSubmit={onSubmit} spacing={3} w="100%">
                  <Text
                    color="#8A7E6A"
                    fontFamily="'Cinzel', serif"
                    fontSize={{ base: '10px', sm: '11px' }}
                    letterSpacing="0.2em"
                    textTransform="uppercase"
                  >
                    Send word when the gates open
                  </Text>
                  <HStack maxW="420px" mx="auto" spacing={0} w="100%">
                    <Input
                      bg="rgba(20, 18, 15, 0.8)"
                      border="2px solid"
                      borderColor="#3A3228"
                      borderRadius="8px 0 0 8px"
                      borderRight="none"
                      color="#E8DCC8"
                      fontSize="14px"
                      h="48px"
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      value={email}
                      _focus={{
                        borderColor: '#C87A2A',
                        boxShadow: 'none',
                      }}
                      _placeholder={{
                        color: '#8A7E6A',
                      }}
                    />
                    <Button
                      animation={`${torchGlow} 4s ease-in-out infinite`}
                      borderRadius="0 8px 8px 0"
                      color="#12100E"
                      flexShrink={0}
                      h="48px"
                      letterSpacing="0.15em"
                      px={{ base: 6, sm: 10 }}
                      textTransform="uppercase"
                      type="submit"
                    >
                      Summon
                    </Button>
                  </HStack>
                </VStack>
              )}

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
    </Grid>
  );
};
