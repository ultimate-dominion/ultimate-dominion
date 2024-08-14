import {
  Box,
  Button,
  Divider,
  HStack,
  Progress,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { EncounterType } from '../utils/types';

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

  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(32);

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

  const userTurn = useMemo(() => {
    if (!(character && currentBattle)) return false;

    if (currentBattle.encounterType === EncounterType.PvE) {
      return true;
    }

    const attackersTurn = Number(currentBattle.currentTurn) % 2 === 1;

    if (attackersTurn && currentBattle.attackers.includes(character?.id)) {
      return true;
    }

    if (!attackersTurn && currentBattle.defenders.includes(character?.id)) {
      return true;
    }

    return false;
  }, [character, currentBattle]);

  const turnEndTime = useMemo(() => {
    if (!currentBattle) return 0;

    const _turnEndTime =
      (BigInt(currentBattle.currentTurnTimer) + BigInt(32)) * BigInt(1000);

    return Number(_turnEndTime);
  }, [currentBattle]);

  useEffect(() => {
    if (turnEndTime - Date.now() < 0) {
      setTurnTimeLeft(0);
    } else {
      setTurnTimeLeft(Math.floor((turnEndTime - Date.now()) / 1000));
    }

    const interval = setInterval(() => {
      if (turnEndTime - Date.now() < 0) {
        setTurnTimeLeft(0);
        return;
      }
      setTurnTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [turnEndTime, turnTimeLeft]);

  const canAttack = useMemo(() => {
    if (!currentBattle) return false;

    if (currentBattle.encounterType === EncounterType.PvE) {
      return true;
    }

    if (userTurn) {
      return true;
    }

    if (turnTimeLeft === 0) {
      return true;
    }

    return false;
  }, [currentBattle, userTurn, turnTimeLeft]);

  return (
    <Box maxH="100%" overflowY="auto" pb={4} ref={parentDivRef}>
      {!battleOver && currentBattle && equippedWeapons && opponent && (
        <VStack bgColor="white" position="sticky" spacing={0} top={0} w="100%">
          {userTurn && (
            <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
              <Text as="span" fontWeight="bold">
                Choose your move!
              </Text>{' '}
              You have {turnTimeLeft} seconds before your opponent can attack.
            </Text>
          )}
          {!userTurn && !canAttack && (
            <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
              It is your opponent&apos;s turn. But you can attack in{' '}
              {turnTimeLeft} seconds.
            </Text>
          )}
          {!userTurn && canAttack && (
            <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
              Your opponent took too long to make a move.{' '}
              <Text as="span" fontWeight={700}>
                You can now attack!
              </Text>
            </Text>
          )}
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
          <HStack position="relative" spacing={0} w="100%">
            <Progress
              position="absolute"
              size="xs"
              top={-1}
              value={(turnTimeLeft / 32) * 100}
              variant="timer"
              w="100%"
            />
            {equippedWeapons.map((item, index) => (
              <Button
                borderLeft={index === 0 ? 'none' : '2px'}
                borderRadius={0}
                borderRight={
                  index === 0 || index === equippedWeapons.length - 1
                    ? 'none'
                    : '2px'
                }
                isDisabled={attackingItemId !== null || !canAttack}
                isLoading={attackingItemId === item.tokenId}
                key={`equipped-item-${index}`}
                loadingText="Attacking..."
                onClick={() =>
                  onAttack(
                    item.tokenId,
                    userTurn
                      ? currentBattle.currentTurn
                      : (
                          BigInt(currentBattle.currentTurn) + BigInt(1)
                        ).toString(),
                  )
                }
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
