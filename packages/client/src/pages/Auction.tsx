import { Button, Grid, GridItem, Stack, Text } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import {
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
// import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { Address, erc20Abi, parseEther } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
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
export const Auction = (): JSX.Element => {
  const { /*renderSuccess,*/ renderError } = useToast();

  //   const [filter, setFilter] = useState({ filtered: 'all' });
  //   const [query, setQuery] = useState('');
  interface Item {
    ItemType: ItemType;
    TokenId: string;
    Weapon: WeaponStats | null;
    Armor: ArmorStats | null;
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
  }
  const { character: userCharacter } = useCharacter();
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
    wanted: Item | number,
    offered: Item | number,
    purchaser: Character,
    amount: bigint,
  ) {
    return await worldContract.write.UD__createOrder([
      {
        signature: '' as Address,
        offerer: purchaser.owner as Address,
        offer: {
          tokenType: typeof offered === 'number' ? 1 : 2,
          token:
            typeof offered === 'number'
              ? (goldToken as Address)
              : (itemsContract as Address),
          identifier:
            typeof offered === 'number' ? 0n : BigInt(offered.TokenId),
          amount: typeof offered === 'number' ? offered : amount,
        },
        consideration: {
          tokenType: typeof wanted === 'number' ? 1 : 2,
          token:
            typeof wanted === 'number'
              ? (goldToken as Address)
              : (itemsContract as Address),
          identifier: typeof wanted === 'number' ? 0n : BigInt(wanted.TokenId),
          amount: typeof wanted === 'number' ? wanted : amount,
          recipient: purchaser.owner as Address,
        },
      },
    ]);
  };
  const sellItem = async function (
    tokenId: string,
    amount: string,
    price: string,
  ) {
    if (
      goldAllowance == null ||
      goldAllowance < BigInt(price) * BigInt(amount)
    ) {
      renderError('Approve more funds in your wallet details');
    } else if (items && userCharacter) {
      _sell(
        Number(price),
        items.filter(x => x.TokenId == tokenId)[0],
        userCharacter,
        BigInt(amount),
      );
    }
  };
  // const orderItem = async function (
  //   tokenId: string,
  //   amount: string,
  //   price: string,
  // ) {
  //   if (goldAllowance == null || goldAllowance < price * amount) {
  //     renderError('Approve more funds in your wallet details');
  //   } else if (items && userCharacter) {
  //     _sell(
  //       items.filter(x => x.TokenId == tokenId)[0],
  //       Number(price),
  //       userCharacter,
  //       BigInt(amount),
  //     );
  //   }
  // };
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
            } as ConsiderationData,
          } as Order;
        }),
      ),
    );
  }, [Offers, worldContract.read]);
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
      //remove duplicate objects
      .filter(
        (item1, i, arr) =>
          arr.findIndex(item2 => item2.tokenId === item1.tokenId) === i,
      )
      .sort((a, b) => {
        return Number(a.tokenId) - Number(b.tokenId);
      });
    const allItems = await Promise.all(
      _items.map(async item => {
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
  }, [Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI, worldContract.read]);

  useEffect(() => {
    (async function () {
      await fetchItems();
      await fetchOrders();
      setAuctionContractAddress(
        await worldContract.read.UD__auctionHouseAddress(),
      );
      if (goldAllowance == null && auctionContractAddress && userCharacter) {
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
    fetchItems,
    fetchOrders,
    goldAllowance,
    goldToken,
    itemAllowance,
    itemsContract,
    publicClient,
    userCharacter,
    userCharacter?.owner,
    worldContract.read,
  ]);
  return (
    <Stack>
      <Text>1. Display all weapons and armor. (Name, image, stats)</Text>
      <Grid
        templateColumns="repeat(4, 1fr)"
        templateRows="repeat(1, 4fr)"
        gap={1}
      >
        {items?.map((item, i) => (
          <GridItem key={'weapon-' + i} colSpan={1} border="solid 1px">
            <Text>
              Name: {item[ItemType[item.ItemType] as keyof Item]?.name}
            </Text>
            <Text>Type: {ItemType[item.ItemType]}</Text>
            <Text>
              Image: {item[ItemType[item.ItemType] as keyof Item]?.image}
            </Text>
            <Text>
              Description:{' '}
              {item[ItemType[item.ItemType] as keyof Item]?.description}
            </Text>
          </GridItem>
        ))}
      </Grid>
      <Text>2. Popup if Gold/Item allowance is too low </Text>
      {goldAllowance != null && (
        <Text>Gold Allowance: {goldAllowance.toString()} </Text>
      )}
      {itemAllowance != null && (
        <Text>Item Allowance: {itemAllowance.toString()} </Text>
      )}

      <Text>3. Place order (weapon/armor and price) </Text>
      <Text>
        {Array.from(
          runQuery([
            Has(ItemsOwners),
            HasValue(ItemsOwners, { owner: userCharacter?.owner }),
          ]),
        )}
      </Text>

      {items && (
        <Button
          onClick={() =>
            sellItem(items[0].TokenId, '1', parseEther('1').toString())
          }
        >
          Order
        </Button>
      )}

      <Text>4. Display Orders (weapon/armor and price) </Text>
      <Grid
        templateColumns="repeat(1, 1fr)"
        templateRows="repeat(1, 4fr)"
        gap={1}
      >
        {orders?.map((order, i) => (
          <GridItem key={'orders-' + i} colSpan={1} border="solid 1px">
            <Text>Hash: {order.orderHash}</Text>
            <Text>
              Status:{' '}
              {['canceled', 'active', 'fulfilled'][Number(order.orderStatus)]}
            </Text>
            <Text>
              Looking for: {order.consideration.amount}
              {order.consideration.token == goldToken
                ? ' $GOLD'
                : items?.find(
                    item => item.TokenId == order.consideration.identifier,
                  )?.Weapon?.name ||
                  items?.find(
                    item => item.TokenId == order.consideration.identifier,
                  )?.Armor?.name}
            </Text>
            <Text>
              Offering:{' '}
              {order.offer.token == goldToken
                ? 'Gold'
                : items?.find(item => item.TokenId == order.offer.identifier)
                    ?.Weapon?.name ||
                  items?.find(item => item.TokenId == order.offer.identifier)
                    ?.Armor?.name}
            </Text>
          </GridItem>
        ))}
      </Grid>
    </Stack>
  );
};
