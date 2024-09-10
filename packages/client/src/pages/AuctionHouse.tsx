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
import {
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';

import { AuctionRow } from '../components/AuctionRow';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import {
  type ArmorTemplate,
  type ConsiderationData,
  ItemFilterOptions,
  ItemType,
  type OfferData,
  type Order,
  OrderStatus,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

enum SortOptions {
  Level = 'Level',
  FloorPrice = 'Floor Price',
}

const ITEMS_PER_PAGE = 10;

export const AuctionHouse = (): JSX.Element => {
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const {
    components: { Considerations, Offers, Orders, UltimateDominionConfig },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  const [items, setItems] = useState<
    (ArmorTemplate | SpellTemplate | WeaponTemplate)[]
  >([]);

  const [sort, setSort] = useState({
    reversed: false,
    sorted: SortOptions.Level,
  });
  const [filter, setFilter] = useState<ItemFilterOptions>(
    ItemFilterOptions.All,
  );
  const [query, setQuery] = useState('');

  const [page, setPage] = useState('1');
  const [pageLimit, setPageLimit] = useState(0);

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const fetchOrders = useCallback(() => {
    try {
      setIsFetchingOrders(true);

      const _activeOrders = Array.from(
        runQuery([
          Has(Considerations),
          Has(Offers),
          Has(Orders),
          HasValue(Orders, { orderStatus: OrderStatus.Active }),
        ]),
      ).map(orderHash => {
        const considerationData = getComponentValueStrict(
          Considerations,
          orderHash,
        );
        const offerData = getComponentValueStrict(Offers, orderHash);
        const orderStatus = getComponentValueStrict(
          Orders,
          orderHash,
        ).orderStatus;

        return {
          orderHash: orderHash.toString(),
          orderStatus: orderStatus.toString(),
          offer: {
            amount:
              offerData.tokenType === TokenType.ERC20
                ? formatEther(offerData.amount)
                : offerData.amount.toString(),
            identifier: offerData.identifier.toString(),
            token: offerData.token.toString(),
            tokenType: offerData.tokenType,
          } as OfferData,
          consideration: {
            amount:
              considerationData.tokenType === TokenType.ERC20
                ? formatEther(considerationData.amount)
                : considerationData.amount.toString(),
            identifier: considerationData.identifier.toString(),
            token: considerationData.token.toString(),
            tokenType: considerationData.tokenType,
            recipient: considerationData.recipient.toString(),
          } as ConsiderationData,
        } as Order;
      });

      setActiveOrders(_activeOrders);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to get order data.', e);
    } finally {
      setIsFetchingOrders(false);
    }
  }, [Considerations, Offers, Orders, renderError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const itemFloorPrices = useMemo(() => {
    const itemFloorPrices: { [key: string]: string } = {};

    activeOrders.forEach(order => {
      const price = itemFloorPrices[order.offer.identifier];
      if (
        !price ||
        BigInt(
          order.consideration.amount && order.consideration.token === goldToken,
        ) < BigInt(price)
      ) {
        itemFloorPrices[order.offer.identifier] = order.consideration.amount;
      }
    });

    return itemFloorPrices;
  }, [activeOrders, goldToken]);

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

  const unfilteredItems = useMemo(
    () => [...armorTemplates, ...spellTemplates, ...weaponTemplates],
    [armorTemplates, spellTemplates, weaponTemplates],
  );

  useEffect(() => {
    if (pageNumber < 1 || isLoadingItemTemplates) {
      return;
    }
    let itemsCopy = unfilteredItems;

    itemsCopy = [...itemsCopy].sort((itemA, itemB) => {
      let result = false;
      const floorA = itemFloorPrices[itemA.tokenId] ?? '0';
      const floorB = itemFloorPrices[itemB.tokenId] ?? '0';

      switch (sort.sorted) {
        case SortOptions.Level:
          result = sort.reversed
            ? BigInt(itemA?.minLevel || '0') >= BigInt(itemB?.minLevel || '0')
            : BigInt(itemB?.minLevel || '0') > BigInt(itemA?.minLevel || '0');
          break;
        case SortOptions.FloorPrice:
          result = sort.reversed
            ? BigInt(floorA) >= BigInt(floorB)
            : BigInt(floorB) > BigInt(floorA);
          break;
        default:
          break;
      }
      return result ? 1 : -1;
    });
    itemsCopy = [...itemsCopy].filter(entry => {
      switch (filter) {
        case ItemFilterOptions.Armor:
          return entry.itemType == ItemType.Armor;
        case ItemFilterOptions.Spell:
          return entry.itemType == ItemType.Spell;
        case ItemFilterOptions.Weapon:
          return entry.itemType == ItemType.Weapon;
        default:
          return true;
      }
    });
    const searcher = new FuzzySearch([...itemsCopy], ['name', 'description']);
    itemsCopy = searcher.search(query);

    const _pageLimit =
      Math.floor(Math.ceil(itemsCopy.length / ITEMS_PER_PAGE)) || 1;

    setPageLimit(_pageLimit);
    setItems(
      itemsCopy.slice(
        (pageNumber - 1) * ITEMS_PER_PAGE,
        pageNumber * ITEMS_PER_PAGE,
      ),
    );

    if (pageNumber > _pageLimit) {
      setPage(_pageLimit.toString());
    }
  }, [
    filter,
    isLoadingItemTemplates,
    itemFloorPrices,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
    unfilteredItems,
  ]);

  if (isLoadingItemTemplates || isFetchingOrders) {
    return (
      <Center h="100%">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <VStack>
      <Button
        alignSelf="start"
        leftIcon={<IoMdArrowRoundBack />}
        my={4}
        onClick={() => navigate(GAME_BOARD_PATH)}
        size="xs"
        variant="outline"
      >
        Back to Game Board
      </Button>
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
          {Object.keys(ItemFilterOptions).map(k => {
            return (
              <Button
                key={`filter-${k}`}
                onClick={() =>
                  setFilter(
                    ItemFilterOptions[k as keyof typeof ItemFilterOptions],
                  )
                }
                size="sm"
                variant={
                  filter ===
                  ItemFilterOptions[k as keyof typeof ItemFilterOptions]
                    ? 'solid'
                    : 'outline'
                }
              >
                {k}
              </Button>
            );
          })}
        </HStack>
      </Stack>
      <Flex justify="space-between" w="100%">
        <Text>Items {items.length}</Text>
        <HStack>
          <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
            {Array.from(Object.values(SortOptions)).map(s => {
              return (
                <Button
                  key={`filter-${s}`}
                  display={{ base: 'none', lg: 'flex' }}
                  fontWeight={sort.sorted == s ? 'bold' : 'normal'}
                  onClick={() => {
                    setSort({
                      sorted: s,
                      reversed: !sort.reversed,
                    });
                    setPage('1');
                  }}
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
        {items.length > 0 ? (
          items.map((item, i) => {
            return (
              <AuctionRow
                key={`auction-row-${i}`}
                {...item}
                floor={itemFloorPrices[item.tokenId] ?? '0'}
              />
            );
          })
        ) : (
          <Text mt={12}>No items</Text>
        )}
      </VStack>
      <HStack
        my={5}
        visibility={
          unfilteredItems && unfilteredItems.length > 0 ? 'visible' : 'hidden'
        }
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
