import {
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { GiPerson } from 'react-icons/gi';
import { IoIosWarning } from 'react-icons/io';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCachedDelegator } from '../lib/delegatorCache';

import { ActionsPanel } from '../components/ActionsPanel';
import { BattleOutcomeModal } from '../components/BattleOutcomeModal';
import { RankChangeToast } from '../components/RankChangeToast';
import { ConsumableQuickUse } from '../components/ConsumableQuickUse';
import { EquippedLoadout } from '../components/EquippedLoadout';
import { InfoModal } from '../components/InfoModal';
import { MapPanel } from '../components/MapPanel';
import { PolygonalCard } from '../components/PolygonalCard';
import { StatsPanel } from '../components/StatsPanel';
import { TileDetailsPanel } from '../components/TileDetailsPanel';
import { TransactionProgressBar } from '../components/TransactionProgressBar';
import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useQueue } from '../contexts/QueueContext';
import { useGameStore } from '../lib/gameStore/store';
import { CHARACTER_CREATION_PATH, HOME_PATH, WAITING_ROOM_PATH } from '../Routes';
import { BATTLE_OUTCOME_SEEN_KEY } from '../utils/constants';

export const GameBoard = (): JSX.Element => {
  const {
    isOpen: isEquipInfoModalOpen,
    onOpen: onOpenEquipInfoModal,
    onClose: onCloseEquipInfoModal,
  } = useDisclosure();
  const {
    isOpen: isOuterRealmsInfoModalOpen,
    onOpen: onOpenOuterRealmsInfoModal,
    onClose: onCloseOuterRealmsInfoModal,
  } = useDisclosure();
  const {
    isOpen: isBattleOutcomeModalOpen,
    onOpen: onOpenBattleOutcomeModal,
    onClose: onCloseBattleOutcomeModal,
  } = useDisclosure();
  const {
    isOpen: isStatsDrawerOpen,
    onOpen: onOpenStatsDrawer,
    onClose: onCloseStatsDrawer,
  } = useDisclosure();

  const { isAuthenticated: isConnected, isConnecting } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    delegatorAddress,
    isSynced,
    network: { worldContract },
  } = useMUD();
  const { character, isMoveEquipped, isRefreshing } = useCharacter();
  const { inSafetyZone, isSpawned, position } = useMap();
  const { attackProgress, continueToBattleOutcome, currentBattle, lastestBattleOutcome } = useBattle();
  const { autoAdventureMode, moveProgress } = useMovement();
  const { isMapFull, queueStatus } = useQueue();
  const hydrated = useGameStore((s) => s.hydrated);
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  // Grace period: cached session lets player land here before auth resolves.
  // Wait up to 5s for auth to catch up before redirecting.
  const hasCachedSession = useMemo(() => {
    return !!getCachedDelegator(import.meta.env.VITE_WORLD_ADDRESS || '');
  }, []);

  const [authGraceExpired, setAuthGraceExpired] = useState(false);
  useEffect(() => {
    if (!hasCachedSession) return;
    const timer = setTimeout(() => setAuthGraceExpired(true), 5000);
    return () => clearTimeout(timer);
  }, [hasCachedSession]);

  // Redirect to home if synced, but missing other requirements.
  // IMPORTANT: Wait for each loading phase to complete before making
  // redirect decisions. Premature redirects cause refresh-to-home bugs.
  useEffect(() => {
    const inGracePeriod = hasCachedSession && !authGraceExpired;

    // Phase 1: Wait for auth to resolve (isConnecting is true during auto-reconnect)
    if (isConnecting) return;
    if (!isConnected) {
      if (inGracePeriod) return;
      navigate(isMapFull ? WAITING_ROOM_PATH : HOME_PATH);
      return;
    }

    // Phase 2: Wait for MUD sync
    if (!isSynced) return;

    // Phase 3: Wait for delegation (external path)
    if (!delegatorAddress) {
      if (inGracePeriod) return;
      navigate(HOME_PATH);
      return;
    }

    // Phase 4: Wait for game data to load before deciding.
    // hydrated = GameStore has received its initial snapshot from the indexer.
    // Without it, character is null because the Characters table is empty, not
    // because the player hasn't created one.
    if (!hydrated || isRefreshing) return;

    if (!character?.locked) {
      navigate(CHARACTER_CREATION_PATH);
      return;
    }

    // If map is full and player is in queue (not ready to spawn), redirect to waiting room
    if (isMapFull && !isSpawned && queueStatus === 'waiting') {
      navigate(WAITING_ROOM_PATH);
      return;
    }

    if (character?.worldEncounter) {
      // Skip shop redirect when player explicitly left the shop.
      // The encounter auto-ends on the next move via MapSystem.
      const fromShop = (location.state as { fromShop?: boolean })?.fromShop;
      if (!fromShop) {
        navigate(`/shops/${character.worldEncounter.shopId}`);
      }
    }
  }, [
    authGraceExpired,
    character,
    delegatorAddress,
    hasCachedSession,
    hydrated,
    isConnected,
    isConnecting,
    isMapFull,
    isRefreshing,
    isSpawned,
    isSynced,
    location.state,
    navigate,
    queueStatus,
  ]);

  // Show welcome modal for brand-new characters
  useEffect(() => {
    if (!character) return;

    const welcomeSeenKey = `welcome-seen-${worldContract.address}-${character.id}`;
    if (localStorage.getItem(welcomeSeenKey)) return;

    if (character.experience === BigInt(0)) {
      onOpenEquipInfoModal();
    }
  }, [character, onOpenEquipInfoModal, worldContract]);

  const onAcknowledgeEquipInfo = useCallback(() => {
    if (!character) return;

    const welcomeSeenKey = `welcome-seen-${worldContract.address}-${character.id}`;
    localStorage.setItem(welcomeSeenKey, 'true');
    onCloseEquipInfoModal();
  }, [character, onCloseEquipInfoModal, worldContract]);

  // Open Outer Realms warning modal if character is level 1 and entered Outer Realms
  useEffect(() => {
    if (!(character && position)) return;

    const outerRealmsSeenKey = `outer-realms-warning-seen-${worldContract.address}-${character.id}`;

    const hasSeenWarning = localStorage.getItem(outerRealmsSeenKey);
    if (hasSeenWarning) return;

    if (character.level === BigInt(1) && !inSafetyZone) {
      onOpenOuterRealmsInfoModal();
    }
  }, [
    character,
    inSafetyZone,
    onOpenOuterRealmsInfoModal,
    position,
    worldContract,
  ]);

  const onAcknowledgeOuterRealmsWarning = useCallback(() => {
    if (!character) return;

    const outerRealmsSeenKey = `outer-realms-warning-seen-${worldContract.address}-${character.id}`;
    localStorage.setItem(outerRealmsSeenKey, 'true');
    onCloseOuterRealmsInfoModal();
  }, [character, onCloseOuterRealmsInfoModal, worldContract]);

  // Open battle outcome modal if there is a new battle outcome
  useEffect(() => {
    if (lastestBattleOutcome) {
      if (!continueToBattleOutcome) return;

      const latestBattleOutcomeSeen = localStorage.getItem(
        BATTLE_OUTCOME_SEEN_KEY,
      );

      if (latestBattleOutcomeSeen === lastestBattleOutcome.encounterId) return;

      onOpenBattleOutcomeModal();
    }
  }, [continueToBattleOutcome, onOpenBattleOutcomeModal, lastestBattleOutcome]);

  if (!character?.locked) return <Box />;

  return (
    <>
    <Helmet>
      <title>Play | Ultimate Dominion</title>
    </Helmet>
    <Grid
      gap={2}
      h={{ base: 'auto', md: 'calc(100vh - 125px)' }}
      minH={{ base: 'calc(100vh - 80px)' }}
      templateColumns={{ base: '1fr', lg: 'repeat(16, 1fr)' }}
      templateRows={{ base: 'auto', lg: 'repeat(12, 1fr)' }}
    >
      <GridItem
        colSpan={{ base: 1, lg: 4 }}
        display={{ base: 'none', lg: 'block' }}
        rowSpan={{ base: 'auto', lg: 12 }}
      >
        <PolygonalCard className="data-dense" clipPath="none" overflowY="auto">
          <StatsPanel />
        </PolygonalCard>
      </GridItem>
      <GridItem
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        rowSpan={{ base: 'auto', lg: 12 }}
        rowStart={{ base: 0, lg: 0 }}
        display="flex"
        flexDirection="column"
        gap={0}
        overflow="hidden"
      >
        <Box flex="1" minH={0} overflow="hidden">
          <PolygonalCard className="data-dense" clipPath="none" h="100%">
            <TileDetailsPanel />
          </PolygonalCard>
        </Box>
        <TransactionProgressBar progressA={moveProgress} progressB={attackProgress} />
        <Box
          flex="1"
          minH={0}
          overflow="hidden"
          display={
            !isDesktop && !currentBattle && isSpawned && position
              ? 'none'
              : undefined
          }
        >
          <PolygonalCard className="data-dense" clipPath="none" h="100%">
            <ActionsPanel />
          </PolygonalCard>
        </Box>
      </GridItem>
      <GridItem
        colSpan={{ base: 1, lg: 4 }}
        colStart={{ base: 0, lg: 13 }}
        rowSpan={{ base: 'auto', lg: 12 }}
        rowStart={{ base: 'auto', lg: 0 }}
      >
        <MapPanel />
      </GridItem>
      <Box
        bottom={4}
        display={{ base: 'block', lg: 'none' }}
        left={4}
        pos="fixed"
        zIndex={10}
      >
        <Button onClick={onOpenStatsDrawer} px={4} py={5}>
          <GiPerson size={24} />
        </Button>
        <Drawer isOpen={isStatsDrawerOpen} onClose={onCloseStatsDrawer} placement="bottom">
          <DrawerOverlay />
          <DrawerContent maxH="60vh" borderTopRadius="lg">
            <DrawerCloseButton />
            <DrawerHeader>Stats</DrawerHeader>
            <DrawerBody className="data-dense" overflowY="auto" pb={6}>
              <StatsPanel />
              {isSpawned && !currentBattle && (
                <>
                  <Divider borderColor="grey300" my={4} />
                  <EquippedLoadout />
                  <Divider borderColor="grey300" my={4} />
                  <ConsumableQuickUse />
                </>
              )}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Box>

      <InfoModal
        heading="Welcome to Ultimate Dominion"
        isOpen={isEquipInfoModalOpen}
        onClose={onAcknowledgeEquipInfo}
      >
        <Text>
          Your character is ready. Spawn onto the map to begin exploring the
          Dark Cave. Move carefully — monsters lurk beyond the safety zone, and
          death has consequences.
        </Text>
      </InfoModal>
      <InfoModal
        heading="Careful! You're about to enter the Outer Realms!"
        isOpen={isOuterRealmsInfoModalOpen}
        onClose={onAcknowledgeOuterRealmsWarning}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text mt={4}>
            The{' '}
            <Text as="span" fontWeight={700}>
              Outer Realms
            </Text>{' '}
            is a dangerous place for a level 1 character. Any other player could
            attack you at any time.
          </Text>
          <Text>
            It is recommended that you level up your character more before
            entering.
          </Text>
        </VStack>
      </InfoModal>

      {lastestBattleOutcome && !autoAdventureMode && (
        <BattleOutcomeModal
          key={lastestBattleOutcome.encounterId}
          battleOutcome={lastestBattleOutcome}
          isOpen={isBattleOutcomeModalOpen}
          onClose={onCloseBattleOutcomeModal}
        />
      )}
      <RankChangeToast />
    </Grid>
    </>
  );
};
