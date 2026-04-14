import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useGameAudio } from '../contexts/SoundContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { getTableValue } from '../lib/gameStore';
import { getStatSymbol } from '../utils/helpers';
import { type Character, PowerSource } from '../utils/types';

import { HealthBar } from './HealthBar';
import { PolygonalCard } from './PolygonalCard';

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
  compact = false,
  onLevelComplete,
}: {
  canLevel: boolean;
  character: Character;
  compact?: boolean;
  onLevelComplete?: (newLevel: number) => void;
}): JSX.Element => {
  const { renderSuccess, renderWarning } = useToast();
  const { t } = useTranslation('ui');
  const {
    delegatorAddress,
    systemCalls: { levelCharacter },
  } = useMUD();
  const { refreshCharacter } = useCharacter();
  const { duckMusic, playSfx } = useGameAudio();

  const levelTx = useTransaction({ actionName: 'level up', showSuccessToast: false });

  const [abilityPoints, setAbilityPoints] = useState(0);
  const [newAgility, setNewAgility] = useState(character.baseStats.agility);
  const [newIntelligence, setNewIntelligence] = useState(
    character.baseStats.intelligence,
  );
  const [newStrength, setNewStrength] = useState(character.baseStats.strength);

  // Calculate ability points — must match StatCalculator.calculateStatPointsForLevel in contracts
  // +1 stat point per level at all tiers
  const calculateAbilityPointsForLevel = useCallback(
    (nextLevel: bigint, powerSource: PowerSource): number => {
      const level = Number(nextLevel);
      let points = 1;
      // Physical power source bonus at level 5
      if (level === 5 && powerSource === PowerSource.Physical) {
        points += 1;
      }
      return points;
    },
    [],
  );

  useEffect(() => {
    if (canLevel) {
      const nextLevel = character.level + BigInt(1);
      setAbilityPoints(calculateAbilityPointsForLevel(nextLevel, character.baseStats.powerSource));
    } else {
      setAbilityPoints(0);
    }
    setNewAgility(character.baseStats.agility);
    setNewIntelligence(character.baseStats.intelligence);
    setNewStrength(character.baseStats.strength);
  }, [
    calculateAbilityPointsForLevel,
    canLevel,
    character.baseStats.agility,
    character.baseStats.intelligence,
    character.baseStats.powerSource,
    character.baseStats.strength,
    character.level,
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
      if (levelTx.isLoading) return;

      let replenishAbilityPoint = false;

      switch (stat) {
        case 'str':
          if (newStrength === character.baseStats.strength) return;
          if (strengthIncreased) {
            replenishAbilityPoint = true;
          }
          if (!replenishAbilityPoint && abilityPoints <= 0) {
            renderWarning(t('leveling.notEnoughPoints'));
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
            renderWarning(t('leveling.notEnoughPoints'));
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
            renderWarning(t('leveling.notEnoughPoints'));
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
      levelTx.isLoading,
      newAgility,
      newIntelligence,
      newStrength,
      renderWarning,
      strengthIncreased,
    ],
  );

  const onIncrementStat = useCallback(
    (stat: 'str' | 'agi' | 'int') => {
      if (levelTx.isLoading) return;
      if (abilityPoints <= 0) {
        renderWarning(t('leveling.notEnoughPoints'));
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
    [abilityPoints, levelTx.isLoading, renderWarning],
  );

  const onLevelCharacter = useCallback(async () => {
    if (abilityPoints > 0) {
      renderWarning(t('leveling.unusedPoints'));
      return;
    }
    if (!delegatorAddress) return;

    const newStats = {
      agility: newAgility,
      maxHp: character.maxHp,
      currentHp: character.currentHp,
      class: character.entityClass,
      experience: character.experience,
      intelligence: newIntelligence,
      level: character.level,
      strength: newStrength,
      // Implicit class system fields - preserve from baseStats
      race: character.baseStats.race,
      powerSource: character.baseStats.powerSource,
      startingArmor: character.baseStats.startingArmor,
      advancedClass: character.baseStats.advancedClass,
      hasSelectedAdvancedClass: character.baseStats.hasSelectedAdvancedClass,
    };

    const result = await levelTx.execute(async () => {
      const { error, success } = await levelCharacter(character.id, newStats);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      playSfx('level-up');
      duckMusic(4000);

      // Poll Zustand store until level reflects the change
      const prevLevel = character.level;
      const newLevel = Number(character.level) + 1;
      for (let i = 0; i < 30; i++) {
        const stats = getTableValue('Stats', character.id);
        if (stats && stats.level !== prevLevel.toString()) break;
        await new Promise(r => setTimeout(r, 500));
      }
      await refreshCharacter();

      // Analytics: level up + milestone tracking
      import('../utils/analytics').then(({ trackLevelUp, trackMilestone }) => {
        trackLevelUp(newLevel, character.name);
        if (newLevel === 3) trackMilestone('level_3_adventurer_badge', newLevel);
        if (newLevel === 5) trackMilestone('level_5_power_source', newLevel);
        if (newLevel === 10) trackMilestone('level_10_advanced_class', newLevel);
      });

      if (onLevelComplete) {
        onLevelComplete(newLevel);
      } else {
        if (newLevel === 5) {
          const bonusMsg: Record<number, string> = {
            [PowerSource.Divine]: t('leveling.level5Divine'),
            [PowerSource.Weave]: t('leveling.level5Weave'),
            [PowerSource.Physical]: t('leveling.level5Physical'),
          };
          const msg = bonusMsg[character.baseStats.powerSource];
          renderSuccess(t('leveling.level5Success', { bonus: msg ? ` ${msg}.` : '' }));
        } else if (newLevel === 3) {
          renderSuccess(t('leveling.level3Badge'));
        } else {
          renderSuccess(t('leveling.leveledUp'));
        }
      }
    }
  }, [
    abilityPoints,
    character,
    delegatorAddress,
    levelCharacter,
    levelTx,
    newAgility,
    newIntelligence,
    newStrength,
    onLevelComplete,
    playSfx,
    duckMusic,
    refreshCharacter,
    renderSuccess,
    renderWarning,
  ]);

  const expiredEffectModifications: {
    agiModifier: bigint;
    intModifier: bigint;
    strModifier: bigint;
  } = useMemo(() => {
    if (!character) {
      return {
        agiModifier: BigInt(0),
        intModifier: BigInt(0),
        strModifier: BigInt(0),
      };
    }

    const inactiveEffects = character.worldStatusEffects.filter(
      effect => !effect.active,
    );

    const agiModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.agiModifier,
      BigInt(0),
    );

    const intModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.intModifier,
      BigInt(0),
    );

    const strModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.strModifier,
      BigInt(0),
    );

    return {
      agiModifier,
      intModifier,
      strModifier,
    };
  }, [character]);

  const nextLevel = character.level + BigInt(1);

  const powerSourceBonusText = useMemo(() => {
    const ps = character.baseStats.powerSource;
    if (ps === PowerSource.Divine) return t('leveling.divinePowerBonus');
    if (ps === PowerSource.Weave) return t('leveling.weavePowerBonus');
    if (ps === PowerSource.Physical) return t('leveling.physicalPowerBonus');
    return '';
  }, [character.baseStats.powerSource, t]);

  const Wrapper = compact
    ? ({ children }: { children: ReactNode }) => (
        <VStack
          border="2px solid"
          borderColor="yellow"
          borderRadius="md"
          boxShadow="0 0 15px rgba(239, 211, 28, 0.3)"
          bg="rgba(239, 211, 28, 0.05)"
          py={4}
          w="100%"
        >
          {children}
        </VStack>
      )
    : ({ children }: { children: ReactNode }) => (
        <PolygonalCard clipPath="none" py={6}>
          {children}
        </PolygonalCard>
      );

  return (
    <Wrapper>
      <VStack>
        <HStack color="#D4A54A" justify="space-between" px={6} w="100%">
          <Text alignSelf="start" fontWeight={700}>
            {compact ? t('leveling.levelUp') : t('leveling.myStats')}
          </Text>
          <Text alignSelf="start" fontWeight={700}>
            {t('leveling.abilityPoints', { points: abilityPoints })}
          </Text>
        </HStack>
        {canLevel && nextLevel === BigInt(5) && character.baseStats.powerSource !== PowerSource.None && (
          <Box
            bg="rgba(212, 165, 74, 0.08)"
            border="1px solid"
            borderColor="rgba(200, 122, 42, 0.4)"
            borderRadius="md"
            mx={6}
            px={4}
            py={3}
            w="calc(100% - 48px)"
          >
            <Text color="#D4A54A" fontFamily="Cinzel, serif" fontSize="xs" fontWeight={700} textAlign="center">
              {powerSourceBonusText}
            </Text>
          </Box>
        )}
        {!compact && (
          <HealthBar
            currentHp={character.currentHp}
            maxHp={character.maxHp}
            mt={2}
            level={character.level}
            px={6}
            statusEffects={character?.worldStatusEffects
              .filter(e => e.active)
              .map(e => e.name)}
            w="100%"
          />
        )}

        {/* Compact stat allocation cards — used in LevelUpModal */}
        {compact && canLevel && (
          <VStack spacing={3} px={4} py={4} w="100%">
            {([
              { key: 'agi' as const, abbrev: 'AGI', name: t('leveling.agility'), color: '#5A8A3E', desc: t('leveling.agiDesc') },
              { key: 'int' as const, abbrev: 'INT', name: t('leveling.intelligence'), color: '#4A7AB5', desc: t('leveling.intDesc') },
              { key: 'str' as const, abbrev: 'STR', name: t('leveling.strength'), color: '#B85C3A', desc: t('leveling.strDesc') },
            ] as const).map(({ key, abbrev, name, color, desc }) => {
              const value = key === 'agi' ? newAgility : key === 'int' ? newIntelligence : newStrength;
              const increased = key === 'agi' ? agilityIncreased : key === 'int' ? intelligenceIncreased : strengthIncreased;
              return (
                <Box
                  key={key}
                  w="100%"
                  px={5}
                  py={4}
                  borderRadius="md"
                  bg={increased ? 'rgba(196,184,158,0.12)' : 'rgba(196,184,158,0.06)'}
                  border="1px solid"
                  borderColor={increased ? 'rgba(212, 165, 74, 0.3)' : 'rgba(196,184,158,0.12)'}
                  transition="all 0.2s"
                >
                  <HStack justify="space-between" w="100%" align="center">
                    <Text color={color} fontWeight={700} fontSize="xl" fontFamily="mono" letterSpacing="0.05em">
                      {abbrev}
                    </Text>
                    <HStack spacing={3} align="center">
                      {increased && (
                        <Button
                          borderRadius="8px"
                          borderWidth="1.5px"
                          onClick={() => onDecrementStat(key)}
                          size="sm"
                          variant="outline"
                        >
                          <Text fontWeight={700}>-</Text>
                        </Button>
                      )}
                      <Text
                        color={increased ? 'green' : '#C4B89E'}
                        fontWeight={increased ? 'bold' : 'normal'}
                        fontSize="2xl"
                        fontFamily="mono"
                        minW="40px"
                        textAlign="center"
                      >
                        {value.toString()}
                      </Text>
                      <Button
                        borderRadius="8px"
                        borderWidth="1.5px"
                        isDisabled={abilityPoints <= 0}
                        onClick={() => onIncrementStat(key)}
                        size="sm"
                        variant="outline"
                      >
                        <Text fontWeight={700}>+</Text>
                      </Button>
                    </HStack>
                  </HStack>
                  <Text color="#8A7E6A" fontSize="sm" fontStyle="italic" mt={1}>
                    {name} — {desc}
                  </Text>
                </Box>
              );
            })}
          </VStack>
        )}

        {/* Standard stat display — used in StatsPanel and when not allocating in compact mode */}
        {!(compact && canLevel) && (
        <>
        <HStack justifyContent="end" mt={4} px={6} w="100%">
          <HStack
            justifyContent={canLevel ? 'center' : 'end'}
            textAlign="end"
            w="50%"
          >
            <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
              {t('leveling.base')}
            </Text>
            {!canLevel && (
              <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
                {t('leveling.bonus')}
              </Text>
            )}
            {!canLevel && (
              <Text size={{ base: '2xs', xl: 'xs' }} w="33%">
                {t('leveling.total')}
              </Text>
            )}
          </HStack>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="6px"
          w="100%"
        />
        <HStack px={6} w="100%">
          <Text
            color="#5A8A3E"
            fontWeight={700}
            size={{ base: 'xs', md: 'sm', lg: 'md', xl: 'lg' }}
            w="50%"
          >
            AGI -{' '}
            <Text
              as="span"
              color="#C4B89E"
              fontWeight={500}
              size={{ base: '2xs', sm: 'xs' }}
            >
              {t('leveling.agility')}
            </Text>
          </Text>
          <HStack justifyContent="end" textAlign="end" w="50%">
            {agilityIncreased && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              color={agilityIncreased ? 'green' : '#C4B89E'}
              fontWeight={agilityIncreased ? 'bold' : 'normal'}
              size={{ base: 'xs', sm: 'sm', md: 'lg' }}
              w="33%"
            >
              {newAgility.toString()}
            </Text>
            {canLevel && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              <Text size={{ base: 'xs', sm: 'sm', md: 'lg' }} w="33%">
                {getStatWithSymbol(
                  BigInt(character.agility) -
                    expiredEffectModifications.agiModifier -
                    BigInt(newAgility),
                )}
              </Text>
            )}
            {!canLevel && (
              <Text
                fontWeight="600"
                size={{ base: 'xs', sm: 'sm', md: 'lg' }}
                w="33%"
              >
                {(
                  character.agility - expiredEffectModifications.agiModifier
                ).toString()}
              </Text>
            )}
          </HStack>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="6px"
          w="100%"
        />
        <HStack px={6} w="100%">
          <Text
            color="#4A7AB5"
            fontWeight={700}
            size={{ base: 'xs', md: 'sm', lg: 'md', xl: 'lg' }}
            w="50%"
          >
            INT -{' '}
            <Text
              as="span"
              color="#C4B89E"
              fontWeight={500}
              size={{ base: '2xs', sm: 'xs' }}
            >
              {t('leveling.intelligence')}
            </Text>
          </Text>
          <HStack justifyContent="end" textAlign="end" w="50%">
            {intelligenceIncreased && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              color={intelligenceIncreased ? 'green' : '#C4B89E'}
              fontWeight={intelligenceIncreased ? 'bold' : 'normal'}
              size={{ base: 'xs', sm: 'sm', md: 'lg' }}
              w="33%"
            >
              {newIntelligence.toString()}
            </Text>
            {canLevel && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              <Text size={{ base: 'xs', sm: 'sm', md: 'lg' }} w="33%">
                {getStatWithSymbol(
                  BigInt(character.intelligence) -
                    expiredEffectModifications.intModifier -
                    BigInt(newIntelligence),
                )}
              </Text>
            )}
            {!canLevel && (
              <Text
                fontWeight="600"
                size={{ base: 'xs', sm: 'sm', md: 'lg' }}
                w="33%"
              >
                {(
                  character.intelligence -
                  expiredEffectModifications.intModifier
                ).toString()}
              </Text>
            )}
          </HStack>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="6px"
          w="100%"
        />
        <HStack px={6} w="100%">
          <Text
            color="#B85C3A"
            fontWeight={700}
            size={{ base: 'xs', md: 'sm', lg: 'md', xl: 'lg' }}
            w="50%"
          >
            STR -{' '}
            <Text
              as="span"
              color="#C4B89E"
              fontWeight={500}
              size={{ base: '2xs', sm: 'xs' }}
            >
              {t('leveling.strength')}
            </Text>
          </Text>
          <HStack justifyContent="end" textAlign="end" w="50%">
            {strengthIncreased && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              color={strengthIncreased ? 'green' : '#C4B89E'}
              fontWeight={strengthIncreased ? 'bold' : 'normal'}
              size={{ base: 'xs', sm: 'sm', md: 'lg' }}
              w="33%"
            >
              {newStrength.toString()}
            </Text>
            {canLevel && (
              <Box w="33%">
                <Button
                  borderRadius="8px"
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
              <Text size={{ base: 'xs', sm: 'sm', md: 'lg' }} w="33%">
                {getStatWithSymbol(
                  BigInt(character.strength) -
                    expiredEffectModifications.strModifier -
                    BigInt(newStrength),
                )}
              </Text>
            )}
            {!canLevel && (
              <Text
                fontWeight="600"
                size={{ base: 'xs', sm: 'sm', md: 'lg' }}
                w="33%"
              >
                {(
                  character.strength - expiredEffectModifications.strModifier
                ).toString()}
              </Text>
            )}
          </HStack>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="6px"
          w="100%"
        />
        </>
        )}

        {canLevel && (
          <Button
            isLoading={levelTx.isLoading}
            mt={8}
            onClick={onLevelCharacter}
            size="sm"
            variant="gold"
          >
            {t('leveling.levelUp')}
          </Button>
        )}
      </VStack>
    </Wrapper>
  );
};
