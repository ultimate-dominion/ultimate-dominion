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
import { useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { IoIosWarning } from 'react-icons/io';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import { ActionsPanel } from '../components/ActionsPanel';
import { BattleOutcomeModal } from '../components/BattleOutcomeModal';
import { ConsumableQuickUse } from '../components/ConsumableQuickUse';
import { EquippedLoadout } from '../components/EquippedLoadout';
import { InfoModal } from '../components/InfoModal';
import { MapPanel } from '../components/MapPanel';
import { PolygonalCard } from '../components/PolygonalCard';
import { StatsPanel } from '../components/StatsPanel';
import { TileDetailsPanel } from '../components/TileDetailsPanel';
import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, HOME_PATH } from '../Routes';
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
  const navigate = useNavigate();
  const {
    delegatorAddress,
    isSynced,
    network: { worldContract },
  } = useMUD();
  const { character, isMoveEquipped, isRefreshing } = useCharacter();
  const { inSafetyZone, isSpawned, position } = useMap();
  const { continueToBattleOutcome, currentBattle, lastestBattleOutcome } = useBattle();
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  // Redirect to home if synced, but missing other requirements.
  // IMPORTANT: Wait for each loading phase to complete before making
  // redirect decisions. Premature redirects cause refresh-to-home bugs.
  useEffect(() => {
    // Phase 1: Wait for auth to resolve
    if (isConnecting) return;
    if (!isConnected) {
      navigate(HOME_PATH);
      return;
    }

    // Phase 2: Wait for MUD sync
    if (!isSynced) return;

    // Phase 3: Wait for delegation (external path)
    if (!delegatorAddress) {
      navigate(HOME_PATH);
      return;
    }

    // Phase 4: Wait for character data to load before deciding
    if (isRefreshing) return;

    if (!character?.locked) {
      navigate(CHARACTER_CREATION_PATH);
      return;
    }

    if (character?.worldEncounter) {
      navigate(`/shops/${character.worldEncounter.shopId}`);
    }
  }, [
    character,
    delegatorAddress,
    isConnected,
    isConnecting,
    isRefreshing,
    isSynced,
    navigate,
  ]);

  // Open equip info modal if character has no experience and no equipped items
  useEffect(() => {
    if (!character) return;

    const equipInfoSeenKey = `equip-info-seen-${worldContract.address}-${character.id}`;

    const hasSeenEquipInfo = localStorage.getItem(equipInfoSeenKey);
    if (hasSeenEquipInfo) return;

    if (character.experience === BigInt(0) && !isMoveEquipped) {
      onOpenEquipInfoModal();
    }
  }, [character, isMoveEquipped, onOpenEquipInfoModal, worldContract]);

  const onAcknowledgeEquipInfo = useCallback(() => {
    if (!character) return;

    const equipInfoSeenKey = `equip-info-seen-${worldContract.address}-${character.id}`;
    localStorage.setItem(equipInfoSeenKey, 'true');
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
        rowSpan={{ base: 'auto', lg: 6 }}
        rowStart={{ base: 0, lg: 0 }}
      >
        <PolygonalCard className="data-dense" clipPath="none">
          <TileDetailsPanel />
        </PolygonalCard>
      </GridItem>
      <GridItem
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        display={
          !isDesktop && !currentBattle && isSpawned && position
            ? 'none'
            : undefined
        }
        rowSpan={{ base: 'auto', lg: 6 }}
        rowStart={{ base: 'auto', lg: 7 }}
      >
        <PolygonalCard className="data-dense" clipPath="none">
          <ActionsPanel />
        </PolygonalCard>
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
        bottom={2}
        display={{ base: 'block', lg: 'none' }}
        left={2}
        pos="fixed"
        zIndex={5}
      >
        <Button onClick={onOpenStatsDrawer} size="sm">
          Stats
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
        heading="Welcome to the game board!"
        isOpen={isEquipInfoModalOpen}
        onClose={onAcknowledgeEquipInfo}
      >
        <Text>
          In order to start battling, you must have at least 1 weapon or spell
          equipped. Go to your{' '}
          <Text
            as={Link}
            color="blue"
            onClick={onAcknowledgeEquipInfo}
            to={`/characters/${character?.id}`}
            _hover={{
              textDecoration: 'underline',
            }}
          >
            character page
          </Text>{' '}
          to equip a move.
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

      {lastestBattleOutcome && (
        <BattleOutcomeModal
          battleOutcome={lastestBattleOutcome}
          isOpen={isBattleOutcomeModalOpen}
          onClose={onCloseBattleOutcomeModal}
        />
      )}
    </Grid>
    </>
  );
};
