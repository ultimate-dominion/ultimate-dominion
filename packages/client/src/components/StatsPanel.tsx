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
import { IoIosArrowForward } from 'react-icons/io';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { Level } from './Level';

const CURRENT_LEVEL = 1;

export const StatsPanel = (): JSX.Element => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    components: { Levels },
  } = useMUD();
  const { character, characterStats } = useCharacter();

  const nextLevelXpRequirement = useComponentValue(
    Levels,
    encodeEntity({ level: 'uint256' }, { level: BigInt(CURRENT_LEVEL + 1) }),
  )?.experience;

  const levelPercent = useMemo(() => {
    if (!nextLevelXpRequirement) return 0;
    return (
      (100 * Number(characterStats.experience)) / Number(nextLevelXpRequirement)
    );
  }, [characterStats.experience, nextLevelXpRequirement]);

  if (!character) {
    return (
      <VStack h="100%" justify="center">
        <Spinner size="lg" />
      </VStack>
    );
  }

  const { goldBalance, image, name } = character;
  const { agility, experience, intelligence, maxHitPoints, strength } =
    characterStats;

  return (
    <VStack alignItems="start" h="100%" p={2} spacing={4}>
      <HStack
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
          <Text>{maxHitPoints}</Text>
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

      <Level levelPercent={levelPercent} />

      <HStack alignItems="start" w="100%">
        <Text fontWeight="bold">{goldBalance} $GOLD</Text>
        <Spacer />
        <Text>
          {experience}/{nextLevelXpRequirement?.toString() ?? '0'}
        </Text>
      </HStack>

      <VStack align="stretch" alignItems="start" mt={4} spacing={2} w="100%">
        <HStack fontWeight="bold" w="100%">
          <Text>Active Items</Text>
          <Spacer />
          <Text>1/3</Text>
        </HStack>
        <HStack
          justify="space-between"
          fontSize="xs"
          fontWeight="bold"
          pl={2}
          w="100%"
        >
          <Text>Rusty Dagger</Text>
          <Button padding="0 2px" size="sm" variant="ghost">
            ⁂
          </Button>
        </HStack>
        <HStack justify="space-between" fontSize="xs" pl={2} w="100%">
          <Text>Empty Slot</Text>
          <Button padding="0 2px" size="sm" variant="ghost">
            +
          </Button>
        </HStack>
        <HStack justify="space-between" fontSize="xs" pl={2} w="100%">
          <Text>Empty Slot</Text>
          <Button padding="0 2px" size="sm" variant="ghost">
            +
          </Button>
        </HStack>
      </VStack>

      <HStack justify="space-between" fontWeight="bold" mt={4} w="100%">
        <Text>Health Potion</Text>
        <Text>0</Text>
      </HStack>

      {isDesktop && (
        <>
          <VStack alignSelf="start" alignItems="start">
            <Link
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
              borderBottom="2px solid"
              borderColor="grey400"
              fontSize={{ base: 'xs', sm: 'sm', md: 'md' }}
              pb={1}
              _hover={{
                borderColor: 'grey500',
                textDecoration: 'none',
              }}
            >
              Leader Board
            </Link>
          </VStack>
        </>
      )}
    </VStack>
  );
};
