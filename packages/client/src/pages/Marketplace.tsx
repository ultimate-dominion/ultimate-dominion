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
import { InfoModal } from '../components/InfoModal';
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
  LowestPrice = 'Lowest Price',
  HighestOffer = 'Highest Offer',
}

const ITEMS_PER_PAGE = 10;
const MARKETPLACE_INFO_SEEN_KEY = 'marketplace-info-seen';

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
    onClose: onCloseCreateListingModal,
    onOpen: onOpenCreateListingModal,
  } = useDisclosure();
  const {
    isOpen: isMarketplaceInfoModalOpen,
    onClose: onCloseMarketplaceInfoModal,
    onOpen: onOpenMarketplaceInfoModal,
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

  const lowestPrices = useMemo(() => {
    const lowestPrices: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const price = lowestPrices[order.offer.identifier];
      if (
        !price ||
        BigInt(
          order.consideration.amount && order.consideration.token === goldToken,
        ) < BigInt(price)
      ) {
        lowestPrices[order.offer.identifier] = parseEther(
          order.consideration.amount,
        );
      }
    });

    return lowestPrices;
  }, [activeOrders, goldToken]);

  const highestOffers = useMemo(() => {
    const highestOffers: { [key: string]: bigint } = {};

    activeOrders.forEach(order => {
      const offer = highestOffers[order.consideration.identifier];
      if (
        !offer ||
        BigInt(order.offer.amount) > BigInt(offer) ||
        order.offer.tokenType === TokenType.ERC20
      ) {
        highestOffers[order.consideration.identifier] = parseEther(
          order.offer.amount,
        );
      }
    });

    return highestOffers;
  }, [activeOrders]);

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
      const lowestPriceA = lowestPrices[itemA.tokenId] ?? '0';
      const lowestPriceB = lowestPrices[itemB.tokenId] ?? '0';

      const highestOfferA = highestOffers[itemA.tokenId] ?? '0';
      const highestOfferB = highestOffers[itemB.tokenId] ?? '0';

      switch (sort.sorted) {
        case SortOptions.Level:
          result = sort.reversed
            ? BigInt(itemA?.minLevel || '0') >= BigInt(itemB?.minLevel || '0')
            : BigInt(itemB?.minLevel || '0') > BigInt(itemA?.minLevel || '0');
          break;
        case SortOptions.LowestPrice:
          result = sort.reversed
            ? BigInt(lowestPriceA) >= BigInt(lowestPriceB)
            : BigInt(lowestPriceB) > BigInt(lowestPriceA);
          break;
        case SortOptions.HighestOffer:
          result = sort.reversed
            ? BigInt(highestOfferA) >= BigInt(highestOfferB)
            : BigInt(highestOfferB) > BigInt(highestOfferA);
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
    highestOffers,
    isLoadingItemTemplates,
    itemTypeFilter,
    lowestPrices,
    marketplaceFilter,
    pageLimit,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
    unfilteredItems,
  ]);

  // Open marketplace info modal if this is the first time the user is visiting the page
  useEffect(() => {
    const hasSeenMarketplaceInfo = localStorage.getItem(
      MARKETPLACE_INFO_SEEN_KEY,
    );
    if (hasSeenMarketplaceInfo) return;
    onOpenMarketplaceInfoModal();
  }, [onOpenMarketplaceInfoModal]);

  const onAcknowledgeMarketplaceInfo = useCallback(() => {
    localStorage.setItem(MARKETPLACE_INFO_SEEN_KEY, 'true');
    onCloseMarketplaceInfoModal();
  }, [onCloseMarketplaceInfoModal]);

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
          <HStack w={{ base: '0px', sm: '300px', md: '350px', lg: '500px' }}>
            {Array.from(Object.values(SortOptions)).map((s, i) => {
              return (
                <Button
                  display={
                    i === 0
                      ? { base: 'none', md: 'flex' }
                      : { base: 'none', sm: 'flex' }
                  }
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
                highestOffer={
                  highestOffers[item.tokenId]
                    ? formatEther(highestOffers[item.tokenId])
                    : '0'
                }
                lowestPrice={
                  lowestPrices[item.tokenId]
                    ? formatEther(lowestPrices[item.tokenId])
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
      <InfoModal
        heading="Welcome to the Marketplace!"
        isOpen={isMarketplaceInfoModalOpen}
        onClose={onAcknowledgeMarketplaceInfo}
      >
        <VStack>
          <Text alignSelf="center" fontSize="60px">
            🤝
          </Text>
          <VStack spacing={4}>
            <Text>
              Here you can buy and sell armor, potions, spells, and weapons with
              other players.
            </Text>
            <Text size="sm">
              To start the process, either create a listing or select an item
              based on what items are for sale or what items have a $GOLD offer
              on them. If there are $GOLD offers on an item, anyone who owns the
              item can accept any of the offers.
            </Text>
            <Text size="sm">
              To coordinate a sale with another player, you can use the chat box
              in the bottom-right.
            </Text>
          </VStack>
        </VStack>
      </InfoModal>
    </VStack>
  );
};
