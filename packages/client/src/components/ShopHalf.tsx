import {
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
// import { FaHatWizard } from 'react-icons/fa';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';

import { Character } from '../utils/types';
import { ShopItemRow } from './ShopItemRow';
// import { useNavigate } from 'react-router-dom';

// import { SHOP_PATH } from '../Routes';
export const ShopHalf = ({
  name,
  filterNames,
  sortNames,
}: {
  name: string;
  filterNames: Array<string>;
  sortNames: Array<string>;
}): JSX.Element => {
  // const navigate = useNavigate();
  const [sort, setSort] = useState({ sorted: 'byClass', reversed: false });
  const [entries /* setEntries */] = useState<Character[]>([]);
  // const [filter, setFilter] = useState({ filtered: 'all' });
  // const [query, setQuery] = useState('');
  const [page, setPage] = useState('1');
  const [pageLimit /* setPageLimit */] = useState(0);

  const pageNumber = useMemo(() => {
    if (isNaN(Number(page))) {
      return 1;
    }
    return Number(page);
  }, [page]);

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
          <Input placeholder="Search" />
        </InputGroup>
        <HStack>
          {filterNames.map((f, i) => (
            <Button size="sm" variant="solid" key={`filter-${i}`}>
              {f}
            </Button>
          ))}
        </HStack>
      </Stack>
      <HStack>
        <Flex justify="space-between" w="100%">
          <HStack>
            <HStack textAlign="right" w="100%">
              {sortNames.map(s => {
                return (
                  <Button
                    key={`sort-${s}`}
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
          </HStack>
        </Flex>
      </HStack>
      <VStack gap={3} maxW="100%" overflowX="auto" w="100%">
        {['item1', 'item2', 'item3'].map(function (item, i) {
          return <ShopItemRow key={`shop-row-${i}`} name={item} />;
        })}
      </VStack>
      <HStack my={5} visibility={entries.length > 0 ? 'visible' : 'hidden'}>
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
