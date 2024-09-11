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
  useDisclosure,
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
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';
import { formatEther, parseEther } from 'viem';
import { useAccount } from 'wagmi';

import { CreateListingModal } from '../components/CreateListingModal';
import { MarketplaceRow } from '../components/MarketplaceRow';
import { Pagination } from '../components/Pagination';
import { useCharacter } from '../contexts/CharacterContext';
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

enum MarketplaceFilter {
  ForSale = 'For Sale',
  GoldOffers = '$GOLD Offers',
  MyListings = 'My Listings',
}

enum SortOptions {
  Level = 'Level',
  FloorPrice = 'Floor Price',
}

const ITEMS_PER_PAGE = 10;

export const Marketplace = (): JSX.Element => {
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
  const { character } = useCharacter();

  const {
    isOpen: isCreateListingModalOpen,
    onOpen: onOpenCreateListingModal,
    onClose: onCloseCreateListingModal,
  } = useDisclosure();

  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  const [items, setItems] = useState<
    (ArmorTemplate | SpellTemplate | WeaponTemplate)[]
  >([]);

  const [sort, setSort] = useState({
    reversed: false,
    sorted: SortOptions.Level,
  });
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>(
    MarketplaceFilter.ForSale,
  );
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemFilterOptions>(
    ItemFilterOptions.All,
  );
  const [query, setQuery] = useState('');

  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      window.location.reload();
    }
  }, [isConnected, navigate]);

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
        const orderData = getComponentValueStrict(Orders, orderHash);
        const offerData = getComponentValueStrict(Offers, orderHash);
        const orderStatus = getComponentValueStrict(
          Orders,
          orderHash,
        ).orderStatus;

        return {
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
          offer: {
            amount:
              offerData.tokenType === TokenType.ERC20
                ? formatEther(offerData.amount)
                : offerData.amount.toString(),
            identifier: offerData.identifier.toString(),
            token: offerData.token.toString(),
            tokenType: offerData.tokenType,
          } as OfferData,
          offerer: orderData.offerer.toString(),
          orderHash: orderHash.toString(),
          orderStatus: orderStatus.toString(),
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
    const itemFloorPrices: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const price = itemFloorPrices[order.offer.identifier];
      if (
        !price ||
        BigInt(
          order.consideration.amount && order.consideration.token === goldToken,
        ) < BigInt(price)
      ) {
        itemFloorPrices[order.offer.identifier] = parseEther(
          order.consideration.amount,
        );
      }
    });

    return itemFloorPrices;
  }, [activeOrders, goldToken]);

  const unfilteredItems = useMemo(
    () => [...armorTemplates, ...spellTemplates, ...weaponTemplates],
    [armorTemplates, spellTemplates, weaponTemplates],
  );

  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

  useEffect(() => {
    if (!character) return;
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

    itemsCopy = itemsCopy.filter(item => {
      switch (marketplaceFilter) {
        case MarketplaceFilter.ForSale:
          return activeOrders
            .filter(order => order.offer.tokenType === TokenType.ERC1155)
            .map(order => order.offer.identifier)
            .includes(item.tokenId);
        case MarketplaceFilter.GoldOffers:
          return activeOrders
            .filter(order => order.offer.tokenType === TokenType.ERC20)
            .map(order => order.consideration.identifier)
            .includes(item.tokenId);
        case MarketplaceFilter.MyListings:
          return activeOrders
            .filter(
              order =>
                order.offerer === character.owner ||
                order.consideration.recipient === character.owner,
            )
            .map(order =>
              order.offer.tokenType === TokenType.ERC1155
                ? order.offer.identifier
                : order.consideration.identifier,
            )
            .includes(item.tokenId);
        default:
          return true;
      }
    });

    itemsCopy = [...itemsCopy].filter(entry => {
      switch (itemTypeFilter) {
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

    setLength(itemsCopy.length);
    setItems(
      itemsCopy.slice(
        (pageNumber - 1) * ITEMS_PER_PAGE,
        pageNumber * ITEMS_PER_PAGE,
      ),
    );

    if (pageNumber > pageLimit) {
      setPage(pageLimit);
    }
  }, [
    activeOrders,
    character,
    isLoadingItemTemplates,
    itemFloorPrices,
    itemTypeFilter,
    marketplaceFilter,
    pageLimit,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
    unfilteredItems,
  ]);

  if (isLoadingItemTemplates || isFetchingOrders) {
    return (
      <Center>
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
          {Object.keys(MarketplaceFilter).map(k => {
            return (
              <Button
                key={`marketplace-filter-${k}`}
                onClick={() =>
                  setMarketplaceFilter(
                    MarketplaceFilter[k as keyof typeof MarketplaceFilter],
                  )
                }
                size={{ base: 'xs', sm: 'sm' }}
                variant={
                  marketplaceFilter ===
                  MarketplaceFilter[k as keyof typeof MarketplaceFilter]
                    ? 'solid'
                    : 'outline'
                }
              >
                {MarketplaceFilter[k as keyof typeof MarketplaceFilter]}
              </Button>
            );
          })}
        </HStack>
      </Stack>
      <Stack
        alignItems="center"
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 8, md: 0 }}
        justify="space-between"
        mb={8}
        w="100%"
      >
        <Stack
          alignItems="center"
          direction={{ base: 'column', md: 'row' }}
          spacing={{ base: 4, md: 8 }}
        >
          <Text>Filter by:</Text>
          <HStack>
            {Object.keys(ItemFilterOptions).map(k => {
              return (
                <Button
                  key={`item-type-filter-${k}`}
                  onClick={() =>
                    setItemTypeFilter(
                      ItemFilterOptions[k as keyof typeof ItemFilterOptions],
                    )
                  }
                  size={{ base: 'xs', sm: 'sm' }}
                  variant={
                    itemTypeFilter ===
                    ItemFilterOptions[k as keyof typeof ItemFilterOptions]
                      ? 'solid'
                      : 'outline'
                  }
                >
                  {ItemFilterOptions[k as keyof typeof ItemFilterOptions]}
                </Button>
              );
            })}
          </HStack>
        </Stack>
        <Button bg="blue" onClick={onOpenCreateListingModal} size="sm">
          Create Listing
        </Button>
      </Stack>
      <Flex justify="space-between" w="100%">
        <Text>Items {length}</Text>
        <HStack>
          <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
            {Array.from(Object.values(SortOptions)).map(s => {
              return (
                <Button
                  display={{ base: 'none', lg: 'flex' }}
                  fontWeight={sort.sorted == s ? 'bold' : 'normal'}
                  key={`filter-${s}`}
                  onClick={() => {
                    setSort({
                      sorted: s,
                      reversed: !sort.reversed,
                    });
                    setPage(1);
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
              <MarketplaceRow
                floor={
                  itemFloorPrices[item.tokenId]
                    ? formatEther(itemFloorPrices[item.tokenId])
                    : '0'
                }
                key={`marketplace-row-${i}`}
                {...item}
              />
            );
          })
        ) : (
          <Text mt={12}>No items</Text>
        )}
      </VStack>

      <HStack
        my={5}
        visibility={unfilteredItems?.length > 0 ? 'visible' : 'hidden'}
      >
        <Pagination
          length={length}
          page={page}
          pageLimit={pageLimit}
          perPage={ITEMS_PER_PAGE}
          setPage={setPage}
          setPageLimit={setPageLimit}
        />
      </HStack>

      <CreateListingModal
        isOpen={isCreateListingModalOpen}
        onClose={onCloseCreateListingModal}
      />
    </VStack>
  );
};
