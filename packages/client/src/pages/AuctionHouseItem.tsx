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
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
// import { Entity } from '@latticexyz/recs';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Address, erc20Abi } from 'viem';

import { AuctionHouseListedItem } from '../components/AuctionHouseListedItem';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';

export const AuctionHouseItem = (): JSX.Element => {
  const params = useParams();

  const { character: userCharacter } = useCharacter();
  const {
    components: { UltimateDominionConfig },
    network: { publicClient, walletClient, worldContract },
  } = useMUD();

  const [filter /*, setFilter*/] = useState({ filtered: 'all' });
  const [amount, setAmount] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [auctionContractAddress, setAuctionContractAddress] = useState('');
  // const [listing, setListings] = useState(
  //   Array<{
  //     orderId: Address;
  //     collection: Address;
  //     buyer: Address;
  //     price: bigint;
  //     tokenId: bigint;
  //   }>,
  // );
  // const [offers, setOffers] = useState(
  //   Array<{
  //     orderId: Address;
  //     collection: Address;
  //     buyer: Address;
  //     price: bigint;
  //     tokenId: bigint;
  //   }>,
  // );
  const [items, setItems] = useState(
    Array<{
      orderId: Address;
      collection: Address;
      buyer: Address;
      price: bigint;
      tokenId: bigint;
    }>,
  );
  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };
  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };
  useEffect(
    () =>
      async function () {
        const auctionHouseOrder =
          await worldContract.read.UD__auctionHouseAddress();
        setAuctionContractAddress(auctionHouseOrder);
        if (userCharacter?.owner) {
          const allowance = await publicClient.readContract({
            address: goldToken as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [
              userCharacter?.owner as Address,
              auctionContractAddress as Address,
            ],
          });
          setAllowance(allowance);
        }
      },
    [
      auctionContractAddress,
      goldToken,
      publicClient,
      userCharacter?.owner,
      worldContract.read,
    ],
  );

  const allow = async function (a: bigint) {
    const tx = {
      address: goldToken as Address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [
        auctionContractAddress, //userCharacter?.owner as Address,
        a, //auctionHouseOrdersContractAddress as Address,
      ],
    };
    const results = await publicClient.simulateContract(tx);
    await walletClient.writeContract(tx);
    setAllowance(results.result == true ? a : 0n);
  };
  const bid = async function (a: bigint) {
    if (params.itemId) {
      if (allowance >= BigInt(a)) {
        const orderId = await worldContract.write.UD__createOrder([
          {
            signature: '' as Address,
            offerer: '' as Address,
            offer: {
              tokenType: 1,
              token: '' as Address,
              identifier: 1n,
              amount: 1n,
            },
            consideration: {
              tokenType: 2,
              token: '' as Address,
              identifier: 1n,
              amount: 1n,
              recipient: '' as Address,
            },
          },
        ]);
        setItems([
          ...items,
          {
            orderId: orderId as Address,
            collection: itemsContract as Address,
            buyer: userCharacter?.owner as Address,
            tokenId: BigInt(params.itemId),
            price: a,
          },
        ]);
      }
    }
    //console.log("no item id")
  };

  // const cancel = async function (_orderId: Address) {
  //   const order = items.filter(x => x.orderId == _orderId)[0];
  //   const orderId = await worldContract.write.UD__cancelOrder([
  //     itemsContract as Address,
  //     order.tokenId,
  //   ]);
  //   setItems([...items.filter(x => x.orderId != orderId)]);
  // };

  // const fill = async function (_orderId: Address) {
  //   const order = items.filter(x => x.orderId == _orderId)[0];
  //   const orderId = await worldContract.write.UD__fulfillOrder([
  //     itemsContract as Address,
  //     order.tokenId,
  //     order.buyer,
  //     order.price,
  //   ]);
  //   setItems([...items.filter(x => x.orderId != orderId)]);
  // };

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
                onChange={e => setAmount(BigInt(e.target.value))}
                placeholder="0.00"
                type="number"
                min={0}
                value={amount.toString()}
              />
            </InputGroup>
            {allowance >= amount && allowance != 0n ? (
              <Button
                onClick={() => bid(amount)}
                size="sm"
                variant={filter.filtered == 'all' ? 'solid' : 'outline'}
              >
                bid
              </Button>
            ) : (
              <Button
                onClick={() => allow(amount)}
                size="sm"
                variant={filter.filtered == 'all' ? 'solid' : 'outline'}
              >
                allow
              </Button>
            )}
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
                {items.map(function (item) {
                  return (
                    <AuctionHouseListedItem
                      key={item.orderId}
                      name={item.orderId.toString()}
                      buyer={item.buyer.toString()}
                      price={item.price.toString()}
                      // onClick={() => cancel(item.orderId)}
                    ></AuctionHouseListedItem>
                  );
                })}
              </TabPanel>{' '}
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
