import {
  Avatar,
  Box,
  Button,
  Center,
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
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import worldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Address,
  erc20Abi,
  formatEther,
  maxUint256,
  parseEther,
  zeroHash,
} from 'viem';
import { useWalletClient } from 'wagmi';

import { AuctionAllowance } from '../components/AuctionAllowance';
import { ItemCard } from '../components/ItemCard';
import { OrderRow } from '../components/OrderRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { AUCTION_HOUSE_PATH } from '../Routes';
import { ERC_1155ABI } from '../utils/constants';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorStats,
  type ArmorTemplate,
  type Character,
  type ConsiderationData,
  type OfferData,
  type Order,
  type WeaponStats,
  type WeaponTemplate,
} from '../utils/types';

export const AuctionItem = (): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();

  const { renderSuccess, renderError } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();

  const {
    components: { UltimateDominionConfig, Characters, ItemsOwners, Offers },
    isSynced,
    network: { worldContract, publicClient },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    weaponTemplates,
  } = useItems();
  const { character: userCharacter } = useCharacter();

  const [selectedItem, setSelectedItem] = useState<
    ArmorTemplate | WeaponTemplate | null
  >(null);
  const [currentBalance, setCurrentBalance] = useState('0');
  const [floor, setFloor] = useState(maxUint256);
  const [ceiling, setCeiling] = useState(0n);
  const [isSelling, setIsSelling] = useState(false);
  const [offerAmount, setOfferAmount] = useState('1');
  const [offerPrice, setOfferPrice] = useState('1');
  const [listingAmount, setListingAmount] = useState('1');
  const [listingPrice, setListingPrice] = useState('1');
  const [itemType, setItemType] = useState<string | null>(null);
  const [auctionHouseAddress, setAuctionHouseAddress] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };
  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const _getAllowances = async function () {
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
        abi: ERC_1155ABI,
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
  };

  const onClose = function () {
    setIsOpen(false);
    navigate(0);
  };

  const _sell = async function (
    wanted: ArmorTemplate | WeaponTemplate | bigint,
    offered: ArmorTemplate | WeaponTemplate | bigint,
    purchaser: Character,
    amount: bigint,
  ) {
    if (!externalWalletClient || !auctionHouseAddress || !userCharacter) {
      renderError('Wallet not connected.');
      return;
    }
    try {
      setIsSelling(true);
      const allowances = await _getAllowances();
      if (typeof offered != 'bigint' && !allowances.itemAllowance) {
        renderError('Items allowance is off');
        setIsOpen(true);
        return;
      }
      if (
        typeof offered == 'bigint' &&
        (!allowances.goldAllowance || allowances.goldAllowance < offered)
      ) {
        renderError('Gold allowance is insufficient');
        setIsOpen(true);
        return;
      } // this is covering both selling an item for gold or gold for an item
      // wanted is either an item or a bigint (representing a gold amount)
      const { request } = await publicClient.simulateContract({
        address: worldContract.address,
        abi: worldAbi,
        functionName: 'UD__createOrder',
        account: externalWalletClient.account,
        args: [
          {
            signature: '' as Address,
            offerer: purchaser.owner as Address,
            offer: {
              // 1 is ERC20 in the contracts. 3 is ERC1155
              tokenType: typeof offered === 'bigint' ? 1 : 3,
              token:
                typeof offered === 'bigint'
                  ? (goldToken as Address)
                  : (itemsContract as Address),
              // Identifier will be ignored if it's a bigint (representing gold), otherwise it represents the ERC1155 token ID
              identifier:
                typeof offered === 'bigint'
                  ? 0n
                  : BigInt((offered as ArmorTemplate | WeaponTemplate).tokenId),
              // Amount is the amount of the ERC1155 token that is offered. For ERC20, use the offered value
              amount: typeof offered === 'bigint' ? offered : amount,
            },
            consideration: {
              // 1 is ERC20 in the contracts. 3 is ERC1155
              tokenType: typeof wanted === 'bigint' ? 1 : 3,
              token:
                // Identifier will be ignored if it's a bigint (representing gold), otherwise it represents the ERC1155 token ID
                typeof wanted === 'bigint'
                  ? (goldToken as Address)
                  : (itemsContract as Address),
              identifier:
                typeof wanted === 'bigint'
                  ? 0n
                  : BigInt((wanted as ArmorTemplate | WeaponTemplate).tokenId),
              // Amount is the amount of the ERC1155 token that is wanted. For ERC20, use the offered value
              amount: typeof wanted === 'bigint' ? wanted : amount,
              recipient: purchaser.owner as Address,
            },
          },
        ],
      });
      await externalWalletClient?.writeContract(request);
      renderSuccess('Order placed successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error placing order.', e);
    } finally {
      setIsSelling(false);
    }
  };

  const sellItem = async function (
    amount: string | number,
    price: string | number,
  ) {
    if (
      !selectedItemId ||
      !currentBalance ||
      Number(amount) > Number(currentBalance)
    ) {
      renderError('You do not have enough items to sell');
    } else if (selectedItem && userCharacter) {
      _sell(
        parseEther(price.toString()),
        selectedItem,
        userCharacter,
        BigInt(amount),
      );
    }
  };

  const orderItem = async function (amount: string, price: string) {
    if (selectedItem && userCharacter) {
      _sell(
        selectedItem,
        parseEther(price.toString()),
        userCharacter,
        BigInt(amount),
      );
    }
  };

  const fetchCharacterItems = useCallback(
    async (
      character: Character,
      _selectedItem: ArmorTemplate | WeaponTemplate,
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
    setOrders(
      await Promise.all(
        Array.from(runQuery([Has(Offers)])).map(async orderHash => {
          const offerData = await worldContract.read.UD__getOffer([
            orderHash as Address,
          ]);
          const considerationData =
            await worldContract.read.UD__getConsideration([
              orderHash as Address,
            ]);
          const orderStatus = await worldContract.read.UD__getOrderStatus([
            orderHash as Address,
          ]);
          if (considerationData.token == goldToken && orderStatus == 1) {
            setFloor(
              BigInt(
                considerationData.amount / offerData.amount < floor
                  ? considerationData.amount / offerData.amount
                  : floor,
              ),
            );
          }
          if (offerData.token == goldToken && orderStatus == 1) {
            setCeiling(
              BigInt(
                offerData.amount / considerationData.amount > ceiling
                  ? offerData.amount / considerationData.amount
                  : ceiling,
              ),
            );
          }

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
        }),
      ),
    );
  }, [Offers, ceiling, floor, goldToken, worldContract.read]);

  const fetchSelectedItem = useCallback(
    (selectedItemId: string): ArmorTemplate | WeaponTemplate | null => {
      let _item: ArmorTemplate | WeaponTemplate | undefined =
        armorTemplates.find(
          armor => armor.tokenId.toString() === selectedItemId,
        );

      if (_item) {
        setItemType('armor');
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
    [armorTemplates, renderError, weaponTemplates],
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
      <AuctionAllowance isOpen={isOpen} onClose={onClose}></AuctionAllowance>
      <Box>
        <Button
          mt={5}
          size="sm"
          onClick={() => navigate(AUCTION_HOUSE_PATH)}
          variant="outline"
        >
          Back to Auction House
        </Button>
        <Grid
          templateRows="repeat(10, 1fr)"
          templateColumns={{ base: 'repeat(5, 1fr)', lg: 'repeat(10, 1fr)' }}
        >
          <GridItem p={5} rowSpan={2} colSpan={5}>
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
          </GridItem>
          <GridItem p={5} rowSpan={2} colSpan={5}>
            <Grid templateColumns="repeat(, 1fr)">
              {selectedItem != null ? (
                [...Object.keys({ ...selectedItem })]
                  .filter(key =>
                    ['itemId', 'owner', 'statRestrictions'].indexOf(key) > -1
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
                                  | Omit<WeaponStats, 'statRestrictions'>
                                  | Omit<ArmorStats, 'statRestrictions'>
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
                  <Spacer></Spacer>
                  <Text>
                    {floor.toString() == maxUint256.toString()
                      ? 'not enough data'
                      : formatEther(floor).toString()}
                  </Text>
                </HStack>
              </GridItem>
              <GridItem>
                <HStack>
                  <Text>Cieling Price</Text>
                  <Spacer></Spacer>
                  <Text>
                    {formatEther(ceiling).toString() == '0'
                      ? 'not enough data'
                      : formatEther(ceiling).toString()}
                  </Text>
                </HStack>
              </GridItem>{' '}
            </Grid>
            <Spacer />
            <Stack>
              <Stack direction="row" mb={2} mt={8} w="100%">
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
              </Stack>
              <Button
                w="100%"
                onClick={() =>
                  orderItem(offerAmount.toString(), offerPrice.toString())
                }
                isLoading={isSelling}
                size="sm"
                variant="solid"
              >
                Offer {offerPrice} $GOLD for {offerAmount} item
              </Button>
            </Stack>
          </GridItem>
          <GridItem p={5} rowSpan={8} colSpan={{ base: 5, lg: 10 }} order={3}>
            <Tabs variant="enclosed" size="lg">
              <TabList>
                <Tab>Listing</Tab>
                <Tab>Offers</Tab>
                <Tab>Owned</Tab>
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
                              offerItem={removeEmoji(
                                selectedItem?.name as string,
                              )}
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
                <TabPanel>
                  <Center>
                    <Stack direction="row">
                      {BigInt(currentBalance) > 0n &&
                      selectedItem != null &&
                      userCharacter != null &&
                      userCharacter.owner != null ? (
                        <ItemCard
                          {...selectedItem}
                          balance={currentBalance}
                          itemId={zeroHash as Entity}
                          owner={userCharacter.owner}
                        />
                      ) : (
                        ''
                      )}
                    </Stack>
                  </Center>
                  {BigInt(currentBalance) > 0n ? (
                    <Stack>
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
                      <Spacer></Spacer>
                      <Button
                        w="100%"
                        onClick={() =>
                          sellItem(
                            listingAmount.toString(),
                            listingPrice.toString(),
                          )
                        }
                        isLoading={isSelling}
                        size="sm"
                        variant="solid"
                      >
                        List {listingAmount} of your item for {listingPrice}{' '}
                        $GOLD
                      </Button>
                    </Stack>
                  ) : (
                    <Center my={5}>
                      <Text>None Owned</Text>
                    </Center>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </GridItem>
        </Grid>
      </Box>
    </Stack>
  );
};
