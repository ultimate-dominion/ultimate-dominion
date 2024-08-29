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
import FuzzySearch from 'fuzzy-search';
import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';

// import { FaHatWizard } from 'react-icons/fa';
import { getEmoji, removeEmoji } from '../utils/helpers';
import { ArmorTemplate, WeaponTemplate } from '../utils/types';
import { Pagination } from './Pagination';
import { ShopItemRow } from './ShopItemRow';
const PER_PAGE = 5;
export const ShopHalf = ({
  name,
  items,
}: {
  name: string;
  items: Array<ArmorTemplate | WeaponTemplate>;
}): JSX.Element => {
  const [entries, setEntries] = useState<Array<ArmorTemplate | WeaponTemplate>>(
    [],
  );
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);
  const [length, setLength] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
  const [filter, setFilter] = useState({ filtered: 'all' });

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
    let entriesCopy: Array<ArmorTemplate | WeaponTemplate> = [...items];
    const searcher = new FuzzySearch(
      [...entriesCopy],
      ['name', 'characterId', 'description'],
      { caseSensitive: false },
    );
    entriesCopy = searcher.search(query);
    entriesCopy = [...entriesCopy].filter(entry => {
      switch (filter.filtered) {
        case 'byWeapon':
          return Object.keys(entry).indexOf('armorModifier') > -1 ? 0 : 1;
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
  }, [filter.filtered, items, pageLimit, pageNumber, query]);
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
          <InputLeftElement h="100%" pointerEvents="none">
            <FaSearch />
          </InputLeftElement>
          <Input
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            value={query}
          />{' '}
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
            onClick={() => setFilter({ filtered: 'byWeapon' })}
            size="sm"
            variant={filter.filtered == 'byWeapon' ? 'solid' : 'outline'}
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
              fontWeight={sort.sorted == 'byStock' ? 'bold' : 'normal'}
              onClick={() =>
                setSort({
                  sorted: 'byStock',
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
              {sort.sorted == 'byStock' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byStock' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byStock' && <FaSortAmountDown color="grey" />}
            </Button>
            <Button
              display={{ base: 'none', lg: 'flex' }}
              fontWeight={sort.sorted == 'byPrice' ? 'bold' : 'normal'}
              onClick={() =>
                setSort({
                  sorted: 'byPrice',
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
              {sort.sorted == 'byPrice' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byPrice' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byPrice' && <FaSortAmountDown color="grey" />}
            </Button>
            <Box display={{ base: 'none', md: 'block' }} w="30px"></Box>
          </HStack>
        </Flex>
      </HStack>
      <VStack gap={3} maxW="100%" overflowX="auto" w="100%">
        {entries.map((entry, i) => {
          return (
            <ShopItemRow
              {...entry}
              emoji={getEmoji(entry.name)}
              key={`shop-row-${i}`}
              name={removeEmoji(entry.name)}
            />
          );
        })}
      </VStack>
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
