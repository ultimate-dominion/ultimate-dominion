import {
  Button,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  HStack,
  Input,
  Spacer,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useState } from 'react';
import { FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';

import { Entry } from '../components/Leaderboard/Entry';
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
const PER_PAGE = 5;

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
    <VStack mt={5}>
      <HStack my={5} w="100%">
        <Input
          onChange={e => setQuery(e.target.value)}
          placeholder="Search"
          value={query}
        />
        <Button onClick={() => setFilter({ filtered: 'all' })} variant="solid">
          All
        </Button>
        <Button
          onClick={() => setFilter({ filtered: 'byWarrior' })}
          variant="solid"
        >
          Warrior
        </Button>
        <Button
          onClick={() =>
            setFilter({
              filtered: 'byRogue',
            })
          }
          variant="solid"
        >
          Rogue
        </Button>
        <Button
          onClick={() => setFilter({ filtered: 'byMage' })}
          variant="solid"
        >
          Mage
        </Button>
      </HStack>
      <Card
        border="none"
        direction="row"
        overflow="hidden"
        variant="outline"
        w="100%"
      >
        <Stack w="100%">
          <CardBody w="100%">
            <HStack w="100%">
              <VStack>
                <HStack>
                  <Text textAlign="left">{total} Players</Text>
                  <Text size="sm" />
                  <Center />
                </HStack>
              </VStack>
              <Spacer />
              <Grid templateColumns="repeat(3, 1fr)" w="50%">
                <GridItem>
                  <Center>
                    <Button
                      fontWeight=""
                      onClick={() =>
                        setSort({
                          sorted: 'byStats',
                          reversed: !sort.reversed,
                        })
                      }
                      variant="ghost"
                    >
                      <Text mr={5}>Total Stats</Text>
                      {sort.sorted == 'byStats' && sort.reversed ? (
                        <FaSortAmountUp />
                      ) : null}
                      {sort.sorted == 'byStats' && !sort.reversed ? (
                        <FaSortAmountDown />
                      ) : null}
                    </Button>
                  </Center>
                </GridItem>
                <GridItem>
                  <Center>
                    <Button
                      fontWeight=""
                      onClick={() =>
                        setSort({
                          sorted: 'byLevel',
                          reversed: !sort.reversed,
                        })
                      }
                      variant="ghost"
                    >
                      <Text mr={5}>Level</Text>
                      {sort.sorted == 'byLevel' && sort.reversed ? (
                        <FaSortAmountUp />
                      ) : null}
                      {sort.sorted == 'byLevel' && !sort.reversed ? (
                        <FaSortAmountDown />
                      ) : null}
                    </Button>
                  </Center>
                </GridItem>
                <GridItem>
                  <Center>
                    <Button
                      fontWeight=""
                      onClick={() =>
                        setSort({
                          sorted: 'byGold',
                          reversed: !sort.reversed,
                        })
                      }
                      variant="ghost"
                    >
                      <Text mr={5}>Gold</Text>
                      {sort.sorted == 'byGold' && sort.reversed ? (
                        <FaSortAmountUp />
                      ) : null}
                      {sort.sorted == 'byGold' && !sort.reversed ? (
                        <FaSortAmountDown />
                      ) : null}
                    </Button>
                  </Center>
                </GridItem>
              </Grid>
              <Button variant="link" />
            </HStack>
          </CardBody>
        </Stack>
      </Card>

      <VStack gap={3} w="100%">
        {entries.length > 0 ? (
          entries.map(function (entry, i) {
            return (
              <Entry
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
              ></Entry>
            );
          })
        ) : (
          <Card
            background="black"
            color="white"
            margin="0 auto"
            variant="filled"
          >
            <CardBody>
              <Text fontWeight="bold">No players</Text>
            </CardBody>
          </Card>
        )}
      </VStack>
      <HStack my={5}>
        {page > 1 && (
          <Button onClick={() => setPage(1)} size="sm" variant="outline">
            First
          </Button>
        )}
        {page == pageLimit && pageLimit > 1 && page - 2 > 0 && (
          <Button onClick={() => setPage(page - 2)} size="sm" variant="outline">
            {page - 2}
          </Button>
        )}
        {page - 1 > -1 && (
          <Button
            onClick={() => setPage(page == 1 ? 1 : page - 1)}
            size="sm"
            variant={page == 1 ? 'solid' : 'outline'}
          >
            {page == 1 ? 1 : page - 1}
          </Button>
        )}
        {pageLimit > 1 && (
          <Button
            onClick={() => setPage(page == 1 ? 2 : page)}
            size="sm"
            variant={page > 1 ? 'solid' : 'outline'}
          >
            {page == 1 ? 2 : page}
          </Button>
        )}
        {page + 1 <= pageLimit && pageLimit > 2 && (
          <Button
            onClick={() => setPage(page == 1 ? 3 : page + 1)}
            size="sm"
            variant="outline"
          >
            {page == 1 ? 3 : page + 1}
          </Button>
        )}

        {page < pageLimit && (
          <Button
            onClick={() => setPage(pageLimit)}
            size="sm"
            variant="outline"
          >
            Last
          </Button>
        )}
      </HStack>
    </VStack>
  );
};
