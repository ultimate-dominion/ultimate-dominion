import {
  Avatar,
  Box,
  Button,
  HStack,
  Link,
  Spacer,
  Spinner,
  Text,
  Tooltip,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { Has, runQuery } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import { BsBackpack4Fill } from 'react-icons/bs';
import {
  IoIosArrowForward,
  IoMdInformationCircleOutline,
} from 'react-icons/io';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { hexToBigInt } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { LEADERBOARD_PATH, MARKETPLACE_PATH } from '../Routes';
import { MAX_EQUIPPED_ARMOR, MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { etherToFixedNumber } from '../utils/helpers';
import { ClassSymbol } from './ClassSymbol';
import { Level } from './Level';
import { LeaderboardIconSvg, MarketplaceIconSvg } from './SVGs';
import { PotionSvg } from './SVGs/PotionSvg';

const MAX_EQUIPPED_ITEMS = MAX_EQUIPPED_ARMOR + MAX_EQUIPPED_WEAPONS;

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    components: { Levels },
  } = useMUD();
  const {
    character,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    inventoryConsumables,
  } = useCharacter();

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
      character
        ? encodeEntity(
            { level: 'uint256' },
            { level: BigInt(Number(character.level) - 1) },
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

  const allItems = useMemo(
    () => [...equippedArmor, ...equippedSpells, ...equippedWeapons],
    [equippedArmor, equippedSpells, equippedWeapons],
  );

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
        minH={{ base: '40px', md: '66px' }}
        px="20px"
        width="100%"
      >
        <HStack
          as="button"
          color="white"
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
          py={1}
          w="100%"
        >
          <Text size="lg">HP</Text>
          <Text color="grey500" size="lg">
            {currentHpWithFloor.toString()}/{maxHp.toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="#F5F5FA1F"
          boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
          h="6px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1}
          w="100%"
        >
          <Text size="lg">AGI</Text>
          <Text color="grey500" size="lg">
            {(agility - expiredEffectModifications.agiModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="#F5F5FA1F"
          boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
          h="6px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1}
          w="100%"
        >
          <Text size="lg">INT</Text>
          <Text color="grey500" size="lg">
            {(intelligence - expiredEffectModifications.intModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="#F5F5FA1F"
          boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
          h="6px"
          w="100%"
        />
        <HStack
          fontWeight={700}
          justifyContent="space-between"
          px={2}
          py={1}
          w="100%"
        >
          <Text size="lg">STR</Text>
          <Text color="grey500" size="lg">
            {(strength - expiredEffectModifications.strModifier).toString()}
          </Text>
        </HStack>
        <Box
          backgroundColor="#F5F5FA1F"
          boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
          h="6px"
          w="100%"
        />
      </VStack>

      <HStack mt={4} px={4} w="100%">
        <Level
          currentLevel={character.level}
          levelPercent={levelPercent}
          maxed={maxed}
        />
      </HStack>

      <HStack alignItems="start" mt={4} px={2} w="100%">
        <HStack>
          <Text color="yellow" fontWeight={700} size="lg">
            {etherToFixedNumber(externalGoldBalance)} $GOLD
          </Text>
          <Tooltip
            bg="#070D2A"
            hasArrow
            label="This is your external wallet's $GOLD balance. You can use this to buy items in the Marketplace and various shops. To withdraw from or deposit $GOLD into your Adventure Escrow, visit 0,0 on the map."
            placement="top"
            shouldWrapChildren
          >
            <IoMdInformationCircleOutline />
          </Tooltip>
        </HStack>
        <Spacer />
        <Text color="gray500" fontWeight={500}>
          <Text
            as="span"
            color={
              BigInt(experience) >= nextLevelXpRequirement ? 'green' : 'black'
            }
            fontWeight={
              BigInt(experience) >= nextLevelXpRequirement ? 'bold' : 'normal'
            }
          >
            {experience.toString()}
          </Text>
          /{nextLevelXpRequirement.toString()} XP
        </Text>
      </HStack>

      {BigInt(experience) >= nextLevelXpRequirement && !maxed && (
        <Button
          alignSelf="center"
          onClick={() => navigate(`/characters/${character.id}`)}
          size="xs"
          variant="gold"
        >
          Level Up!
        </Button>
      )}

      <VStack align="stretch" alignItems="start" mt={6} spacing={1} w="100%">
        <HStack fontWeight={700} mb={2} px={2} w="100%">
          <Text size="lg">Equipped Items</Text>
          <Tooltip
            bg="#070D2A"
            hasArrow
            label="Visit the character page to equip items"
            placement="top"
          >
            <Button
              onClick={() => navigate(`/characters/${character.id}`)}
              p="0 2px"
              size="sm"
              variant="ghost"
            >
              <BsBackpack4Fill size={12} />
            </Button>
          </Tooltip>
          <Spacer />
          <Text color="grey500" size="lg">
            {allItems.length}/{MAX_EQUIPPED_ITEMS}
          </Text>
        </HStack>
        {allItems.map((item, index) => (
          <HStack
            borderBottom="2px solid"
            borderColor="white"
            boxShadow="0px 0px 0px 0px #A2A9B0, 0px 0px 0px 0px #54545480, 5px 5px 10px 0px #54545440, -5px -5px 10px 0px #5454547D"
            fontSize="xs"
            justify="space-between"
            key={`equipped-item-${index}`}
            overflow="hidden"
            px={2}
            py={1}
            w="100%"
          >
            <Text fontWeight={500}>{item.name}</Text>
            <Box h={6} />
          </HStack>
        ))}
        {Array.from({
          length: MAX_EQUIPPED_ITEMS - allItems.length,
        }).map((_, index) => (
          <HStack
            boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
            key={`empty-weapon-${index}`}
            fontSize="xs"
            justify="space-between"
            px={2}
            py={1}
            w="100%"
          >
            <Text>Empty Slot</Text>
            <Button
              h={6}
              onClick={() => navigate(`/characters/${character.id}`)}
              p={0}
              size="sm"
              variant="ghost"
              w={4}
            >
              +
            </Button>
          </HStack>
        ))}
        <HStack
          boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
          fontSize="xs"
          justify="space-between"
          mt={2}
          pl={2}
          pr={5}
          py={2}
          w="100%"
        >
          <Text fontWeight={500}>Consumables</Text>
          <HStack h={6}>
            <Text fontWeight={700}>{inventoryConsumables.length}</Text>
            <PotionSvg mb={0.5} theme="dark" />
          </HStack>
        </HStack>
      </VStack>

      {isDesktop && (
        <HStack
          justifyContent="space-between"
          m="0 auto"
          maxWidth="250px"
          pb={6}
          pt={4}
          w="100%"
        >
          <Link
            alignItems="center"
            as={RouterLink}
            display="flex"
            fontSize={{ base: 'xs', sm: 'sm' }}
            gap={1}
            textDecoration="underline"
            to={MARKETPLACE_PATH}
          >
            <MarketplaceIconSvg size={3} theme="dark" />
            Marketplace
          </Link>
          <Link
            alignItems="center"
            as={RouterLink}
            display="flex"
            fontSize={{ base: 'xs', sm: 'sm' }}
            gap={1}
            textDecoration="underline"
            to={LEADERBOARD_PATH}
          >
            <LeaderboardIconSvg size={3} theme="dark" />
            Leaderboard
          </Link>
        </HStack>
      )}
    </VStack>
  );
};
