import {
  Box,
  Button,
  Divider,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';

export const ActionsPanel = (): JSX.Element => {
  const {
    isRefreshing: isRefreshingCharacter,
    character,
    equippedWeapons,
  } = useCharacter();
  const { isSpawned, monstersOnTile, position } = useMap();
  const {
    actionOutcomes,
    attackingItemId,
    currentBattle,
    lastestBattleOutcome,
    onAttack,
    onContinueToBattleOutcome,
    opponent,
  } = useBattle();
  const { isRefreshing: isRefreshingMap } = useMovement();

  const parentDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (parentDivRef.current) {
      parentDivRef.current.scrollTo({
        behavior: 'smooth',
        top: parentDivRef.current.scrollHeight,
      });
    }
  }, [actionOutcomes]);

  const battleOver = useMemo(
    () => currentBattle?.encounterId === lastestBattleOutcome?.encounterId,
    [currentBattle, lastestBattleOutcome],
  );

  const actionText = useMemo(() => {
    if (isRefreshingCharacter || isRefreshingMap) return '';

    if (!(isSpawned && position)) {
      return (
        <Typist
          avgTypingDelay={10}
          cursor={{ show: false }}
          stdTypingDelay={10}
        >
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
            In order to begin battling, you must{' '}
            <Text as="span" fontWeight={700}>
              spawn
            </Text>{' '}
            your character.
          </Text>
        </Typist>
      );
    }

    if (position.x === 0 && position.y === 0) {
      return (
        <Typist
          avgTypingDelay={10}
          cursor={{ show: false }}
          stdTypingDelay={10}
        >
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
            You are currently in the starting tile.{' '}
            <Text as="span" fontWeight={700}>
              Move to a new tile
            </Text>{' '}
            to find monsters to battle.
          </Text>
        </Typist>
      );
    }

    if ((position.x !== 0 || position.y !== 0) && monstersOnTile.length === 0) {
      return (
        <Typist
          avgTypingDelay={10}
          cursor={{ show: false }}
          startDelay={500}
          stdTypingDelay={10}
        >
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
            Looks like there are no monsters in this tile.{' '}
            <Text as="span" fontWeight={700}>
              Move to a new tile
            </Text>{' '}
            to find monsters to battle.
          </Text>
        </Typist>
      );
    }

    if ((position.x !== 0 || position.y !== 0) && monstersOnTile.length > 0) {
      return (
        <Typist
          avgTypingDelay={10}
          cursor={{ show: false }}
          stdTypingDelay={10}
        >
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
            To initiate a battle,{' '}
            <Text as="span" fontWeight={700}>
              click on a monster
            </Text>
            .
          </Text>
        </Typist>
      );
    }

    return '';
  }, [
    isRefreshingCharacter,
    isRefreshingMap,
    isSpawned,
    monstersOnTile,
    position,
  ]);

  return (
    <Box maxH="100%" overflowY="auto" pb={4} ref={parentDivRef}>
      {!battleOver && currentBattle && equippedWeapons && opponent && (
        <VStack bgColor="white" position="sticky" spacing={0} top={0} w="100%">
          <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
            Choose your move:
          </Text>
          {equippedWeapons.length === 0 && (
            <Text color="red" fontWeight={700} p={{ base: 2, lg: 4 }}>
              You have no equipped items. In order to attack, you must go to
              your{' '}
              <Text
                as={Link}
                color="blue"
                to={`/characters/${character?.id}`}
                _hover={{ textDecoration: 'underline' }}
              >
                character page
              </Text>{' '}
              and equip at least 1 item.
            </Text>
          )}
          <HStack spacing={0} w="100%">
            {equippedWeapons.map((item, index) => (
              <Button
                borderLeft={index === 0 ? 'none' : '2px'}
                borderRadius={0}
                borderRight={
                  index === 0 || index === equippedWeapons.length - 1
                    ? 'none'
                    : '2px'
                }
                isDisabled={attackingItemId !== null}
                isLoading={attackingItemId === item.tokenId}
                key={`equipped-item-${index}`}
                loadingText="Attacking..."
                onClick={() => onAttack(item.tokenId)}
                variant="outline"
                w="100%"
              >
                {item.name}
              </Button>
            ))}
          </HStack>
        </VStack>
      )}
      <Stack p={{ base: 2, lg: 4 }}>
        {!currentBattle && actionText}

        {opponent &&
          actionOutcomes.map((action, i) => {
            if (action.miss) {
              return (
                <Typist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  key={`battle-action-${i}`}
                  stdTypingDelay={10}
                >
                  {action.attackerId === character?.id ? (
                    <Text
                      key={`battle-action-${i}`}
                      size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                    >
                      You missed{' '}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>
                      .
                    </Text>
                  ) : (
                    <Text
                      key={`battle-action-${i}`}
                      size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                    >
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      missed you.
                    </Text>
                  )}
                </Typist>
              );
            }

            const critText = action.crit ? 'Critical hit! ' : '';

            return (
              <Typist
                avgTypingDelay={10}
                cursor={{ show: false }}
                key={`battle-action-${i}`}
                stdTypingDelay={10}
              >
                {action.attackerId === character?.id ? (
                  <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                    {critText}You attacked{' '}
                    <Text as="span" color="green">
                      {opponent?.name}
                    </Text>{' '}
                    for{' '}
                    <Text as="span" color="red">
                      {action.attackerDamageDelt}
                    </Text>{' '}
                    damage.
                  </Text>
                ) : (
                  <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                    {critText}
                    <Text as="span" color="green">
                      {opponent?.name}
                    </Text>{' '}
                    attacked you for{' '}
                    <Text as="span" color="red">
                      {action.attackerDamageDelt}
                    </Text>{' '}
                    damage.
                  </Text>
                )}
              </Typist>
            );
          })}
      </Stack>
      {battleOver && currentBattle && (
        <Stack my={4} spacing={4}>
          <Divider />
          <Typist
            avgTypingDelay={10}
            cursor={{ show: false }}
            stdTypingDelay={10}
          >
            <Text
              fontWeight="bold"
              size={{ base: 'xs', sm: 'sm', lg: 'md' }}
              textAlign="center"
            >
              {lastestBattleOutcome?.winner === character?.id
                ? 'You won!'
                : 'You lost...'}
            </Text>
          </Typist>
          <HStack justifyContent="center">
            <Button
              onClick={() => onContinueToBattleOutcome(true)}
              size="sm"
              variant="outline"
            >
              View Results
            </Button>
          </HStack>
        </Stack>
      )}
    </Box>
  );
};
