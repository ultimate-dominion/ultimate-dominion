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
import { Trans, useTranslation } from 'react-i18next';
import { GiPerson } from 'react-icons/gi';
import { IoIosWarning } from 'react-icons/io';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCachedDelegator } from '../lib/delegatorCache';

import { ActionsPanel } from '../components/ActionsPanel';
import { CurrentObjectiveHud } from '../components/CurrentObjectiveHud';
import { AdvancedClassModal } from '../components/AdvancedClassModal';
import { BattleOutcomeModal } from '../components/BattleOutcomeModal';
import { CaveReactionOverlay } from '../components/CaveReactionOverlay';
import { RankChangeToast } from '../components/RankChangeToast';
import { ConsumableQuickUse } from '../components/ConsumableQuickUse';
import { EquippedLoadout } from '../components/EquippedLoadout';
import { InfoModal } from '../components/InfoModal';
import { LevelUpModal } from '../components/LevelUpModal';
import { MapPanel } from '../components/MapPanel';
import { MapRevealOverlay } from '../components/MapRevealOverlay';
import { ZoneTransitionOverlay } from '../components/ZoneTransitionOverlay';
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
import { SHOW_Z2 } from '../lib/env';
import { BattleWorldTicker } from '../components/pretext/game/BattleWorldTicker';
import { useGameStore, wasPreHydrated } from '../lib/gameStore/store';
import { CHARACTER_CREATION_PATH, HOME_PATH, WAITING_ROOM_PATH } from '../Routes';
import { OnboardingStage, useOnboardingStage } from '../hooks/useOnboardingStage';
import { BATTLE_OUTCOME_SEEN_KEY, MAX_LEVEL } from '../utils/constants';
import { useGameValue, encodeUint256Key, toBigInt } from '../lib/gameStore';

export const GameBoard = (): JSX.Element => {
  const { t } = useTranslation('ui');
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

  const {
    isOpen: isLevelUpModalOpen,
    onOpen: onOpenLevelUpModal,
    onClose: onCloseLevelUpModal,
  } = useDisclosure();

  const {
    isOpen: isClassModalOpen,
    onOpen: onOpenClassModal,
    onClose: onCloseClassModal,
  } = useDisclosure();

  const [showMapReveal, setShowMapReveal] = useState(false);
  const [showZoneTransition, setShowZoneTransition] = useState(false);
  const [showCaveReaction, setShowCaveReaction] = useState(false);
  const [classJustSelected, setClassJustSelected] = useState(false);

  const { isAuthenticated: isConnected, isConnecting } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    delegatorAddress,
    isSynced,
    network: { worldContract },
  } = useMUD();
  const { character, isMoveEquipped, isRefreshing, refreshCharacter } = useCharacter();
  const { currentZone, inSafetyZone, isSpawned, position } = useMap();
  const { attackProgress, continueToBattleOutcome, currentBattle, lastestBattleOutcome } = useBattle();
  const { autoAdventureMode, clearPendingZoneTransition, moveProgress, pendingZoneTransition } = useMovement();
  const { isMapFull, queueStatus } = useQueue();
  const hydrated = useGameStore((s) => s.hydrated);
  const isReconnecting = useGameStore((s) => s.isReconnecting);
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const stage = useOnboardingStage();

  const nextLevelRow = useGameValue(
    'Levels',
    character ? encodeUint256Key(BigInt(character.level)) : undefined,
  );
  const nextLevelXpRequirement = toBigInt(nextLevelRow?.experience);

  const canLevel = useMemo(() => {
    if (!character) return false;
    if (Number(character.level) >= MAX_LEVEL) return false;
    if (nextLevelXpRequirement === BigInt(0)) return false;
    return BigInt(character.experience) >= nextLevelXpRequirement;
  }, [character, nextLevelXpRequirement]);

  const handleLevelUpClose = useCallback(() => {
    onCloseLevelUpModal();

    // L10: chain to advanced class selection
    if (
      SHOW_Z2 &&
      character &&
      Number(character.level) >= 10 &&
      !character.hasSelectedAdvancedClass
    ) {
      setTimeout(() => onOpenClassModal(), 500);
      return;
    }

    // L5: map reveal
    const key = `map-reveal-seen-${worldContract.address}-${character?.id}`;
    if (character && Number(character.level) >= 5 && !localStorage.getItem(key)) {
      setTimeout(() => setShowMapReveal(true), 500);
    }
  }, [character, onCloseLevelUpModal, onOpenClassModal, worldContract.address]);

  // Class selection callbacks
  const onClassSelected = useCallback(() => {
    refreshCharacter();
    setClassJustSelected(true);
  }, [refreshCharacter]);

  const handleClassModalClose = useCallback(() => {
    onCloseClassModal();
    if (classJustSelected) {
      setClassJustSelected(false);
      const caveReactionKey = `cave-reaction-seen-${worldContract.address}-${character?.id}`;
      if (!localStorage.getItem(caveReactionKey)) {
        localStorage.setItem(caveReactionKey, 'true');
        setTimeout(() => setShowCaveReaction(true), 700);
      }
    }
  }, [character?.id, classJustSelected, onCloseClassModal, worldContract.address]);

  // Fallback: auto-open class modal for players who log in at L10 without having gone through the battle chain
  useEffect(() => {
    if (
      SHOW_Z2 &&
      character &&
      Number(character.level) >= 10 &&
      !character.hasSelectedAdvancedClass &&
      !isClassModalOpen &&
      !isBattleOutcomeModalOpen &&
      !isLevelUpModalOpen
    ) {
      const key = `class-modal-prompted-${worldContract.address}-${character.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        setTimeout(() => onOpenClassModal(), 1000);
      }
    }
  }, [character, isBattleOutcomeModalOpen, isClassModalOpen, isLevelUpModalOpen, onOpenClassModal, worldContract.address]);

  // Wire zone transition overlay from MovementContext
  useEffect(() => {
    if (pendingZoneTransition) {
      clearPendingZoneTransition();
      setShowZoneTransition(true);
    }
  }, [clearPendingZoneTransition, pendingZoneTransition]);

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

  // Only show loading text when we're on the fast-path (store was pre-hydrated
  // from cache). During the normal flow, character resolves before we get here
  // so the brief null is invisible as <Box />.
  //
  // After 3s of loading, show a reload button so returning players aren't stuck
  // staring at a blank screen when the store/auth fails to re-hydrate.
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (character?.locked) { setLoadingTooLong(false); return; }
    const timer = setTimeout(() => setLoadingTooLong(true), 3000);
    return () => clearTimeout(timer);
  }, [character?.locked]);

  if (!character?.locked) {
    if (hasCachedSession && wasPreHydrated) {
      return (
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minH="calc(100vh - 125px)" gap={4}>
          <Text color="rgba(196, 184, 158, 0.5)" fontSize="sm">{t('gameBoard.loading')}</Text>
          {loadingTooLong && (
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="outline"
            >
              {t('gameBoard.reload')}
            </Button>
          )}
        </Box>
      );
    }
    return <Box />;
  }

  return (
    <>
    <Helmet>
      <title>{t('gameBoard.pageTitle')}</title>
    </Helmet>
    {isReconnecting && (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.700"
        zIndex={9999}
        display="flex"
        alignItems="center"
        justifyContent="center"
        pointerEvents="all"
      >
        <Text color="rgba(196, 184, 158, 0.8)" fontSize="md" fontWeight="medium">
          {t('gameBoard.reconnecting')}
        </Text>
      </Box>
    )}
    <Grid
      gap={2}
      h={{ base: 'auto', md: 'calc(100vh - 125px)' }}
      minH={{ base: 'calc(100vh - 80px)' }}
      templateColumns={{ base: '1fr', lg: 'repeat(16, 1fr)' }}
      templateRows={{ base: 'auto', lg: 'repeat(12, 1fr)' }}
    >
      <GridItem
        colSpan={{ base: 1, lg: 4 }}
        display={{ base: 'none', lg: stage >= OnboardingStage.JUST_SPAWNED ? 'block' : 'none' }}
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
        {SHOW_Z2 && <BattleWorldTicker />}
        {SHOW_Z2 && <CurrentObjectiveHud />}
        <Box
          flex={!isDesktop && currentBattle ? 'none' : '1'}
          minH={0}
          overflow="hidden"
        >
          <PolygonalCard className="data-dense" clipPath="none" h={!isDesktop && currentBattle ? 'auto' : '100%'}>
            <TileDetailsPanel />
          </PolygonalCard>
        </Box>
        <TransactionProgressBar progressA={moveProgress} progressB={attackProgress} />
        <Box
          flex="1"
          minH={0}
          overflow="hidden"
          display={
            !isDesktop && !currentBattle && !autoAdventureMode && isSpawned && position
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
            <DrawerHeader>{t('gameBoard.statsDrawer')}</DrawerHeader>
            <DrawerBody className="data-dense" overflowY="auto" pb={6}>
              <StatsPanel />
              {isSpawned && !currentBattle && stage >= OnboardingStage.FIRST_BLOOD && (
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
        heading={t('gameBoard.outerRealmsWarning')}
        isOpen={isOuterRealmsInfoModalOpen}
        onClose={onAcknowledgeOuterRealmsWarning}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text mt={4}>
            <Trans i18nKey="gameBoard.outerRealmsBody1" ns="ui" components={{ bold: <Text as="span" fontWeight={700} /> }} />
          </Text>
          <Text>
            {t('gameBoard.outerRealmsBody2')}
          </Text>
        </VStack>
      </InfoModal>

      {lastestBattleOutcome && !autoAdventureMode && (
        <BattleOutcomeModal
          key={lastestBattleOutcome.encounterId}
          battleOutcome={lastestBattleOutcome}
          isOpen={isBattleOutcomeModalOpen}
          onClose={() => {
            onCloseBattleOutcomeModal();
            if (canLevel) {
              setTimeout(() => onOpenLevelUpModal(), 300);
            }
          }}
        />
      )}

      {character && (
        <LevelUpModal
          character={character}
          isOpen={isLevelUpModalOpen}
          onClose={handleLevelUpClose}
        />
      )}

      {SHOW_Z2 && character && (
        <AdvancedClassModal
          isOpen={isClassModalOpen}
          onClose={handleClassModalClose}
          characterId={character.id}
          onClassSelected={onClassSelected}
        />
      )}

      {showCaveReaction && (
        <CaveReactionOverlay
          onComplete={() => setShowCaveReaction(false)}
        />
      )}

      {showMapReveal && (
        <MapRevealOverlay
          onComplete={() => {
            setShowMapReveal(false);
            const key = `map-reveal-seen-${worldContract.address}-${character?.id}`;
            localStorage.setItem(key, 'true');
          }}
        />
      )}

      {showZoneTransition && (
        <ZoneTransitionOverlay
          onComplete={() => {
            setShowZoneTransition(false);
            const key = `zone-transition-seen-${worldContract.address}-${character?.id}-2`;
            localStorage.setItem(key, 'true');
          }}
        />
      )}
      <RankChangeToast />
    </Grid>
    </>
  );
};
