import {
  Box,
  Button,
  HStack,
  Input,
  keyframes,
  Link,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import SafeTypist from '../components/SafeTypist';
import { API_URL } from '../utils/constants';

import { ConnectWalletModal } from '../components/ConnectWalletModal';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useQueue } from '../contexts/QueueContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, GUIDE_PATH, MANIFESTO_PATH, WAITING_ROOM_PATH } from '../Routes';

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 12px rgba(200,122,42,0.3), 0 0 24px rgba(200,122,42,0.15);
  }
  50% {
    box-shadow: 0 0 20px rgba(232,168,64,0.5), 0 0 40px rgba(200,122,42,0.25);
  }
`;

export const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { authMethod, isAuthenticated, isConnecting } = useAuth();
  const { delegatorAddress, isSynced } = useMUD();
  const { character, isRefreshing } = useCharacter();
  const { isMapFull, statsLoaded } = useQueue();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const onEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setEmailError('');

    try {
      const existing = JSON.parse(localStorage.getItem('ud:signups') || '[]');
      existing.push({ email, ts: Date.now() });
      localStorage.setItem('ud:signups', JSON.stringify(existing));
    } catch { /* localStorage unavailable */ }

    try {
      const res = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEmailError(data.error || 'Something went wrong. Try again.');
        setIsSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Capture invite code from URL params
  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode) {
      sessionStorage.setItem('ud:inviteCode', inviteCode);
    }
  }, [searchParams]);

  // Auto-navigate when fully set up (returning players, or just signed in)
  useEffect(() => {
    if (isRefreshing) return;
    if (!isAuthenticated) return;
    if (!statsLoaded) return; // Wait for queue stats before deciding

    const embeddedReady = authMethod === 'embedded' && !!delegatorAddress;
    const externalReady = authMethod === 'external' && !!delegatorAddress;
    if (!embeddedReady && !externalReady) return;

    if (character?.locked) {
      navigate(isMapFull ? WAITING_ROOM_PATH : GAME_BOARD_PATH);
    } else {
      navigate(CHARACTER_CREATION_PATH);
    }
  }, [authMethod, character?.locked, delegatorAddress, isAuthenticated, isMapFull, isRefreshing, navigate, statsLoaded]);

  // Auto-open delegation modal for external wallets that haven't delegated yet
  useEffect(() => {
    if (authMethod === 'external' && isAuthenticated && !delegatorAddress && isSynced && !isOpen) {
      onOpen();
    }
  }, [authMethod, delegatorAddress, isAuthenticated, isOpen, isSynced, onOpen]);

  const onPlay = useCallback(() => {
    // If map is full, go to waiting room (auth or not)
    if (isMapFull) {
      navigate(WAITING_ROOM_PATH);
      return;
    }

    // Authenticated with a character — go to game
    if (isAuthenticated && character?.locked) {
      navigate(GAME_BOARD_PATH);
      return;
    }

    // Not authenticated (or stale session was cleared) — open sign-in modal
    onOpen();
  }, [character, isAuthenticated, isMapFull, navigate, onOpen]);

  // While auto-reconnect is resolving, render nothing so returning users
  // don't see the landing page flash before being redirected to the game.
  // Don't hide when the sign-in modal is open (manual sign-in flow).
  if (isConnecting && !isAuthenticated && !isOpen) {
    return <Box />;
  }

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
        <title>Ultimate Dominion — Nothing Is Forgotten</title>
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
            Nothing Is Forgotten
          </Text>

          <VStack fontWeight={500} maxW="850px" spacing={6} textAlign="center">
            <SafeTypist
              avgTypingDelay={35}
              stdTypingDelay={20}
              cursor={{ show: true, blink: true, element: '▌', hideWhenDone: true, hideWhenDoneDelay: 500 }}
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

          <Button
            animation={`${torchGlow} 4s ease-in-out infinite`}
            color="#12100E"
            letterSpacing="0.15em"
            onClick={onPlay}
            px={{ base: 16, sm: 24 }}
            textTransform="uppercase"
          >
            Enter
          </Button>

          {/* Email signup */}
          <VStack spacing={3} w="100%">
            {submitted ? (
              <VStack spacing={1}>
                <Text
                  color="rgba(196, 184, 158, 0.7)"
                  fontSize="14px"
                  fontWeight={500}
                  letterSpacing="0.05em"
                >
                  You won&apos;t be forgotten.
                </Text>
                <Text
                  color="rgba(196, 184, 158, 0.4)"
                  fontSize="13px"
                  fontStyle="italic"
                >
                  We&apos;ll find you when it&apos;s time to rise.
                </Text>
              </VStack>
            ) : (
              <Box as="form" maxW="420px" mx="auto" onSubmit={onEmailSubmit} w="100%">
                <VStack spacing={2}>
                  <Text
                    color="rgba(196, 184, 158, 0.45)"
                    fontFamily="'Cinzel', serif"
                    fontSize={{ base: '10px', sm: '11px' }}
                    letterSpacing="0.15em"
                    textTransform="uppercase"
                  >
                    Or leave your name — we&apos;ll send word
                  </Text>
                  <HStack spacing={0} w="100%">
                    <Input
                      bg="rgba(196, 184, 158, 0.05)"
                      border="1px solid"
                      borderColor="rgba(196, 184, 158, 0.15)"
                      borderRadius="0"
                      color="rgba(232, 220, 200, 0.8)"
                      fontSize="14px"
                      h="40px"
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      value={email}
                      _focus={{
                        borderColor: 'rgba(200, 122, 42, 0.5)',
                        boxShadow: 'none',
                      }}
                      _placeholder={{
                        color: 'rgba(196, 184, 158, 0.25)',
                      }}
                    />
                    <Box
                      as="button"
                      bg={isSubmitting ? 'rgba(200, 122, 42, 0.2)' : 'rgba(200, 122, 42, 0.35)'}
                      border="1px solid"
                      borderColor="rgba(200, 122, 42, 0.4)"
                      borderLeft="none"
                      color="rgba(232, 220, 200, 0.85)"
                      cursor={isSubmitting ? 'wait' : 'pointer'}
                      flexShrink={0}
                      fontSize="11px"
                      fontWeight={600}
                      h="40px"
                      letterSpacing="0.15em"
                      opacity={isSubmitting ? 0.6 : 1}
                      px={5}
                      textTransform="uppercase"
                      transition="all 0.2s ease"
                      type="submit"
                      _hover={{
                        bg: isSubmitting ? undefined : 'rgba(200, 122, 42, 0.55)',
                        color: '#E8DCC8',
                      }}
                    >
                      {isSubmitting ? '...' : 'Awaken'}
                    </Box>
                  </HStack>
                  {emailError && (
                    <Text
                      color="rgba(200, 100, 100, 0.8)"
                      fontSize="13px"
                      textAlign="center"
                    >
                      {emailError}
                    </Text>
                  )}
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
              to={MANIFESTO_PATH}
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Manifesto
            </Link>
            <Text color="#3A3228" userSelect="none">|</Text>
            <Link
              as={RouterLink}
              color="#8A7E6A"
              to={GUIDE_PATH}
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
          </HStack>

          <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
        </VStack>
      </Box>
    </Box>
  );
};
