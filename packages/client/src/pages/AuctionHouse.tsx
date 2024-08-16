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
import { getComponentValueStrict, Has, runQuery } from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { AuctionRow } from '../components/AuctionRow';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { HOME_PATH } from '../Routes';
import { fetchMetadataFromUri, getEmoji, uriToHttp } from '../utils/helpers';
import {
  ArmorStats,
  Item,
  ItemType,
  StatsClasses,
  WeaponStats,
} from '../utils/types';

interface Price {
  tokenId: string;
  floor: string;
  ceiling: string;
}
const PER_PAGE = 5;

export const AuctionHouse = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: { Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI },

    network: { worldContract },
  } = useMUD();
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [prices] = useState<Price[] | null>(null);

  const [entries, setEntries] = useState<Item[]>([]);

  const [sort, setSort] = useState({ sorted: 'byClass', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('1');
  const [pageLimit, setPageLimit] = useState(0);

  const fetchItems = useCallback(async () => {
    try {
      setIsFetchingItems(true);
      const _items = Array.from(runQuery([Has(ItemsOwners)]))
        .map(entity => {
          const { owner, tokenId } = decodeEntity(
            { owner: 'address', tokenId: 'uint256' },
            entity,
          );

          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId },
          );

          const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);

          return {
            itemId: entity,
            itemType: itemTemplate.itemType,
            owner,
            tokenId: tokenId.toString(),
            tokenIdEntity,
          };
        })
        .filter(
          (item1, i, arr) =>
            arr.findIndex(item2 => item2.tokenId === item1.tokenId) === i,
        )
        .sort((a, b) => {
          return Number(a.tokenId) - Number(b.tokenId);
        });
      const allItems = await Promise.all(
        _items.map(async item => {
          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            item.tokenIdEntity,
          ).uri;

          const metadata = await fetchMetadataFromUri(
            uriToHttp(`${baseURI}${tokenURI}`)[0],
          );
          const data = {
            ...metadata,
            tokenId: item.tokenId,
            itemType: item.itemType as ItemType,
            stats: null,
            class: StatsClasses.Mage,
          } as Item;
          switch (item.itemType) {
            case ItemType.Weapon: {
              const w = await worldContract.read.UD__getWeaponStats([
                BigInt(item.tokenId),
              ]);
              const highestStat = Math.max(
                ...Object.values({
                  a: Number(w.agiModifier.toString()),
                  i: Number(w.intModifier.toString()),
                  s: Number(w.strModifier.toString()),
                }),
              );
              data.class =
                w.strModifier.toString() == highestStat.toString()
                  ? StatsClasses.Warrior
                  : data.class;
              data.class =
                w.agiModifier.toString() == highestStat.toString()
                  ? StatsClasses.Rogue
                  : data.class;
              data.class =
                w.intModifier.toString() == highestStat.toString()
                  ? StatsClasses.Mage
                  : data.class;
              data.stats = {
                agiModifier: w.agiModifier.toString(),
                classRestrictions: w.classRestrictions.map(
                  (classRestriction: number) =>
                    classRestriction as StatsClasses,
                ),
                hitPointModifier: w.hitPointModifier.toString(),
                intModifier: w.intModifier.toString(),
                itemId: item.itemId,
                maxDamage: w.maxDamage.toString(),
                minDamage: w.minDamage.toString(),
                minLevel: w.minLevel.toString(),
                owner: item.owner,
                strModifier: w.strModifier.toString(),
                tokenId: item.tokenId,
              } as WeaponStats;
              break;
            }
            case ItemType.Armor: {
              const a = await worldContract.read.UD__getArmorStats([
                BigInt(item.tokenId),
              ]);
              const highestStat = Math.max(
                ...Object.values({
                  a: Number(a.agiModifier.toString()),
                  i: Number(a.intModifier.toString()),
                  s: Number(a.strModifier.toString()),
                }),
              );
              data.class =
                a.strModifier.toString() == highestStat.toString()
                  ? StatsClasses.Warrior
                  : data.class;
              data.class =
                a.agiModifier.toString() == highestStat.toString()
                  ? StatsClasses.Rogue
                  : data.class;
              data.class =
                a.intModifier.toString() == highestStat.toString()
                  ? StatsClasses.Mage
                  : data.class;

              data.stats = {
                armorModifier: a.armorModifier.toString(),
                agiModifier: a.agiModifier.toString(),
                classRestrictions: a.classRestrictions.map(
                  (classRestriction: number) =>
                    classRestriction as StatsClasses,
                ),
                hitPointModifier: a.hitPointModifier.toString(),
                intModifier: a.intModifier.toString(),
                itemId: item.itemId,
                minLevel: a.minLevel.toString(),
                owner: item.owner,
                strModifier: a.strModifier.toString(),
                tokenId: item.tokenId,
              } as ArmorStats;
              break;
            }
            default:
              break;
          }
          return data as Item;
        }),
      );
      setItems(allItems);
    } catch (err) {
      renderError('Failed to load items');
    } finally {
      setIsFetchingItems(false);
    }
  }, [
    Items,
    ItemsBaseURI,
    ItemsOwners,
    ItemsTokenURI,
    renderError,
    worldContract.read,
  ]);

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

  useEffect(() => {
    (async (): Promise<void> => {
      await fetchItems();
    })();
  }, [fetchItems]);

  useEffect(() => {
    if (pageNumber < 1) {
      return;
    }
    let entriesCopy: Item[] = items ? items : Array<Item>();
    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      let result = false;
      const floorA =
        prices?.filter(price => entryA.tokenId == price.tokenId)[0]?.floor ||
        '0';
      const floorB =
        prices?.filter(price => entryB.tokenId == price.tokenId)[0]?.floor ||
        '0';

      switch (sort.sorted) {
        case 'byClass':
          result = sort.reversed
            ? entryA.class.toString().localeCompare(entryB.class.toString()) > 0
            : entryB.class.toString().localeCompare(entryA.class.toString()) >
              0;
          break;
        case 'byLevel':
          result = sort.reversed
            ? BigInt(entryA?.stats?.minLevel || '0') >=
              BigInt(entryB?.stats?.minLevel || '0')
            : BigInt(entryB?.stats?.minLevel || '0') <
              BigInt(entryA?.stats?.minLevel || '0');
          break;
        case 'byPrice':
          result = sort.reversed
            ? BigInt(floorA) >= BigInt(floorB)
            : BigInt(floorB) < BigInt(floorA);
          break;
        default:
          result =
            entryA.class.toString().localeCompare(entryB.class.toString()) > 0;
      }
      return result ? 1 : -1;
    });
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter.filtered) {
        case 'byArmor':
          return entry.itemType == ItemType.Armor;
        case 'byWeapon':
          return entry.itemType == ItemType.Weapon;
        default:
          return true;
      }
    });
    const searcher = new FuzzySearch(
      [...entriesCopy],
      ['name', 'description'],
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
    filter.filtered,
    items,
    pageNumber,
    prices,
    query,
    sort.reversed,
    sort.sorted,
  ]);

  if (isFetchingItems) {
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
          {Object.values(ItemType)
            .filter(
              key => !isNaN(Number(ItemType[key as keyof typeof ItemType])),
            )
            .sort()
            .filter(key =>
              items
                ? items?.filter(
                    item =>
                      item.itemType == ItemType[key as keyof typeof ItemType],
                  )?.length > 0
                : false,
            )
            .map(k => {
              return (
                <Button
                  key={`filter-${k}`}
                  onClick={() => setFilter({ filtered: `by${k}` })}
                  size="sm"
                  variant={filter.filtered == `by${k}` ? 'solid' : 'outline'}
                >
                  {k}
                </Button>
              );
            })}
        </HStack>
      </Stack>
      <Flex justify="space-between" w="100%">
        <Text>
          Sort: {sort.sorted}, {sort.reversed ? 'desc' : 'asc'}
        </Text>
        <Text>Items {entries.length}</Text>
        <HStack>
          <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
            {['byClass', 'byLevel', 'byPrice'].map(s => {
              return (
                <Button
                  key={`filter-${s}`}
                  display={{ base: 'none', lg: 'flex' }}
                  fontWeight={sort.sorted == s ? 'bold' : 'normal'}
                  onClick={() =>
                    setSort({
                      sorted: s,
                      reversed: !sort.reversed,
                    })
                  }
                  p={1}
                  size={{ base: '2xs', lg: 'sm' }}
                  variant="ghost"
                  w="100%"
                >
                  <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                    {s}
                  </Text>
                  {sort.sorted == s && sort.reversed && <FaSortAmountUp />}
                  {sort.sorted == s && !sort.reversed && <FaSortAmountDown />}
                  {sort.sorted != s && <FaSortAmountDown color="grey" />}
                </Button>
              );
            })}
          </HStack>
          <Box display={{ base: 'none', md: 'block' }} w="50px" />
        </HStack>
      </Flex>

      <VStack gap={3} overflowX="auto" w="100%">
        {entries && entries.length > 0 ? (
          entries.map(function (item, i) {
            return (
              <AuctionRow
                key={`auction-row-${i}`}
                agiModifier={'0'}
                hitPointModifier={'0'}
                intModifier={'0'}
                minLevel={'0'}
                strModifier={'0'}
                floor={'0'}
                {...item}
                {...item.stats}
                emoji={getEmoji(item?.name as string)}
                itemClass={item.class.toString()}
                image={item.image}
              />
            );
          })
        ) : (
          <Text mt={12}>No items</Text>
        )}
      </VStack>
      <HStack
        my={5}
        visibility={items && items.length > 0 ? 'visible' : 'hidden'}
      >
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
