import {
  Avatar,
  Button,
  Grid,
  GridItem,
  HStack,
  Link,
  Spacer,
  Spinner,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import { GiRogue } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { LEADERBOARD_PATH } from '../Routes';
import { MAX_EQUIPPED_ARMOR, MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { Level } from './Level';

const MAX_EQUIPPED_ITEMS = MAX_EQUIPPED_ARMOR + MAX_EQUIPPED_WEAPONS;

export const StatsPanel = (): JSX.Element => {
  const navigate = useNavigate();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    components: { Levels },
  } = useMUD();
  const { character, equippedArmor, equippedWeapons } = useCharacter();

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
    () => [...equippedArmor, ...equippedWeapons],
    [equippedArmor, equippedWeapons],
  );

  if (!character) {
    return (
      <VStack h="100%" justify="center">
        <Spinner size="lg" />
      </VStack>
    );
  }

  const {
    agility,
    baseHp,
    currentHp,
    experience,
    goldBalance,
    image,
    intelligence,
    name,
    strength,
  } = character;

  const currentHpWithFloor = parseInt(currentHp) < 0 ? 0 : parseInt(currentHp);

  return (
    <VStack alignItems="start" h="100%" p={2} spacing={4}>
      <HStack
        as="button"
        onClick={() => navigate(`/characters/${character.characterId}`)}
        spacing={4}
        _hover={{ cursor: 'pointer', textDecoration: 'underline' }}
      >
        <Avatar src={image} />
        <Text fontWeight="700">{name}</Text>
        <IoIosArrowForward size={20} />
      </HStack>

      <Grid
        alignSelf="start"
        columnGap={2}
        templateColumns="repeat(2, 1fr)"
        w="75%"
      >
        <GridItem>
          <Text fontWeight="bold" size="lg">
            HP
          </Text>
        </GridItem>
        <GridItem>
          <Text>
            {currentHpWithFloor}/{baseHp}
          </Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            STR
          </Text>
        </GridItem>
        <GridItem>
          <Text>{strength}</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            AGI
          </Text>
        </GridItem>
        <GridItem>
          <Text>{agility}</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold" size="lg">
            INT
          </Text>
        </GridItem>
        <GridItem>
          <Text>{intelligence}</Text>
        </GridItem>
      </Grid>

      <Level currentLevel={character.level} levelPercent={levelPercent} />

      <HStack alignItems="start" w="100%">
        <Text fontWeight="bold">
          {Number(goldBalance).toLocaleString()} $GOLD
        </Text>
        <Spacer />
        <Text>
          <Text
            as="span"
            color={
              BigInt(experience) >= nextLevelXpRequirement ? 'green' : 'black'
            }
            fontWeight={
              BigInt(experience) >= nextLevelXpRequirement ? 'bold' : 'normal'
            }
          >
            {experience}
          </Text>
          /{nextLevelXpRequirement.toString()} XP
        </Text>
      </HStack>

      {BigInt(experience) >= nextLevelXpRequirement && (
        <Button
          alignSelf="center"
          onClick={() => navigate(`/characters/${character.characterId}`)}
          size="xs"
          variant="gold"
        >
          Level Up!
        </Button>
      )}

      <VStack align="stretch" alignItems="start" mt={4} spacing={2} w="100%">
        <HStack fontWeight="bold" w="100%">
          <Text>Equipped Items</Text>
          <Spacer />
          <Text>
            {allItems.length}/{MAX_EQUIPPED_ITEMS}
          </Text>
        </HStack>
        {allItems.map((item, index) => (
          <HStack
            fontSize="xs"
            justify="space-between"
            key={`equipped-item-${index}`}
            pl={2}
            w="100%"
          >
            <Text>{item.name}</Text>
            <Button
              onClick={() => navigate(`/characters/${character.characterId}`)}
              p="0 2px"
              size="sm"
              variant="ghost"
            >
              <GiRogue size={12} />
            </Button>
          </HStack>
        ))}
        {Array.from({
          length: MAX_EQUIPPED_ITEMS - allItems.length,
        }).map((_, index) => (
          <HStack
            key={`empty-weapon-${index}`}
            justify="space-between"
            fontSize="xs"
            pl={2}
            w="100%"
          >
            <Text>Empty Slot</Text>
            <Button
              onClick={() => navigate(`/characters/${character.characterId}`)}
              p="0 2px"
              size="sm"
              variant="ghost"
            >
              +
            </Button>
          </HStack>
        ))}
      </VStack>

      <HStack justify="space-between" fontWeight="bold" mt={4} w="100%">
        <Text>Health Potion</Text>
        <Text>0</Text>
      </HStack>

      {isDesktop && (
        <>
          <VStack alignSelf="start" alignItems="start">
            <Link
              as={RouterLink}
              borderBottom="2px solid"
              borderColor="grey400"
              fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
              pb={1}
              textAlign="left"
              _hover={{
                borderColor: 'grey500',
                textDecoration: 'none',
              }}
            >
              Auction House
            </Link>
            <Link
              as={RouterLink}
              borderBottom="2px solid"
              borderColor="grey400"
              fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
              to={LEADERBOARD_PATH}
              pb={1}
              _hover={{
                borderColor: 'grey500',
                textDecoration: 'none',
              }}
            >
              Leaderboard
            </Link>
          </VStack>
        </>
      )}
    </VStack>
  );
};
