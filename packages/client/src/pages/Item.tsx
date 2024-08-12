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
import { getComponentValueStrict, Has, runQuery } from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
import worldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
// import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { Address, erc20Abi, formatEther, maxUint256, parseEther } from 'viem';
import { useWalletClient } from 'wagmi';

import { ItemCard } from '../components/ItemCard';
import { OrderRow } from '../components/OrderRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { AUCTION_PATH } from '../Routes';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import {
  Armor,
  ArmorStats,
  Character,
  ItemType,
  StatsClasses,
  Weapon,
  WeaponStats,
} from '../utils/types';
const erc1155abi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
    ],
    name: 'isApprovedForAll',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
export const Item = (): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();

  const { renderSuccess, renderError } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  //   const [filter, setFilter] = useState({ filtered: 'all' });
  //   const [query, setQuery] = useState('');
  interface Item {
    ItemType: ItemType;
    TokenId: string;
    Weapon: WeaponStats | null;
    Armor: ArmorStats | null;
    Balance: number | null;
  }
  interface Order {
    orderHash: string;
    orderStatus: string;
    offer: OfferData;
    consideration: ConsiderationData;
  }
  interface OfferData {
    amount: string;
    identifier: string;
    token: string;
    tokenType: string;
  }
  interface ConsiderationData {
    amount: string;
    identifier: string;
    token: string;
    tokenType: string;
    recipient: string;
  }
  const { character: userCharacter } = useCharacter();
  const [floor, setFloor] = useState(maxUint256);
  const [ceiling, setCeiling] = useState(0n);
  const [isSelling, setIsSelling] = useState(false);
  const [offerAmount, setOfferAmount] = useState(1);
  const [offerPrice, setOfferPrice] = useState(1);
  const [listingAmount, setListingAmount] = useState(1);
  const [listingPrice, setListingPrice] = useState(1);
  const [inventory, setInventory] = useState<Item[] | null>(null);
  const [itemType, setItemType] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [goldAllowance, setGoldAllowance] = useState<bigint | null>(null);
  const [itemAllowance, setItemAllowance] = useState<boolean | null>(null);
  const [auctionContractAddress, setAuctionContractAddress] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);

  const {
    components: {
      UltimateDominionConfig,
      Characters,
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
      Offers,
    },
    network: { worldContract, publicClient },
  } = useMUD();
  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };
  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const _sell = async function (
    wanted: Item | bigint,
    offered: Item | bigint,
    purchaser: Character,
    amount: bigint,
  ) {
    if (!externalWalletClient) {
      renderError('Wallet not connected.');
      return;
    }
    try {
      setIsSelling(true);
      // this is covering both selling an item for gold or gold for an item
      // wanted is either an item or a bigint (representing a gold amount)
      const args = [
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
                : BigInt((offered as Item).TokenId),
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
                : BigInt((wanted as Item).TokenId),
            // Amount is the amount of the ERC1155 token that is wanted. For ERC20, use the offered value
            amount: typeof wanted === 'bigint' ? wanted : amount,
            recipient: purchaser.owner as Address,
          },
        },
      ];
      const { request } = await publicClient.simulateContract({
        address: worldContract.address,
        abi: worldAbi,
        functionName: 'UD__createOrder',
        account: externalWalletClient.account,
        args: args,
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
      !params.itemId ||
      inventory == null ||
      !inventory[0].Balance ||
      Number(amount) > inventory[0].Balance
    ) {
      renderError('You do not have enough items to sell');
    } else if (items && userCharacter) {
      _sell(
        parseEther(price.toString()),
        items.filter(x => x.TokenId == params.itemId)[0],
        userCharacter,
        BigInt(amount),
      );
    }
  };
  const orderItem = async function (amount: string, price: string) {
    if (
      !params.itemId ||
      goldAllowance == null ||
      goldAllowance < parseEther(price.toString())
    ) {
      renderError('Approve more funds in your wallet details');
    } else if (items && userCharacter) {
      _sell(
        items.filter(x => x.TokenId == params.itemId)[0],
        parseEther(price.toString()),
        userCharacter,
        BigInt(amount),
      );
    }
  };
  const fetchCharacterItems = useCallback(
    async (character: Character) => {
      try {
        const _items = Array.from(runQuery([Has(ItemsOwners)]))
          .map(entity => {
            const itemdBalance = getComponentValueStrict(
              ItemsOwners,
              entity,
            ).balance;

            const { owner, tokenId } = decodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              entity,
            );

            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId },
            );

            const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);

            return {
              balance: itemdBalance.toString(),
              itemId: entity,
              itemType: itemTemplate.itemType,
              owner,
              tokenId: tokenId.toString(),
              tokenIdEntity,
            };
          })

          .filter(
            item =>
              item.owner === character?.owner &&
              ItemType[item.itemType] === itemType &&
              item.tokenId === params.itemId,
          )
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
          })
          .map(item => {
            const result = {
              ItemType: item.itemType,
              TokenId: item.tokenId,
              Balance: Number(item.balance),
              Weapon: null,
              Armor: null,
            } as Item;
            result[ItemType[item.itemType]] = item;
            return result;
          });
        setInventory(_items);
      } catch (e) {
        renderError('Failed to fetch character data.', e);
      } finally {
        // setIsLoadingItems(false);
      }
    },
    [Items, ItemsOwners, itemType, params.itemId, renderError],
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
          if (considerationData.token == goldToken) {
            setFloor(
              BigInt(
                considerationData.amount / offerData.amount < floor
                  ? considerationData.amount / offerData.amount
                  : floor,
              ),
            );
          }
          if (offerData.token == goldToken) {
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
  const fetchItems = useCallback(async () => {
    const _items = Array.from(runQuery([Has(ItemsOwners)]))
      .map(entity => {
        const { owner, tokenId } = decodeEntity(
          { owner: 'address', tokenId: 'uint256' },
          entity,
        );

        const tokenIdEntity = encodeEntity({ tokenId: 'uint256' }, { tokenId });

        const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
        return {
          // balance: itemdBalance.toString(),
          itemId: entity,
          itemType: itemTemplate.itemType,
          owner,
          tokenId: tokenId.toString(),
          tokenIdEntity,
        };
      })
      .filter(item => item.tokenId == params.itemId);
    const allItems = await Promise.all(
      _items.map(async item => {
        setItemType(ItemType[item.itemType]);
        const itemData = {
          TokenId: item.tokenId,
          ItemType: item.itemType as ItemType,
          Weapon: null as WeaponStats | null,
          Armor: null as ArmorStats | null,
        };
        const baseURI = getComponentValueStrict(
          ItemsBaseURI,
          singletonEntity,
        ).uri;

        const tokenURI = getComponentValueStrict(
          ItemsTokenURI,
          item.tokenIdEntity,
        ).uri;

        const metadata = await fetchMetadataFromUri(
          uriToHttp(`${baseURI}${tokenURI}`)[0],
        );
        switch (item.itemType) {
          case ItemType.Weapon: {
            const w = await worldContract.read.UD__getWeaponStats([
              BigInt(item.tokenId),
            ]);
            itemData.Weapon = {
              ...metadata,
              agiModifier: w.agiModifier.toString(),
              classRestrictions: w.classRestrictions.map(
                (classRestriction: number) => classRestriction as StatsClasses,
              ),
              hitPointModifier: w.hitPointModifier.toString(),
              intModifier: w.intModifier.toString(),
              itemId: item.itemId,
              maxDamage: w.maxDamage.toString(),
              minDamage: w.minDamage.toString(),
              minLevel: w.minLevel.toString(),
              owner: item.owner,
              strModifier: w.strModifier.toString(),
              tokenId: item.tokenId,
            } as Weapon;
            break;
          }
          case ItemType.Armor: {
            const a = await worldContract.read.UD__getArmorStats([
              BigInt(item.tokenId),
            ]);
            itemData.Armor = {
              ...metadata,
              armorModifier: a.armorModifier.toString(),
              agiModifier: a.agiModifier.toString(),
              classRestrictions: a.classRestrictions.map(
                (classRestriction: number) => classRestriction as StatsClasses,
              ),
              hitPointModifier: a.hitPointModifier.toString(),
              intModifier: a.intModifier.toString(),
              itemId: item.itemId,
              minLevel: a.minLevel.toString(),
              owner: item.owner,
              strModifier: a.strModifier.toString(),
              tokenId: item.tokenId,
            } as Armor;
            break;
          }
          default:
            break;
        }
        return itemData;
      }),
    );

    setItems(allItems);
  }, [
    Items,
    ItemsBaseURI,
    ItemsOwners,
    ItemsTokenURI,
    params.itemId,
    worldContract.read,
  ]);
  useEffect(() => {
    (async function () {
      setAuctionContractAddress(
        await worldContract.read.UD__auctionHouseAddress(),
      );
      await fetchItems();
      await fetchOrders();
      if (userCharacter && itemType) {
        await fetchCharacterItems(userCharacter);
      }
      if (auctionContractAddress && userCharacter) {
        setGoldAllowance(
          await publicClient.readContract({
            address: goldToken as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [
              userCharacter?.owner as Address,
              auctionContractAddress as Address,
            ],
          }),
        );
      }
      if (itemAllowance == null && auctionContractAddress && userCharacter) {
        setItemAllowance(
          (await publicClient.readContract({
            address: itemsContract as Address,
            abi: erc1155abi,
            functionName: 'isApprovedForAll',
            args: [
              userCharacter?.owner as Address,
              auctionContractAddress as Address,
            ],
          })) as boolean,
        );
      }
    })();
  }, [
    Characters,
    auctionContractAddress,
    fetchCharacterItems,
    fetchItems,
    fetchOrders,
    goldAllowance,
    goldToken,
    itemAllowance,
    itemType,
    itemsContract,
    publicClient,
    userCharacter,
    userCharacter?.owner,
    worldContract.read,
  ]);
  return (
    <Stack>
      <Box>
        <Grid
          templateRows="repeat(10, 1fr)"
          templateColumns={{ base: 'repeat(5, 1fr)', lg: 'repeat(10, 1fr)' }}
        >
          <GridItem p={5} rowSpan={2} colSpan={5}>
            {items != null && itemType != null ? (
              <Heading textAlign="center">
                {items[0][itemType]?.name.replace(/[\p{Emoji}\u200d]+/gu, '')}
              </Heading>
            ) : (
              <Skeleton>
                <Heading>...</Heading>
              </Skeleton>
            )}
            <Center my={5}>
              {items != null && itemType != null ? (
                <Avatar
                  borderRadius={0}
                  size="2xl"
                  name={' '}
                  backgroundColor="transparent"
                >
                  {(items[0][itemType]?.name as string).match(
                    /[\p{Emoji}\u200d]+/gu,
                  )}
                </Avatar>
              ) : (
                <Skeleton>
                  <Image min-height={200}></Image>
                </Skeleton>
              )}
            </Center>
            {items != null && itemType != null ? (
              <Text>{items[0][itemType]?.description}</Text>
            ) : (
              <Skeleton></Skeleton>
            )}
            <Button
              w="100%"
              mt={5}
              size="sm"
              onClick={() => navigate(AUCTION_PATH)}
              variant="outline"
            >
              Back to Auction House
            </Button>
          </GridItem>
          <GridItem p={5} rowSpan={2} colSpan={5}>
            <Stack></Stack>
            <Grid templateColumns="repeat(, 1fr)">
              {items != null && itemType != null ? (
                [...Object.keys(items[0][itemType])]
                  .filter(
                    x =>
                      [
                        'name',
                        'description',
                        'owner',
                        'image',
                        'tokenId',
                        'itemId',
                        'classRestrictions',
                      ].indexOf(x) == -1,
                  )
                  .map((key, i) => (
                    <GridItem key={`detail-${i}`}>
                      <HStack>
                        <Text textTransform="capitalize">{key}</Text>
                        <Spacer></Spacer>
                        <Text>{items[0][itemType][key]}</Text>
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
                    {floor.toString().toString() == maxUint256.toString()
                      ? 'not enough data'
                      : formatEther(floor.toString()).toString()}
                  </Text>
                </HStack>
              </GridItem>
              <GridItem>
                <HStack>
                  <Text>Cieling Price</Text>
                  <Spacer></Spacer>
                  <Text>
                    {formatEther(ceiling.toString()).toString() == '0'
                      ? 'not enough data'
                      : formatEther(ceiling.toString()).toString()}
                  </Text>
                </HStack>
              </GridItem>{' '}
            </Grid>
            <Spacer></Spacer>
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
                onClick={() => orderItem(offerAmount, offerPrice)}
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
                    {orders != null && itemType != null && items != null
                      ? orders
                          .filter(
                            item =>
                              item.offer.token == itemsContract &&
                              item.consideration.token == goldToken &&
                              item.offer.identifier == params.itemId,
                          )
                          .filter(item => item.orderStatus == 1)
                          .map((order, i) => (
                            <OrderRow
                              key={`order-${i}`}
                              from={order.consideration.recipient}
                              orderHash={order.orderHash}
                              offer={Number(order.offer.amount)}
                              consideration={formatEther(
                                order.consideration.amount,
                              )}
                              considerationItem={'$GOLD'}
                              offerItem={items[0][itemType]?.name.replace(
                                /[\p{Emoji}\u200d]+/gu,
                                '',
                              )}
                              emoji={(items[0][itemType]?.name as string).match(
                                /[\p{Emoji}\u200d]+/gu,
                              )}
                            ></OrderRow>
                          ))
                      : ''}
                  </Stack>
                </TabPanel>
                <TabPanel>
                  <Stack gap={2}>
                    {orders != null && itemType != null && items != null
                      ? orders
                          .filter(
                            item =>
                              item.offer.token == goldToken &&
                              item.consideration.token == itemsContract &&
                              item.consideration.identifier == params.itemId,
                          )
                          .filter(item => item.orderStatus == '1')
                          .map((order, i) => (
                            <OrderRow
                              key={`order-${i}`}
                              from={order.consideration.recipient}
                              orderHash={order.orderHash}
                              consideration={Number(order.consideration.amount)}
                              offer={formatEther(order.offer.amount).toString()}
                              offerItem={'$GOLD'}
                              considerationItem={items[0][
                                itemType
                              ]?.name.replace(/[\p{Emoji}\u200d]+/gu, '')}
                              emoji={(items[0][itemType]?.name as string).match(
                                /[\p{Emoji}\u200d]+/gu,
                              )}
                            ></OrderRow>
                          ))
                      : ''}
                  </Stack>
                </TabPanel>
                <TabPanel>
                  <Center>
                    <Stack direction="row">
                      {items != null &&
                      inventory != null &&
                      inventory.length > 0 &&
                      inventory[0].Balance > 0 &&
                      itemType != null ? (
                        <ItemCard
                          name={items[0][itemType].name}
                          classRestrictions={
                            items[0][itemType].classRestrictions
                          }
                          image={`x${inventory[0]?.Balance}`}
                          strModifier={items[0][itemType].strModifier}
                          agiModifier={items[0][itemType].agiModifier}
                          intModifier={items[0][itemType].intModifier}
                          {...inventory[0][itemType]}
                          isEquipped={false}
                        />
                      ) : (
                        ''
                      )}
                      <Center>
                        {inventory &&
                        inventory.length > 0 &&
                        inventory[0]?.Balance > 0 ? (
                          <Avatar
                            name={' '}
                            size="lg"
                            w={100}
                            h={100}
                            background="grey300"
                          >
                            <FaTimes />
                            {inventory[0]?.Balance < 1000
                              ? inventory[0].Balance
                              : '999+'}
                          </Avatar>
                        ) : (
                          ''
                        )}
                      </Center>
                    </Stack>
                  </Center>
                  {inventory &&
                  inventory.length > 0 &&
                  inventory[0].Balance > 0 ? (
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
                            max={Number(inventory[0]?.Balance)}
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
