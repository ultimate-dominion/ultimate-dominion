import { Button, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { Has, HasValue, runQuery } from '@latticexyz/recs';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useCombat } from '../contexts/CombatContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ActionType } from '../utils/types';
import { HealthBar } from './HealthBar';

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
    components: { Actions },
    delegatorAddress,
    systemCalls: { endTurn },
  } = useMUD();
  const { character, equippedItems, refreshCharacter } = useCharacter();
  const { currentBattle, monster } = useCombat();
  const { isSpawned } = useMapNavigation();

  const [isAttacking, setIsAttacking] = useState(false);

  const actionText = useMemo(() => {
    if (!isSpawned) {
      return 'You must spawn on the map to start battling.';
    }

    if (currentBattle && monster) {
      return `You are currently in a battle with a ${monster.name}.`;
    }

    return 'To initiate a battle, move into a new tile and click on a monster.';
  }, [currentBattle, isSpawned, monster]);

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

        if (!monster) {
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
          monster.monsterId,
          basicAttackId,
          itemId,
          currentBattle.currentTurn,
        );

        if (error && !success) {
          throw new Error(error);
        }

        await refreshCharacter();
      } catch (e) {
        renderError('Failed to attack.', e);
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
      monster,
      refreshCharacter,
      renderError,
    ],
  );

  return (
    <Stack spacing={8}>
      <Stack>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>{actionText}</Text>
        {currentBattle && equippedItems && monster && (
          <HealthBar
            baseHp={monster.baseHp}
            currentHp={monster.currentHp}
            mt={4}
            w="80%"
          />
        )}
        {currentBattle && equippedItems && monster && (
          <HStack justify="center">
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
            {equippedItems.map((item, index) => (
              <Button
                key={`equipped-item-${index}`}
                isLoading={isAttacking}
                loadingText="Attacking..."
                mt={8}
                onClick={() => onAttack(item.tokenId)}
              >
                Attack with {item.name}
              </Button>
            ))}
          </HStack>
        )}
        {currentBattle && equippedItems && monster && (
          <VStack mt={4}>
            <Text fontWeight={700}>MONSTER STATS:</Text>
            <HStack>
              <Text>Attack: {monster.agility}</Text>
              <Text>Defense: {monster.intelligence}</Text>
              <Text>Level: {monster.level}</Text>
            </HStack>
          </VStack>
        )}
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
    </Stack>
  );
};
