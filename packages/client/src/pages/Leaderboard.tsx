import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';

import { LeaderboardRow } from '../components/LeaderboardRow';
import { Character, StatsClasses } from '../utils/types';

const createDummyData = (num: number = 1) => {
  const result: Character[] = [];
  for (let i = 0; i < num; i++) {
    result[result.length] = {
      characterId: (Math.random() + 1).toString(36).substring(7) as Entity,
      entityClass: Math.floor(Math.random() * 3) as StatsClasses,
      goldBalance: Math.floor(Math.random() * (1000 - 100) + 100) / 100 + '',
      locked: Math.random() < 0.5,
      owner: (Math.random() + 1).toString(36).substring(7),
      tokenId: i + '',
      agility: Math.floor(Math.random() * 10) + 1 + '',
      baseHp: Math.floor(Math.random() * 10) + 1 + '',
      currentHp: Math.floor(Math.random() * 10) + 1 + '',
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

export const Leaderboard = (): JSX.Element => {
  const [entries, setEntries] = useState(DUMMY_CHARACTER);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('1');
  const [pageLimit, setPageLimit] = useState(0);

  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

  useEffect(() => {
    if (pageNumber < 1) {
      return;
    }
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
          return entry.entityClass == StatsClasses.Warrior;
        case 'byRogue':
          return entry.entityClass == StatsClasses.Rogue;
        case 'byMage':
          return entry.entityClass == StatsClasses.Mage;
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
    const _pageLimit = Math.floor(Math.ceil(entriesCopy.length / PER_PAGE));
    setPageLimit(_pageLimit);
    setEntries(
      entriesCopy.slice((pageNumber - 1) * PER_PAGE, pageNumber * PER_PAGE),
    );

    if (pageNumber > _pageLimit) {
      setPage(_pageLimit.toString());
    }
  }, [filter.filtered, pageNumber, query, sort.reversed, sort.sorted]);

  return (
    <VStack mt={16}>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        mb={8}
        spacing={{ base: 4, md: 8 }}
        w="100%"
      >
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
      <Flex justify="space-between" w="100%">
        <Text>Players {entries.length}</Text>
        <HStack>
          <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
            <Button
              display={{ base: 'none', lg: 'flex' }}
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
              w="100%"
            >
              <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                Total Stats
              </Text>
              {sort.sorted == 'byStats' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byStats' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byStats' && <FaSortAmountDown color="grey" />}
            </Button>
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
              w="100%"
            >
              <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                Level
              </Text>
              {sort.sorted == 'byLevel' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byLevel' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byLevel' && <FaSortAmountDown color="grey" />}
            </Button>
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
              w="100%"
            >
              <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                $Gold
              </Text>
              {sort.sorted == 'byGold' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byGold' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byGold' && <FaSortAmountDown color="grey" />}
            </Button>
          </HStack>
          <Box display={{ base: 'none', md: 'block' }} w="50px" />
        </HStack>
      </Flex>

      <VStack gap={3} overflowX="auto" w="100%">
        {entries.length > 0 ? (
          entries.map(function (entry, i) {
            return (
              <LeaderboardRow
                name={entry.characterId}
                gold={entry.goldBalance}
                key={`leaderboard-row-${i}`}
                level={entry.level}
                stats={{
                  HP: entry.baseHp,
                  AGI: entry.agility,
                  STR: entry.strength,
                  INT: entry.intelligence,
                }}
                total={entry.experience}
                type={entry.entityClass}
              />
            );
          })
        ) : (
          <Text mt={12}>No players</Text>
        )}
      </VStack>
      <HStack my={5} visibility={entries.length > 0 ? 'visible' : 'hidden'}>
        <Button
          onClick={() => setPage('1')}
          size="xs"
          visibility={pageNumber <= 1 ? 'hidden' : 'visible'}
        >
          <FaBackwardStep />
        </Button>
        <Button
          onClick={() =>
            setPage((pageNumber == 1 ? 1 : pageNumber - 1).toString())
          }
          size="xs"
          visibility={pageNumber <= 1 ? 'hidden' : 'visible'}
        >
          <IoCaretBack />
        </Button>
        <Input
          max={pageLimit}
          min={1}
          onChange={e => {
            const value = e.target.value;
            if (value === '') {
              setPage(value);
              return;
            }
            if (isNaN(Number(value))) {
              return;
            }
            if (Number(value) < 1) {
              return;
            }
            if (Number(value) > pageLimit) {
              return;
            }
            setPage(value);
          }}
          p={2}
          size="sm"
          value={page}
          w={10}
        />
        <Text size="sm">of {pageLimit}</Text>
        <Button
          onClick={() =>
            setPage(
              (pageNumber < pageLimit ? pageNumber + 1 : pageNumber).toString(),
            )
          }
          size="xs"
          visibility={pageNumber == pageLimit ? 'hidden' : 'visible'}
        >
          <IoCaretForward />
        </Button>
        <Button
          onClick={() => setPage(pageLimit.toString())}
          size="xs"
          visibility={pageNumber == pageLimit ? 'hidden' : 'visible'}
        >
          <FaForwardStep />
        </Button>
      </HStack>
    </VStack>
  );
};
