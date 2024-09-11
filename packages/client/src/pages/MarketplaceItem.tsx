import {
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftAddon,
  Spacer,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate, useParams } from 'react-router-dom';
import { Address, erc20Abi, formatEther, parseEther } from 'viem';

import { MarketplaceAllowanceModal } from '../components/MarketplaceAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { MARKETPLACE_PATH } from '../Routes';
import { ERC_1155_ABI } from '../utils/constants';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorStats,
  type ConsiderationData,
  type OfferData,
  type Order,
  OrderStatus,
  type SpellStats,
  TokenType,
  type WeaponStats,
} from '../utils/types';

export const MarketplaceItem = (): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();

  const {
    components: {
      Considerations,
      ItemsOwners,
      Offers,
      Orders,
      UltimateDominionConfig,
    },
    isSynced,
    network: { publicClient },
    systemCalls: { createOrder },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { character: userCharacter } = useCharacter();

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isFetchingOrders, setIsFetchingOrders] = useState(true);
  const [refetchCounter, setRefetchCounter] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);

  const [offerAmount, setOfferAmount] = useState('1');
  const [offerPrice, setOfferPrice] = useState('1');
  const [listingAmount, setListingAmount] = useState('1');
  const [listingPrice, setListingPrice] = useState('1');

  const { isOpen, onClose, onOpen } = useDisclosure();

  const { marketplace: marketplaceAddress, goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { marketplace: null, goldToken: null };

  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const fetchOrders = useCallback(() => {
    const _orders = Array.from(
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
      const offerData = getComponentValueStrict(Offers, orderHash);
      const orderStatus = getComponentValueStrict(
        Orders,
        orderHash,
      ).orderStatus;

      return {
        orderHash: orderHash.toString(),
        orderStatus: orderStatus.toString(),
        offer: {
          amount:
            offerData.tokenType === TokenType.ERC20
              ? formatEther(offerData.amount)
              : offerData.amount.toString(),
          identifier: offerData.identifier.toString(),
          token: offerData.token.toString(),
          tokenType: offerData.tokenType,
        } as OfferData,
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
      } as Order;
    });

    setRefetchCounter(prev => prev + 1);
    setOrders(_orders);
    setIsFetchingOrders(false);
  }, [Considerations, Offers, Orders]);

  useEffect(() => {
    if (!isSynced) return;
    fetchOrders();
  }, [fetchOrders, isSynced]);

  const selectedItem = useMemo(() => {
    const armor = armorTemplates.find(
      armor => armor.tokenId === selectedItemId,
    );
    if (armor) return armor;

    const spell = spellTemplates.find(
      spell => spell.tokenId === selectedItemId,
    );
    if (spell) return spell;

    const weapon = weaponTemplates.find(
      weapon => weapon.tokenId === selectedItemId,
    );
    if (weapon) return weapon;

    return null;
  }, [armorTemplates, selectedItemId, spellTemplates, weaponTemplates]);

  const userItemBalance = useMemo(() => {
    if (!(userCharacter && selectedItem)) return '0';
    if (refetchCounter === 0) return '0';

    const tokenOwnersEntity = encodeEntity(
      { owner: 'address', tokenId: 'uint256' },
      {
        owner: userCharacter.owner as `0x${string}`,
        tokenId: BigInt(selectedItem.tokenId),
      },
    );

    const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);
    return itemOwner ? itemOwner.balance.toString() : '0';
  }, [ItemsOwners, refetchCounter, selectedItem, userCharacter]);

  const fetchAllowances = useCallback(async () => {
    let allowances = { goldAllowance: 0n, itemAllowance: false };
    try {
      const _goldAllowance = await publicClient.readContract({
        address: goldToken as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userCharacter?.owner as Address, marketplaceAddress as Address],
      });

      const _itemAllowance = (await publicClient.readContract({
        address: itemsContract as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [userCharacter?.owner as Address, marketplaceAddress as Address],
      })) as boolean;
      allowances = {
        goldAllowance: _goldAllowance,
        itemAllowance: _itemAllowance,
      };
      return allowances;
    } catch (e) {
      renderError((e as Error)?.message ?? 'Could not get allowances', e);
      return allowances;
    }
  }, [
    goldToken,
    itemsContract,
    marketplaceAddress,
    publicClient,
    renderError,
    userCharacter?.owner,
  ]);

  const onCreateOrder = useCallback(
    async (
      offerType: TokenType,
      considerationType: TokenType,
      amount: string,
      price: string,
    ) => {
      try {
        setIsCreatingOrder(true);

        if (!userCharacter) throw new Error('Character not found.');
        if (!selectedItem) throw new Error('Item not found.');
        if (!goldToken || !itemsContract) {
          throw new Error('Token contracts not found.');
        }

        const allowances = await fetchAllowances();

        if (
          offerType === TokenType.ERC20 &&
          (!allowances.goldAllowance ||
            allowances.goldAllowance < BigInt(price))
        ) {
          onOpen();
          throw new Error('Gold allowance is insufficient.');
        }

        if (offerType === TokenType.ERC1155 && !allowances.itemAllowance) {
          onOpen();
          throw new Error('Items allowance is off.');
        }

        if (
          offerType === TokenType.ERC1155 &&
          Number(amount) > Number(userItemBalance)
        ) {
          throw new Error(
            `You do not have enough ${selectedItem.name} to sell.`,
          );
        }

        const _order = {
          consideration: {
            amount:
              considerationType === TokenType.ERC20
                ? parseEther(price)
                : BigInt(price),
            identifier:
              considerationType === TokenType.ERC20
                ? 0n
                : BigInt(selectedItem.tokenId),
            recipient: userCharacter.owner as Address,
            token: (considerationType === TokenType.ERC20
              ? goldToken
              : itemsContract) as Address,
            tokenType: considerationType,
          },
          offer: {
            amount:
              offerType === TokenType.ERC20
                ? parseEther(amount)
                : BigInt(amount),
            identifier:
              offerType === TokenType.ERC20 ? 0n : BigInt(selectedItem.tokenId),
            token: (offerType === TokenType.ERC20
              ? goldToken
              : itemsContract) as Address,
            tokenType: offerType,
          },
          offerer: userCharacter.owner as Address,
          signature: '' as Address,
        };

        const { error, success } = await createOrder(_order);

        if (error && !success) {
          throw new Error(error);
        }

        renderSuccess('Order placed successfully!');
        fetchOrders();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to create order.', e);
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [
      createOrder,
      fetchAllowances,
      fetchOrders,
      goldToken,
      itemsContract,
      onOpen,
      renderError,
      renderSuccess,
      selectedItem,
      userCharacter,
      userItemBalance,
    ],
  );

  const itemFloorPrice = useMemo(() => {
    const itemOrders = orders.filter(
      order => order.consideration.token == goldToken,
    );

    if (itemOrders.length == 0) return null;

    const floorPrices = itemOrders.map(order =>
      parseEther(order.consideration.amount),
    );

    return formatEther(
      floorPrices.reduce((prev, curr) => (prev < curr ? prev : curr)),
    );
  }, [goldToken, orders]);

  const itemCeilingPrice = useMemo(() => {
    const itemOrders = orders.filter(
      order => order.consideration.token == goldToken,
    );

    if (itemOrders.length == 0) return null;

    const ceilingPrices = itemOrders.map(order =>
      parseEther(order.consideration.amount),
    );

    return formatEther(
      ceilingPrices.reduce((prev, curr) => (prev > curr ? prev : curr)),
    );
  }, [goldToken, orders]);

  if (selectedItem == null) {
    return (
      <VStack>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <Text>Item not found</Text>
      </VStack>
    );
  }

  if (isFetchingOrders || isLoadingItemTemplates) {
    return (
      <VStack>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <HStack h="100%" justifyContent="center" w="100%">
          <Spinner size="xl" />
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack>
      <MarketplaceAllowanceModal isOpen={isOpen} onClose={onClose} />
      <Box>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <HStack alignItems="start" spacing={12}>
          <Stack w="50%">
            <HStack>
              <Heading textAlign="center">
                {removeEmoji(selectedItem.name)}
              </Heading>
            </HStack>

            <Center my={5}>
              <Avatar
                borderRadius={0}
                size="2xl"
                name={' '}
                backgroundColor="transparent"
              >
                {getEmoji(selectedItem.name)}
              </Avatar>
            </Center>
            <Text>{selectedItem.description}</Text>
          </Stack>
          <Grid templateColumns="repeat(, 1fr)" w="50%">
            {[...Object.keys({ ...selectedItem })]
              .filter(key =>
                ['effects', 'itemId', 'owner', 'statRestrictions'].indexOf(
                  key,
                ) > -1
                  ? false
                  : true,
              )
              .map((key, i) => (
                <GridItem key={`detail-${i}`}>
                  <HStack>
                    <Text textTransform="capitalize">{key}</Text>
                    <Spacer />
                    <Text>
                      {selectedItem
                        ? selectedItem[
                            key as keyof (
                              | Omit<ArmorStats, 'statRestrictions'>
                              | Omit<SpellStats, 'statRestrictions'>
                              | Omit<WeaponStats, 'statRestrictions'>
                            )
                          ]
                        : ''}
                    </Text>
                  </HStack>
                </GridItem>
              ))}
            <GridItem>
              <HStack>
                <Text>Floor Price</Text>
                <Spacer />
                <Text>
                  {itemFloorPrice == null ? 'not enough data' : itemFloorPrice}
                </Text>
              </HStack>
            </GridItem>
            <GridItem>
              <HStack>
                <Text>Ceiling Price</Text>
                <Spacer />
                <Text>
                  {itemCeilingPrice == null
                    ? 'not enough data'
                    : itemCeilingPrice}
                </Text>
              </HStack>
            </GridItem>
          </Grid>
        </HStack>
        <Divider my={8} />
        <HStack alignItems="start" spacing={12}>
          <Stack w="50%">
            <Text fontWeight="bold">Make an Offer</Text>
            <Text>
              Want to make a $GOLD offer for {selectedItem.name}? Your offer
              will be listed in the &quot;$GOLD Offers&quot; tab below.
            </Text>
          </Stack>
          <Stack w="50%">
            <Text fontWeight="bold">List for Sale</Text>
            {userItemBalance === '0' ? (
              <Text>
                You don&apos;t have any {selectedItem.name} in your inventory.
              </Text>
            ) : (
              <Text>
                You currently have {userItemBalance} {selectedItem.name}. Want
                to list some for sale? Your listing will be shown in the
                &quot;Item Listings&quot; tab below.
              </Text>
            )}
          </Stack>
        </HStack>
        <HStack alignItems="start" spacing={12}>
          <Stack w="50%">
            <Stack direction="row" mb={2} mt={8} w="100%">
              <InputGroup size="lg" w="100%">
                <InputLeftAddon>Price</InputLeftAddon>
                <Input
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min={0}
                  value={offerPrice.toString()}
                />
              </InputGroup>
              <InputGroup size="lg" w="100%">
                <InputLeftAddon>Amount</InputLeftAddon>
                <Input
                  onChange={e => setOfferAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min={0}
                  value={offerAmount.toString()}
                />
              </InputGroup>
            </Stack>
            <Button
              w="100%"
              onClick={() =>
                onCreateOrder(
                  TokenType.ERC20,
                  TokenType.ERC1155,
                  offerAmount,
                  offerPrice,
                )
              }
              isLoading={isCreatingOrder}
              size="sm"
              variant="solid"
            >
              Offer {offerPrice} $GOLD for {offerAmount} item
            </Button>
          </Stack>
          <Stack w="50%">
            <Stack direction="row" mb={2} mt={8} w="100%">
              <InputGroup size="lg" w="100%">
                <InputLeftAddon>Amount</InputLeftAddon>
                <Input
                  onChange={e => setListingAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min={0}
                  step={1}
                  max={Number(userItemBalance)}
                  value={listingAmount.toString()}
                />
              </InputGroup>
              <InputGroup size="lg" w="100%">
                <InputLeftAddon>Price</InputLeftAddon>
                <Input
                  onChange={e => setListingPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min={0}
                  value={listingPrice.toString()}
                />
              </InputGroup>
            </Stack>
            <Button
              w="100%"
              onClick={() =>
                onCreateOrder(
                  TokenType.ERC1155,
                  TokenType.ERC20,
                  listingAmount,
                  listingPrice,
                )
              }
              isLoading={isCreatingOrder}
              size="sm"
              variant="solid"
            >
              List {listingAmount} of your item for {listingPrice} $GOLD
            </Button>
          </Stack>
        </HStack>
        <Divider my={8} />
        <Tabs variant="enclosed" size="lg">
          <TabList>
            <Tab>Item Listings</Tab>
            <Tab>$GOLD Offers</Tab>
            <Tab>History</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Stack gap={2}>
                {orders
                  .filter(
                    item =>
                      item.offer.token == itemsContract &&
                      item.consideration.token == goldToken &&
                      item.offer.identifier == selectedItemId,
                  )
                  .filter(item => item.orderStatus == '1')
                  .map((order, i) => (
                    <OrderRow
                      key={`order-${i}`}
                      item={selectedItem}
                      order={order}
                      refetchOrders={fetchOrders}
                    />
                  ))}
              </Stack>
            </TabPanel>
            <TabPanel>
              <Stack gap={2}>
                {orders
                  .filter(
                    item =>
                      item.offer.token == goldToken &&
                      item.consideration.token == itemsContract &&
                      item.consideration.identifier == selectedItemId,
                  )
                  .filter(item => item.orderStatus == '1')
                  .map((order, i) => (
                    <OrderRow
                      key={`order-${i}`}
                      item={selectedItem}
                      order={order}
                      refetchOrders={fetchOrders}
                    />
                  ))}
              </Stack>
            </TabPanel>
            <TabPanel>Coming soon...</TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </VStack>
  );
};
