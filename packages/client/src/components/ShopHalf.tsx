import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spacer,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';

import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemFilterOptions,
  ItemType,
  OrderType,
  Shop,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

import { Pagination } from './Pagination';
import { ShopItemRow } from './ShopItemRow';

enum SortOptions {
  Price = 'Price',
  Stock = 'Stock',
}

const PER_PAGE = 5;

export const ShopHalf = ({
  characterId,
  items,
  onTradeComplete,
  orderType,
  shop,
}: {
  characterId: string;
  items: Array<{
    balance: bigint | null;
    index: string;
    isEquipped: boolean;
    item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
    stock: bigint | null;
  }>;
  onTradeComplete?: (tokenId: string, amount: number, goldDelta: bigint, orderType: OrderType) => void;
  shop: Shop;
  orderType: OrderType;
}): JSX.Element => {
  const [entries, setEntries] = useState<
    Array<{
      balance: bigint | null;
      index: string;
      isEquipped: boolean;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
    }>
  >([]);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({
    sorted: SortOptions.Price,
    reversed: false,
  });
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemFilterOptions>(
    ItemFilterOptions.All,
  );

  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

  useEffect(() => {
    if (pageNumber < 1) {
      return;
    }
    let entriesCopy: Array<{
      balance: bigint | null;
      index: string;
      isEquipped: boolean;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
    }> = [...items];
    const searcher = new FuzzySearch([...entriesCopy], ['item.name'], {
      caseSensitive: false,
    });
    entriesCopy = searcher.search(query);

    entriesCopy = [...entriesCopy].filter(entry => {
      switch (itemTypeFilter) {
        case ItemFilterOptions.Armor:
          return entry.item.itemType == ItemType.Armor;
        case ItemFilterOptions.Consumable:
          return entry.item.itemType == ItemType.Consumable;
        case ItemFilterOptions.Spell:
          return entry.item.itemType == ItemType.Spell;
        case ItemFilterOptions.Weapon:
          return entry.item.itemType == ItemType.Weapon;

        default:
          return true;
      }
    });

    entriesCopy = [...entriesCopy].sort((entryA, entryB) => {
      switch (sort.sorted) {
        case SortOptions.Price:
          return sort.reversed
            ? Number(BigInt(entryB.item.price) - BigInt(entryA.item.price))
            : Number(BigInt(entryA.item.price) - BigInt(entryB.item.price));
        case SortOptions.Stock:
          return sort.reversed
            ? Number(entryA.stock ? entryA.stock : entryA.balance) -
                Number(entryB.stock ? entryB.stock : entryB.balance)
            : Number(entryB.stock ? entryB.stock : entryB.balance) -
                Number(entryA.stock ? entryA.stock : entryA.balance);
        default:
          return Number(BigInt(entryB.item.price) - BigInt(entryA.item.price));
      }
    });
    setLength(entriesCopy.length);
    setEntries(
      entriesCopy.slice((pageNumber - 1) * PER_PAGE, pageNumber * PER_PAGE),
    );
    if (pageNumber > pageLimit) {
      setPage(pageLimit);
    }
  }, [
    items,
    itemTypeFilter,
    pageLimit,
    pageNumber,
    query,
    sort.reversed,
    sort.sorted,
  ]);

  return (
    <VStack>
      <Stack
        alignItems="center"
        direction={{ base: 'column', md: 'row' }}
        mb={8}
        p={2}
        spacing={{ base: 4, md: 8 }}
        w="100%"
      >
        <InputGroup w={{ base: '100%', md: '50%' }}>
          <InputLeftElement pointerEvents="none">
            <FaSearch />
          </InputLeftElement>
          <Input
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            value={query}
          />
        </InputGroup>
        <Select
          onChange={e => setItemTypeFilter(e.target.value as ItemFilterOptions)}
          size="md"
          value={itemTypeFilter}
          w={{ base: '100%', md: '50%' }}
        >
          {Object.keys(ItemFilterOptions).map(k => {
            return (
              <option key={`item-type-filter-${k}`} value={k}>
                {ItemFilterOptions[k as keyof typeof ItemFilterOptions]}
              </option>
            );
          })}
        </Select>
      </Stack>
      <HStack w="100%">
        <Flex justify="space-between" w="100%">
          <HStack textAlign="right" w="100%">
            <Spacer />
            <Button
              color="#565555"
              fontWeight={sort.sorted === SortOptions.Stock ? 'bold' : 'normal'}
              onClick={() =>
                setSort({
                  sorted: SortOptions.Stock,
                  reversed: !sort.reversed,
                })
              }
              p={1}
              size={{ base: '2xs' }}
              variant="ghost"
              w="75px"
            >
              <Text mr={2} size={{ base: '2xs' }}>
                Stock
              </Text>
              {sort.sorted === SortOptions.Stock && sort.reversed && (
                <FaSortAmountUp />
              )}
              {sort.sorted === SortOptions.Stock && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted !== SortOptions.Stock && (
                <FaSortAmountDown color="grey" />
              )}
            </Button>
            <Button
              color="#565555"
              fontWeight={sort.sorted === SortOptions.Price ? 'bold' : 'normal'}
              onClick={() =>
                setSort({
                  sorted: SortOptions.Price,
                  reversed: !sort.reversed,
                })
              }
              p={1}
              size={{ base: '2xs' }}
              variant="ghost"
              w="75px"
            >
              <Text mr={2} size={{ base: '2xs' }}>
                Price
              </Text>
              {sort.sorted === SortOptions.Price && sort.reversed && (
                <FaSortAmountUp />
              )}
              {sort.sorted === SortOptions.Price && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted !== SortOptions.Price && (
                <FaSortAmountDown color="grey" />
              )}
            </Button>
            <Box display={{ base: 'none', md: 'block' }} w="60px" />
          </HStack>
        </Flex>
      </HStack>
      <VStack gap={0} maxW="100%" overflowX="auto" w="100%">
        {entries.length > 0 ? (
          entries.map((entry, i) => {
            return (
              <ShopItemRow
                balance={entry.balance}
                characterId={characterId}
                isEquipped={entry.isEquipped}
                item={entry.item}
                itemIndex={entry.index}
                key={`shop-row-${i}`}
                onTradeComplete={onTradeComplete}
                orderType={orderType}
                shop={shop}
                stock={entry.stock}
                theme="white"
              />
            );
          })
        ) : (
          <Text mt={4}>No Items</Text>
        )}
      </VStack>
      <Spacer />
      <Box visibility={entries.length > 0 ? 'visible' : 'hidden'}>
        <Pagination
          length={length}
          page={page}
          pageLimit={pageLimit}
          perPage={PER_PAGE}
          setPage={setPage}
          setPageLimit={setPageLimit}
        />
      </Box>
    </VStack>
  );
};
