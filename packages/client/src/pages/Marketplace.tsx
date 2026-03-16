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
  Select,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { GiTwoCoins } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
import { formatEther } from 'viem';
import { CreateListingModal } from '../components/CreateListingModal';
import { InfoModal } from '../components/InfoModal';
import { MarketplaceRow } from '../components/MarketplaceRow';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import { MarketplaceIconSvg } from '../components/SVGs';
import { useCharacter } from '../contexts/CharacterContext';
import { useGoldMerchant } from '../contexts/GoldMerchantContext';
import { useItems } from '../contexts/ItemsContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { useOrders } from '../contexts/OrdersContext';
import { CHARACTER_CREATION_PATH, HOME_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemFilterOptions,
  ItemType,
  MarketplaceFilter,
  OrderType,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

enum SortOptions {
  Level = 'Level',
  LowestPrice = 'Lowest Price',
  HighestOffer = 'Highest Offer',
}

const ITEMS_PER_PAGE = 10;
const MARKETPLACE_INFO_SEEN_KEY = 'marketplace-info-seen';

export const Marketplace = (): JSX.Element => {
  const navigate = useNavigate();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();
  const { onOpen: onOpenGoldMerchant } = useGoldMerchant();

  const { delegatorAddress, isSynced } = useMUD();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const {
    activeOrders,
    highestOffers,
    isLoading: isLoadingOrders,
    lowestPrices,
    refreshOrders,
  } = useOrders();
  const { character, isRefreshing } = useCharacter();

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

  const [items, setItems] = useState<
    (ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate)[]
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

  // Redirect to home if synced, but missing other requirements
  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
      return;
    }

    if (!isSynced) return;

    if (!delegatorAddress) {
      navigate(HOME_PATH);
      return;
    }

    if (!character?.locked && !isRefreshing) {
      navigate(CHARACTER_CREATION_PATH);
      return;
    }

    refreshOrders();
  }, [
    character,
    delegatorAddress,
    isConnected,
    isConnecting,
    isRefreshing,
    isSynced,
    navigate,
    refreshOrders,
  ]);

  const unfilteredItems = useMemo(
    () => [
      ...armorTemplates,
      ...consumableTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ],
    [armorTemplates, consumableTemplates, spellTemplates, weaponTemplates],
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
      const lowestPriceA = lowestPrices[itemA.tokenId.toString()] ?? '0';
      const lowestPriceB = lowestPrices[itemB.tokenId.toString()] ?? '0';

      const highestOfferA = highestOffers[itemA.tokenId.toString()] ?? '0';
      const highestOfferB = highestOffers[itemB.tokenId.toString()] ?? '0';

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

    const searcher = new FuzzySearch([...itemsCopy], ['name']);
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

  if (isLoadingItemTemplates || isLoadingOrders) {
    return (
      <Center>
        <Spinner size="lg" />
      </Center>
    );
  }

  if (!character) {
    return (
      <VStack w="100%">
        <Text mt={12}>An error occurred</Text>
      </VStack>
    );
  }

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>Marketplace | Ultimate Dominion</title>
      </Helmet>
      <VStack>
        <HStack
          bgColor="blue500"
          h={{ base: '100px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Stack
            alignItems="center"
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: 2, md: 4 }}
          >
            <HStack>
              <MarketplaceIconSvg />
              <Heading color="white">Marketplace</Heading>
            </HStack>
            <Text color="yellow">
              <Text
                as="span"
                display={{ base: 'none', md: 'inline-block' }}
                mr={2}
              >
                -{' '}
              </Text>
              $GOLD Balance: {etherToFixedNumber(character.externalGoldBalance)}
            </Text>
            <Button
              leftIcon={<GiTwoCoins />}
              onClick={onOpenGoldMerchant}
              size="xs"
              variant="gold"
            >
              Get Gold
            </Button>
          </Stack>
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
          <HStack spacing={2}>
            {Object.keys(MarketplaceFilter).map(k => {
              return (
                <Button
                  bgColor={
                    marketplaceFilter ===
                    MarketplaceFilter[k as keyof typeof MarketplaceFilter]
                      ? 'grey500'
                      : undefined
                  }
                  color={
                    marketplaceFilter ===
                    MarketplaceFilter[k as keyof typeof MarketplaceFilter]
                      ? 'white'
                      : undefined
                  }
                  key={`marketplace-filter-${k}`}
                  onClick={() =>
                    setMarketplaceFilter(
                      MarketplaceFilter[k as keyof typeof MarketplaceFilter],
                    )
                  }
                  size={{ base: 'xs', sm: 'sm' }}
                  variant="white"
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
          px={3}
          w="100%"
        >
          <HStack
            alignItems="center"
            justifyContent="space-between"
            spacing={{ base: 4, md: 8 }}
            w={{ base: '100%', md: '325px' }}
          >
            <Text
              color="#8A7E6A"
              fontWeight={400}
              size="sm"
              w={{ base: '50%', sm: '42%' }}
            >
              Filter by:
            </Text>
            <Select
              onChange={e =>
                setItemTypeFilter(e.target.value as ItemFilterOptions)
              }
              size="sm"
              value={itemTypeFilter}
            >
              {Object.keys(ItemFilterOptions).map(k => {
                return (
                  <option key={`item-type-filter-${k}`} value={k}>
                    {ItemFilterOptions[k as keyof typeof ItemFilterOptions]}
                  </option>
                );
              })}
            </Select>
          </HStack>
          <Button onClick={onOpenCreateListingModal} size="sm">
            Create Listing
          </Button>
        </Stack>
        <Flex alignItems="center" justify="space-between" w="100%">
          <Text pl={4} color="#8A7E6A" fontWeight={400} size="sm">
            Items {length}
          </Text>
          <HStack>
            <HStack w={{ base: '0px', md: '350px', lg: '500px' }}>
              {Array.from(Object.values(SortOptions)).map(s => {
                return (
                  <Button
                    color="#8A7E6A"
                    display={{ base: 'none', md: 'flex' }}
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
                    variant="unstyled"
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
          {items.length > 0 ? (
            items.map((item, i) => {
              return (
                <>
                  <MarketplaceRow
                    highestOffer={
                      highestOffers[item.tokenId.toString()]
                        ? formatEther(highestOffers[item.tokenId.toString()])
                        : '0'
                    }
                    key={`marketplace-row-${i}`}
                    lowestPrice={
                      lowestPrices[item.tokenId.toString()]
                        ? formatEther(lowestPrices[item.tokenId.toString()])
                        : '0'
                    }
                    orderType={
                      marketplaceFilter === MarketplaceFilter.ForSale
                        ? OrderType.Buying
                        : OrderType.Selling
                    }
                    {...item}
                  />
                  <Box
                    bg="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="1px"
                    w="100%"
                  />
                </>
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
            <Text alignSelf="center" fontSize="68px">
              🤝
            </Text>
            <VStack spacing={4}>
              <Text>
                Here you can buy and sell armor, potions, spells, and weapons
                with other players.
              </Text>
              <Text size="sm">
                To start the process, either create a listing or select an item
                based on which items are for sale or which items have a $GOLD
                offer on them. If there are $GOLD offers on an item, anyone who
                owns the item can accept any of the offers.
              </Text>
              <Text size="sm">
                To coordinate a sale with another player, you can use the chat
                box in the bottom-right.
              </Text>
            </VStack>
          </VStack>
        </InfoModal>
      </VStack>
    </PolygonalCard>
  );
};
