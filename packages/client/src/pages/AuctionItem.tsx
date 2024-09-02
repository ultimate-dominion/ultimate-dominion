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
  Image,
  Input,
  InputGroup,
  InputLeftAddon,
  Skeleton,
  Spacer,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  getComponentValue,
  getComponentValueStrict,
  Has,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Address, erc20Abi, formatEther, maxUint256, parseEther } from 'viem';

import { AuctionAllowanceModal } from '../components/AuctionAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { AUCTION_HOUSE_PATH } from '../Routes';
import { ERC_1155_ABI } from '../utils/constants';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorStats,
  type ArmorTemplate,
  type Character,
  type ConsiderationData,
  type OfferData,
  type Order,
  type SpellStats,
  type SpellTemplate,
  TokenType,
  type WeaponStats,
  type WeaponTemplate,
} from '../utils/types';

export const AuctionItem = (): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();

  const {
    components: {
      Characters,
      Considerations,
      ItemsOwners,
      Offers,
      Orders,
      UltimateDominionConfig,
    },
    isSynced,
    network: { worldContract, publicClient },
    systemCalls: { createOrder },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { character: userCharacter } = useCharacter();

  const [selectedItem, setSelectedItem] = useState<
    ArmorTemplate | SpellTemplate | WeaponTemplate | null
  >(null);
  const [currentBalance, setCurrentBalance] = useState('0');

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const [floor /* setFloor */] = useState(maxUint256);
  const [ceiling /* setCeiling */] = useState(0n);
  const [offerAmount, setOfferAmount] = useState('1');
  const [offerPrice, setOfferPrice] = useState('1');
  const [listingAmount, setListingAmount] = useState('1');
  const [listingPrice, setListingPrice] = useState('1');
  const [itemType, setItemType] = useState<string | null>(null);
  const [auctionHouseAddress, setAuctionHouseAddress] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);

  const { isOpen, onClose, onOpen } = useDisclosure();

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const fetchAllowances = useCallback(async () => {
    let allowances = { goldAllowance: 0n, itemAllowance: false };
    try {
      const _goldAllowance = await publicClient.readContract({
        address: goldToken as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userCharacter?.owner as Address, auctionHouseAddress as Address],
      });

      const _itemAllowance = (await publicClient.readContract({
        address: itemsContract as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [userCharacter?.owner as Address, auctionHouseAddress as Address],
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
    auctionHouseAddress,
    goldToken,
    itemsContract,
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
          Number(amount) > Number(currentBalance)
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
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to create order.', e);
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [
      createOrder,
      currentBalance,
      fetchAllowances,
      goldToken,
      itemsContract,
      onOpen,
      renderError,
      renderSuccess,
      selectedItem,
      userCharacter,
    ],
  );

  const fetchCharacterItems = useCallback(
    async (
      character: Character,
      _selectedItem: ArmorTemplate | SpellTemplate | WeaponTemplate,
    ) => {
      try {
        const tokenOwnersEntity = encodeEntity(
          { owner: 'address', tokenId: 'uint256' },
          {
            owner: character.owner as `0x${string}`,
            tokenId: BigInt(_selectedItem.tokenId),
          },
        );

        const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

        setCurrentBalance(itemOwner ? itemOwner.balance.toString() : '0');
      } catch (e) {
        renderError('Failed to fetch character data.', e);
      }
    },
    [ItemsOwners, renderError],
  );

  const fetchOrders = useCallback(async () => {
    const _orders = Array.from(
      runQuery([Has(Considerations), Has(Offers), Has(Orders)]),
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

      // if (considerationData.token == goldToken && orderStatus == 1) {
      //   setFloor(
      //     BigInt(
      //       considerationData.amount / offerData.amount < floor
      //         ? considerationData.amount / offerData.amount
      //         : floor,
      //     ),
      //   );
      // }
      // if (offerData.token == goldToken && orderStatus == 1) {
      //   setCeiling(
      //     BigInt(
      //       offerData.amount / considerationData.amount > ceiling
      //         ? offerData.amount / considerationData.amount
      //         : ceiling,
      //     ),
      //   );
      // }

      return {
        orderHash: orderHash.toString(),
        orderStatus: orderStatus.toString(),
        offer: {
          amount: offerData.amount.toString(),
          identifier: offerData.identifier.toString(),
          token: offerData.token.toString(),
          tokenType: offerData.tokenType.toString(),
        } as OfferData,
        consideration: {
          amount: considerationData.amount.toString(),
          identifier: considerationData.identifier.toString(),
          token: considerationData.token.toString(),
          tokenType: considerationData.tokenType.toString(),
          recipient: considerationData.recipient.toString(),
        } as ConsiderationData,
      } as Order;
    });

    setOrders(_orders);
  }, [Considerations, Offers, Orders]);

  const fetchSelectedItem = useCallback(
    (
      selectedItemId: string,
    ): ArmorTemplate | SpellTemplate | WeaponTemplate | null => {
      let _item: ArmorTemplate | SpellTemplate | WeaponTemplate | undefined =
        armorTemplates.find(
          armor => armor.tokenId.toString() === selectedItemId,
        );

      if (_item) {
        setItemType('armor');
      }

      if (!_item) {
        _item = spellTemplates.find(
          spell => spell.tokenId.toString() === selectedItemId,
        );
      }

      if (_item) {
        setItemType('spell');
      }

      if (!_item) {
        _item = weaponTemplates.find(
          weapon => weapon.tokenId.toString() === selectedItemId,
        );
      }

      if (_item) {
        setItemType('weapon');
      }

      if (!_item) {
        renderError('Item not found');
        return null;
      }

      setSelectedItem(_item);
      return _item;
    },
    [armorTemplates, renderError, spellTemplates, weaponTemplates],
  );

  useEffect(() => {
    (async () => {
      if (!(isSynced && selectedItemId)) return;
      if (isLoadingItemTemplates) return;

      const _auctionHouseAddress = getComponentValueStrict(
        UltimateDominionConfig,
        singletonEntity,
      ).auctionHouse;
      setAuctionHouseAddress(_auctionHouseAddress);

      const _selectedItem = fetchSelectedItem(selectedItemId);
      await fetchOrders();
      if (userCharacter && _selectedItem) {
        fetchCharacterItems(userCharacter, _selectedItem);
      }
    })();
  }, [
    Characters,
    fetchCharacterItems,
    fetchSelectedItem,
    fetchOrders,
    isLoadingItemTemplates,
    isSynced,
    itemType,
    selectedItem,
    selectedItemId,
    UltimateDominionConfig,
    userCharacter,
    worldContract.read,
  ]);

  return (
    <Stack>
      <AuctionAllowanceModal isOpen={isOpen} onClose={onClose} />
      <Box>
        <Button
          mt={5}
          size="sm"
          onClick={() => navigate(AUCTION_HOUSE_PATH)}
          variant="outline"
        >
          Back to Auction House
        </Button>
        <HStack alignItems="start" spacing={12}>
          <Stack w="50%">
            <HStack>
              {selectedItem != null ? (
                <Heading textAlign="center">
                  {removeEmoji(selectedItem.name)}
                </Heading>
              ) : (
                <Skeleton>
                  <Heading>...</Heading>
                </Skeleton>
              )}
            </HStack>

            <Center my={5}>
              {selectedItem != null ? (
                <Avatar
                  borderRadius={0}
                  size="2xl"
                  name={' '}
                  backgroundColor="transparent"
                >
                  {getEmoji(selectedItem.name)}
                </Avatar>
              ) : (
                <Skeleton>
                  <Image min-height={200}></Image>
                </Skeleton>
              )}
            </Center>
            {selectedItem != null && selectedItem.description != null ? (
              <Text>{selectedItem?.description}</Text>
            ) : (
              <Skeleton />
            )}
          </Stack>
          <Grid templateColumns="repeat(, 1fr)" w="50%">
            {selectedItem != null ? (
              [...Object.keys({ ...selectedItem })]
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
                ))
            ) : (
              <Skeleton>
                <GridItem>
                  <Text>INT</Text>
                </GridItem>
              </Skeleton>
            )}{' '}
            <GridItem>
              <HStack>
                <Text>Floor Price</Text>
                <Spacer />
                <Text>
                  {floor.toString() == maxUint256.toString()
                    ? 'not enough data'
                    : formatEther(floor).toString()}
                </Text>
              </HStack>
            </GridItem>
            <GridItem>
              <HStack>
                <Text>Ceiling Price</Text>
                <Spacer />
                <Text>
                  {formatEther(ceiling).toString() == '0'
                    ? 'not enough data'
                    : formatEther(ceiling).toString()}
                </Text>
              </HStack>
            </GridItem>{' '}
          </Grid>
        </HStack>
        <Divider my={8} />
        <HStack alignItems="start" spacing={12}>
          <Stack w="50%">
            <Text fontWeight="bold">Make an Offer</Text>
            <Text>
              Want to make a $GOLD offer for {selectedItem?.name}? Your offer
              will be listed in the &quot;$GOLD Offers&quot; tab below.
            </Text>
          </Stack>
          <Stack w="50%">
            <Text fontWeight="bold">List for Sale</Text>
            {currentBalance === '0' ? (
              <Text>
                You don&apos;t have any {selectedItem?.name} in your inventory.
              </Text>
            ) : (
              <Text>
                You currently have {currentBalance} {selectedItem?.name}. Want
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
                  max={Number(currentBalance)}
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
                {orders != null && itemType != null
                  ? orders
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
                          from={order.consideration.recipient}
                          orderHash={order.orderHash}
                          offer={order.offer.amount}
                          consideration={formatEther(
                            BigInt(order.consideration.amount),
                          )}
                          considerationItem={'$GOLD'}
                          offerItem={removeEmoji(selectedItem?.name as string)}
                          emoji={getEmoji(selectedItem?.name as string)}
                          recipient={order.consideration.recipient}
                        />
                      ))
                  : ''}
              </Stack>
            </TabPanel>
            <TabPanel>
              <Stack gap={2}>
                {orders != null && itemType != null && selectedItem != null
                  ? orders
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
                          from={order.consideration.recipient}
                          orderHash={order.orderHash}
                          consideration={order.consideration.amount}
                          offer={formatEther(
                            BigInt(order.offer.amount),
                          ).toString()}
                          offerItem={'$GOLD'}
                          considerationItem={removeEmoji(selectedItem.name)}
                          emoji={getEmoji(selectedItem.name)}
                          recipient={order.consideration.recipient}
                        />
                      ))
                  : ''}
              </Stack>
            </TabPanel>
            <TabPanel>Coming soon...</TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Stack>
  );
};
