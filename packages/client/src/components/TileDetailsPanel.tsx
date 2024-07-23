import {
  Avatar,
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  Spinner,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { GiCrossedSwords } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useCombat } from '../contexts/CombatContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { type Character, EncounterType, type Monster } from '../utils/types';
import { HealthBar } from './HealthBar';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const TileDetailsPanel = (): JSX.Element => {
  const { renderError, renderSuccess } = useToast();

  const {
    delegatorAddress,
    systemCalls: { createMatch },
  } = useMUD();
  const { character } = useCharacter();
  const { isRefreshing, monsters, otherPlayers } = useMapNavigation();
  const { currentBattle, monsterOponent } = useCombat();

  const [isInitiating, setIsInitiating] = useState(false);

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

        const { error, success } = await createMatch(
          EncounterType.PvE,
          [character.characterId],
          [monster.monsterId],
        );

        if (error && !success) {
          throw new Error(error);
        }

        renderSuccess('Battle has begun!');
      } catch (e) {
        renderError('Failed to initiate battle.', e);
      } finally {
        setIsInitiating(false);
      }
    },
    [character, createMatch, delegatorAddress, renderError, renderSuccess],
  );

  if (isRefreshing) {
    return (
      <Flex alignItems="center" h="100%" justifyContent="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  if (character && currentBattle && monsterOponent) {
    return (
      <VStack mt={4}>
        <HStack alignItems="start" w="100%">
          <VStack w="48%">
            <Text fontWeight="bold" size="lg">
              {monsterOponent.name.slice(0, -3)}
            </Text>
            <Text fontSize="68px">{monsterOponent.name.slice(-3)}</Text>
          </VStack>
          <VStack mt={8}>
            <GiCrossedSwords color="red" size={40} />
          </VStack>
          <VStack w="48%">
            <Text fontWeight="bold" size="lg">
              {character.name}
            </Text>
            <Avatar my={5} size="lg" src={character.image} />
          </VStack>
        </HStack>
        <HStack alignItems="start" w="100%">
          <VStack w="48%">
            <HealthBar
              baseHp={monsterOponent.baseHp}
              currentHp={monsterOponent.currentHp}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text fontSize="sm">Agility: {monsterOponent.agility}</Text>
              <Text fontSize="sm">
                Intelligence: {monsterOponent.intelligence}
              </Text>
              <Text fontSize="sm">Strength: {monsterOponent.strength}</Text>
            </VStack>
          </VStack>
          <VStack w="48%">
            <HealthBar
              baseHp={character.baseHp}
              currentHp={character.currentHp}
              w="90%"
            />
            <VStack alignItems="start" px={4}>
              <Text fontSize="sm">Agility: {character.agility}</Text>
              <Text fontSize="sm">Intelligence: {character.intelligence}</Text>
              <Text fontSize="sm">Strength: {character.strength}</Text>
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
          <Text fontWeight="bold" size="xl">
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
        {otherPlayers.length > 0 && (
          <GridItem colSpan={1}>
            <Text mt={1} size={{ base: '2xs', lg: 'sm' }}>
              Safe Zone
            </Text>
          </GridItem>
        )}
      </Grid>
      <Grid gap={5} mt={1} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          {monsters.length > 0 &&
            monsters.map((monster, i) => (
              <MonsterRow
                key={`tile-monster-${i}-${monster.name}`}
                monster={monster}
                onClick={() => {
                  onInitiateCombat(monster);
                }}
              />
            ))}
          {monsters.length === 0 && (
            <Text size={{ base: '2xs', lg: 'sm' }}>
              No monsters in this area
            </Text>
          )}
        </GridItem>

        {otherPlayers.length > 0 && (
          <>
            <GridItem colSpan={1}>
              {otherPlayers.length > 0 &&
                otherPlayers.map((player, i) => (
                  <PlayerRow
                    key={`tile-player-${i}-${player.name}`}
                    player={player}
                  />
                ))}
            </GridItem>
            <GridItem colSpan={1}>
              {otherPlayers.map((player, i) => (
                <PlayerLevelRow
                  key={`tile-player-level-${i}-${player.name}`}
                  player={player}
                />
              ))}
            </GridItem>
          </>
        )}
        {otherPlayers.length === 0 && (
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
