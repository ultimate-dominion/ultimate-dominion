import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValueStrict, Has, runQuery } from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
// import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { Address, erc20Abi } from 'viem';

import { AuctionRow } from '../components/AuctionRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import {
  Armor,
  ArmorStats,
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
  //   const [filter, setFilter] = useState({ filtered: 'all' });
  //   const [query, setQuery] = useState('');
  interface Item {
    ItemType: ItemType;
    TokenId: string;
    Weapon: WeaponStats | null;
    Armor: ArmorStats | null;
    Price: bigint;
    Level: bigint;
    Class: string;
  }

  const { character: userCharacter } = useCharacter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [sorts, setSorts] = useState([
    { class: 'Armor', sorted: 'byPrice', reversed: false },
    { class: 'Weapon', sorted: 'ByClass', reversed: false },
  ]);
  const [goldAllowance, setGoldAllowance] = useState<bigint | null>(null);
  const [itemAllowance, setItemAllowance] = useState<boolean | null>(null);
  const [auctionContractAddress, setAuctionContractAddress] = useState('');

  const {
    components: {
      UltimateDominionConfig,
      Characters,
      Items,
      ItemsBaseURI,
      ItemsOwners,
      ItemsTokenURI,
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
          Price: BigInt(0),
          Level: BigInt(0),
          Class: 'Mage',
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
            const highestStat = Math.max(
              ...Object.values({
                a: Number(w.agiModifier.toString()),
                i: Number(w.intModifier.toString()),
                s: Number(w.strModifier.toString()),
              }),
            );
            itemData.Class =
              w.strModifier.toString() == highestStat.toString()
                ? 'Warrior'
                : itemData.Class;
            itemData.Class =
              w.agiModifier.toString() == highestStat.toString()
                ? 'Rogue'
                : itemData.Class;
            itemData.Class =
              w.intModifier.toString() == highestStat.toString()
                ? 'Mage'
                : itemData.Class;
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
            const highestStat = Math.max(
              ...Object.values({
                a: Number(a.agiModifier.toString()),
                i: Number(a.intModifier.toString()),
                s: Number(a.strModifier.toString()),
              }),
            );
            itemData.Class =
              a.strModifier.toString() == highestStat.toString()
                ? 'Warrior'
                : itemData.Class;
            itemData.Class =
              a.agiModifier.toString() == highestStat.toString()
                ? 'Rogue'
                : itemData.Class;
            itemData.Class =
              a.intModifier.toString() == highestStat.toString()
                ? 'Mage'
                : itemData.Class;

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
    let sorted = Array<Item>();
    for (let i = 0; i < sorts.length; i++) {
      const sort = sorts[i];
      sorted = [
        ...sorted,
        ...allItems
          .filter(x => ItemType[x.ItemType] == sort.class)
          .sort((entryA, entryB) => {
            let result = false;
            switch (sort.sorted) {
              case 'byPrice':
                result = sort.reversed
                  ? BigInt(entryA.Price) >= BigInt(entryB.Price)
                  : BigInt(entryB.Price) < BigInt(entryA.Price);
                break;
              case 'byLevel':
                result = sort.reversed
                  ? BigInt(entryA.Level) >= BigInt(entryB.Level)
                  : BigInt(entryB.Level) < BigInt(entryA.Level);
                break;
              case 'byClass':
                result = sort.reversed
                  ? entryA.Class.localeCompare(entryB.Class) > 0
                  : entryB.Class.localeCompare(entryA.Class) > 0;
                break;
              default:
                result = BigInt(entryB.Price) >= BigInt(entryA.Price);
            }
            return result ? 1 : -1;
          }),
      ];
    }
    setItems(sorted);
    // setItems(allItems)
  }, [
    Items,
    ItemsBaseURI,
    ItemsOwners,
    ItemsTokenURI,
    sorts,
    worldContract.read,
  ]);

  useEffect(() => {
    (async function () {
      await fetchItems();
      setAuctionContractAddress(
        await worldContract.read.UD__auctionHouseAddress(),
      );

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
    fetchItems,
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
      {items &&
        Object.values(ItemType)
          .filter(key => !isNaN(Number(ItemType[key])))
          .filter(
            key =>
              items?.filter(item => item.ItemType == ItemType[key])?.length > 0,
          )
          .map((k, i) => {
            return (
              <Stack key={i}>
                <Text size={{ base: 'lg', lg: 'xl' }} fontWeight="bold" my={5}>
                  {k == 'Armor' ? `${k}` : `${k}s`}
                </Text>
                <Flex justify="space-between" w="100%">
                  <Text>
                    {
                      items?.filter(item => item.ItemType == ItemType[k])
                        ?.length
                    }{' '}
                    Items
                  </Text>

                  <HStack>
                    <HStack
                      w={{
                        base: '130px',
                        sm: '215px',
                        md: '300px',
                        lg: '450px',
                      }}
                    >
                      <Button
                        display={{ base: 'none', lg: 'flex' }}
                        fontWeight={
                          sorts.filter(sort => sort.class == k)[0].sorted ==
                          'byPrice'
                            ? 'bold'
                            : 'normal'
                        }
                        onClick={() =>
                          setSorts(
                            sorts.map(sort =>
                              sort.class == k
                                ? {
                                    ...sort,
                                    sorted: 'byPrice',
                                    reversed: !sort.reversed,
                                  }
                                : sort,
                            ),
                          )
                        }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Floor Price
                        </Text>
                        {(function () {
                          const s = sorts.filter(sort => sort.class == k)[0];
                          if (s.sorted == 'byPrice' && s.reversed) {
                            return <FaSortAmountUp />;
                          }
                          if (s.sorted == 'byPrice' && !s.reversed) {
                            return <FaSortAmountDown />;
                          }
                          return <FaSortAmountDown color="grey" />;
                        })()}{' '}
                      </Button>
                      <Button
                        fontWeight={
                          sorts.filter(sort => sort.class == k)[0].sorted ==
                          'byLevel'
                            ? 'bold'
                            : 'normal'
                        }
                        onClick={() =>
                          setSorts(
                            sorts.map(sort =>
                              sort.class == k
                                ? {
                                    ...sort,
                                    sorted: 'byLevel',
                                    reversed: !sort.reversed,
                                  }
                                : sort,
                            ),
                          )
                        }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Level
                        </Text>
                        {(function () {
                          const s = sorts.filter(sort => sort.class == k)[0];
                          if (s.sorted == 'byLevel' && s.reversed) {
                            return <FaSortAmountUp />;
                          }
                          if (s.sorted == 'byLevel' && !s.reversed) {
                            return <FaSortAmountDown />;
                          }
                          return <FaSortAmountDown color="grey" />;
                        })()}{' '}
                      </Button>
                      <Button
                        fontWeight={
                          sorts.filter(sort => sort.class == k)[0].sorted ==
                          'byClass'
                            ? 'bold'
                            : 'normal'
                        }
                        onClick={() =>
                          setSorts(
                            sorts.map(sort =>
                              sort.class == k
                                ? {
                                    ...sort,
                                    sorted: 'byClass',
                                    reversed: !sort.reversed,
                                  }
                                : sort,
                            ),
                          )
                        }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Class
                        </Text>
                        {(function () {
                          const s = sorts.filter(sort => sort.class == k)[0];
                          if (s.sorted == 'byClass' && s.reversed) {
                            return <FaSortAmountUp />;
                          }
                          if (s.sorted == 'byClass' && !s.reversed) {
                            return <FaSortAmountDown />;
                          }
                          return <FaSortAmountDown color="grey" />;
                        })()}
                      </Button>
                    </HStack>
                    <Box display={{ base: 'none', md: 'block' }} w="50px" />
                  </HStack>
                </Flex>
                <Grid
                  templateColumns="repeat(1, 1fr)"
                  templateRows="repeat(1, 4fr)"
                  gap={1}
                  my={5}
                >
                  {items
                    ?.filter(x => x.ItemType == ItemType[k])
                    ?.map((item, i) => {
                      const _item = item[ItemType[item.ItemType] as keyof Item];
                      return (
                        <GridItem key={'orders-' + i} colSpan={1}>
                          <AuctionRow
                            emoji={(_item?.name as string).match(
                              /[\p{Emoji}\u200d]+/gu,
                            )}
                            baseHp={_item?.hitPointModifier}
                            strength={_item?.strModifier}
                            agility={_item?.agiModifier}
                            intelligence={_item?.intModifier}
                            itemId={_item?.tokenId}
                            floor={item.Price}
                            level={item.Level}
                            itemClass={item.Class}
                          ></AuctionRow>
                        </GridItem>
                      );
                    })}
                </Grid>
              </Stack>
            );
          })}
    </Stack>
  );
};
