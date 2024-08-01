import { Button, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { useCharacter } from '../contexts/CharacterContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';

// enum ActionEvents {
//   Attack = 'attack',
//   Defend = 'defend against',
//   GainGold = 'gold',
//   GainExperience = 'experience',
// }

// type BattleEvent = {
//   type: ActionEvents;
//   monster: string;
//   amount: number;
// };

// type ResolutionEvent = {
//   type: ActionEvents;
//   amount: number;
// };

// const BATTLE_EVENTS: BattleEvent[] = [
//   {
//     type: ActionEvents.Defend,
//     amount: 1,
//     monster: 'Green Slime',
//   },
//   {
//     type: ActionEvents.Attack,
//     amount: 2,
//     monster: 'Green Slime',
//   },
// ];

// const RESOLUTION_EVENTS: ResolutionEvent[] = [
//   {
//     type: ActionEvents.GainGold,
//     amount: 2,
//   },
//   {
//     type: ActionEvents.GainExperience,
//     amount: 3,
//   },
// ];

export const ActionsPanel = (): JSX.Element => {
  const {
    isRefreshing: isRefreshingCharacter,
    character,
    equippedItems,
  } = useCharacter();
  const {
    actionOutcomes,
    aliveMonsters,
    currentBattle,
    isAttacking,
    isRefreshing: isRefreshingMap,
    isSpawned,
    monsterOponent,
    onAttack,
    position,
  } = useMapNavigation();

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

    if ((position.x !== 0 || position.y !== 0) && aliveMonsters.length === 0) {
      return (
        <Typist
          avgTypingDelay={10}
          cursor={{ show: false }}
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

    if ((position.x !== 0 || position.y !== 0) && aliveMonsters.length > 0) {
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
    aliveMonsters,
    isRefreshingCharacter,
    isRefreshingMap,
    isSpawned,
    position,
  ]);

  return (
    <>
      {currentBattle && equippedItems && monsterOponent && (
        <VStack bgColor="white" position="sticky" spacing={0} top={0} w="100%">
          <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
            Choose your move:
          </Text>
          {equippedItems.length === 0 && (
            <Text color="red" fontWeight={700}>
              You have no equipped items. In order to attack, you must go to
              your{' '}
              <Text
                as={Link}
                color="green"
                to={`/characters/${character?.characterId}`}
                _hover={{ textDecoration: 'underline' }}
              >
                character page
              </Text>{' '}
              and equip at least 1 item.
            </Text>
          )}
          <HStack w="100%">
            {equippedItems.map((item, index) => (
              <Button
                borderLeft={index === 0 ? 'none' : '1px'}
                borderRadius={0}
                borderRight={
                  index === equippedItems.length - 1 ? 'none' : '1px'
                }
                isLoading={isAttacking}
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

        {monsterOponent &&
          actionOutcomes.map((action, i) => {
            if (action.miss) {
              return (
                <Typist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  key={`battle-action-${i}`}
                  stdTypingDelay={10}
                >
                  <Text
                    key={`battle-action-${i}`}
                    size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                  >
                    You missed{' '}
                    <Text as="span" color="green">
                      {monsterOponent.name}
                    </Text>
                    .
                  </Text>
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
                <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                  {critText}You attacked{' '}
                  <Text as="span" color="green">
                    {monsterOponent?.name}
                  </Text>{' '}
                  for{' '}
                  <Text as="span" color="red">
                    {action.attackerDamageDelt}
                  </Text>{' '}
                  damage.
                </Text>
              </Typist>
            );
          })}
      </Stack>
      {/* <Stack>
        {BATTLE_EVENTS.map((event, i) => (
          <Text
            key={`battle-event-${i}`}
            size={{ base: 'xs', sm: 'sm', lg: 'md' }}
          >
            You {event.type}{' '}
            <Text as="span" color="green">
              {event.monster}
            </Text>{' '}
            {event.type === ActionEvents.Attack ? 'for' : 'taking'}{' '}
            <Text as="span" color="red">
              {event.amount} damage
            </Text>
            .
          </Text>
        ))}
      </Stack>
      <Stack>
        {RESOLUTION_EVENTS.map((event, i) => (
          <Text
            key={`resolution-event-${i}`}
            size={{ base: 'xs', sm: 'sm', lg: 'md' }}
          >
            You gain {event.amount}{' '}
            <Text
              as="span"
              color={event.type === ActionEvents.GainGold ? 'yellow' : 'green'}
            >
              {event.type === ActionEvents.GainGold ? '$GOLD' : 'experience'}
            </Text>
            !
          </Text>
        ))}
      </Stack> */}
    </>
  );
};
