import { Button, HStack, Text, VStack } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { type Character } from '../utils/types';

export const LevelingPanel = ({
  canLevel,
  character,
}: {
  canLevel: boolean;
  character: Character;
}): JSX.Element => {
  const { renderError, renderSuccess, renderWarning } = useToast();
  const {
    delegatorAddress,
    systemCalls: { levelCharacter },
  } = useMUD();
  const { refreshCharacter } = useCharacter();

  const [abilityPoints, setAbilityPoints] = useState(0);
  const [newAgility, setNewAgility] = useState(character.agility);
  const [newIntelligence, setNewIntelligence] = useState(
    character.intelligence,
  );
  const [newStrength, setNewStrength] = useState(character.strength);

  const [isLeveling, setIsLeveling] = useState(false);

  useEffect(() => {
    if (canLevel) {
      setAbilityPoints(2);
    } else {
      setAbilityPoints(0);
    }
    setNewAgility(character.agility);
    setNewIntelligence(character.intelligence);
    setNewStrength(character.strength);
  }, [canLevel, character.agility, character.intelligence, character.strength]);

  const strengthIncreased = useMemo(
    () => BigInt(newStrength) > BigInt(character.strength),
    [newStrength, character.strength],
  );

  const agilityIncreased = useMemo(
    () => BigInt(newAgility) > BigInt(character.agility),
    [newAgility, character.agility],
  );

  const intelligenceIncreased = useMemo(
    () => BigInt(newIntelligence) > BigInt(character.intelligence),
    [newIntelligence, character.intelligence],
  );

  const onDecrementStat = useCallback(
    (stat: 'str' | 'agi' | 'int') => {
      if (isLeveling) return;

      let replenishAbilityPoint = false;

      switch (stat) {
        case 'str':
          if (newStrength === character.strength) return;
          if (strengthIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewStrength(prev => (BigInt(prev) - BigInt(1)).toString());
          break;
        case 'agi':
          if (newAgility === character.agility) return;
          if (agilityIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewAgility(prev => (BigInt(prev) - BigInt(1)).toString());
          break;
        case 'int':
          if (newIntelligence === character.intelligence) return;
          if (intelligenceIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewIntelligence(prev => (BigInt(prev) - BigInt(1)).toString());
          break;
        default:
      }

      if (replenishAbilityPoint) {
        setAbilityPoints(prev => prev + 1);
      } else {
        setAbilityPoints(prev => prev - 1);
      }
    },
    [
      abilityPoints,
      agilityIncreased,
      character.agility,
      character.intelligence,
      character.strength,
      intelligenceIncreased,
      isLeveling,
      newAgility,
      newIntelligence,
      newStrength,
      renderWarning,
      strengthIncreased,
    ],
  );

  const onIncrementStat = useCallback(
    (stat: 'str' | 'agi' | 'int') => {
      if (isLeveling) return;
      if (abilityPoints <= 0) {
        renderWarning('You do not have enough ability points.');
        return;
      }

      switch (stat) {
        case 'str':
          setNewStrength(prev => (BigInt(prev) + BigInt(1)).toString());
          break;
        case 'agi':
          setNewAgility(prev => (BigInt(prev) + BigInt(1)).toString());
          break;
        case 'int':
          setNewIntelligence(prev => (BigInt(prev) + BigInt(1)).toString());
          break;
        default:
      }

      setAbilityPoints(prev => prev - 1);
    },
    [abilityPoints, isLeveling, renderWarning],
  );

  const onLevelCharacter = useCallback(async () => {
    try {
      setIsLeveling(true);
      if (abilityPoints > 0) {
        renderWarning('You have unused ability points');
        return;
      }
      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const newStats = {
        agility: newAgility,
        baseHp: character.baseHp,
        currentHp: character.currentHp,
        class: character.entityClass,
        experience: character.experience,
        intelligence: newIntelligence,
        level: character.level,
        strength: newStrength,
      };

      const { error, success } = await levelCharacter(character.id, newStats);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess('Character leveled up!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to unequip item.', e);
    } finally {
      setIsLeveling(false);
    }
  }, [
    abilityPoints,
    character,
    delegatorAddress,
    levelCharacter,
    newAgility,
    newIntelligence,
    newStrength,
    refreshCharacter,
    renderError,
    renderSuccess,
    renderWarning,
  ]);

  const currentHpWithFloor =
    parseInt(character.currentHp) < 0 ? 0 : parseInt(character.currentHp);

  return (
    <VStack>
      <HStack justify="space-between" w="100%">
        <Text alignSelf="start" fontWeight="bold">
          My Stats
        </Text>
        <Text alignSelf="start" fontWeight="bold">
          Ability Points: {abilityPoints}
        </Text>
      </HStack>
      <Text alignSelf="end" mt={4} size="xs">
        Base
      </Text>
      <VStack w="100%">
        <HStack justify="space-between" w="100%">
          <Text>HP - Hit Points</Text>
          <Text>
            {currentHpWithFloor}/{character.baseHp}
          </Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text>STR - Strength</Text>
          <HStack>
            {strengthIncreased && (
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('str')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            )}
            <Text
              color={strengthIncreased ? 'green' : 'black'}
              fontWeight={strengthIncreased ? 'bold' : 'normal'}
            >
              {newStrength}
            </Text>
            {canLevel && (
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('str')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            )}
          </HStack>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text>AGI - Agility</Text>
          <HStack>
            {agilityIncreased && (
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('agi')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            )}
            <Text
              color={agilityIncreased ? 'green' : 'black'}
              fontWeight={agilityIncreased ? 'bold' : 'normal'}
            >
              {newAgility}
            </Text>
            {canLevel && (
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('agi')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            )}
          </HStack>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text>INT - Intelligence</Text>
          <HStack>
            {intelligenceIncreased && (
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('int')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            )}
            <Text
              color={intelligenceIncreased ? 'green' : 'black'}
              fontWeight={intelligenceIncreased ? 'bold' : 'normal'}
            >
              {newIntelligence}
            </Text>
            {canLevel && (
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('int')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            )}
          </HStack>
        </HStack>
      </VStack>
      {canLevel && (
        <Button
          isLoading={isLeveling}
          mt={8}
          onClick={onLevelCharacter}
          size="sm"
          variant="gold"
        >
          Level Up!
        </Button>
      )}
    </VStack>
  );
};
