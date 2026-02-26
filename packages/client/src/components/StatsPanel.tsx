import {
  Avatar,
  Box,
  Button,
  Divider,
  HStack,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { Has, runQuery } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import {
  IoIosArrowForward,
  IoMdInformationCircleOutline,
} from 'react-icons/io';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { hexToBigInt } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { LEADERBOARD_PATH, MARKETPLACE_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';

import { ClassSymbol } from './ClassSymbol';
import { Level } from './Level';
import { LeaderboardIconSvg, MarketplaceIconSvg } from './SVGs';

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    components: { Levels },
  } = useMUD();
  const { character } = useCharacter();


  const maxLevelXpRequirement = useMemo(
    () =>
      hexToBigInt(
        Array.from(runQuery([Has(Levels)])).slice(-1)[0] as `0x${string}`,
      ),
    [Levels],
  );

  const maxed = useMemo(() => {
    if (!character) return false;
    return maxLevelXpRequirement <= BigInt(character.level);
  }, [character, maxLevelXpRequirement]);

  const currentLevelXpRequirement =
    useComponentValue(
      Levels,
      character && Number(character.level) > 0
        ? encodeEntity(
            { level: 'uint256' },
            { level: BigInt(Math.max(0, Number(character.level) - 1)) },
          )
        : undefined,
    )?.experience ?? BigInt(0);

  const nextLevelXpRequirement =
    useComponentValue(
      Levels,
      character
        ? encodeEntity({ level: 'uint256' }, { level: BigInt(character.level) })
        : undefined,
    )?.experience ?? BigInt(0);

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
              entityClass={character.entityClass}
              mb={0.5}
              theme="light"
            />
          </HStack>
          <IoIosArrowForward size={20} />
        </HStack>
      </HStack>

      <VStack mt={4} spacing={0} w="100%">
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1.5}
          w="100%"
        >
          <Text size="lg">HP</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="lg">
            {currentHpWithFloor.toString()}/{maxHp.toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="1px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1.5}
          w="100%"
        >
          <Text size="lg">AGI</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="lg">
            {(agility - expiredEffectModifications.agiModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="1px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1.5}
          w="100%"
        >
          <Text size="lg">INT</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="lg">
            {(intelligence - expiredEffectModifications.intModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="1px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1.5}
          w="100%"
        >
          <Text size="lg">STR</Text>
          <Text color="#8A7E6A" fontFamily="mono" size="lg">
            {(strength - expiredEffectModifications.strModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="1px"
          w="100%"
        />
      </VStack>

      <Divider borderColor="grey300" mt={4} />

      <HStack mt={4} px={4} w="100%">
        <Level
          currentLevel={character.level}
          levelPercent={levelPercent}
          maxed={maxed}
        />
      </HStack>
      <Text fontWeight={600} size="md" textAlign="center">
        <Text
          as="span"
          color={
            BigInt(experience) >= nextLevelXpRequirement ? 'green' : undefined
          }
          fontFamily="mono"
          fontWeight={700}
        >
          {experience.toString()}
        </Text>
        <Text as="span" color="grey500" fontFamily="mono">
          {' / '}
          {nextLevelXpRequirement.toString()}
        </Text>{' '}
        XP
      </Text>

      <Divider borderColor="grey300" mt={4} />

      <VStack mt={4} px={2} spacing={1} w="100%">
        <HStack justifyContent="space-between" w="100%">
          <HStack>
            <Text color="yellow" fontWeight={700} size="lg">
              Gold
            </Text>
            <Tooltip
              hasArrow
              label="Your Gold balance. You can use this to buy items in the Marketplace and various shops. To withdraw from or deposit Gold into your Adventure Escrow, visit 0,0 on the map."
              placement="top"
              shouldWrapChildren
            >
              <IoMdInformationCircleOutline />
            </Tooltip>
          </HStack>
          <Text color="yellow" fontFamily="mono" fontWeight={700} size="lg">
            {etherToFixedNumber(
              externalGoldBalance + character.escrowGoldBalance,
            )}
          </Text>
        </HStack>
        <HStack justifyContent="space-between" w="100%" px={2}>
          <Text size="md">Spendable</Text>
          <Text fontFamily="mono" fontWeight={700} size="md">
            {etherToFixedNumber(externalGoldBalance)}
          </Text>
        </HStack>
        <HStack justifyContent="space-between" w="100%" px={2}>
          <HStack>
            <Text size="md">Escrow</Text>
            <Tooltip
              hasArrow
              label="Your Adventure Escrow is where Gold goes when you win battles. Leaving Gold in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your Gold at 0,0 on the map."
              placement="top"
              shouldWrapChildren
            >
              <IoMdInformationCircleOutline />
            </Tooltip>
          </HStack>
          <Text fontFamily="mono" fontWeight={700} size="md">
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

      <Divider borderColor="grey300" mt={4} />

      <HStack
        justifyContent="center"
        gap={2}
        pb={4}
        pt={4}
        px={2}
        w="100%"
      >
        <Button
          as={RouterLink}
          flex={1}
          leftIcon={<MarketplaceIconSvg size={3} theme="dark" />}
          size="sm"
          to={MARKETPLACE_PATH}
          variant="dark"
        >
          Marketplace
        </Button>
        <Button
          as={RouterLink}
          flex={1}
          leftIcon={<LeaderboardIconSvg size={3} theme="dark" />}
          size="sm"
          to={LEADERBOARD_PATH}
          variant="dark"
        >
          Leaderboard
        </Button>
      </HStack>
    </VStack>
  );
};
