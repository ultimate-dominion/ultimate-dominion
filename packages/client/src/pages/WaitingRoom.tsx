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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQueue } from '../contexts/QueueContext';
import { useMap } from '../contexts/MapContext';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { GameEventFeed } from '../components/GameEventFeed';
import { InvitePanel } from '../components/InvitePanel';

// Lazy-load existing pages as tab content
import { Marketplace } from './Marketplace';
import { Leaderboard } from './Leaderboard';
import { Tavern } from './Tavern';

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
    leaveQueue,
    reportSpawned,
    isMapFull,
    slotsAvailable,
  } = useQueue();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const { isOpen: isFeedOpen, onOpen: onOpenFeed, onClose: onCloseFeed } = useDisclosure();

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(HOME_PATH);
    }
  }, [isAuthenticated, navigate]);

  // Redirect to game board if spawned
  useEffect(() => {
    if (isSpawned) {
      navigate(GAME_BOARD_PATH);
    }
  }, [isSpawned, navigate]);

  // If map is no longer full, redirect to game board
  useEffect(() => {
    if (!isMapFull && queueStatus !== 'ready') {
      navigate(GAME_BOARD_PATH);
    }
  }, [isMapFull, queueStatus, navigate]);

  const handleLeaveQueue = useCallback(async () => {
    await leaveQueue();
    navigate(GAME_BOARD_PATH);
  }, [leaveQueue, navigate]);

  const handleSpawnNow = useCallback(() => {
    // Navigate to game board — MapPanel will handle the actual spawn
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

  const bannerBg = queueStatus === 'ready' ? 'green.900' : '#1C1814';
  const bannerBorder = queueStatus === 'ready' ? 'green.500' : '#3A3228';

  return (
    <>
      <Helmet>
        <title>Queue | Ultimate Dominion</title>
      </Helmet>

      {/* Top banner */}
      <Box
        bg={bannerBg}
        border="1px solid"
        borderColor={bannerBorder}
        mb={4}
        p={4}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <HStack justify="space-between" wrap="wrap" spacing={3}>
          <VStack align="start" spacing={0}>
            {queueStatus === 'ready' ? (
              <>
                <Text color="green.300" fontWeight={700} size="md">
                  A slot opened!
                </Text>
                <Text color="green.200" size="sm">
                  Spawn now — {countdown} remaining
                </Text>
              </>
            ) : (
              <>
                <HStack spacing={2}>
                  <Text fontWeight={700} size="md">
                    Queue Position: #{queuePosition}
                  </Text>
                  {priority !== 'normal' && (
                    <Badge
                      colorScheme={priority === 'founder' ? 'yellow' : 'blue'}
                      fontSize="2xs"
                      textTransform="capitalize"
                    >
                      {priority}
                    </Badge>
                  )}
                </HStack>
                <Text color="#8A7E6A" size="sm">
                  ~{estimatedWaitMinutes} min wait
                  {' '}·{' '}
                  {currentPlayers}/{maxPlayers} players
                  {' '}·{' '}
                  {totalInQueue} in queue
                </Text>
              </>
            )}
          </VStack>

          <HStack spacing={2}>
            {queueStatus === 'ready' ? (
              <Button
                colorScheme="green"
                onClick={handleSpawnNow}
                size="sm"
              >
                Spawn Now
              </Button>
            ) : (
              <>
                <Button
                  onClick={shareQueuePosition}
                  size="sm"
                  variant="outline"
                >
                  Share Position
                </Button>
                <Button
                  onClick={handleLeaveQueue}
                  size="sm"
                  variant="ghost"
                  color="red.400"
                >
                  Leave
                </Button>
              </>
            )}
            {!isDesktop && (
              <Button onClick={onOpenFeed} size="sm" variant="outline">
                Live Feed
              </Button>
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Main content */}
      <HStack align="start" spacing={4}>
        {/* Tab content area */}
        <Box flex={1}>
          <Tabs colorScheme="orange" variant="soft-rounded">
            <TabList mb={4}>
              <Tab>Marketplace</Tab>
              <Tab>Leaderboard</Tab>
              <Tab>Guide</Tab>
              <Tab>Invite Friends</Tab>
            </TabList>

            <TabPanels>
              <TabPanel p={0}>
                <Marketplace />
              </TabPanel>
              <TabPanel p={0}>
                <Leaderboard />
              </TabPanel>
              <TabPanel p={0}>
                <Tavern />
              </TabPanel>
              <TabPanel p={0}>
                <InvitePanel />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>

        {/* Desktop: Live Feed side panel */}
        {isDesktop && (
          <Box
            border="1px solid"
            borderColor="#3A3228"
            h="calc(100vh - 200px)"
            overflowY="auto"
            position="sticky"
            top="80px"
            w="320px"
          >
            <Box bg="#1C1814" p={3} position="sticky" top={0}>
              <Text fontFamily="Cinzel, serif" fontWeight={600} size="sm">
                Live Feed
              </Text>
            </Box>
            <Box p={3}>
              <GameEventFeed />
            </Box>
          </Box>
        )}
      </HStack>

      {/* Mobile: Live Feed drawer */}
      <Drawer isOpen={isFeedOpen} onClose={onCloseFeed} placement="bottom">
        <DrawerOverlay />
        <DrawerContent bg="#1C1814" maxH="60vh" borderTopRadius="lg">
          <DrawerCloseButton />
          <DrawerHeader>Live Feed</DrawerHeader>
          <DrawerBody pb={6}>
            <GameEventFeed />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};
