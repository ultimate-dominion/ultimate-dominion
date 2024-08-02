import {
  Box,
  Button,
  Center,
  Flex,
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
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { formatEther, hexToString } from 'viem';
import { useAccount } from 'wagmi';

import { LeaderboardRow } from '../components/LeaderboardRow';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { HOME_PATH } from '../Routes';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import { Character, StatsClasses } from '../utils/types';

const PER_PAGE = 10;

export const Leaderboard = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: { Characters, CharactersTokenURI, GoldBalances, Stats },
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isFetchingCharacters, setIsFetchingCharacters] = useState(true);

  const [entries, setEntries] = useState<Character[]>([]);
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('1');
  const [pageLimit, setPageLimit] = useState(0);

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

            const goldBalance =
              getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(`ipfs://${metadataURI}`)[0],
            );

            return {
              ...fetachedMetadata,
              agility: characterStats.agility.toString(),
              baseHp: characterStats.baseHp.toString(),
              characterId: entity,
              entityClass: characterStats.class,
              experience: characterStats.experience.toString(),
              goldBalance: formatEther(goldBalance as bigint).toString(),
              intelligence: characterStats.intelligence.toString(),
              level: characterStats.level.toString(),
              locked: characterData.locked,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              strength: characterStats.strength.toString(),
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
    const _pageLimit =
      Math.floor(Math.ceil(entriesCopy.length / PER_PAGE)) || 1;
    setPageLimit(_pageLimit);
    setEntries(
      entriesCopy.slice((pageNumber - 1) * PER_PAGE, pageNumber * PER_PAGE),
    );

    if (pageNumber > _pageLimit) {
      setPage(_pageLimit.toString());
    }
  }, [
    characters,
    filter.filtered,
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
            return <LeaderboardRow key={`leaderboard-row-${i}`} {...entry} />;
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
