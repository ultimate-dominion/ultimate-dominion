import {
  Avatar,
  Box,
  Button,
  Divider,
  HStack,
  Spinner,
  Text,
  Tooltip,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { DARK_INSET_SHADOW } from '../utils/theme';
import { useGameValue, getTableEntries, encodeUint256Key, toBigInt } from '../lib/gameStore';
import { useMemo } from 'react';
import { GiTwoCoins } from 'react-icons/gi';
import {
  IoIosArrowForward,
  IoMdInformationCircleOutline,
} from 'react-icons/io';
import { useNavigate } from 'react-router-dom';
import { useCharacter } from '../contexts/CharacterContext';
import { useFragments } from '../contexts/FragmentContext';
import { etherToFixedNumber } from '../utils/helpers';

import { ClassSymbol } from './ClassSymbol';
import { Level } from './Level';
import { TileScout } from './TileScout';

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const { character } = useCharacter();
  const { fragments } = useFragments();


  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const maxLevelXpRequirement = useMemo(() => {
    const levelsEntries = getTableEntries('Levels');
    const maxLevelKey = Object.keys(levelsEntries).sort().slice(-1)[0];
    return maxLevelKey ? BigInt(maxLevelKey) : BigInt(0);
  }, []);

  const maxed = useMemo(() => {
    if (!character) return false;
    return maxLevelXpRequirement <= BigInt(character.level);
  }, [character, maxLevelXpRequirement]);

  const currentLevelRow = useGameValue(
    'Levels',
    character && Number(character.level) > 0
      ? encodeUint256Key(BigInt(Math.max(0, Number(character.level) - 1)))
      : undefined,
  );
  const currentLevelXpRequirement = toBigInt(currentLevelRow?.experience);

  const nextLevelRow = useGameValue(
    'Levels',
    character
      ? encodeUint256Key(BigInt(character.level))
      : undefined,
  );
  const nextLevelXpRequirement = toBigInt(nextLevelRow?.experience);

  const levelPercent = useMemo(() => {
    if (!character) return 0;

    const xpEarnedSinceLastLevel =
      BigInt(character.experience) - currentLevelXpRequirement;
    const xpNeededSinceLastLevel =
      nextLevelXpRequirement - currentLevelXpRequirement;

    const percent =
      (100 * Number(xpEarnedSinceLastLevel)) / Number(xpNeededSinceLastLevel);
    return percent > 100 ? 100 : percent;
  }, [character, currentLevelXpRequirement, nextLevelXpRequirement]);

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

  if (!character) {
    return (
      <VStack h="100%" justify="center">
        <Spinner size="lg" />
      </VStack>
    );
  }

  const {
    agility,
    maxHp,
    currentHp,
    experience,
    externalGoldBalance,
    image,
    intelligence,
    name,
    strength,
  } = character;

  const currentHpWithFloor = currentHp < BigInt(0) ? BigInt(0) : currentHp;

  return (
    <VStack spacing={0}>
      <HStack
        bgColor="blue500"
        minH={{ base: '36px', md: '46px' }}
        px="20px"
        width="100%"
      >
        <HStack
          as="button"
          color="#E8DCC8"
          justifyContent="space-between"
          onClick={() => navigate(`/characters/${character.id}`)}
          spacing={4}
          w="100%"
          _hover={{ cursor: 'pointer', textDecoration: 'underline' }}
        >
          <HStack>
            <Avatar size="sm" src={image} />
            <Text fontWeight={700} ml={2} size="lg">
              {name}
            </Text>
            <ClassSymbol
              advancedClass={character.advancedClass}
              entityClass={character.entityClass}
              mb={0.5}
              theme="light"
            />
          </HStack>
          <IoIosArrowForward size={20} />
        </HStack>
      </HStack>

      <VStack mt={3} spacing={0} w="100%">
        {/* HP bar */}
        <Box px={2} py={1.5} w="100%">
          <HStack justifyContent="space-between" mb={1}>
            <Text fontWeight={700} size="sm">HP</Text>
            <Text color="#8A7E6A" fontFamily="mono" fontWeight={700} size="sm">
              {currentHpWithFloor.toString()}/{maxHp.toString()}
            </Text>
          </HStack>
          <Box
            bg="#14120F"
            borderRadius="md"
            boxShadow={DARK_INSET_SHADOW}
            h="10px"
            overflow="hidden"
            w="100%"
          >
            <Box
              bg={
                Number(currentHpWithFloor) / Number(maxHp) > 0.6
                  ? '#5A8A3E'
                  : Number(currentHpWithFloor) / Number(maxHp) > 0.3
                    ? '#C87A2A'
                    : '#8B2020'
              }
              borderRadius="md"
              h="100%"
              transition="width 0.5s ease, background-color 0.5s ease"
              w={`${(Number(currentHpWithFloor) / Number(maxHp)) * 100}%`}
            />
          </Box>
        </Box>

        {/* Stats — compact single row */}
        <HStack
          justifyContent="center"
          px={2}
          py={1.5}
          spacing={2}
          w="100%"
        >
          <Text color="#8A7E6A" fontFamily="mono" size="sm">
            AGI{' '}
            <Text as="span" color="#E8DCC8" fontWeight={700}>
              {(agility - expiredEffectModifications.agiModifier).toString()}
            </Text>
          </Text>
          <Text color="#5A5040" size="sm">·</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="sm">
            INT{' '}
            <Text as="span" color="#E8DCC8" fontWeight={700}>
              {(intelligence - expiredEffectModifications.intModifier).toString()}
            </Text>
          </Text>
          <Text color="#5A5040" size="sm">·</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="sm">
            STR{' '}
            <Text as="span" color="#E8DCC8" fontWeight={700}>
              {(strength - expiredEffectModifications.strModifier).toString()}
            </Text>
          </Text>
        </HStack>
      </VStack>

      <Divider borderColor="grey300" mt={2} />

      <Box mt={2} px={4} w="100%">
        <Level
          currentLevel={character.level}
          levelPercent={levelPercent}
          maxed={maxed}
        />
        <HStack justifyContent="space-between" mt={1}>
          <Text color="#8A7E6A" fontWeight={600} size="xs">XP</Text>
          <Text fontFamily="mono" fontWeight={700} size="xs">
            <Text
              as="span"
              color={
                BigInt(experience) >= nextLevelXpRequirement ? 'green' : undefined
              }
            >
              {experience.toString()}
            </Text>
            <Text as="span" color="grey500">
              {' / '}
              {nextLevelXpRequirement.toString()}
            </Text>
          </Text>
        </HStack>
      </Box>

      <Divider borderColor="grey300" mt={2} />

      <VStack mt={2} px={2} spacing={1} w="100%">
        <HStack justifyContent="space-between" w="100%">
          <Tooltip
            hasArrow
            label="Your Gold balance. You can use this to buy items in the Marketplace and various shops. To withdraw from or deposit Gold into your Adventure Escrow, visit 0,0 on the map."
            placement="top"
            shouldWrapChildren
          >
            <HStack spacing={1.5} cursor="default">
              <GiTwoCoins color="#D4A54A" size={18} />
              <Text color="yellow" fontWeight={700} size="lg">
                Gold
              </Text>
            </HStack>
          </Tooltip>
          <Text
            color="yellow"
            fontFamily="mono"
            fontWeight={700}
            fontSize="lg"
          >
            {etherToFixedNumber(
              externalGoldBalance + character.escrowGoldBalance,
            )}
          </Text>
        </HStack>
        <HStack justifyContent="space-between" w="100%" px={2}>
          <Text color="#6A6050" size="sm">Spendable</Text>
          <Text color="#8A7E6A" fontFamily="mono" fontWeight={600} size="sm">
            {etherToFixedNumber(externalGoldBalance)}
          </Text>
        </HStack>
        <HStack justifyContent="space-between" w="100%" px={2}>
          <HStack>
            <Text color="#6A6050" size="sm">Escrow</Text>
            <Tooltip
              hasArrow
              label="Your Adventure Escrow is where Gold goes when you win battles. Leaving Gold in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your Gold at 0,0 on the map."
              placement="top"
              shouldWrapChildren
            >
              <IoMdInformationCircleOutline size={12} />
            </Tooltip>
          </HStack>
          <Text color="#8A7E6A" fontFamily="mono" fontWeight={600} size="sm">
            {etherToFixedNumber(character.escrowGoldBalance)}
          </Text>
        </HStack>
      </VStack>


      {BigInt(experience) >= nextLevelXpRequirement && !maxed && (
        <Button
          alignSelf="center"
          mt={2}
          onClick={() => navigate(`/characters/${character.id}`)}
          size="xs"
          variant="gold"
        >
          Level Up!
        </Button>
      )}

      {isDesktop && (
        <>
          <Divider borderColor="grey300" />
          <Box pb={4} pt={2} w="100%">
            <TileScout />
          </Box>

          {/* Fragment progress dots */}
          <Divider borderColor="grey300" />
          <VStack px={4} py={3} spacing={1.5} w="100%">
            <Text color="#8A7E6A" fontSize="xs" fontWeight={600}>
              Fragments
            </Text>
            <HStack spacing={1.5}>
              {Array.from({ length: 8 }, (_, i) => {
                const frag = fragments.find(f => f.fragmentType === i + 1);
                const claimed = frag?.claimed ?? false;
                return (
                  <Box
                    key={i}
                    w="10px"
                    h="10px"
                    borderRadius="2px"
                    bg={claimed ? '#A8DEFF' : '#2A2520'}
                    transition="background-color 0.3s ease"
                  />
                );
              })}
            </HStack>
          </VStack>
        </>
      )}
    </VStack>
  );
};
