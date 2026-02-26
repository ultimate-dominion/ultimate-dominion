import {
  Box,
  Button,
  HStack,
  keyframes,
  Link,
  Progress,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Typist from 'react-typist';

import { ConnectWalletModal } from '../components/ConnectWalletModal';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, GUIDE_PATH, MANIFESTO_PATH, TAVERN_PATH } from '../Routes';

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
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { authMethod, isAuthenticated } = useAuth();
  const {
    components: { SyncProgress },
    delegatorAddress,
  } = useMUD();
  const { character, isRefreshing } = useCharacter();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  // Sticky LIVE: once sync reaches LIVE (including cache restore), don't
  // re-show loading bar if background delta sync briefly goes non-LIVE.
  const wasLive = useRef(false);
  if (syncProgress?.step === SyncStep.LIVE) {
    wasLive.current = true;
  }

  const [syncStalled, setSyncStalled] = useState(false);

  useEffect(() => {
    if (syncProgress && syncProgress.step === SyncStep.LIVE) {
      setSyncStalled(false);
      return;
    }

    const timer = setTimeout(() => {
      setSyncStalled(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, [syncProgress]);

  // Auto-navigate when fully set up (returning players, or just signed in)
  useEffect(() => {
    if (isRefreshing) return;
    if (!isAuthenticated) return;

    const embeddedReady = authMethod === 'embedded';
    const externalReady = authMethod === 'external' && !!delegatorAddress;
    if (!embeddedReady && !externalReady) return;

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
    } else {
      navigate(CHARACTER_CREATION_PATH);
    }
  }, [authMethod, character?.locked, delegatorAddress, isAuthenticated, isRefreshing, navigate]);

  const onPlay = useCallback(() => {
    // Authenticated with a character — go to game
    if (isAuthenticated && character?.locked) {
      navigate(GAME_BOARD_PATH);
      return;
    }

    // Not authenticated (or stale session was cleared) — open sign-in modal
    onOpen();
  }, [character, isAuthenticated, navigate, onOpen]);

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
            <Typist
              avgTypingDelay={35}
              stdTypingDelay={20}
              cursor={{ show: true, blink: true, element: '▌', hideWhenDone: true, hideWhenDoneDelay: 500 }}
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

          {syncProgress && syncProgress.step !== SyncStep.LIVE && syncProgress.percentage < 100 && !wasLive.current ? (
            <VStack justify="center" w={{ base: '80%', sm: '50%' }}>
              <Text>Loading {Math.round(syncProgress.percentage)}%</Text>
              <Progress value={Math.round(syncProgress.percentage)} w="100%" />
              {syncStalled && (
                <VStack spacing={2} mt={2}>
                  <Text size="xs" color="grey500" textAlign="center">
                    Taking longer than expected...
                  </Text>
                  <Button
                    onClick={() => window.location.reload()}
                    size="sm"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </VStack>
              )}
            </VStack>
          ) : (
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
          )}

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
              as={RouterLink}
              color="#8A7E6A"
              to={TAVERN_PATH}
              _hover={{ color: '#D4A54A', textDecoration: 'none' }}
            >
              Tavern
            </Link>
          </HStack>

          <ConnectWalletModal isOpen={isOpen} onClose={onClose} />
        </VStack>
      </Box>
    </Box>
  );
};
