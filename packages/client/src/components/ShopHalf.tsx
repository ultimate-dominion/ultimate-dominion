import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spacer,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';

import {
  type ArmorTemplate,
  ItemFilterOptions,
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
  balances,
  name,
  items,
  prices,
  stock,
  shopId,
  itemIndexes,
  characterId,
  side,
}: {
  balances: Array<string> | null;
  characterId: Entity;
  name: string;
  items: Array<ArmorTemplate | SpellTemplate | WeaponTemplate>;
  prices: Array<string> | null;
  stock: Array<string> | null;
  shopId: string;
  itemIndexes: Array<string>;
  side: string;
}): JSX.Element => {
  const [entries, setEntries] = useState<
    Array<ArmorTemplate | SpellTemplate | WeaponTemplate>
  >([]);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({
    sorted: SortOptions.Price,
    reversed: false,
  });
  const [filter, setFilter] = useState<ItemFilterOptions>(
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
    let entriesCopy: Array<ArmorTemplate | SpellTemplate | WeaponTemplate> = [
      ...items,
    ];
    const searcher = new FuzzySearch(
      [...entriesCopy],
      ['name', 'characterId', 'description'],
      { caseSensitive: false },
    );
    entriesCopy = searcher.search(query);
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter) {
        case ItemFilterOptions.Weapon:
          return entry.itemType == 0 ? 1 : 0;
        case ItemFilterOptions.Armor:
          return entry.itemType == 1 ? 1 : 0;

        default:
          return true;
      }
    });
    setLength(entriesCopy.length);
    setEntries(
      entriesCopy.slice((pageNumber - 1) * PER_PAGE, pageNumber * PER_PAGE),
    );
    if (pageNumber > pageLimit) {
      setPage(pageLimit);
    }
  }, [filter, items, pageLimit, pageNumber, query]);

  return (
    <VStack>
      <Text fontWeight={700} fontSize={24} textAlign="left" w="100%">
        {name}
      </Text>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        mb={8}
        spacing={{ base: 4, md: 8 }}
        w="100%"
      >
        <InputGroup w="100%">
          <InputLeftElement pointerEvents="none">
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
            onClick={() => setFilter(ItemFilterOptions.All)}
            size="sm"
            variant={filter === ItemFilterOptions.All ? 'solid' : 'outline'}
          >
            All
          </Button>
          <Button
            onClick={() => setFilter(ItemFilterOptions.Armor)}
            size="sm"
            variant={filter === ItemFilterOptions.Armor ? 'solid' : 'outline'}
          >
            Armor
          </Button>
          <Button
            onClick={() => setFilter(ItemFilterOptions.Weapon)}
            size="sm"
            variant={filter === ItemFilterOptions.Weapon ? 'solid' : 'outline'}
          >
            Weapon
          </Button>
        </HStack>
      </Stack>
      <HStack w="100%">
        <Flex justify="space-between" w="100%">
          <HStack textAlign="right" w="100%">
            <Spacer />
            <Button
              display={{ base: 'none', lg: 'flex' }}
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
              display={{ base: 'none', lg: 'flex' }}
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
            <Box display={{ base: 'none', md: 'block' }} w="30px"></Box>
          </HStack>
        </Flex>
      </HStack>
      <VStack gap={3} maxW="100%" overflowX="auto" w="100%">
        {entries.length > 0 ? (
          entries.map((entry, i) => {
            return (
              <ShopItemRow
                characterId={characterId}
                itemIndex={itemIndexes[i]}
                shopId={shopId}
                stock={stock ? stock[i] : '0'}
                price={prices ? prices[i] : '0'}
                balance={balances ? balances[i] : null}
                item={entry}
                key={`shop-row-${i}`}
                side={side}
              />
            );
          })
        ) : (
          <Text mt={4}>No Data</Text>
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
