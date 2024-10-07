import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { getStatSymbol } from '../utils/helpers';
import { type Character } from '../utils/types';
import { HealthBar } from './HealthBar';

const getStatWithSymbol = (stat: bigint | string): JSX.Element => {
  const statString = BigInt(stat).toString();

  const isNegative = statString.startsWith('-');

  if (isNegative) {
    return (
      <Text
        as="span"
        color="red"
      >{`${getStatSymbol(statString)}${statString}`}</Text>
    );
  }

  if (statString === '0') {
    return <Text as="span">{statString}</Text>;
  }

  return (
    <Text
      as="span"
      color="green"
    >{`${getStatSymbol(statString)}${statString}`}</Text>
  );
};

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
  const [newAgility, setNewAgility] = useState(character.baseStats.agility);
  const [newIntelligence, setNewIntelligence] = useState(
    character.baseStats.intelligence,
  );
  const [newStrength, setNewStrength] = useState(character.baseStats.strength);

  const [isLeveling, setIsLeveling] = useState(false);

  useEffect(() => {
    if (canLevel) {
      setAbilityPoints(2);
    } else {
      setAbilityPoints(0);
    }
    setNewAgility(character.baseStats.agility);
    setNewIntelligence(character.baseStats.intelligence);
    setNewStrength(character.baseStats.strength);
  }, [
    canLevel,
    character.baseStats.agility,
    character.baseStats.intelligence,
    character.baseStats.strength,
  ]);

  const strengthIncreased = useMemo(
    () => BigInt(newStrength) > BigInt(character.baseStats.strength),
    [newStrength, character.baseStats.strength],
  );

  const agilityIncreased = useMemo(
    () => BigInt(newAgility) > BigInt(character.baseStats.agility),
    [newAgility, character.baseStats.agility],
  );

  const intelligenceIncreased = useMemo(
    () => BigInt(newIntelligence) > BigInt(character.baseStats.intelligence),
    [newIntelligence, character.baseStats.intelligence],
  );

  const onDecrementStat = useCallback(
    (stat: 'str' | 'agi' | 'int') => {
      if (isLeveling) return;

      let replenishAbilityPoint = false;

      switch (stat) {
        case 'str':
          if (newStrength === character.baseStats.strength) return;
          if (strengthIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewStrength(prev => prev - BigInt(1));
          break;
        case 'agi':
          if (newAgility === character.baseStats.agility) return;
          if (agilityIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewAgility(prev => prev - BigInt(1));
          break;
        case 'int':
          if (newIntelligence === character.baseStats.intelligence) return;
          if (intelligenceIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning('You do not have enough ability points.');
            return;
          }

          setNewIntelligence(prev => prev - BigInt(1));
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
      character.baseStats.agility,
      character.baseStats.intelligence,
      character.baseStats.strength,
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
          setNewStrength(prev => prev + BigInt(1));
          break;
        case 'agi':
          setNewAgility(prev => prev + BigInt(1));
          break;
        case 'int':
          setNewIntelligence(prev => prev + BigInt(1));
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
        maxHp: character.maxHp,
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
      <HealthBar
        currentHp={character.currentHp}
        maxHp={character.maxHp}
        mt={2}
        level={character.level}
        w="100%"
      />
      <HStack justifyContent="end" mt={4} w="100%">
        <HStack
          justifyContent={canLevel ? 'center' : 'end'}
          textAlign="end"
          w="50%"
        >
          <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
            Base
          </Text>
          {!canLevel && (
            <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
              Bonus
            </Text>
          )}
          {!canLevel && (
            <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
              Total
            </Text>
          )}
        </HStack>
      </HStack>
      <HStack w="100%">
        <Text size={{ base: 'xs', md: 'sm', xl: 'md' }} w="50%">
          STR -{' '}
          <Text as="span" size={{ base: '2xs', sm: 'xs' }}>
            Strength
          </Text>
        </Text>
        <HStack justifyContent="end" textAlign="end" w="50%">
          {strengthIncreased && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('str')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            </Box>
          )}
          <Text
            color={strengthIncreased ? 'green' : 'black'}
            fontWeight={strengthIncreased ? 'bold' : 'normal'}
            size={{ base: 'xs', sm: 'sm' }}
            w="33%"
          >
            {newStrength.toString()}
          </Text>
          {canLevel && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('str')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            </Box>
          )}
          {!canLevel && (
            <Text size={{ base: 'xs', sm: 'sm' }} w="33%">
              {getStatWithSymbol(
                BigInt(character.strength) - BigInt(newStrength),
              )}
            </Text>
          )}
          {!canLevel && (
            <Text fontWeight="600" size={{ base: 'xs', sm: 'sm' }} w="33%">
              {character.strength.toString()}
            </Text>
          )}
        </HStack>
      </HStack>
      <HStack w="100%">
        <Text size={{ base: 'xs', md: 'sm', xl: 'md' }} w="50%">
          AGI -{' '}
          <Text as="span" size={{ base: '2xs', sm: 'xs' }}>
            Agility
          </Text>
        </Text>
        <HStack justifyContent="end" textAlign="end" w="50%">
          {agilityIncreased && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('agi')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            </Box>
          )}
          <Text
            color={agilityIncreased ? 'green' : 'black'}
            fontWeight={agilityIncreased ? 'bold' : 'normal'}
            size={{ base: 'xs', sm: 'sm' }}
            w="33%"
          >
            {newAgility.toString()}
          </Text>
          {canLevel && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('agi')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            </Box>
          )}
          {!canLevel && (
            <Text size={{ base: 'xs', sm: 'sm' }} w="33%">
              {getStatWithSymbol(
                BigInt(character.agility) - BigInt(newAgility),
              )}
            </Text>
          )}
          {!canLevel && (
            <Text fontWeight="600" size={{ base: 'xs', sm: 'sm' }} w="33%">
              {character.agility.toString()}
            </Text>
          )}
        </HStack>
      </HStack>
      <HStack w="100%">
        <Text size={{ base: 'xs', md: 'sm', xl: 'md' }} w="50%">
          INT -{' '}
          <Text as="span" size={{ base: '2xs', sm: 'xs' }}>
            Intelligence
          </Text>
        </Text>
        <HStack justifyContent="end" textAlign="end" w="50%">
          {intelligenceIncreased && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                onClick={() => onDecrementStat('int')}
                size="xs"
                variant="outline"
              >
                <Text>-</Text>
              </Button>
            </Box>
          )}
          <Text
            color={intelligenceIncreased ? 'green' : 'black'}
            fontWeight={intelligenceIncreased ? 'bold' : 'normal'}
            size={{ base: 'xs', sm: 'sm' }}
            w="33%"
          >
            {newIntelligence.toString()}
          </Text>
          {canLevel && (
            <Box w="33%">
              <Button
                borderWidth="1.5px"
                isDisabled={abilityPoints <= 0}
                onClick={() => onIncrementStat('int')}
                size="xs"
                variant="outline"
              >
                <Text>+</Text>
              </Button>
            </Box>
          )}
          {!canLevel && (
            <Text size={{ base: 'xs', sm: 'sm' }} w="33%">
              {getStatWithSymbol(
                BigInt(character.intelligence) - BigInt(newIntelligence),
              )}
            </Text>
          )}
          {!canLevel && (
            <Text fontWeight="600" size={{ base: 'xs', sm: 'sm' }} w="33%">
              {character.intelligence.toString()}
            </Text>
          )}
        </HStack>
      </HStack>

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
