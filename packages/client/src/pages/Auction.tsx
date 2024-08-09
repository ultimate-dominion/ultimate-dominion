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
  }

  const { character: userCharacter } = useCharacter();
  const [items, setItems] = useState<Item[] | null>(null);
  // const [sort, setSort] = useState({ sorted: 'byGold', reversed: false });
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
    // const allItemsCopy = JSON.parse(JSON.stringify(allItems)).sort(
    //   (entryA, entryB) => {
    //     switch (sort.sorted) {
    //       case 'byGold':
    //         return sort.reversed
    //           ? Number(entryA.goldBalance) - Number(entryB.goldBalance)
    //           : Number(entryB.goldBalance) - Number(entryA.goldBalance);
    //       case 'byLevel':
    //         return sort.reversed
    //           ? Number(entryA.level) - Number(entryB.level)
    //           : Number(entryB.level) - Number(entryA.level);
    //       case 'byStats':
    //         return sort.reversed
    //           ? Number(entryA.experience) - Number(entryB.experience)
    //           : Number(entryB.experience) - Number(entryA.experience);
    //       default:
    //         return Number(entryB.goldBalance) - Number(entryA.goldBalance);
    //     }
    //   },
    // );
    setItems(allItems);
  }, [Items, ItemsBaseURI, ItemsOwners, ItemsTokenURI, worldContract.read]);

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
          .sort()
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
                        // fontWeight={sort.sorted == 'byStats' ? 'bold' : 'normal'}
                        // onClick={() =>
                        //   setSort({
                        //     sorted: 'byStats',
                        //     reversed: !sort.reversed,
                        //   })
                        // }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Floor Price
                        </Text>
                        {/* {sort.sorted == 'byStats' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byStats' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byStats' && <FaSortAmountDown color="grey" />} */}
                      </Button>
                      <Button
                        // fontWeight={sort.sorted == 'byLevel' ? 'bold' : 'normal'}
                        // onClick={() =>
                        //   setSort({
                        //     sorted: 'byLevel',
                        //     reversed: !sort.reversed,
                        //   })
                        // }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Level
                        </Text>
                        {/* {sort.sorted == 'byLevel' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byLevel' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byLevel' && <FaSortAmountDown color="grey" />} */}
                      </Button>
                      <Button
                        // fontWeight={sort.sorted == 'byGold' ? 'bold' : 'normal'}
                        // onClick={() =>
                        //   setSort({
                        //     sorted: 'byGold',
                        //     reversed: !sort.reversed,
                        //   })
                        // }
                        p={1}
                        size={{ base: '2xs', lg: 'sm' }}
                        variant="ghost"
                        w="100%"
                      >
                        <Text mr={2} size={{ base: '2xs', sm: 'xs' }}>
                          Class
                        </Text>
                        {/* {sort.sorted == 'byGold' && sort.reversed && <FaSortAmountUp />}
              {sort.sorted == 'byGold' && !sort.reversed && (
                <FaSortAmountDown />
              )}
              {sort.sorted != 'byGold' && <FaSortAmountDown color="grey" />} */}
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
                            floor={1}
                            high={2}
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
