import {
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  Image,
  Input,
  InputGroup,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
// import { Entity } from '@latticexyz/recs';
import { useState } from 'react';
import { Address } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';

export const AuctionHouseItem = (): JSX.Element => {
  const { character: userCharacter } = useCharacter();
  const {
    network: { worldContract },
  } = useMUD();

  const [filter /*, setFilter*/] = useState({ filtered: 'all' });
  const [query, setQuery] = useState('');
  // const { items } = useComponentValue(
  //   UltimateDominionConfig,
  //   singletonEntity,
  // ) ?? { characterToken: null };
  // const abi = [
  //     {
  //       inputs: [
  //         {
  //           internalType: 'address',
  //           name: 'account',
  //           type: 'address',
  //         },
  //         {
  //           internalType: 'address',
  //           name: 'operator',
  //           type: 'address',
  //         },
  //       ],
  //       name: 'isApprovedForAll',
  //       outputs: [
  //         {
  //           internalType: 'bool',
  //           name: '',
  //           type: 'bool',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [
  //         {
  //           internalType: 'address',
  //           name: 'operator',
  //           type: 'address',
  //         },
  //         {
  //           internalType: 'bool',
  //           name: 'approved',
  //           type: 'bool',
  //         },
  //       ],
  //       name: 'setApprovalForAll',
  //       outputs: [],
  //       stateMutability: 'nonpayable',
  //       type: 'function',
  //     },
  //   ],
  // const { data: allowance, refetch } = useContractRead({
  //   address: items,
  //   abi: abi,
  //   functionName: 'setApprovalForAll',
  //   args: [AuctionHouseOrdersContract, true],
  // });
  const bid = async function () {
    await worldContract.write.UD__placeOrder([
      userCharacter?.owner as Address,
      BigInt(1),
      BigInt(1),
    ]);
  };
  return (
    <Box>
      <Grid
        templateRows="repeat(10, 1fr)"
        templateColumns={{ base: 'repeat(5, 1fr)', lg: 'repeat(10, 1fr)' }}
      >
        <GridItem backgroundColor="lavender" p={5} rowSpan={2} colSpan={5}>
          <Heading>Item Name</Heading>
          <Image></Image>
        </GridItem>
        <GridItem backgroundColor="powderblue" p={5} rowSpan={2} colSpan={5}>
          <Text>Description</Text>
          <Grid templateColumns="repeat(2, 1fr)">
            <GridItem>
              <Text>AGI</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
            <GridItem>
              <Text>INT</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
            <GridItem>
              <Text>STR</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
            <GridItem>
              <Text>HP</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
            <GridItem>
              <Text>Highest Price</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
            <GridItem>
              <Text>Floor Price</Text>
            </GridItem>
            <GridItem textAlign="right">1 $GOLD</GridItem>
          </Grid>

          <Stack direction="row" mt={8} spacing={8} w="100%">
            <InputGroup w="100%">
              <Input
                onChange={e => setQuery(e.target.value)}
                placeholder="0.00"
                value={query}
              />
            </InputGroup>
            <Button
              onClick={() => bid()}
              size="sm"
              variant={filter.filtered == 'all' ? 'solid' : 'outline'}
            >
              Bid
            </Button>
          </Stack>
        </GridItem>
        <GridItem
          backgroundColor="mintcream"
          p={5}
          rowSpan={8}
          colSpan={{ base: 5, lg: 10 }}
          order={3}
        >
          <Tabs variant="enclosed" size="lg">
            <TabList>
              <Tab>Listing</Tab>
              <Tab>Offers</Tab>
              <Tab>Owned</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <p>one!</p>
              </TabPanel>
              <TabPanel>
                <p>two!</p>
              </TabPanel>
              <TabPanel>
                <p>three!</p>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>
      </Grid>
    </Box>
  );
};
