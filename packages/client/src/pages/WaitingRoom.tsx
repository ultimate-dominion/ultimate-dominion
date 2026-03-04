import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  keyframes,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { CaptchaGate } from '../components/CaptchaGate';
import { ConnectWalletModal } from '../components/ConnectWalletModal';
import { GameEventFeed } from '../components/GameEventFeed';
import { InvitePanel } from '../components/InvitePanel';
import { useAuth } from '../contexts/AuthContext';
import { useMap } from '../contexts/MapContext';
import { useQueue } from '../contexts/QueueContext';
import { GAME_BOARD_PATH, WAITING_ROOM_PATH } from '../Routes';

// Pulsing amber glow for the queue position number
const positionPulse = keyframes`
  0%, 100% {
    text-shadow: 0 0 20px rgba(200,122,42,0.4), 0 0 60px rgba(200,122,42,0.15);
  }
  50% {
    text-shadow: 0 0 30px rgba(200,122,42,0.6), 0 0 80px rgba(200,122,42,0.25);
  }
`;

const slotGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 15px rgba(90,138,62,0.3), inset 0 0 15px rgba(90,138,62,0.1);
  }
  50% {
    box-shadow: 0 0 30px rgba(90,138,62,0.5), inset 0 0 20px rgba(90,138,62,0.2);
  }
`;

// Slow breathing border pulse for the idle hero
const borderPulse = keyframes`
  0%, 100% {
    border-color: rgba(200,122,42,0.15);
  }
  50% {
    border-color: rgba(200,122,42,0.35);
  }
`;

export const WaitingRoom = (): JSX.Element => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isSpawned } = useMap();
  const {
    queuePosition,
    totalInQueue,
    currentPlayers,
    maxPlayers,
    queueStatus,
    readyUntil,
    estimatedWaitMinutes,
    priority,
    joinQueue,
    leaveQueue,
    reportSpawned,
    isMapFull,
    gameEvents,
  } = useQueue();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const { isOpen: isFeedOpen, onOpen: onOpenFeed, onClose: onCloseFeed } = useDisclosure();
  const { isOpen: isAuthOpen, onOpen: onOpenAuth, onClose: onCloseAuth } = useDisclosure();
  const [showCaptcha, setShowCaptcha] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Countdown timer for ready state
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!readyUntil || queueStatus !== 'ready') {
      setCountdown('');
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, readyUntil.getTime() - Date.now());
      if (remaining <= 0) {
        setCountdown('Expired');
        return;
      }
      const seconds = Math.ceil(remaining / 1000);
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      setCountdown(`${min}:${sec.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [readyUntil, queueStatus]);

  // Redirect to game board if spawned
  // TODO: re-enable after testing
  // useEffect(() => {
  //   if (isSpawned) {
  //     navigate(GAME_BOARD_PATH);
  //   }
  // }, [isSpawned, navigate]);

  // If map is no longer full, redirect to game board
  // TODO: re-enable after testing
  // useEffect(() => {
  //   if (!isMapFull && queueStatus !== 'ready') {
  //     navigate(GAME_BOARD_PATH);
  //   }
  // }, [isMapFull, queueStatus, navigate]);

  const handleLeaveQueue = useCallback(async () => {
    await leaveQueue();
    navigate(GAME_BOARD_PATH);
  }, [leaveQueue, navigate]);

  const handleSpawnNow = useCallback(() => {
    reportSpawned();
    navigate(GAME_BOARD_PATH);
  }, [navigate, reportSpawned]);

  const shareQueuePosition = useCallback(() => {
    const text = `I'm #${queuePosition} in line for Ultimate Dominion! ${totalInQueue} players waiting.\n\nultimatedominion.com\n\n#UltimateDominion`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
  }, [queuePosition, totalInQueue]);

  // Rough wait estimate for players not yet in queue
  const preQueueEstimate = totalInQueue > 0
    ? Math.ceil((totalInQueue + 1) * 8)
    : 8;

  const isReady = queueStatus === 'ready';
  const isWaiting = queueStatus === 'waiting';

  return (
    <>
      <Helmet>
        <title>Queue | Ultimate Dominion</title>
      </Helmet>

      <Box maxW="1100px" mx="auto" px={{ base: 3, md: 6 }} py={{ base: 4, md: 8 }}>

        {/* ═══ HERO: Queue Status ═══ */}
        {isReady ? (
          // ── SLOT OPEN ──
          <Box
            animation={`${slotGlow} 2s ease-in-out infinite`}
            border="1px solid"
            borderColor="#5A8A3E"
            mb={8}
            p={{ base: 6, md: 10 }}
            textAlign="center"
          >
            <Text
              color="#5A8A3E"
              fontFamily="Cinzel, serif"
              fontSize={{ base: '2xl', md: '4xl' }}
              fontWeight={700}
              mb={2}
            >
              A Slot Has Opened
            </Text>
            <Text color="#C4B89E" fontSize={{ base: 'md', md: 'lg' }} mb={6}>
              You have {countdown || '2:00'} to enter the world before your place is given away.
            </Text>
            <Button
              fontSize="lg"
              onClick={handleSpawnNow}
              px={12}
              py={6}
              variant="amber"
            >
              Enter the World
            </Button>
          </Box>
        ) : isWaiting ? (
          // ── IN QUEUE ──
          <Box mb={8} textAlign="center">
            <Text
              color="#8A7E6A"
              fontFamily="Cinzel, serif"
              fontSize={{ base: 'sm', md: 'md' }}
              letterSpacing="0.2em"
              mb={2}
              textTransform="uppercase"
            >
              Your Position in Line
            </Text>
            <Text
              animation={`${positionPulse} 3s ease-in-out infinite`}
              color="#C87A2A"
              fontFamily="Cinzel, serif"
              fontSize={{ base: '72px', md: '108px' }}
              fontWeight={700}
              lineHeight={1}
              mb={2}
            >
              #{queuePosition}
            </Text>
            <HStack justify="center" mb={3} spacing={3}>
              {priority !== 'normal' && (
                <Badge
                  bg={priority === 'founder' ? 'rgba(212,165,74,0.15)' : 'rgba(106,138,176,0.15)'}
                  border="1px solid"
                  borderColor={priority === 'founder' ? '#D4A54A' : '#6A8AB0'}
                  borderRadius="2px"
                  color={priority === 'founder' ? '#D4A54A' : '#6A8AB0'}
                  fontSize="xs"
                  px={2}
                  py={0.5}
                  textTransform="capitalize"
                >
                  {priority} Priority
                </Badge>
              )}
            </HStack>
            <Text color="#8A7E6A" fontSize="sm" mb={4}>
              ~{estimatedWaitMinutes} min estimated
              {' · '}
              {currentPlayers}/{maxPlayers} adventurers in-world
              {' · '}
              {totalInQueue} waiting
            </Text>
            <HStack justify="center" spacing={3}>
              <Button
                onClick={shareQueuePosition}
                size="sm"
                variant="outline"
              >
                Share Position
              </Button>
              <Button
                color="#B83A2A"
                onClick={handleLeaveQueue}
                size="sm"
                variant="ghost"
              >
                Leave Queue
              </Button>
            </HStack>
          </Box>
        ) : (
          // ── IDLE (not yet in queue) ──
          <Box
            animation={`${borderPulse} 4s ease-in-out infinite`}
            border="1px solid"
            borderColor="rgba(200,122,42,0.15)"
            mb={8}
            p={{ base: 6, md: 10 }}
            position="relative"
            textAlign="center"
          >
            {/* Decorative corner marks */}
            <Box
              borderColor="rgba(200,122,42,0.25)"
              borderLeft="2px solid"
              borderTop="2px solid"
              h="16px"
              left={-0.5}
              position="absolute"
              top={-0.5}
              w="16px"
            />
            <Box
              borderColor="rgba(200,122,42,0.25)"
              borderRight="2px solid"
              borderTop="2px solid"
              h="16px"
              position="absolute"
              right={-0.5}
              top={-0.5}
              w="16px"
            />
            <Box
              borderBottom="2px solid"
              borderColor="rgba(200,122,42,0.25)"
              borderLeft="2px solid"
              bottom={-0.5}
              h="16px"
              left={-0.5}
              position="absolute"
              w="16px"
            />
            <Box
              borderBottom="2px solid"
              borderColor="rgba(200,122,42,0.25)"
              borderRight="2px solid"
              bottom={-0.5}
              h="16px"
              position="absolute"
              right={-0.5}
              w="16px"
            />

            <Text
              color="#8A7E6A"
              fontFamily="Cinzel, serif"
              fontSize={{ base: 'xs', md: 'sm' }}
              letterSpacing="0.3em"
              mb={4}
              textTransform="uppercase"
            >
              The World is Full
            </Text>
            <Text
              color="#C87A2A"
              fontFamily="Cinzel, serif"
              fontSize={{ base: '64px', md: '96px' }}
              fontWeight={700}
              lineHeight={1}
              mb={1}
            >
              {currentPlayers}/{maxPlayers}
            </Text>
            <Text
              color="#C4B89E"
              fontFamily="Cinzel, serif"
              fontSize={{ base: 'sm', md: 'md' }}
              letterSpacing="0.05em"
              mb={5}
            >
              adventurers are currently in the world
            </Text>

            {/* Queue stats bar */}
            <HStack
              borderColor="rgba(196,184,158,0.08)"
              borderTop="1px solid"
              justify="center"
              mb={6}
              mx="auto"
              pt={5}
              spacing={{ base: 4, md: 8 }}
              w={{ base: '100%', md: '80%' }}
            >
              <VStack spacing={0}>
                <Text color="#C87A2A" fontFamily="Cinzel, serif" fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
                  {totalInQueue}
                </Text>
                <Text color="#5A5040" fontSize="xs" textTransform="uppercase">
                  in queue
                </Text>
              </VStack>
              <Box bg="rgba(196,184,158,0.12)" h="30px" w="1px" />
              <VStack spacing={0}>
                <Text color="#C87A2A" fontFamily="Cinzel, serif" fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
                  ~{preQueueEstimate}m
                </Text>
                <Text color="#5A5040" fontSize="xs" textTransform="uppercase">
                  est. wait
                </Text>
              </VStack>
              <Box bg="rgba(196,184,158,0.12)" h="30px" w="1px" />
              <VStack spacing={0}>
                <Text color="#C87A2A" fontFamily="Cinzel, serif" fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
                  5m
                </Text>
                <Text color="#5A5040" fontSize="xs" textTransform="uppercase">
                  avg. session
                </Text>
              </VStack>
            </HStack>

            {/* CTA: Join Queue or Log In */}
            {!isAuthenticated ? (
              <Button
                fontSize="lg"
                onClick={onOpenAuth}
                px={10}
                py={5}
                variant="amber"
              >
                Log in to Join Queue
              </Button>
            ) : showCaptcha ? (
              <CaptchaGate
                isLoading={queueStatus === ('joining' as any)}
                onVerified={async (token) => {
                  await joinQueue(token);
                }}
              />
            ) : (
              <VStack spacing={3}>
                <Button
                  fontSize="lg"
                  onClick={() => setShowCaptcha(true)}
                  px={10}
                  py={5}
                  variant="amber"
                >
                  Join Queue
                </Button>
                <Text color="#5A5040" fontSize="xs">
                  You'll be notified when a slot opens
                </Text>
              </VStack>
            )}
          </Box>
        )}

        {/* ═══ MAIN CONTENT: Two columns on desktop ═══ */}
        <Box
          display={{ base: 'block', lg: 'grid' }}
          gap={8}
          gridTemplateColumns={{ lg: '1fr 380px' }}
        >
          {/* ── Left Column: Game Pitch + Invite ── */}
          <VStack align="stretch" spacing={8}>

            {/* Game Description */}
            <Box>
              <Text
                color="#D4A54A"
                fontFamily="Cinzel, serif"
                fontSize={{ base: 'lg', md: 'xl' }}
                fontWeight={600}
                mb={4}
              >
                While You Wait
              </Text>
              <Box
                borderColor="rgba(200,122,42,0.3)"
                borderLeft="2px solid"
                pl={5}
              >
                <Text
                  color="#C4B89E"
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontStyle="italic"
                  lineHeight={1.8}
                  mb={4}
                >
                  Ultimate Dominion is a text-based MMORPG where every fight leaves a mark,
                  every death costs something real, and every piece of loot you find belongs
                  to you forever. There are no shortcuts, no resets, and no takebacks.
                </Text>
                <Text color="#8A7E6A" fontSize="sm" lineHeight={1.7}>
                  Build a character. Choose a class. Explore dangerous zones, fight
                  other players, trade rare gear, and carve your name into a world that
                  remembers everything. The server is small on purpose — only {maxPlayers} adventurers
                  at a time. Every encounter matters.
                </Text>
              </Box>
            </Box>

            {/* Invite Friends — front and center */}
            <Box
              bg="#1C1814"
              border="1px solid"
              borderColor="#3A3228"
              p={{ base: 5, md: 6 }}
            >
              <Text
                color="#D4A54A"
                fontFamily="Cinzel, serif"
                fontSize={{ base: 'lg', md: 'xl' }}
                fontWeight={600}
                mb={2}
              >
                Invite Friends, Skip the Line
              </Text>
              <Text color="#8A7E6A" fontSize="sm" lineHeight={1.7} mb={5}>
                Players who enter with an invite code get priority queue placement — they
                move ahead of everyone without one. Earn codes by reaching level milestones
                in-game, then share them to bring friends in faster.
              </Text>
              <InvitePanel />
            </Box>

            {/* Mobile: Live Feed button */}
            {!isDesktop && (
              <Button
                onClick={onOpenFeed}
                variant="outline"
                w="100%"
              >
                {gameEvents.length > 0
                  ? `World Events (${gameEvents.length})`
                  : 'World Events'
                }
              </Button>
            )}
          </VStack>

          {/* ── Right Column: World Events (desktop only) ── */}
          {isDesktop && (
            <Box
              border="1px solid"
              borderColor="#3A3228"
              maxH="calc(100vh - 120px)"
              minH="500px"
              overflowY="auto"
              position="sticky"
              top="80px"
            >
              <Box
                bg="#1C1814"
                borderBottom="1px solid"
                borderColor="rgba(196,184,158,0.08)"
                p={4}
                position="sticky"
                top={0}
                zIndex={1}
              >
                <Text
                  color="#D4A54A"
                  fontFamily="Cinzel, serif"
                  fontSize="sm"
                  fontWeight={600}
                  letterSpacing="0.1em"
                  textTransform="uppercase"
                >
                  World Events
                </Text>
                <Text color="#5A5040" fontSize="xs" mt={1}>
                  Happening right now in the world
                </Text>
              </Box>
              <Box p={4}>
                <GameEventFeed />
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <ConnectWalletModal isOpen={isAuthOpen} onClose={onCloseAuth} suppressNavigate />

      {/* Mobile: Live Feed drawer */}
      <Drawer isOpen={isFeedOpen} onClose={onCloseFeed} placement="bottom">
        <DrawerOverlay />
        <DrawerContent bg="#1C1814" borderTopRadius="lg" maxH="60vh">
          <DrawerCloseButton />
          <DrawerHeader
            color="#D4A54A"
            fontFamily="Cinzel, serif"
            fontSize="md"
          >
            World Events
          </DrawerHeader>
          <DrawerBody pb={6}>
            <GameEventFeed />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};
