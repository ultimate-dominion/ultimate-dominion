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
import { useCallback, useEffect, useState } from 'react';
import { FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { Address, erc20Abi } from 'viem';

import { AuctionRow } from '../components/AuctionRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { ERC_1155ABI } from '../utils/constants';
import { fetchMetadataFromUri, getEmoji, uriToHttp } from '../utils/helpers';
import {
  ArmorStats,
  Item,
  ItemType,
  StatsClasses,
  WeaponStats,
} from '../utils/types';

interface Price {
  tokenId: string;
  floor: string;
  ceiling: string;
}

export const AuctionHouse = (): JSX.Element => {
  const { character: userCharacter } = useCharacter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [prices] = useState<Price[] | null>(null);
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
          itemId: entity,
          itemType: itemTemplate.itemType,
          owner,
          tokenId: tokenId.toString(),
          tokenIdEntity,
        };
      })
      .filter(
        (item1, i, arr) =>
          arr.findIndex(item2 => item2.tokenId === item1.tokenId) === i,
      )
      .sort((a, b) => {
        return Number(a.tokenId) - Number(b.tokenId);
      });
    const allItems = await Promise.all(
      _items.map(async item => {
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
        const data = {
          ...metadata,
          tokenId: item.tokenId,
          itemType: item.itemType as ItemType,
          stats: null,
          class: StatsClasses.Mage,
        } as Item;
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
            data.class =
              w.strModifier.toString() == highestStat.toString()
                ? StatsClasses.Warrior
                : data.class;
            data.class =
              w.agiModifier.toString() == highestStat.toString()
                ? StatsClasses.Rogue
                : data.class;
            data.class =
              w.intModifier.toString() == highestStat.toString()
                ? StatsClasses.Mage
                : data.class;
            data.stats = {
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
            } as WeaponStats;
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
            data.class =
              a.strModifier.toString() == highestStat.toString()
                ? StatsClasses.Warrior
                : data.class;
            data.class =
              a.agiModifier.toString() == highestStat.toString()
                ? StatsClasses.Rogue
                : data.class;
            data.class =
              a.intModifier.toString() == highestStat.toString()
                ? StatsClasses.Mage
                : data.class;

            data.stats = {
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
            } as ArmorStats;
            break;
          }
          default:
            break;
        }
        return data as Item;
      }),
    );
    let sorted = Array<Item>();
    for (let i = 0; i < sorts.length; i++) {
      const sort = sorts[i];
      sorted = [
        ...sorted,
        ...allItems
          .filter(
            x =>
              x.itemType.toString() ==
              ItemType[sort.class as keyof typeof ItemType].toString(),
          )
          .sort((entryA, entryB) => {
            let result = false;
            const floorA =
              prices?.filter(price => entryA.tokenId == price.tokenId)[0]
                ?.floor || '0';
            const floorB =
              prices?.filter(price => entryB.tokenId == price.tokenId)[0]
                ?.floor || '0';
            switch (sort.sorted) {
              case 'byPrice':
                result = sort.reversed
                  ? BigInt(floorA) >= BigInt(floorB)
                  : BigInt(floorB) < BigInt(floorA);
                break;
              case 'byLevel':
                result = sort.reversed
                  ? BigInt(entryA?.stats?.minLevel || '0') >=
                    BigInt(entryB?.stats?.minLevel || '0')
                  : BigInt(entryB?.stats?.minLevel || '0') <
                    BigInt(entryA?.stats?.minLevel || '0');
                break;
              case 'byClass':
                result = sort.reversed
                  ? entryA.class
                      .toString()
                      .localeCompare(entryB.class.toString()) > 0
                  : entryB.class
                      .toString()
                      .localeCompare(entryA.class.toString()) > 0;
                break;
              default:
                result = BigInt(floorB) >= BigInt(floorA);
            }
            return result ? 1 : -1;
          }),
      ];
    }
    setItems(sorted);
  }, [
    Items,
    ItemsBaseURI,
    ItemsOwners,
    ItemsTokenURI,
    prices,
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
            abi: ERC_1155ABI,
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
          .filter(key => !isNaN(Number(ItemType[key as keyof typeof ItemType])))
          .filter(
            key =>
              items?.filter(
                item => item.itemType == ItemType[key as keyof typeof ItemType],
              )?.length > 0,
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
                      items?.filter(
                        item =>
                          item.itemType == ItemType[k as keyof typeof ItemType],
                      )?.length
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
                    ?.filter(
                      x => x.itemType == ItemType[k as keyof typeof ItemType],
                    )
                    ?.map((item, i) => {
                      return (
                        <GridItem key={'orders-' + i} colSpan={1}>
                          <AuctionRow
                            agiModifier={'0'}
                            hitPointModifier={'0'}
                            intModifier={'0'}
                            minLevel={'0'}
                            strModifier={'0'}
                            floor={'0'}
                            {...item}
                            {...item.stats}
                            emoji={getEmoji(item?.name as string)}
                            itemClass={item.class.toString()}
                            image={item.image}
                          />
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
