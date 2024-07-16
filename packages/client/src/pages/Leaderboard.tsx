import {
  Button,
  Card,
  Center,
  Grid,
  GridItem,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useState } from 'react';
import {
  FaBackward,
  FaFastBackward,
  FaFastForward,
  FaForward,
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
} from 'react-icons/fa';

import { LeaderboardRow } from '../components/LeaderboardRow';
import { Character, StatsClasses } from '../utils/types';

function createDummyData(num: number = 1) {
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
}
const DUMMY_CHARACTER: Character[] = createDummyData(50)!;
const PER_PAGE = 10;

export const Leaderboard = (): JSX.Element => {
  const [entries, setEntries] = useState(DUMMY_CHARACTER);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let entriesCopy = DUMMY_CHARACTER;
    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      switch (sort.sorted) {
        case 'byGold':
          return sort.reversed
            ? Number(entryA.goldBalance) - Number(entryB.goldBalance)
            : Number(entryB.goldBalance) - Number(entryA.goldBalance);
        case 'byLevel':
          return sort.reversed
            ? Number(entryA.level) - Number(entryB.level)
            : Number(entryB.level) - Number(entryA.level);
        case 'byStats':
          return sort.reversed
            ? Number(entryA.experience) - Number(entryB.experience)
            : Number(entryB.experience) - Number(entryA.experience);
        default:
          return Number(entryB.goldBalance) - Number(entryA.goldBalance);
      }
    });
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter.filtered) {
        case 'byWarrior':
          return entry.characterClass == 0;
        case 'byRogue':
          return entry.characterClass == 1;
        case 'byMage':
          return entry.characterClass == 2;
        default:
          return true;
      }
    });
    const searcher = new FuzzySearch(
      [...entriesCopy],
      ['name', 'characterId', 'description'],
      { caseSensitive: false },
    );
    entriesCopy = searcher.search(query);
    setPageLimit(Math.floor(Math.ceil(entriesCopy.length / PER_PAGE)));
    setEntries(entriesCopy.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    setTotal(entriesCopy.length);
  }, [filter.filtered, page, query, sort.reversed, sort.sorted]);

  return (
    <VStack minW={800} mt={5}>
      <Grid
        gap={2}
        mb={5}
        templateColumns="repeat(8, 1fr)"
        templateRows={'repeat(2, 1fr)'}
        w="100%"
      >
        <GridItem
          colSpan={{ md: 4, base: 8 }}
          colStart={{ base: 1, md: 1 }}
          rowStart={{ base: 1, md: 2 }}
        >
          <Center>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <FaSearch />
              </InputLeftElement>
              <Input
                onChange={e => setQuery(e.target.value)}
                placeholder="Search"
                value={query}
              />
            </InputGroup>{' '}
          </Center>
        </GridItem>
        <GridItem colSpan={{ base: 2, md: 1 }} rowStart={{ base: 2, md: 2 }}>
          <Center>
            <Button
              onClick={() => setFilter({ filtered: 'all' })}
              variant={filter.filtered == 'all' ? 'solid' : 'outline'}
            >
              All
            </Button>{' '}
          </Center>
        </GridItem>
        <GridItem colSpan={{ base: 2, md: 1 }} rowStart={{ base: 2, md: 2 }}>
          <Center>
            <Button
              onClick={() => setFilter({ filtered: 'byWarrior' })}
              variant={filter.filtered == 'byWarrior' ? 'solid' : 'outline'}
            >
              Warrior
            </Button>{' '}
          </Center>
        </GridItem>
        <GridItem colSpan={{ base: 2, md: 1 }} rowStart={{ base: 2, md: 2 }}>
          <Center>
            <Button
              onClick={() =>
                setFilter({
                  filtered: 'byRogue',
                })
              }
              variant={filter.filtered == 'byRogue' ? 'solid' : 'outline'}
            >
              Rogue
            </Button>{' '}
          </Center>
        </GridItem>
        <GridItem colSpan={{ base: 2, md: 1 }} rowStart={{ base: 2, md: 2 }}>
          <Center>
            <Button
              onClick={() => setFilter({ filtered: 'byMage' })}
              variant={filter.filtered == 'byMage' ? 'solid' : 'outline'}
            >
              Mage
            </Button>
          </Center>
        </GridItem>
      </Grid>
      <Card
        border="none"
        direction="row"
        overflow="hidden"
        variant="outline"
        w="100%"
      >
        <Center>
          <Text>Players {total}</Text>
        </Center>
        <Spacer />
        <Grid
          mr={5}
          float="right"
          templateColumns="repeat(10, 1fr)"
          w={{ base: '60vh', lg: '60vh' }}
        >
          <GridItem colSpan={3}>
            <Center>
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
                {sort.sorted == 'byStats' && sort.reversed ? (
                  <FaSortAmountUp />
                ) : null}
                {sort.sorted == 'byStats' && !sort.reversed ? (
                  <FaSortAmountDown />
                ) : null}
                {sort.sorted != 'byStats' ? (
                  <FaSortAmountDown color="grey" />
                ) : null}
              </Button>
            </Center>
          </GridItem>
          <GridItem colSpan={3}>
            <Center>
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
                {sort.sorted == 'byLevel' && sort.reversed ? (
                  <FaSortAmountUp />
                ) : null}
                {sort.sorted == 'byLevel' && !sort.reversed ? (
                  <FaSortAmountDown />
                ) : null}
                {sort.sorted != 'byLevel' ? (
                  <FaSortAmountDown color="grey" />
                ) : null}
              </Button>
            </Center>
          </GridItem>
          <GridItem colSpan={3}>
            <Center>
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
                {sort.sorted == 'byGold' && sort.reversed ? (
                  <FaSortAmountUp />
                ) : null}
                {sort.sorted == 'byGold' && !sort.reversed ? (
                  <FaSortAmountDown />
                ) : null}
                {sort.sorted != 'byGold' ? (
                  <FaSortAmountDown color="grey" />
                ) : null}
              </Button>
            </Center>
          </GridItem>
          <GridItem colSpan={1}></GridItem>
        </Grid>
      </Card>

      <VStack gap={3} overflowX="auto" w="100%">
        {entries.length > 0 ? (
          entries.map(function (entry, i) {
            return (
              <LeaderboardRow
                name={entry.characterId}
                gold={entry.goldBalance}
                level={entry.level}
                stats={{
                  HP: entry.baseHitPoints,
                  AGI: entry.agility,
                  STR: entry.strength,
                  INT: entry.intelligence,
                }}
                total={entry.experience}
                type={entry.characterClass}
                key={i}
              />
            );
          })
        ) : (
          <Text fontWeight="bold">No players</Text>
        )}
      </VStack>
      <HStack my={5} visibility={total ? 'visible' : 'hidden'}>
        <Button
          onClick={() => setPage(1)}
          size="sm"
          visibility={page == 1 ? 'hidden' : 'visible'}
        >
          <FaFastBackward />
        </Button>
        <Button
          onClick={() => setPage(page == 1 ? 1 : page - 1)}
          size="sm"
          visibility={page == 1 ? 'hidden' : 'visible'}
        >
          <FaBackward />
        </Button>
        <Button>
          <Input
            max={pageLimit}
            min={1}
            mr={5}
            onChange={e => setPage(e.target.value)}
            value={page}
            w={50}
          />
          of {pageLimit}
        </Button>

        <Button
          onClick={() => setPage(page < pageLimit ? page + 1 : page)}
          size="sm"
          visibility={page == pageLimit ? 'hidden' : 'visible'}
        >
          <FaForward />
        </Button>
        <Button
          onClick={() => setPage(pageLimit)}
          size="sm"
          visibility={page == pageLimit ? 'hidden' : 'visible'}
        >
          <FaFastForward />
        </Button>
      </HStack>
    </VStack>
  );
};
