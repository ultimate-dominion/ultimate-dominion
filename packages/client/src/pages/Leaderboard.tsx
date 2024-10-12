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
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import { Character, StatsClasses } from '../utils/types';

const PLAYERS_PER_PAGE = 10;

export const Leaderboard = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      GoldBalances,
      Stats,
    },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isFetchingCharacters, setIsFetchingCharacters] = useState(true);

  const [entries, setEntries] = useState<Character[]>([]);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
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

  const allCharacterEntities = useEntityQuery([Has(Characters), Has(Stats)]);

  const getAllCharacters = useCallback(
    async (entities: Entity[]): Promise<void> => {
      if (!(delegatorAddress && publicClient && worldContract)) return;

      try {
        setIsFetchingCharacters(true);

        const _characters: Character[] = await Promise.all(
          entities.map(async (entity: Entity) => {
            const characterData = getComponentValueStrict(Characters, entity);
            const characterStats = getComponentValueStrict(Stats, entity);
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
              entityClass: characterStats.class,
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
      Stats,
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
    filter.filtered,
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
          <HStack px={3}>
            <Button
              bgColor={filter.filtered == 'all' ? 'grey500' : undefined}
              color={filter.filtered == 'all' ? 'white' : undefined}
              onClick={() => setFilter({ filtered: 'all' })}
              size="sm"
              variant="white"
            >
              All
            </Button>
            <Button
              leftIcon={
                <WarriorSvg
                  theme={filter.filtered == 'byWarrior' ? 'light' : 'dark'}
                />
              }
              bgColor={filter.filtered == 'byWarrior' ? 'grey500' : undefined}
              color={filter.filtered == 'byWarrior' ? 'white' : undefined}
              onClick={() => setFilter({ filtered: 'byWarrior' })}
              size="sm"
              variant="white"
            >
              Warrior
            </Button>
            <Button
              leftIcon={
                <RogueSvg
                  theme={filter.filtered == 'byRogue' ? 'light' : 'dark'}
                />
              }
              bgColor={filter.filtered == 'byRogue' ? 'grey500' : undefined}
              color={filter.filtered == 'byRogue' ? 'white' : undefined}
              onClick={() => setFilter({ filtered: 'byRogue' })}
              size="sm"
              variant="white"
            >
              Rogue
            </Button>
            <Button
              leftIcon={
                <MageSvg
                  theme={filter.filtered == 'byMage' ? 'light' : 'dark'}
                />
              }
              bgColor={filter.filtered == 'byMage' ? 'grey500' : undefined}
              color={filter.filtered == 'byMage' ? 'white' : undefined}
              onClick={() => setFilter({ filtered: 'byMage' })}
              size="sm"
              variant="white"
            >
              Mage
            </Button>
          </HStack>
        </Stack>
        <Flex alignItems="center" justify="space-between" w="100%">
          <Text pl={4} color="#565555" fontWeight={400} fontSize="14px">
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
            <Box display={{ base: 'none', md: 'block' }} w="50px" />
          </HStack>
        </Flex>

        <VStack gap={3} overflowX="auto" w="100%">
          <Box
            background="#F5F5FA1F"
            h="5px"
            w="100%"
            boxShadow="box-shadow: -5px -5px 10px 0px #B3B9BE inset;box-shadow: 5px 5px 10px 0px #949CA380 inset;box-shadow: 2px 2px 4px 0px #88919980 inset;box-shadow: 0px 0px 4px 0px #545454 inset;"
          ></Box>
          {entries.length > 0 ? (
            [...entries, ...entries, ...entries, ...entries, ...entries].map(
              function (entry, i) {
                return (
                  <LeaderboardRow
                    key={`leaderboard-row-${i}`}
                    top={i == 0 || i == 1 || i == 2}
                    index={i}
                    character={entry}
                  />
                );
              },
            )
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
