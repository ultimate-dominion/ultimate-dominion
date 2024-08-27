import {
  Button,
  Divider,
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
import { useMemo, useState } from 'react';
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { FaBackwardStep, FaForwardStep } from 'react-icons/fa6';
import { IoCaretBack, IoCaretForward } from 'react-icons/io5';

import { Character } from '../utils/types';
import { ShopRow } from './ShopRow';

export const Shops = (): JSX.Element => {
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
    <VStack mt={16}>
      <Text textAlign="center" w="100%">
        Hi, welcome to the shop. Please have a look at my wares. Let me know if
        you need any help.
      </Text>
      <HStack border="2px solid" maxW="100%" p={5}>
        <VStack maxW="47%">
          <Text fontWeight={700} fontSize={24} textAlign="left" w="100%">
            Character’s Inventory - 55 $GOLD
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
              <Button size="sm" variant="solid">
                Weapons
              </Button>
              <Button size="sm" variant="solid">
                Potions
              </Button>
            </HStack>
          </Stack>
          <HStack>
            <Flex justify="space-between" w="100%">
              <HStack>
                <HStack maxW="100%" textAlign="right">
                  {['byStock', 'byPrice'].map(s => {
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
                        {sort.sorted == s && sort.reversed && (
                          <FaSortAmountUp />
                        )}
                        {sort.sorted == s && !sort.reversed && (
                          <FaSortAmountDown />
                        )}
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
              return <ShopRow key={`shop-row-${i}`} name={item} />;
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
                  (pageNumber < pageLimit
                    ? pageNumber + 1
                    : pageNumber
                  ).toString(),
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
        <Spacer></Spacer>
        <Divider border="1px solid black" orientation="vertical" />
        <Spacer></Spacer>
        <VStack maxW="47%">
          <Text fontWeight={700} fontSize={24} textAlign="left" w="100%">
            Basic Armory Inventory - 200 $GOLD
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
              <Button size="sm" variant="solid">
                Weapons
              </Button>
              <Button size="sm" variant="solid">
                Potions
              </Button>
            </HStack>
          </Stack>

          <HStack>
            <Flex justify="space-between" w="50%">
              <HStack>
                <HStack maxW="100%" textAlign="right">
                  {['byStock', 'byPrice'].map(s => {
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
                        {sort.sorted == s && sort.reversed && (
                          <FaSortAmountUp />
                        )}
                        {sort.sorted == s && !sort.reversed && (
                          <FaSortAmountDown />
                        )}
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
              return <ShopRow key={`shop-row-${i}`} name={item} />;
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
                  (pageNumber < pageLimit
                    ? pageNumber + 1
                    : pageNumber
                  ).toString(),
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
      </HStack>
    </VStack>
  );
};
