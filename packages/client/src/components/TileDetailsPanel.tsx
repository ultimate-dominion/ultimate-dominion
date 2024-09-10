import {
  Avatar,
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  Spinner,
  Stack,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { GiCrossedSwords } from 'react-icons/gi';
import { IoIosWarning } from 'react-icons/io';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { getEmoji, removeEmoji } from '../utils/helpers';
import { type Character, EncounterType, type Monster } from '../utils/types';
import { HealthBar } from './HealthBar';
import { InfoModal } from './InfoModal';
import { ShopRow } from './ShopRow';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const TileDetailsPanel = (): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    isOpen: isSafetyZoneInfoModalOpen,
    onClose: onCloseSafetyZoneInfoModal,
    onOpen: onOpenSafetyZoneInfoModal,
  } = useDisclosure();

  const {
    delegatorAddress,
    systemCalls: { createEncounter },
  } = useMUD();
  const { character } = useCharacter();
  const {
    inSafetyZone,
    isSpawned,
    monstersOnTile,
    otherCharactersOnTile,
    shopsOnTile,
  } = useMap();
  const {
    attackOutcomes,
    currentBattle,
    opponent,
    userCharacterForBattleRendering,
  } = useBattle();
  const { isRefreshing } = useMovement();

  const [isInitiating, setIsInitiating] = useState(false);
  const [isUserHit, setIsUserHit] = useState(false);
  const [isMonsterHit, setIsMonsterHit] = useState(false);

  useEffect(() => {
    if (!(attackOutcomes[0] && currentBattle && opponent)) return;

    const attackIndex = attackOutcomes.findLastIndex(
      attack => attack.attackerId === opponent.id,
    );

    if (attackIndex === -1) return;

    const currentBattleOpponentTurn = localStorage.getItem(
      CURRENT_BATTLE_OPPONENT_TURN_KEY,
    );

    if (currentBattleOpponentTurn) {
      if (currentBattleOpponentTurn === attackIndex.toString()) {
        return;
      }
    }

    if (
      attackOutcomes[attackIndex]?.attackerDamageDelt !== '0' &&
      attackIndex - Number(currentBattle.currentTurn) <= 2
    ) {
      setIsUserHit(true);
      setTimeout(() => {
        setIsUserHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_OPPONENT_TURN_KEY,
        attackIndex.toString(),
      );
    }
  }, [attackOutcomes, currentBattle, opponent]);

  useEffect(() => {
    if (!(attackOutcomes[0] && character && currentBattle)) return;

    const attackIndex = attackOutcomes.findLastIndex(
      attack => attack.attackerId === character.id,
    );

    if (attackIndex === -1) return;

    const currentBattleDefenderTurn = localStorage.getItem(
      CURRENT_BATTLE_USER_TURN_KEY,
    );

    if (currentBattleDefenderTurn) {
      if (currentBattleDefenderTurn === attackIndex.toString()) {
        return;
      }
    }

    if (
      attackOutcomes[attackIndex]?.attackerDamageDelt !== '0' &&
      attackIndex - Number(currentBattle.currentTurn) <= 2
    ) {
      setIsMonsterHit(true);
      setTimeout(() => {
        setIsMonsterHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_USER_TURN_KEY,
        attackIndex.toString(),
      );
    }
  }, [attackOutcomes, character, currentBattle]);

  const onInitiateCombat = useCallback(
    async (opponent: Character | Monster, encounterType: EncounterType) => {
      try {
        setIsInitiating(true);

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const { error, success } = await createEncounter(
          encounterType,
          [character.id],
          [opponent.id],
        );

        if (error && !success) {
          throw new Error(error);
        }

        renderSuccess('Battle has begun!');
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to initiate battle.', e);
      } finally {
        setIsInitiating(false);
      }
    },
    [character, createEncounter, delegatorAddress, renderError, renderSuccess],
  );

  if (!currentBattle && isRefreshing) {
    return (
      <Flex alignItems="center" h="100%" justifyContent="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  if (!currentBattle && !isSpawned) {
    return (
      <Box>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
          You have not yet spawned to the map.
        </Text>
      </Box>
    );
  }

  if (currentBattle && opponent && userCharacterForBattleRendering) {
    return (
      <VStack mt={4}>
        <style>
          {`
          @keyframes flicker {
            0% { opacity: 1; }
            25% { opacity: 0; }
            50% { opacity: 1; }
            75% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}
        </style>
        <HStack alignItems="start" w="100%">
          {currentBattle.encounterType === EncounterType.PvE ? (
            <VStack w="48%">
              <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
                {isDesktop ? removeEmoji(opponent.name) : opponent.name}
              </Text>
              {isDesktop && (
                <Text
                  animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                  fontSize="68px"
                  opacity={isMonsterHit ? 0 : 1}
                  transition="opacity 0.1s ease-in-out"
                >
                  {getEmoji(opponent.name)}
                </Text>
              )}
            </VStack>
          ) : (
            <Stack
              alignItems="center"
              direction={{ base: 'row', lg: 'column' }}
              justify={{ base: 'center', lg: 'start' }}
              w="48%"
            >
              <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
                {opponent.name}
              </Text>
              <Avatar
                animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                my={{ base: 1, lg: 5 }}
                opacity={isMonsterHit ? 0 : 1}
                size={{ base: '2xs', lg: 'lg' }}
                src={opponent.image}
              />
            </Stack>
          )}
          <VStack mt={{ base: 0, lg: 14 }} w="4%">
            <GiCrossedSwords color="red" size={isDesktop ? 40 : 28} />
          </VStack>
          <Stack
            alignItems="center"
            direction={{ base: 'row', lg: 'column' }}
            justify={{ base: 'center', lg: 'start' }}
            w="48%"
          >
            <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
              {userCharacterForBattleRendering.name}
            </Text>
            <Avatar
              animation={isUserHit ? 'flicker .7s infinite' : 'none'}
              my={{ base: 1, lg: 5 }}
              opacity={isUserHit ? 0 : 1}
              size={{ base: '2xs', lg: 'lg' }}
              src={userCharacterForBattleRendering.image}
            />
          </Stack>
        </HStack>
        <HStack alignItems="start" w="100%">
          <VStack spacing={{ base: 0, lg: 2 }} w="48%">
            <HealthBar
              maxHp={opponent.maxHp}
              currentHp={opponent.currentHp}
              level={opponent.level}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Agility: {opponent.agility}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Intelligence: {opponent.intelligence}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Strength: {opponent.strength}
              </Text>
            </VStack>
          </VStack>
          <VStack spacing={{ base: 0, lg: 2 }} w="48%">
            <HealthBar
              maxHp={userCharacterForBattleRendering.maxHp}
              currentHp={userCharacterForBattleRendering.currentHp}
              level={userCharacterForBattleRendering.level}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Agility: {userCharacterForBattleRendering.agility}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Intelligence: {userCharacterForBattleRendering.intelligence}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Strength: {userCharacterForBattleRendering.strength}
              </Text>
            </VStack>
          </VStack>
        </HStack>
      </VStack>
    );
  }

  if (isInitiating) {
    return (
      <Box h="100%">
        <VStack h="100%" justifyContent="center" spacing={8}>
          <Text fontWeight="bold" size={{ base: 'md', lg: 'xl' }}>
            Initiating battle!
          </Text>
          <Spinner color="red" size="xl" />
        </VStack>
      </Box>
    );
  }

  return (
    <Box>
      <Grid gap={5} templateColumns="repeat(4, 1fr)">
        {shopsOnTile.length > 0 && (
          <>
            <GridItem colSpan={2}>
              <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
                Shops
              </Text>
            </GridItem>
            <GridItem colSpan={4}>
              {shopsOnTile.map((_, i) => (
                <ShopRow key={`tile-shop-${i}`} />
              ))}
            </GridItem>
          </>
        )}
        <GridItem colSpan={2}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Monsters
          </Text>
        </GridItem>
        <GridItem colSpan={2}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Players
            <Text as="span" size="sm">
              {' '}
              {inSafetyZone ? '(Safety Zone)' : '(Outer Realms)'}
            </Text>
          </Text>
        </GridItem>
      </Grid>
      <Grid gap={5} mt={1} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          {monstersOnTile.length > 0 &&
            monstersOnTile.map((monster, i) => (
              <OpponentRow
                encounterType={EncounterType.PvE}
                key={`tile-monster-${i}-${monster.name}`}
                onClick={() => {
                  onInitiateCombat(monster, EncounterType.PvE);
                }}
                opponent={monster}
              />
            ))}
          {monstersOnTile.length === 0 && (
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No monsters in this area
            </Text>
          )}
        </GridItem>

        <GridItem colSpan={2}>
          {otherCharactersOnTile.length > 0 &&
            otherCharactersOnTile.map((player, i) => (
              <OpponentRow
                encounterType={EncounterType.PvP}
                key={`tile-player-${i}-${player.name}`}
                onClick={() =>
                  inSafetyZone
                    ? onOpenSafetyZoneInfoModal()
                    : onInitiateCombat(player, EncounterType.PvP)
                }
                opponent={player}
              />
            ))}
          {otherCharactersOnTile.length === 0 && (
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No players in this area
            </Text>
          )}
        </GridItem>
      </Grid>
      <InfoModal
        heading="Cannot Battle in the Safety Zone"
        isOpen={isSafetyZoneInfoModalOpen}
        onClose={onCloseSafetyZoneInfoModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text mt={4}>
            You are currently in the{' '}
            <Text as="span" fontWeight={700}>
              Safety Zone
            </Text>
            .
          </Text>
          <Text textAlign="center">
            In order to battle other players, you must enter the{' '}
            <Text as="span" fontWeight={700}>
              Outer Realms
            </Text>
            .
          </Text>
        </VStack>
      </InfoModal>
    </Box>
  );
};

const OPPONENT_COLORS = {
  [0]: 'red',
  [1]: 'yellow',
  [2]: 'green',
};

const OpponentRow = ({
  encounterType,
  opponent,
  onClick,
}: {
  encounterType: EncounterType;
  opponent: Character | Monster;
  onClick: () => void;
}) => {
  const { inBattle, level, name } = opponent;

  return (
    <HStack
      as="button"
      border="1px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      onClick={inBattle ? undefined : onClick}
      px={{ base: 1, sm: 2, md: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={{
        bg: inBattle ? 'transparent' : 'grey300',
        border: '1px solid',
        cursor: inBattle ? 'not-allowed' : 'pointer',
      }}
      _hover={{
        border: '1px solid',
        cursor: inBattle ? 'not-allowed' : 'pointer',
      }}
    >
      <HStack justifyContent="start" spacing={4}>
        <Text
          color={OPPONENT_COLORS[opponent.entityClass]}
          filter={inBattle ? 'grayscale(100%)' : 'none'}
          size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
        >
          {name}
        </Text>
        {encounterType === EncounterType.PvP && (
          <Avatar size="xs" src={opponent.image} />
        )}
      </HStack>
      {!inBattle && (
        <Text
          fontWeight="bold"
          size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
        >
          Level {level}
        </Text>
      )}
      {inBattle && (
        <Text color="red" fontWeight="bold" size={{ base: '3xs', sm: '2xs' }}>
          (In battle...)
        </Text>
      )}
    </HStack>
  );
};
