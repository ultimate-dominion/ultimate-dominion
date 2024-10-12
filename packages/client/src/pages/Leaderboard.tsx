import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Icon,
  IconProps,
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
import { PolygonalCardLeaderboard } from '../components/PolygonalCardLeaderboard';
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
    <PolygonalCardLeaderboard>
      <VStack>
        <Box
          boxShadow="-4px 0 0 rgba(0, 0, 0, .2);"
          background="#0C1539"
          display="table"
          height="66px"
          px="20px"
          position="relative"
          width="100%"
        >
          <Text
            color="white"
            display="table-cell"
            size="24px"
            fontWeight="700"
            verticalAlign="middle"
          >
            <LeaderboardIcon /> Leader Board
          </Text>
        </Box>

        <Stack
          direction={{ base: 'column', md: 'row' }}
          mb={8}
          my={4}
          px={3}
          spacing={{ base: 4, md: 8 }}
          w="100%"
        >
          <InputGroup w="100%" backgroundColor="#A2A9B0">
            <InputLeftElement h="100%" pointerEvents="none">
              <FaSearch />
            </InputLeftElement>
            <Input
              boxShadow="-5px -5px 10px 0px #54545440 inset,5px 5px 10px 0px #A6A6A680 inset,2px 2px 4px 0px #18161640 inset,-2px -2px 4px 0px #A2A9B080 inset;"
              gap="10px"
              onChange={e => setQuery(e.target.value)}
              placeholder="Search"
              value={query}
            />
          </InputGroup>
          <HStack px={3}>
            <Button
              backgroundColor={filter.filtered == 'all' ? '#edf2f7' : '#BAC2CA'}
              boxShadow="-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480;"
              onClick={() => setFilter({ filtered: 'all' })}
              size="sm"
              variant={filter.filtered == 'all' ? 'outline' : 'ghost'}
            >
              All
            </Button>
            <Button
              backgroundColor={
                filter.filtered == 'byWarrior' ? '#edf2f7' : '#BAC2CA'
              }
              boxShadow="-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480;"
              fontWeight="500"
              leftIcon={<WarriorIcon />}
              onClick={() => setFilter({ filtered: 'byWarrior' })}
              size="sm"
              variant={filter.filtered == 'byWarrior' ? 'outline' : 'ghost'}
            >
              Warrior
            </Button>
            <Button
              backgroundColor={
                filter.filtered == 'byRogue' ? '#edf2f7' : '#BAC2CA'
              }
              boxShadow="-10px -10px 20px 0px #54545440, 5px 5px 10px 0px #54545480;"
              leftIcon={<RogueIcon />}
              onClick={() =>
                setFilter({
                  filtered: 'byRogue',
                })
              }
              size="sm"
              variant={filter.filtered == 'byRogue' ? 'outline' : 'ghost'}
            >
              Rogue
            </Button>
            <Button
              backgroundColor={
                filter.filtered == 'byMage' ? '#edf2f7' : '#BAC2CA'
              }
              boxShadow="box-shadow: -10px -10px 20px 0px rgba(84, 84, 84, 0.25); box-shadow: 5px 5px 10px 0px rgba(84, 84, 84, 0.5);"
              leftIcon={<MageIcon />}
              onClick={() => setFilter({ filtered: 'byMage' })}
              size="sm"
              variant={filter.filtered == 'byMage' ? 'outline' : 'ghost'}
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
                variant="none"
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
                fontWeight={sort.sorted == 'byLevel' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byLevel',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="none"
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
                fontWeight={sort.sorted == 'byGold' ? 'bold' : 'normal'}
                onClick={() =>
                  setSort({
                    sorted: 'byGold',
                    reversed: !sort.reversed,
                  })
                }
                p={1}
                size={{ base: '2xs', lg: 'sm' }}
                variant="none"
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
    </PolygonalCardLeaderboard>
  );
};

const LeaderboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      width="27"
      height="26"
      viewBox="0 0 27 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M25.7159 9.58634H18.4534V1.26035C18.4534 1.11664 18.3261 1 18.1693 1H8.83068C8.67386 1 8.54659 1.11664 8.54659 1.26035V14H1V24H26L26 9.84669C26 9.70246 25.8722 9.58634 25.7159 9.58634ZM15.0347 7.94562C14.5506 7.80815 14.0813 7.62747 13.6352 7.40565C13.5932 7.3843 13.5466 7.37389 13.5 7.37389C13.4534 7.37389 13.4068 7.3843 13.3648 7.40565C12.9188 7.62747 12.4494 7.80815 11.9653 7.94562C11.958 7.48063 12.0011 7.01617 12.0932 6.55847C12.1108 6.47204 12.0795 6.38352 12.0102 6.3226C11.6426 6.00341 11.3097 5.65037 11.0176 5.27026C11.496 5.12082 11.992 5.01408 12.496 4.95472C12.5915 4.94326 12.6739 4.88755 12.7159 4.8084C12.9347 4.38767 13.1983 3.99038 13.5017 3.6186C13.8051 3.99038 14.0688 4.38872 14.2875 4.8084C14.329 4.88755 14.4119 4.94326 14.5074 4.95472C15.0114 5.01408 15.5074 5.12082 15.9858 5.27026C15.6938 5.65037 15.3608 6.00341 14.9932 6.3226C14.9239 6.38352 14.892 6.47204 14.9102 6.55847C14.9994 7.01617 15.042 7.48115 15.0347 7.94562Z"
        fill="white"
      />
    </svg>
  </Icon>
);

const WarriorIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18.9538 4.84326L14.9306 6.93991L18.2601 4.35745C16.8035 3.46254 15.0347 3.0023 13.7168 2.74661L12 2L10.2486 2.74661C8.96532 3.0023 7.19653 3.48811 5.7052 4.38302L9.03468 6.96548L5.01156 4.86883C3.83237 5.76374 3 7.01662 3 8.70417C3 14.2526 3 16.8606 3 16.8606C3 16.8606 5.01156 20.5681 8.86127 22V14.1503L4.9422 12.0281V9.4968L10.2486 11.4145V14.5083L12.0173 15.8123L13.7861 14.5083V11.3889L19.0925 9.47123V12.0026L15.1734 14.1248V21.9744C18.9884 20.5426 21 16.8606 21 16.8606C21 16.8606 21 14.227 21 8.70417C21 6.99105 20.1329 5.73817 18.9538 4.84326Z"
        fill="black"
      />
    </svg>
  </Icon>
);

const RogueIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_128_242)">
        <path
          d="M1.2973 12.1899C1.31558 9.39851 2.9122 7.6119 5.36198 6.55361C6.70265 5.97393 8.18957 5.60828 9.64908 5.40614C12.6656 4.98401 15.676 5.15048 18.5645 6.19688C20.7736 6.99952 22.5012 8.33725 23.1503 10.6827C23.9577 13.599 22.2362 16.8987 19.4055 17.8886C17.5012 18.5545 15.6242 17.9927 14.4146 16.3933C14.0855 15.9563 13.7899 15.4896 13.4548 15.0556C12.8149 14.2232 11.8947 14.2143 11.2274 15.0348C11.008 15.3053 10.8161 15.5996 10.6302 15.8939C8.49732 19.3125 4.48445 18.4088 2.68368 16.1823C1.74826 15.017 1.31863 13.813 1.2973 12.1899ZM7.78433 9.90982C6.67827 9.88306 5.48386 10.4152 4.93235 11.2327C4.7861 11.4497 4.76172 11.9224 4.90798 12.1245C6.142 13.8279 8.87515 13.8784 10.228 12.2672C10.5784 11.851 10.5632 11.4794 10.1975 11.087C9.51806 10.3617 8.67405 9.98116 7.78433 9.90982ZM17.1294 9.90685C16.0508 9.90982 14.9447 10.4509 14.3658 11.1584C14.0672 11.521 14.0428 11.8272 14.3506 12.2077C15.6699 13.8487 18.3939 13.8606 19.6615 12.175C19.823 11.961 19.829 11.4378 19.6706 11.2238C19.0307 10.3557 18.0953 9.96035 17.1294 9.90685Z"
          fill="black"
        />
      </g>
      <defs>
        <clipPath id="clip0_128_242">
          <rect
            width="22.0541"
            height="12.973"
            fill="white"
            transform="translate(1.2973 5.18919)"
          />
        </clipPath>
      </defs>
    </svg>
  </Icon>
);

const MageIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_128_241)">
        <path
          d="M19.4738 -4.66383e-06C18.8685 1.839 18.3216 3.50236 17.7713 5.16573C17.503 5.97503 17.2726 6.79466 16.9596 7.58674C16.5813 8.55445 16.681 9.45673 17.0869 10.39C18.3869 13.3792 19.6595 16.3823 20.9734 19.4576H11.3637C11.6526 17.4774 13.5959 17.4188 14.9235 16.4615C13.9605 15.9724 12.8392 15.6728 12.1307 14.9668C11.3981 14.2402 11.0645 13.1106 10.4936 12.0396C9.9811 13.0383 9.67843 14.1575 8.96648 14.867C8.24077 15.5936 7.1161 15.9242 6.10492 16.4615C7.36029 17.4223 9.32762 17.4533 9.64748 19.4679H3.02667C3.69047 17.9561 4.34396 16.4615 5.00776 14.9668C6.01205 12.7077 7.04731 10.4658 8.01721 8.19285C8.66038 6.68446 9.67156 5.56177 11.0886 4.7628C13.8332 3.21997 16.5641 1.65303 19.4704 -0.00344849L19.4738 -4.66383e-06Z"
          fill="#1C1C1C"
        />
        <path
          d="M11.9553 24C8.40929 24 4.86329 24 1.31729 24C0.189175 24 0.0103269 23.8071 0.0034481 22.6362C-0.00687005 21.1554 0.127266 20.966 1.27602 20.966C8.42649 20.9625 15.5735 20.9625 22.724 20.966C23.8693 20.966 24.0069 21.1623 24 22.6397C23.9931 23.8003 23.804 24 22.6793 24C19.1058 24 15.5288 24 11.9553 24Z"
          fill="#1C1C1C"
        />
      </g>
      <defs>
        <clipPath id="clip0_128_241">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  </Icon>
);
