import {
  Box,
  Button,
  Grid,
  GridItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect } from 'react';
import { IoIosWarning } from 'react-icons/io';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { ActionsPanel } from '../components/ActionsPanel';
import { BattleOutcomeModal } from '../components/BattleOutcomeModal';
import { InfoModal } from '../components/InfoModal';
import { MapPanel } from '../components/MapPanel';
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

  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const {
    delegatorAddress,
    isSynced,
    network: { worldContract },
  } = useMUD();
  const { character, equippedWeapons } = useCharacter();
  const { inSafetyZone, position } = useMap();
  const { continueToBattleOutcome, lastestBattleOutcome } = useBattle();

  // Redirect to home if synced, but missing other requirements
  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      window.location.reload();
      return;
    }

    if (!isSynced) return;

    if (!delegatorAddress) {
      navigate(HOME_PATH);
      return;
    }

    if (!character?.locked) {
      navigate(CHARACTER_CREATION_PATH);
      return;
    }
  }, [character, delegatorAddress, isConnected, isSynced, navigate]);

  // Open equip info modal if character has no experience and no equipped items
  useEffect(() => {
    if (!(character && equippedWeapons)) return;

    const equipInfoSeenKey = `equip-info-seen-${worldContract.address}-${character.id}`;

    const hasSeenEquipInfo = localStorage.getItem(equipInfoSeenKey);
    if (hasSeenEquipInfo) return;

    if (character.experience === '0' && equippedWeapons.length === 0) {
      onOpenEquipInfoModal();
    }
  }, [character, equippedWeapons, onOpenEquipInfoModal, worldContract]);

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

    if (character.level === '1' && !inSafetyZone) {
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

  return (
    <Grid
      gap={2}
      h="calc(100vh - 100px)"
      mt={4}
      templateColumns={{ base: '1fr', lg: 'repeat(16, 1fr)' }}
      templateRows="repeat(12, 1fr)"
    >
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 4 }}
        display={{ base: 'none', lg: 'block' }}
        overflowY="auto"
        p={4}
        rowSpan={{ base: 12, lg: 12 }}
      >
        <StatsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        overflowY="auto"
        p={{ base: 2, lg: 4 }}
        pos="relative"
        rowSpan={{ base: 3, lg: 6 }}
        rowStart={{ base: 0, lg: 0 }}
      >
        <TileDetailsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        position="relative"
        rowSpan={{ base: 4, lg: 6 }}
        rowStart={{ base: 4, lg: 7 }}
      >
        <ActionsPanel />
      </GridItem>
      <GridItem
        colSpan={{ base: 1, lg: 4 }}
        colStart={{ base: 0, lg: 13 }}
        rowSpan={{ base: 3, lg: 12 }}
        rowStart={{ base: 8, lg: 0 }}
      >
        <MapPanel />
      </GridItem>
      <Box
        bottom={2}
        display={{ base: 'block', lg: 'none' }}
        left="50%"
        pos="fixed"
        px={2}
        transform="translateX(-50%)"
        w="100%"
      >
        <Popover>
          <PopoverTrigger>
            <VStack>
              <Button size="sm" w="100%">
                Stats
              </Button>
            </VStack>
          </PopoverTrigger>
          <PopoverContent p={4}>
            <StatsPanel />
          </PopoverContent>
        </Popover>
      </Box>
      <InfoModal
        heading="Welcome to the game board!"
        isOpen={isEquipInfoModalOpen}
        onClose={onAcknowledgeEquipInfo}
      >
        <Text>
          In order to start battling, you must have at least 1 weapon equipped.
          Go to your{' '}
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
          to equip a weapon.
        </Text>
      </InfoModal>
      <InfoModal
        heading="Careful! You're about to enter the Outer Realms!"
        isOpen={isOuterRealmsInfoModalOpen}
        onClose={onAcknowledgeOuterRealmsWarning}
      >
        <VStack>
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
  );
};
