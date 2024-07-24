import {
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import { useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';

import { Character, StatsClasses } from '../utils/types';
import { useMUD } from '../contexts/MUDContext';

const createDummyData = (num: number = 1) => {
  const result: Character[] = [];
  for (let i = 0; i < num; i++) {
    result[result.length] = {
      characterClass: Math.floor(Math.random() * 3) as StatsClasses,
      characterId: (Math.random() + 1).toString(36).substring(7) as Entity,
      goldBalance: Math.floor(Math.random() * (1000 - 100) + 100) / 100 + '',
      locked: Math.random() < 0.5,
      owner: (Math.random() + 1).toString(36).substring(7),
      tokenId: i + '',
      agility: Math.floor(Math.random() * 10) + 1 + '',
      baseHitPoints: Math.floor(Math.random() * 10) + 1 + '',
      experience: Math.floor(Math.random() * 10) + 1 + '',
      intelligence: Math.floor(Math.random() * 10) + 1 + '',
      level: Math.floor(Math.random() * 10) + 1 + '',
      strength: Math.floor(Math.random() * 10) + 1 + '',
      description: (Math.random() + 1).toString(36).substring(7),
      image:
        'http://example.com/' + (Math.random() + 1).toString(36).substring(7),
      name: (Math.random() + 1).toString(36).substring(7),
    };
  }
  return result;
};

const DUMMY_CHARACTER: Character[] = createDummyData(50);
const PER_PAGE = 10;
export const AuctionHouse = (): JSX.Element => {
  // const [entries, setEntries] = useState(DUMMY_CHARACTER);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  // const [page, setPage] = useState(1);
  // const [pageLimit, setPageLimit] = useState(0);
  // const [total, setTotal] = useState(0);
  const {
    systemCalls: { gimme5 },
  } = useMUD();

  return (
    <Grid templateRows="repeat(10, 1fr)" templateColumns="repeat(5, 1fr)">
      <GridItem
        backgroundColor="mintcream"
        colSpan={4}
        colStart={2}
        p={5}
        rowSpan={2}
      >
        <Heading textAlign="right" my={5}>
          2,00 $GOLD
        </Heading>
        <Stack direction="row" mb={8} spacing={8} w="100%">
          <InputGroup w="100%">
            <InputLeftElement h="100%" pointerEvents="none">
              <FaSearch />
            </InputLeftElement>
            <Input
              onChange={e => setQuery(e.target.value)}
              placeholder="Search"
              value={query}
            />
          </InputGroup>
          <HStack>
            <Button
              onClick={() => setFilter({ filtered: 'all' })}
              size="sm"
              variant={filter.filtered == 'all' ? 'solid' : 'outline'}
            >
              All
            </Button>
            <Button
              onClick={() => setFilter({ filtered: 'byWarrior' })}
              size="sm"
              variant={filter.filtered == 'byWarrior' ? 'solid' : 'outline'}
            >
              Warrior
            </Button>
            <Button
              onClick={() =>
                setFilter({
                  filtered: 'byRogue',
                })
              }
              size="sm"
              variant={filter.filtered == 'byRogue' ? 'solid' : 'outline'}
            >
              Rogue
            </Button>
            <Button
              onClick={() => setFilter({ filtered: 'byMage' })}
              size="sm"
              variant={filter.filtered == 'byMage' ? 'solid' : 'outline'}
            >
              Mage
            </Button>
          </HStack>
        </Stack>
      </GridItem>
      <GridItem
        backgroundColor="lavender"
        colSpan={4}
        colStart={2}
        p={5}
        rowSpan={8}
        rowStart={3}
      >
        <Flex direction="row" w="100%">
          <Grid templateColumns="repeat(10, 1fr)" w="100%">
            <GridItem colSpan={6}>
              <Text>Items</Text>
            </GridItem>
            <GridItem colSpan={1}>
              <Button
                fontWeight={sort.sorted == 'byStats' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byStats',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="ghost"
              >
                <Text mr={5} size={{ base: '2xs', sm: 'xs' }}>
                  Total Stats
                </Text>
                {sort.sorted == 'byStats' && sort.reversed && (
                  <FaSortAmountUp />
                )}
                {sort.sorted == 'byStats' && !sort.reversed && (
                  <FaSortAmountDown />
                )}
                {sort.sorted != 'byStats' && <FaSortAmountDown color="grey" />}
              </Button>
            </GridItem>
            <GridItem colSpan={1}>
              <Button
                fontWeight={sort.sorted == 'byLevel' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byLevel',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="ghost"
              >
                <Text mr={5} size={{ base: '2xs', sm: 'xs' }}>
                  Level
                </Text>
                {sort.sorted == 'byLevel' && sort.reversed && (
                  <FaSortAmountUp />
                )}
                {sort.sorted == 'byLevel' && !sort.reversed && (
                  <FaSortAmountDown />
                )}
                {sort.sorted != 'byLevel' && <FaSortAmountDown color="grey" />}
              </Button>
            </GridItem>
            <GridItem colSpan={2}>
              <Button
                fontWeight={sort.sorted == 'byGold' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byGold',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="ghost"
              >
                <Text mr={5} size={{ base: '2xs', sm: 'xs' }}>
                  $Gold
                </Text>
                {sort.sorted == 'byGold' && sort.reversed && <FaSortAmountUp />}
                {sort.sorted == 'byGold' && !sort.reversed && (
                  <FaSortAmountDown />
                )}
                {sort.sorted != 'byGold' && <FaSortAmountDown color="grey" />}
              </Button>
            </GridItem>
          </Grid>
        </Flex>
        <Heading>Free Item Store</Heading>
        <Button onClick={gimme5}>Gimme 5</Button>
      </GridItem>
      <GridItem
        backgroundColor="powderblue"
        colSpan={1}
        colStart={1}
        rowSpan={10}
        rowStart={1}
      >
      </GridItem>
    </Grid>
  );
};
