import {
  Avatar,
  Box,
  Button,
  Divider,
  HStack,
  Link,
  Spinner,
  Text,
  Tooltip,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue, Has, runQuery } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useMemo } from 'react';
import {
  IoIosArrowForward,
  IoMdInformationCircleOutline,
} from 'react-icons/io';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { hexToBigInt } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { LEADERBOARD_PATH, MARKETPLACE_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';

const REST_FLAVOR = [
  'The fire crackles softly as warmth seeps into your bones. Your wounds begin to close.',
  'You sit by the flames and let the heat chase away the cold. Strength returns.',
  'Embers dance in the dark. The world feels far away. You breathe deep, and heal.',
  'The fire hisses and pops. For a moment, the dangers beyond feel like a distant memory.',
  'Sparks drift upward like tiny stars. When you rise, the pain is gone.',
];

import { ClassSymbol } from './ClassSymbol';
import { Level } from './Level';
import { LeaderboardIconSvg, MarketplaceIconSvg } from './SVGs';

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    components: { Levels, Stats },
    systemCalls: { rest },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { position } = useMap();

  const isAtFire = position?.x === 0 && position?.y === 0;

  const restTx = useTransaction({
    actionName: 'Resting by the fire',
    showSuccessToast: false,
  });

  const { renderSuccess } = useToast();

  const onRest = useCallback(async () => {
    if (!character) return;
    const prevHp = character.currentHp;
    const result = await restTx.execute(async () => {
      const { error, success } = await rest(character.id);
      if (error && !success) throw new Error(error);
    });
    if (result !== undefined) {
      // Poll MUD Stats component until HP reflects the rest
      for (let i = 0; i < 30; i++) {
        const stats = getComponentValue(Stats, character.id);
        if (stats && stats.currentHp !== prevHp) break;
        await new Promise(r => setTimeout(r, 500));
      }
      await refreshCharacter();
      renderSuccess(REST_FLAVOR[Math.floor(Math.random() * REST_FLAVOR.length)]);
    }
  }, [character, rest, restTx, Stats, refreshCharacter, renderSuccess]);

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
          <Text color="grey500" fontFamily="mono" size="lg">
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
          <Text color="grey500" fontFamily="mono" size="lg">
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
          <Text color="grey500" fontFamily="mono" size="lg">
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
          <Text color="grey500" fontFamily="mono" size="lg">
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
              bg="#070D2A"
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
              bg="#070D2A"
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

      {!character.inBattle &&
        currentHp > BigInt(0) &&
        currentHp < maxHp &&
        isAtFire && (
          <VStack
            bg="rgba(0, 0, 0, 0.45)"
            borderRadius="md"
            mt={3}
            mx={2}
            px={3}
            py={2}
            spacing={1}
          >
            <Text
              color="orange.300"
              fontFamily="mono"
              fontSize="xs"
              fontStyle="italic"
              textAlign="center"
            >
              A fire crackles nearby. You could rest here.
            </Text>
            <Button
              alignSelf="center"
              isDisabled={restTx.isLoading}
              isLoading={restTx.isLoading}
              loadingText="Resting by the fire..."
              onClick={onRest}
              size="xs"
              variant="outline"
              color="orange.200"
              borderColor="orange.400"
              _hover={{ bg: 'orange.900', borderColor: 'orange.300' }}
            >
              Rest by the Fire
            </Button>
          </VStack>
        )}

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
