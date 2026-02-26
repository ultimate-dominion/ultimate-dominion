import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Stack,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { formatEther } from 'viem';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import {
  LeaderboardIconSvg,
  MageSvg,
  RogueSvg,
  WarriorSvg,
} from '../components/SVGs';
import { useAuth } from '../contexts/AuthContext';
import { useMap } from '../contexts/MapContext';
import { HOME_PATH } from '../Routes';
import { Character, StatsClasses } from '../utils/types';

const PLAYERS_PER_PAGE = 10;

export const Leaderboard = (): JSX.Element => {
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const navigate = useNavigate();
  const { isAuthenticated: isConnected } = useAuth();
  const { allCharacters, isFetchingEntities, refreshEntities } = useMap();

  const [entries, setEntries] = useState<Character[]>([]);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState<StatsClasses | 'All'>('All');
  const [query, setQuery] = useState('');

  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);

  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
    } else {
      refreshEntities();
    }
  }, [isConnected, navigate, refreshEntities]);

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
    let entriesCopy: Character[] = allCharacters;
    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      const totalStatsA =
        Number(entryA.baseStats.agility) +
        Number(entryA.baseStats.strength) +
        Number(entryA.baseStats.intelligence);
      const totalStatsB =
        Number(entryB.baseStats.agility) +
        Number(entryB.baseStats.strength) +
        Number(entryB.baseStats.intelligence);

      switch (sort.sorted) {
        case 'byGold':
          return sort.reversed
            ? Number(
                formatEther(
                  entryA.externalGoldBalance - entryB.externalGoldBalance,
                ),
              )
            : Number(
                formatEther(
                  entryB.externalGoldBalance - entryA.externalGoldBalance,
                ),
              );
        case 'byLevel':
          return sort.reversed
            ? Number(entryA.level) - Number(entryB.level)
            : Number(entryB.level) - Number(entryA.level);
        case 'byStats':
          return sort.reversed
            ? Number(totalStatsA) - Number(totalStatsB)
            : Number(totalStatsB) - Number(totalStatsA);
        default:
          return Number(
            formatEther(
              entryB.externalGoldBalance - entryA.externalGoldBalance,
            ),
          );
      }
    });
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter) {
        case StatsClasses.Warrior:
          return entry.entityClass == StatsClasses.Warrior;
        case StatsClasses.Rogue:
          return entry.entityClass == StatsClasses.Rogue;
        case StatsClasses.Mage:
          return entry.entityClass == StatsClasses.Mage;
        default:
          return true;
      }
    });
    const searcher = new FuzzySearch([...entriesCopy], ['name'], {
      caseSensitive: false,
    });
    entriesCopy = searcher.search(query);

    setLength(entriesCopy.length);
    setEntries(
      entriesCopy.slice(
        (pageNumber - 1) * PLAYERS_PER_PAGE,
        pageNumber * PLAYERS_PER_PAGE,
      ),
    );

    if (pageNumber > pageLimit) {
      setPage(pageLimit);
    }
  }, [
    allCharacters,
    filter,
    pageLimit,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
  ]);

  if (isFetchingEntities) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>Leaderboard | Ultimate Dominion</title>
      </Helmet>
      <VStack>
        <HStack bgColor="blue500" h="66px" px="20px" width="100%">
          <LeaderboardIconSvg />
          <Heading color="white">Leaderboard</Heading>
        </HStack>

        <Stack
          direction={{ base: 'column', md: 'row' }}
          mb={8}
          my={4}
          px={3}
          spacing={{ base: 4, md: 8 }}
          w="100%"
        >
          <InputGroup>
            <InputLeftElement h="100%" pointerEvents="none">
              <FaSearch />
            </InputLeftElement>
            <Input
              onChange={e => setQuery(e.target.value)}
              placeholder="Search"
              value={query}
            />
          </InputGroup>
          <HStack px={{ base: 0, sm: 3 }}>
            <Button
              bgColor={filter == 'All' ? 'grey500' : undefined}
              color={filter == 'All' ? 'white' : undefined}
              onClick={() => setFilter('All')}
              size="sm"
              variant="white"
            >
              All
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <WarriorSvg
                    theme={filter === StatsClasses.Warrior ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Warrior ? 'grey500' : undefined}
              color={filter === StatsClasses.Warrior ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Warrior)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                'Warrior'
              ) : (
                <WarriorSvg
                  theme={filter === StatsClasses.Warrior ? 'light' : 'dark'}
                />
              )}
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <RogueSvg
                    theme={filter === StatsClasses.Rogue ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Rogue ? 'grey500' : undefined}
              color={filter === StatsClasses.Rogue ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Rogue)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                'Rogue'
              ) : (
                <RogueSvg
                  theme={filter === StatsClasses.Rogue ? 'light' : 'dark'}
                />
              )}
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <MageSvg
                    theme={filter === StatsClasses.Mage ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Mage ? 'grey500' : undefined}
              color={filter === StatsClasses.Mage ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Mage)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                'Mage'
              ) : (
                <MageSvg
                  theme={filter === StatsClasses.Mage ? 'light' : 'dark'}
                />
              )}
            </Button>
          </HStack>
        </Stack>
        <Flex alignItems="center" justify="space-between" w="100%">
          <Text pl={4} color="#565555" fontWeight={400} size="sm">
            {allCharacters.length} Players
          </Text>
          <HStack>
            <HStack
              w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}
            >
              <Button
                color="#565555"
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
                variant="unstyled"
                w="100%"
              >
                <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
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
              <Button
                color="#565555"
                display="flex"
                fontWeight={sort.sorted == 'byLevel' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byLevel',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="unstyled"
                w="100%"
              >
                <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
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
              <Button
                color="#565555"
                display="flex"
                fontWeight={sort.sorted == 'byGold' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byGold',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="unstyled"
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
            <Box display={{ base: 'none', md: 'block' }} w="80px" />
          </HStack>
        </Flex>

        <VStack overflowX="auto" spacing={0} w="100%">
          <Box
            bgColor="rgba(196,184,158,0.08)"
            boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
            h="5px"
            w="100%"
          />
          {entries.length > 0 ? (
            [...entries].map(function (entry, i) {
              return (
                <Box key={`leaderboard-row-${i}`} w="100%">
                  <LeaderboardRow
                    top3={i == 0 || i == 1 || i == 2}
                    index={i}
                    character={entry}
                  />
                  <Box
                    bg="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="1px"
                    w="100%"
                  />
                </Box>
              );
            })
          ) : (
            <Text mt={12}>No players</Text>
          )}
        </VStack>
        <HStack my={5} visibility={entries.length > 0 ? 'visible' : 'hidden'}>
          <Pagination
            length={length}
            page={page}
            pageLimit={pageLimit}
            perPage={PLAYERS_PER_PAGE}
            setPage={setPage}
            setPageLimit={setPageLimit}
          />
        </HStack>
      </VStack>
    </PolygonalCard>
  );
};
