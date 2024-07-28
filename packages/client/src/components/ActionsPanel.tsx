import { Button, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import {
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';
import { formatUnits } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useCombat } from '../contexts/CombatContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ActionType, type BattleActionOutcome } from '../utils/types';

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
  const { renderError } = useToast();
  const {
    components: { ActionOutcome, Actions },
    delegatorAddress,
    systemCalls: { endTurn },
  } = useMUD();
  const {
    isRefreshing: isRefreshingCharacter,
    character,
    equippedItems,
    refreshCharacter,
  } = useCharacter();
  const {
    isRefreshing: isRefreshingMap,
    isSpawned,
    monsters,
    position,
  } = useMapNavigation();
  const { currentBattle, monsterOponent } = useCombat();

  const [isAttacking, setIsAttacking] = useState(false);

  const battleActionOutcomes = useEntityQuery([
    Has(ActionOutcome),
    HasValue(ActionOutcome, { attackerId: character?.characterId }),
  ])
    .map(entity => {
      const _actionOutcome = getComponentValueStrict(ActionOutcome, entity);

      const { encounterId, currentTurn, actionNumber } = decodeEntity(
        {
          encounterId: 'bytes32',
          currentTurn: 'uint256',
          actionNumber: 'uint256',
        },
        entity,
      );

      return {
        attackerDamageDelt: formatUnits(
          _actionOutcome.attackerDamageDelt,
          5,
        ).toString(),
        attackerDied: _actionOutcome.attackerDied,
        attackerId: _actionOutcome.attackerId.toString(),
        actionId: _actionOutcome.actionId.toString(),
        actionNumber: actionNumber.toString(),
        blockNumber: _actionOutcome.blockNumber.toString(),
        crit: _actionOutcome.crit,
        currentTurn: currentTurn.toString(),
        defenderDamageDelt: _actionOutcome.defenderDamageDelt.toString(),
        defenderDied: _actionOutcome.defenderDied,
        defenderId: _actionOutcome.defenderId.toString(),
        encounterId: encounterId.toString(),
        hit: _actionOutcome.hit,
        miss: _actionOutcome.miss,
        timestamp: _actionOutcome.timestamp.toString(),
        weaponId: _actionOutcome.weaponId.toString(),
      } as BattleActionOutcome;
    })
    .filter(action => action.encounterId === currentBattle?.encounterId);

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

    if ((position.x !== 0 || position.y !== 0) && monsters.length === 0) {
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

    if ((position.x !== 0 || position.y !== 0) && monsters.length > 0) {
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
  }, [isRefreshingCharacter, isRefreshingMap, isSpawned, monsters, position]);

  const onAttack = useCallback(
    async (itemId: string) => {
      try {
        setIsAttacking(true);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!currentBattle) {
          throw new Error('Battle not found.');
        }

        if (!monsterOponent) {
          throw new Error('Monster not found.');
        }

        const basicAttackId = Array.from(
          runQuery([
            Has(Actions),
            HasValue(Actions, { actionType: ActionType.PhysicalAttack }),
          ]),
        )[0];

        if (!basicAttackId) {
          throw new Error('Basic attack not found.');
        }

        const { error, success } = await endTurn(
          currentBattle.encounterId,
          character.characterId,
          monsterOponent.monsterId,
          basicAttackId,
          itemId,
          currentBattle.currentTurn,
        );

        if (error && !success) {
          throw new Error(error);
        }

        await refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to attack.', e);
      } finally {
        setIsAttacking(false);
      }
    },
    [
      Actions,
      character,
      currentBattle,
      delegatorAddress,
      endTurn,
      monsterOponent,
      refreshCharacter,
      renderError,
    ],
  );

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
          battleActionOutcomes.map((action, i) => {
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
