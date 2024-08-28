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
import { useComponentValue } from '@latticexyz/react';
import { Has, runQuery } from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { Address, maxUint256 } from 'viem';
import { useAccount } from 'wagmi';

import { AuctionRow } from '../components/AuctionRow';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { HOME_PATH } from '../Routes';
import { getEmoji } from '../utils/helpers';
import {
  ArmorTemplate,
  ConsiderationData,
  ItemType,
  OfferData,
  Order,
  WeaponTemplate,
} from '../utils/types';

interface Price {
  tokenId: string;
  floor: string;
  ceiling: string;
}
const PER_PAGE = 10;

export const AuctionHouse = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: { UltimateDominionConfig, Offers },

    network: { worldContract },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    weaponTemplates,
  } = useItems();

  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [prices, setPrices] = useState<Price[] | null>(null);

  const [entries, setEntries] = useState<(ArmorTemplate | WeaponTemplate)[]>(
    [],
  );
  const [, setOrders] = useState<Order[] | null>(null);

  const [sort, setSort] = useState({ sorted: 'byClass', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('1');
  const [pageLimit, setPageLimit] = useState(0);

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const fetchOrders = useCallback(async () => {
    try {
      setIsFetchingOrders(true);
      setPrices(null);
      setOrders(
        await Promise.all(
          Array.from(runQuery([Has(Offers)])).map(async orderHash => {
            const offerData = await worldContract.read.UD__getOffer([
              orderHash as Address,
            ]);
            const considerationData =
              await worldContract.read.UD__getConsideration([
                orderHash as Address,
              ]);
            const orderStatus = await worldContract.read.UD__getOrderStatus([
              orderHash as Address,
            ]);
            const price = {
              tokenId:
                considerationData.token == goldToken
                  ? offerData.identifier.toString()
                  : considerationData.identifier.toString(),
              floor: '0',
              ceiling: maxUint256.toString(),
            } as Price;
            if (considerationData.token == goldToken && orderStatus == 1) {
              price.floor = BigInt(
                considerationData.amount / offerData.amount <
                  BigInt(price.floor)
                  ? considerationData.amount / offerData.amount
                  : BigInt(price.floor),
              ).toString();
            }
            if (offerData.token == goldToken && orderStatus == 1) {
              price.ceiling = BigInt(
                offerData.amount / considerationData.amount >
                  BigInt(price.ceiling)
                  ? offerData.amount / considerationData.amount
                  : BigInt(price.ceiling),
              ).toString();
            }
            if (price != null) setPrices([price]);
            else {
              setPrices(prev => [...(prev as []), price]);
            }
            return {
              orderHash: orderHash.toString(),
              orderStatus: orderStatus.toString(),
              offer: {
                amount: offerData.amount.toString(),
                identifier: offerData.identifier.toString(),
                token: offerData.token.toString(),
                tokenType: offerData.tokenType.toString(),
              } as OfferData,
              consideration: {
                amount: considerationData.amount.toString(),
                identifier: considerationData.identifier.toString(),
                token: considerationData.token.toString(),
                tokenType: considerationData.tokenType.toString(),
                recipient: considerationData.recipient.toString(),
              } as ConsiderationData,
            } as Order;
          }),
        ),
      );
    } catch (err) {
      renderError('Could not get order data.');
    } finally {
      setIsFetchingOrders(false);
    }
  }, [Offers, goldToken, renderError, worldContract.read]);

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
      await fetchOrders();
    })();
  }, [fetchOrders]);

  const items = useMemo(
    () => [...armorTemplates, ...weaponTemplates],
    [armorTemplates, weaponTemplates],
  );

  useEffect(() => {
    if (pageNumber < 1 || isLoadingItemTemplates) {
      return;
    }
    let entriesCopy = items;

    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      let result = false;
      const floorA =
        prices?.filter(price => entryA.tokenId == price.tokenId)[0]?.floor ||
        '0';
      const floorB =
        prices?.filter(price => entryB.tokenId == price.tokenId)[0]?.floor ||
        '0';
      switch (sort.sorted) {
        // case 'byClass':
        //   result = sort.reversed
        //     ? entryA.class.toString().localeCompare(entryB.class.toString()) > 0
        //     : entryB.class.toString().localeCompare(entryA.class.toString()) >
        //       0;
        //   break;
        case 'byLevel':
          result = sort.reversed
            ? BigInt(entryA?.minLevel || '0') >= BigInt(entryB?.minLevel || '0')
            : BigInt(entryB?.minLevel || '0') > BigInt(entryA?.minLevel || '0');
          break;
        case 'byPrice':
          result = sort.reversed
            ? BigInt(floorA) >= BigInt(floorB)
            : BigInt(floorB) > BigInt(floorA);
          break;
        default:
          // result =
          //   entryA.class.toString().localeCompare(entryB.class.toString()) > 0;
          break;
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
    isLoadingItemTemplates,
    items,
    pageNumber,
    prices,
    query,
    sort.reversed,
    sort.sorted,
  ]);

  if (isLoadingItemTemplates || isFetchingOrders) {
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
                {...item}
                floor={
                  prices &&
                  prices?.filter(price => price.tokenId == item.tokenId)
                    .length > 0
                    ? prices?.filter(price => price.tokenId == item.tokenId)[0]
                        .floor
                    : '0'
                }
                emoji={getEmoji(item?.name as string)}
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
