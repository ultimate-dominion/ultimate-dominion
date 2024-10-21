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
import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { formatEther, hexToString } from 'viem';
import { useAccount } from 'wagmi';

import { LeaderboardRow } from '../components/LeaderboardRow';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import {
  LeaderboardIconSvg,
  MageSvg,
  RogueSvg,
  WarriorSvg,
} from '../components/SVGs';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { HOME_PATH } from '../Routes';
import {
  decodeBaseStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import { Character, EntityStats, StatsClasses } from '../utils/types';

const PLAYERS_PER_PAGE = 10;

export const Leaderboard = (): JSX.Element => {
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      GoldBalances,
    },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isFetchingCharacters, setIsFetchingCharacters] = useState(true);

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
      window.location.reload();
    }
  }, [isConnected, navigate]);

  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

  const allCharacterEntities = useEntityQuery([Has(Characters)]);
  const getAllCharacters = useCallback(
    async (entities: Entity[]): Promise<void> => {
      if (!(delegatorAddress && publicClient && worldContract)) return;

      try {
        setIsFetchingCharacters(true);

        const _characters: Character[] = await Promise.all(
          entities.map(async (entity: Entity) => {
            const characterData = getComponentValueStrict(Characters, entity);
            let baseStats = {
              agility: 0n,
              currentHp: 0n,
              entityClass: 0,
              experience: 0n,
              intelligence: 0n,
              level: 0n,
              maxHp: 0n,
              strength: 0n,
            } as EntityStats;
            try {
              baseStats = decodeBaseStats(characterData.baseStats);
            } catch (err) {
              /* empty */
            }
            const characterStats = baseStats;
            const { tokenId } = characterData;

            const ownerEntity = encodeEntity(
              { address: 'address' },
              { address: characterData.owner as `0x${string}` },
            );
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(tokenId) },
            );

            const externalGoldBalance =
              getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
            const escrowGoldBalance =
              getComponentValue(AdventureEscrow, ownerEntity)?.balance ??
              BigInt(0);

            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(`ipfs://${metadataURI}`)[0],
            );

            return {
              ...fetachedMetadata,
              agility: characterStats.agility,
              entityClass: characterStats.entityClass,
              escrowGoldBalance,
              experience: characterStats.experience,
              externalGoldBalance,
              id: entity,
              intelligence: characterStats.intelligence,
              level: characterStats.level,
              locked: characterData.locked,
              maxHp: characterStats.maxHp,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              strength: characterStats.strength,
              tokenId: tokenId.toString(),
            } as Character;
          }),
        );

        setCharacters(_characters);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch other players.',
          e,
        );
      } finally {
        setIsFetchingCharacters(false);
      }
    },
    [
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      delegatorAddress,
      GoldBalances,
      publicClient,
      renderError,
      worldContract,
    ],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      if (!allCharacterEntities) return;
      await getAllCharacters(allCharacterEntities);
    })();
  }, [allCharacterEntities, getAllCharacters]);

  useEffect(() => {
    if (pageNumber < 1) {
      return;
    }
    let entriesCopy: Character[] = characters;
    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      const totalStatsA =
        Number(entryA.agility) +
        Number(entryA.strength) +
        Number(entryA.intelligence);
      const totalStatsB =
        Number(entryB.agility) +
        Number(entryB.strength) +
        Number(entryB.intelligence);

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
    const searcher = new FuzzySearch(
      [...entriesCopy],
      ['name', 'characterId', 'description'],
      { caseSensitive: false },
    );
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
    characters,
    filter,
    pageLimit,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
  ]);

  if (isFetchingCharacters) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
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
                  theme={filter === StatsClasses.Rogue ? 'light' : 'dark'}
                />
              )}
            </Button>
          </HStack>
        </Stack>
        <Flex alignItems="center" justify="space-between" w="100%">
          <Text pl={4} color="#565555" fontWeight={400} size="sm">
            {characters.length} Players
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
            bgColor="#F5F5FA1F"
            boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
            h="5px"
            w="100%"
          />
          {entries.length > 0 ? (
            [...entries].map(function (entry, i) {
              return (
                <>
                  <LeaderboardRow
                    key={`leaderboard-row-${i}`}
                    top3={i == 0 || i == 1 || i == 2}
                    index={i}
                    character={entry}
                  />
                  <Box
                    bgColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
                    h="5px"
                    w="100%"
                  />
                </>
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
