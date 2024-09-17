import {
  Button,
  Center,
  Divider,
  HStack,
  Spacer,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate, useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';
import { formatEther } from 'viem';

import { ShopHalf } from '../components/ShopHalf';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { GAME_BOARD_PATH } from '../Routes';
import {
  ArmorTemplate,
  OrderType,
  SpellTemplate,
  WeaponTemplate,
} from '../utils/types';

export const Shop = (): JSX.Element => {
  const navigate = useNavigate();
  const { mobId } = useParams();

  const {
    armorTemplates,
    weaponTemplates,
    spellTemplates,
    isLoading: isItemsLoading,
  } = useItems();
  const {
    character: userCharacter,
    inventoryArmor,
    inventorySpells,
    inventoryWeapons,
  } = useCharacter();
  const { allShops, allShopItems } = useMap();

  const shop = useMemo(() => {
    if (!mobId || !allShops) return null;
    return allShops.find(shop => shop.mobId === mobId);
  }, [allShops, mobId]);

  const [sellable, setSellable] = useState<
    Array<{
      item: ArmorTemplate | WeaponTemplate | SpellTemplate;
      price: string;
      balance: string | null;
      stock: string | null;
    }>
  >([]);
  const [buyable, setBuyable] = useState<
    Array<{
      item: ArmorTemplate | WeaponTemplate | SpellTemplate;
      price: string;
      balance: string | null;
      stock: string | null;
    }>
  >([]);

  const items = useMemo(
    () => [...inventoryArmor, ...inventorySpells, ...inventoryWeapons],
    [inventoryArmor, inventorySpells, inventoryWeapons],
  );

  useEffect(() => {
    if (isItemsLoading) return;
    if (items.length === 0) return;
    if (!shop) return;
    const sellableInventory = [
      ...armorTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ]
      // filter out the items this shop does not sell
      .filter(
        item =>
          shop.sellableItems
            .map(item => item.toString())
            .indexOf(item.tokenId.toString()) > -1,
      )
      // filter out the items the user does not have
      .filter(
        item =>
          items
            .map(x => x.tokenId.toString())
            .indexOf(item.tokenId.toString()) > -1,
      )
      // add back the balances and the price of the item
      .map(item => {
        let price =
          allShopItems.find(prices => prices.itemId == item.tokenId)?.price ||
          0;
        price = Number(price) * (Number(shop.priceMarkdown) / 100);
        const balances =
          items.find(owned => owned.tokenId == item.tokenId)?.balance || 0;
        return {
          item: item,
          price: price.toString(),
          balance: balances.toString(),
          stock: null,
        };
      });

    const buyableStock = [
      ...weaponTemplates,
      ...spellTemplates,
      ...armorTemplates,
    ]
      .filter(
        item =>
          shop.buyableItems
            .map(item => item.toString())
            .indexOf(item.tokenId.toString()) > -1,
      )
      // add back the stock and the price of the item
      .map((item, i) => {
        let price =
          allShopItems.find(prices => prices.itemId == item.tokenId)?.price ||
          0;
        price =
          Number(price) + Number(price) * (Number(shop.priceMarkup) / 100);
        return {
          item: item,
          stock: shop.stock[i],
          price: price.toString(),
          balance: null,
        };
      });

    setSellable(sellableInventory);
    setBuyable(buyableStock);
  }, [
    allShopItems,
    armorTemplates,
    isItemsLoading,
    items,
    shop,
    spellTemplates,
    weaponTemplates,
  ]);

  if (!shop) {
    return (
      <VStack>
        <Button
          alignSelf="flex-start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(GAME_BOARD_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Game Board
        </Button>
        <Text>Shop not found</Text>
      </VStack>
    );
  }

  return (
    <VStack mt={16}>
      <Typist avgTypingDelay={10} cursor={{ show: false }} stdTypingDelay={10}>
        <Text textAlign="center" w="100%">
          Hello, and welcome to my shop! Please have a look at my wares. Let me
          know if you need any help.
        </Text>
      </Typist>
      <HStack border="2px solid" mt={8} p={8} w="100%">
        <Spacer />
        <Stack h="100%" w="100%">
          {userCharacter && mobId && sellable && sellable.length > 0 ? (
            <ShopHalf
              characterId={userCharacter.id}
              shopId={mobId}
              items={sellable}
              name={`Character’s Inventory - ${formatEther(userCharacter?.goldBalance)} $GOLD`}
              itemIndexes={shop.sellableItems}
              orderType={OrderType.Selling}
            />
          ) : (
            <Center>
              <Text>No Sellable Items</Text>
            </Center>
          )}
        </Stack>
        <Divider border="1px solid black" mx={8} orientation="vertical" />
        <Stack h="100%" w="100%">
          {userCharacter && mobId && buyable && buyable.length > 0 ? (
            <ShopHalf
              characterId={userCharacter.id}
              items={buyable}
              name={`Shopkeeper’s Inventory - ${formatEther(BigInt(shop.gold)).toString()} $GOLD`}
              shopId={mobId}
              itemIndexes={shop.buyableItems}
              orderType={OrderType.Buying}
            />
          ) : (
            <Text>No Buyable Items</Text>
          )}
        </Stack>
        <Spacer />
      </HStack>
    </VStack>
  );
};
