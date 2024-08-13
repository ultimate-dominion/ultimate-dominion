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
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { GiCrossedSwords } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  CURRENT_BATTLE_MONSTER_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { type Character, EncounterType, type Monster } from '../utils/types';
import { HealthBar } from './HealthBar';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const TileDetailsPanel = (): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const {
    delegatorAddress,
    systemCalls: { createEncounter },
  } = useMUD();
  const { character } = useCharacter();
  const { aliveMonsters, isSpawned, otherCharactersOnTile } = useMap();
  const { actionOutcomes, currentBattle, monsterOponent } = useBattle();
  const { isRefreshing } = useMovement();

  const [isInitiating, setIsInitiating] = useState(false);
  const [isUserHit, setIsUserHit] = useState(false);
  const [isMonsterHit, setIsMonsterHit] = useState(false);

  useEffect(() => {
    if (!(actionOutcomes[0] && currentBattle)) return;

    const currentBattleMonsterTurn = localStorage.getItem(
      CURRENT_BATTLE_MONSTER_TURN_KEY,
    );

    if (currentBattleMonsterTurn) {
      if (currentBattleMonsterTurn === currentBattle.currentTurn) {
        return;
      }
    }

    if (actionOutcomes[actionOutcomes.length - 1]?.attackerDamageDelt !== '0') {
      setIsUserHit(true);
      setTimeout(() => {
        setIsUserHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_MONSTER_TURN_KEY,
        currentBattle.currentTurn,
      );
    }
  }, [actionOutcomes, currentBattle]);

  useEffect(() => {
    if (!(actionOutcomes[0] && currentBattle)) return;

    const currentBattleDefenderTurn = localStorage.getItem(
      CURRENT_BATTLE_USER_TURN_KEY,
    );

    if (currentBattleDefenderTurn) {
      if (currentBattleDefenderTurn === currentBattle.currentTurn) {
        return;
      }
    }

    if (actionOutcomes[actionOutcomes.length - 2]?.attackerDamageDelt !== '0') {
      setIsMonsterHit(true);
      setTimeout(() => {
        setIsMonsterHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_USER_TURN_KEY,
        currentBattle.currentTurn,
      );
    }
  }, [actionOutcomes, currentBattle]);

  const onInitiateCombat = useCallback(
    async (monster: Monster) => {
      try {
        setIsInitiating(true);

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const { error, success } = await createEncounter(
          EncounterType.PvE,
          [character.characterId],
          [monster.monsterId],
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

  if (character && currentBattle && monsterOponent) {
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
          <VStack w="48%">
            <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
              {isDesktop
                ? monsterOponent.name.slice(0, -3)
                : monsterOponent.name}
            </Text>
            {isDesktop && (
              <Text
                animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                fontSize="68px"
                opacity={isMonsterHit ? 0 : 1}
                transition="opacity 0.1s ease-in-out"
              >
                {monsterOponent.name.slice(-3)}
              </Text>
            )}
          </VStack>
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
              {character.name}
            </Text>
            <Avatar
              animation={isUserHit ? 'flicker .7s infinite' : 'none'}
              my={{ base: 1, lg: 5 }}
              opacity={isUserHit ? 0 : 1}
              size={{ base: '2xs', lg: 'lg' }}
              src={character.image}
            />
          </Stack>
        </HStack>
        <HStack alignItems="start" w="100%">
          <VStack spacing={{ base: 0, lg: 2 }} w="48%">
            <HealthBar
              baseHp={monsterOponent.baseHp}
              currentHp={monsterOponent.currentHp}
              level={monsterOponent.level}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Agility: {monsterOponent.agility}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Intelligence: {monsterOponent.intelligence}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Strength: {monsterOponent.strength}
              </Text>
            </VStack>
          </VStack>
          <VStack spacing={{ base: 0, lg: 2 }} w="48%">
            <HealthBar
              baseHp={character.baseHp}
              currentHp={character.currentHp}
              level={character.level}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Agility: {character.agility}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Intelligence: {character.intelligence}
              </Text>
              <Text size={{ base: '2xs', lg: 'sm' }}>
                Strength: {character.strength}
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
        <GridItem colSpan={2}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Monsters
          </Text>
        </GridItem>
        <GridItem colSpan={1}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Players
          </Text>
        </GridItem>
        {otherCharactersOnTile.length > 0 && (
          <GridItem colSpan={1}>
            <Text mt={1} size={{ base: '2xs', lg: 'sm' }}>
              Safe Zone
            </Text>
          </GridItem>
        )}
      </Grid>
      <Grid gap={5} mt={1} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          {aliveMonsters.length > 0 &&
            aliveMonsters.map((monster, i) => (
              <MonsterRow
                key={`tile-monster-${i}-${monster.name}`}
                monster={monster}
                onClick={() => {
                  onInitiateCombat(monster);
                }}
              />
            ))}
          {aliveMonsters.length === 0 && (
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No monsters in this area
            </Text>
          )}
        </GridItem>

        {otherCharactersOnTile.length > 0 && (
          <>
            <GridItem colSpan={1}>
              {otherCharactersOnTile.length > 0 &&
                otherCharactersOnTile.map((c, i) => (
                  <PlayerRow key={`tile-player-${i}-${c.name}`} player={c} />
                ))}
            </GridItem>
            <GridItem colSpan={1}>
              {otherCharactersOnTile.map((c, i) => (
                <PlayerLevelRow
                  key={`tile-player-level-${i}-${c.name}`}
                  player={c}
                />
              ))}
            </GridItem>
          </>
        )}
        {otherCharactersOnTile.length === 0 && (
          <GridItem colSpan={2}>
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No players in this area
            </Text>
          </GridItem>
        )}
      </Grid>
    </Box>
  );
};

const MONSTER_COLORS = {
  [0]: 'red',
  [1]: 'yellow',
  [2]: 'green',
};

const MonsterRow = ({
  monster,
  onClick,
}: {
  monster: Monster;
  onClick: () => void;
}) => {
  const { inBattle, level, name } = monster;

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
      <Text
        color={MONSTER_COLORS[monster.entityClass]}
        filter={inBattle ? 'grayscale(100%)' : 'none'}
        size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
      >
        {name}
      </Text>
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

const PlayerRow = ({ player }: { player: Character }) => {
  const { name } = player;

  return (
    <HStack h={ROW_HEIGHT} justifyContent="start" spacing={4}>
      <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>{name}</Text>
      <Avatar size="xs" src={player.image} />
    </HStack>
  );
};

const PlayerLevelRow = ({ player }: { player: Character }) => {
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <HStack
      h={ROW_HEIGHT}
      onClick={() => navigate(`/characters/${player.characterId}`)}
    >
      <Flex
        alignItems="center"
        as="button"
        borderBottom="1px solid transparent"
        fontWeight="bold"
        gap={2}
        _hover={{ borderBottom: '1px solid', cursor: 'pointer' }}
      >
        <Text size={{ base: '4xs', sm: '3xs', md: 'xs', lg: 'sm' }}>
          Level {player.level}
        </Text>
        <IoIosArrowForward size={isMobile ? 10 : 20} />
      </Flex>
    </HStack>
  );
};
