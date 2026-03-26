import {
  Avatar,
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
  Tooltip,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaSortAmountDown, FaSortAmountUp, FaMedal, FaCrosshairs } from 'react-icons/fa';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { formatEther } from 'viem';
import { SHOW_Z2 } from '../lib/env';
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
import { useGameTable, useGameValue, toNumber } from '../lib/gameStore';
import { CHARACTERS_PATH, HOME_PATH } from '../Routes';
import { Character, StatsClasses } from '../utils/types';

const PLAYERS_PER_PAGE = 10;

type LeaderboardTab = 'rankings' | 'raceToMax' | 'pvpRankings';

type ZoneCompletionEntry = {
  characterId: string;
  characterName: string;
  characterImage?: string;
  completedAt: number;
  rank: number;
  hasBadge: boolean;
};

type PvpRankingEntry = {
  characterId: string;
  characterName: string;
  characterImage?: string;
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
};

export const Leaderboard = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const navigate = useNavigate();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();
  const { allCharacters } = useMap();
  const zoneCompletionTable = useGameTable('CharacterZoneCompletion');
  const pvpRatingTable = useGameTable('PvpRating');
  const pvpSeasonData = useGameValue('PvpSeason', '');

  const [tab, setTab] = useState<LeaderboardTab>('rankings');
  const [entries, setEntries] = useState<Character[]>([]);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState<StatsClasses | 'All'>('All');
  const [query, setQuery] = useState('');

  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);

  // Zone completion data for Race to Max tab
  const zoneCompletions: ZoneCompletionEntry[] = useMemo(() => {
    if (!zoneCompletionTable) return [];

    return Object.entries(zoneCompletionTable)
      .map(([keyBytes, data]) => {
        if (!data.completed) return null;

        const character = allCharacters.find(c => c.id === (data.characterId as string));

        return {
          characterId: data.characterId as string,
          characterName: character?.name ?? 'Unknown',
          characterImage: character?.image,
          completedAt: Number(data.completedAt),
          rank: Number(data.rank),
          hasBadge: Number(data.rank) <= 10,
        };
      })
      .filter((e): e is ZoneCompletionEntry => e !== null)
      .sort((a, b) => a.rank - b.rank);
  }, [zoneCompletionTable, allCharacters]);

  // PvP ranking data
  const pvpRankings: PvpRankingEntry[] = useMemo(() => {
    if (!pvpRatingTable) return [];

    return Object.entries(pvpRatingTable)
      .map(([, data]) => {
        const charId = data.characterId as string;
        if (!charId) return null;
        const character = allCharacters.find(c => c.id === charId);
        const wins = toNumber(data.wins);
        const losses = toNumber(data.losses);
        const total = wins + losses;
        return {
          characterId: charId,
          characterName: character?.name ?? 'Unknown',
          characterImage: character?.image,
          elo: toNumber(data.elo),
          wins,
          losses,
          winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
        };
      })
      .filter((e): e is PvpRankingEntry => e !== null)
      .sort((a, b) => b.elo - a.elo);
  }, [pvpRatingTable, allCharacters]);

  // PvP pagination
  const [pvpPage, setPvpPage] = useState(1);
  const [pvpPageLimit, setPvpPageLimit] = useState(1);

  const pagedPvpRankings = useMemo(
    () =>
      pvpRankings.slice(
        (pvpPage - 1) * PLAYERS_PER_PAGE,
        pvpPage * PLAYERS_PER_PAGE,
      ),
    [pvpRankings, pvpPage],
  );

  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
    }
  }, [isConnected, isConnecting, navigate]);

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
        case 'byGold': {
          const totalGoldA = entryA.externalGoldBalance;
          const totalGoldB = entryB.externalGoldBalance;
          return sort.reversed
            ? Number(formatEther(totalGoldA - totalGoldB))
            : Number(formatEther(totalGoldB - totalGoldA));
        }
        case 'byLevel':
          return sort.reversed
            ? Number(entryA.level) - Number(entryB.level)
            : Number(entryB.level) - Number(entryA.level);
        case 'byStats':
          return sort.reversed
            ? Number(totalStatsA) - Number(totalStatsB)
            : Number(totalStatsB) - Number(totalStatsA);
        default: {
          const defTotalGoldA = entryA.externalGoldBalance;
          const defTotalGoldB = entryB.externalGoldBalance;
          return Number(formatEther(defTotalGoldB - defTotalGoldA));
        }
      }
    });
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter) {
        case StatsClasses.Strength:
          return entry.entityClass == StatsClasses.Strength;
        case StatsClasses.Agility:
          return entry.entityClass == StatsClasses.Agility;
        case StatsClasses.Intelligence:
          return entry.entityClass == StatsClasses.Intelligence;
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

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>{t('leaderboard.pageTitle')}</title>
      </Helmet>
      <VStack>
        <HStack bgColor="blue500" h="66px" px="20px" width="100%">
          <LeaderboardIconSvg />
          <Heading color="white">{t('leaderboard.heading')}</Heading>
        </HStack>

        {/* Tab switcher */}
        <HStack px={3} pt={3} spacing={2} w="100%">
          <Button
            bgColor={tab === 'rankings' ? 'grey500' : undefined}
            color={tab === 'rankings' ? 'white' : undefined}
            onClick={() => setTab('rankings')}
            size="sm"
            variant="white"
          >
            {t('leaderboard.tabs.rankings')}
          </Button>
          <Button
            bgColor={tab === 'raceToMax' ? 'grey500' : undefined}
            color={tab === 'raceToMax' ? 'white' : undefined}
            leftIcon={<FaMedal color={tab === 'raceToMax' ? '#D4A54A' : undefined} />}
            onClick={() => setTab('raceToMax')}
            size="sm"
            variant="white"
          >
            {t('leaderboard.tabs.raceToMax')}
          </Button>
          {SHOW_Z2 && (
            <Button
              bgColor={tab === 'pvpRankings' ? 'grey500' : undefined}
              color={tab === 'pvpRankings' ? 'white' : undefined}
              leftIcon={<FaCrosshairs color={tab === 'pvpRankings' ? '#E85D5D' : undefined} />}
              onClick={() => setTab('pvpRankings')}
              size="sm"
              variant="white"
            >
              {t('leaderboard.tabs.pvpRankings')}
            </Button>
          )}
        </HStack>

        {tab === 'rankings' && <><Stack
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
              placeholder={t('leaderboard.search')}
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
              {t('leaderboard.filterAll')}
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <WarriorSvg
                    theme={filter === StatsClasses.Strength ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Strength ? 'grey500' : undefined}
              color={filter === StatsClasses.Strength ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Strength)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                t('leaderboard.filterStrength')
              ) : (
                <WarriorSvg
                  theme={filter === StatsClasses.Strength ? 'light' : 'dark'}
                />
              )}
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <RogueSvg
                    theme={filter === StatsClasses.Agility ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Agility ? 'grey500' : undefined}
              color={filter === StatsClasses.Agility ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Agility)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                t('leaderboard.filterAgility')
              ) : (
                <RogueSvg
                  theme={filter === StatsClasses.Agility ? 'light' : 'dark'}
                />
              )}
            </Button>
            <Button
              leftIcon={
                isSmallScreen ? undefined : (
                  <MageSvg
                    theme={filter === StatsClasses.Intelligence ? 'light' : 'dark'}
                  />
                )
              }
              bgColor={filter === StatsClasses.Intelligence ? 'grey500' : undefined}
              color={filter === StatsClasses.Intelligence ? 'white' : undefined}
              onClick={() => setFilter(StatsClasses.Intelligence)}
              size="sm"
              variant="white"
            >
              {!isSmallScreen ? (
                t('leaderboard.filterIntelligence')
              ) : (
                <MageSvg
                  theme={filter === StatsClasses.Intelligence ? 'light' : 'dark'}
                />
              )}
            </Button>
          </HStack>
        </Stack>
        <Flex alignItems="center" justify="space-between" w="100%">
          <Text pl={4} color="#565555" fontWeight={400} size="sm">
            {t('leaderboard.playerCount', { count: allCharacters.length })}
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
                  {t('leaderboard.sortStats')}
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
                  {t('leaderboard.sortLevel')}
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
                  {t('leaderboard.sortGold')}
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
            <Text mt={12}>{t('leaderboard.noPlayers')}</Text>
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
        </>}

        {tab === 'raceToMax' && (
          <VStack px={3} py={4} spacing={3} w="100%">
            <Text color="#8A7E6A" size="sm" textAlign="center">
              {t('leaderboard.raceToMaxDesc')}
            </Text>

            <VStack spacing={0} w="100%">
              <Box
                bgColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="5px"
                w="100%"
              />
              {zoneCompletions.length > 0 ? (
                zoneCompletions.map((entry) => (
                  <Box key={`zone-${entry.characterId}`} w="100%">
                    <HStack
                      as={RouterLink}
                      px={4}
                      py={3}
                      spacing={3}
                      to={`${CHARACTERS_PATH}/${entry.characterId}`}
                      w="100%"
                      _hover={{ bg: 'rgba(196,184,158,0.06)' }}
                    >
                      <Text
                        color={entry.rank <= 3 ? '#D4A54A' : '#8A7E6A'}
                        fontFamily="mono"
                        fontWeight={700}
                        minW="30px"
                        size="sm"
                      >
                        #{entry.rank}
                      </Text>
                      {entry.hasBadge && (
                        <Tooltip hasArrow label={t('leaderboard.zoneConqueror')} placement="top">
                          <span>
                            <FaMedal color="#D4A54A" size={14} />
                          </span>
                        </Tooltip>
                      )}
                      <Avatar size="xs" src={entry.characterImage} />
                      <Text
                        color="#E8DCC8"
                        flex={1}
                        fontWeight={600}
                        size="sm"
                      >
                        {entry.characterName}
                      </Text>
                      <Text
                        color="#6A6050"
                        display={{ base: 'none', sm: 'block' }}
                        fontFamily="mono"
                        size="xs"
                      >
                        {new Date(entry.completedAt * 1000).toLocaleDateString()}
                      </Text>
                    </HStack>
                    <Box
                      bg="rgba(196,184,158,0.08)"
                      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                      h="1px"
                      w="100%"
                    />
                  </Box>
                ))
              ) : (
                <VStack py={8} spacing={2}>
                  <FaMedal color="#5A5040" size={32} />
                  <Text color="#8A7E6A" mt={2} size="sm">
                    {t('leaderboard.noneConquered')}
                  </Text>
                  <Text color="#5A5040" size="xs">
                    {t('leaderboard.beFirst')}
                  </Text>
                </VStack>
              )}
            </VStack>

            {/* In-progress characters */}
            {zoneCompletions.length > 0 && zoneCompletions.length < 10 && (
              <Text color="#5A5040" mt={2} size="xs" textAlign="center">
                {t('leaderboard.badgesRemaining', { count: 10 - zoneCompletions.length })}
              </Text>
            )}
          </VStack>
        )}

        {SHOW_Z2 && tab === 'pvpRankings' && (
          <VStack px={3} py={4} spacing={3} w="100%">
            {pvpSeasonData && (
              <HStack
                bg="rgba(232,93,93,0.08)"
                border="1px solid"
                borderColor="rgba(232,93,93,0.2)"
                borderRadius="md"
                justify="center"
                px={4}
                py={2}
                spacing={2}
                w="100%"
              >
                <FaCrosshairs color="#E85D5D" size={14} />
                <Text color="#E85D5D" fontSize="sm" fontWeight={600}>
                  {t('leaderboard.season', { number: toNumber(pvpSeasonData.season) })}
                </Text>
                {pvpSeasonData.name && (
                  <Text color="#8A7E6A" fontSize="xs">
                    — {pvpSeasonData.name as string}
                  </Text>
                )}
              </HStack>
            )}

            <Text color="#8A7E6A" size="sm" textAlign="center">
              {t('leaderboard.pvpDesc')}
            </Text>

            {/* Column headers */}
            <Flex align="center" justify="space-between" px={4} w="100%">
              <HStack flex={1} spacing={3}>
                <Text color="#565555" fontWeight={400} minW="30px" size="xs">
                  {t('leaderboard.colRank')}
                </Text>
                <Text color="#565555" fontWeight={400} size="xs">
                  {t('leaderboard.colPlayer')}
                </Text>
              </HStack>
              <HStack spacing={4}>
                <Text
                  color="#565555"
                  display={{ base: 'none', sm: 'block' }}
                  fontWeight={400}
                  minW="50px"
                  size="xs"
                  textAlign="center"
                >
                  {t('leaderboard.colWL')}
                </Text>
                <Text
                  color="#565555"
                  display={{ base: 'none', sm: 'block' }}
                  fontWeight={400}
                  minW="45px"
                  size="xs"
                  textAlign="center"
                >
                  {t('leaderboard.colWinPct')}
                </Text>
                <Text
                  color="#565555"
                  fontWeight={400}
                  minW="50px"
                  size="xs"
                  textAlign="right"
                >
                  {t('leaderboard.colElo')}
                </Text>
              </HStack>
            </Flex>

            <VStack spacing={0} w="100%">
              <Box
                bgColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="5px"
                w="100%"
              />
              {pagedPvpRankings.length > 0 ? (
                pagedPvpRankings.map((entry, i) => {
                  const rank = (pvpPage - 1) * PLAYERS_PER_PAGE + i + 1;
                  return (
                    <Box key={`pvp-${entry.characterId}`} w="100%">
                      <HStack
                        as={RouterLink}
                        px={4}
                        py={3}
                        spacing={3}
                        to={`${CHARACTERS_PATH}/${entry.characterId}`}
                        w="100%"
                        _hover={{ bg: 'rgba(196,184,158,0.06)' }}
                      >
                        <Text
                          color={rank <= 3 ? '#E85D5D' : '#8A7E6A'}
                          fontFamily="mono"
                          fontWeight={700}
                          minW="30px"
                          size="sm"
                        >
                          #{rank}
                        </Text>
                        <Avatar size="xs" src={entry.characterImage} />
                        <Text
                          color="#E8DCC8"
                          flex={1}
                          fontWeight={600}
                          size="sm"
                        >
                          {entry.characterName}
                        </Text>
                        <HStack spacing={4}>
                          <Text
                            color="#6A6050"
                            display={{ base: 'none', sm: 'block' }}
                            fontFamily="mono"
                            minW="50px"
                            size="xs"
                            textAlign="center"
                          >
                            {entry.wins}/{entry.losses}
                          </Text>
                          <Text
                            color={
                              entry.winRate >= 60
                                ? '#6AAF6A'
                                : entry.winRate >= 40
                                  ? '#C8A96E'
                                  : '#AF6A6A'
                            }
                            display={{ base: 'none', sm: 'block' }}
                            fontFamily="mono"
                            minW="45px"
                            size="xs"
                            textAlign="center"
                          >
                            {entry.winRate}%
                          </Text>
                          <Text
                            color="#E8DCC8"
                            fontFamily="mono"
                            fontWeight={700}
                            minW="50px"
                            size="sm"
                            textAlign="right"
                          >
                            {entry.elo}
                          </Text>
                        </HStack>
                      </HStack>
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
                <VStack py={8} spacing={2}>
                  <FaCrosshairs color="#5A5040" size={32} />
                  <Text color="#8A7E6A" mt={2} size="sm">
                    {t('leaderboard.noPvp')}
                  </Text>
                  <Text color="#5A5040" size="xs">
                    {t('leaderboard.pvpCta')}
                  </Text>
                </VStack>
              )}
            </VStack>

            <HStack
              my={3}
              visibility={pvpRankings.length > PLAYERS_PER_PAGE ? 'visible' : 'hidden'}
            >
              <Pagination
                length={pvpRankings.length}
                page={pvpPage}
                pageLimit={pvpPageLimit}
                perPage={PLAYERS_PER_PAGE}
                setPage={setPvpPage}
                setPageLimit={setPvpPageLimit}
              />
            </HStack>
          </VStack>
        )}
      </VStack>
    </PolygonalCard>
  );
};
