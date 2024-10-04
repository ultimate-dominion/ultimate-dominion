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

import { ShopHalf } from '../components/ShopHalf';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { etherToFixedNumber } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  OrderType,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

export const Shop = (): JSX.Element => {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isItemsLoading,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const {
    character: userCharacter,
    inventoryArmor,
    inventoryConsumables,
    inventorySpells,
    inventoryWeapons,
  } = useCharacter();
  const { allShops } = useMap();

  const shop = useMemo(() => {
    if (!(shopId && allShops)) return null;
    return allShops.find(shop => shop.shopId === shopId) ?? null;
  }, [allShops, shopId]);

  const [sellable, setSellable] = useState<
    Array<{
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      balance: bigint | null;
      stock: bigint | null;
      index: string;
    }>
  >([]);

  const [buyable, setBuyable] = useState<
    Array<{
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      balance: bigint | null;
      stock: bigint | null;
      index: string;
    }>
  >([]);

  const items = useMemo(
    () => [
      ...inventoryArmor,
      ...inventoryConsumables,
      ...inventorySpells,
      ...inventoryWeapons,
    ],
    [inventoryArmor, inventoryConsumables, inventorySpells, inventoryWeapons],
  );
  useEffect(() => {
    if (isItemsLoading) return;
    if (items.length === 0) return;
    if (!shop) return;

    const sellableInventory = items
      // filter out the items this shop does not sell
      .filter(item => shop.sellableItems.includes(item.tokenId))
      // add back the balances of the item and itemIndexes
      .map(item => {
        const index = shop?.sellableItems.indexOf(item.tokenId).toString();
        return {
          index: index,
          item: item,
          balance: item.balance,
          stock: null,
        };
      });

    const buyableStock = [
      ...armorTemplates,
      ...consumableTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ]
      .filter(item => shop.buyableItems.includes(item.tokenId))
      // add back the stock and index of the item
      .map(item => {
        const index = shop?.buyableItems.indexOf(item.tokenId).toString();
        return {
          item: item,
          stock: shop.stock[Number(index)],
          balance: null,
          index: index,
        };
      });

    setSellable(sellableInventory);
    setBuyable(buyableStock);
  }, [
    armorTemplates,
    consumableTemplates,
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
          onClick={() => navigate(-1)}
          size="xs"
          variant="outline"
        >
          Back
        </Button>
        <Text>Shop not found</Text>
      </VStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Button
          alignSelf="flex-start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(-1)}
          size="xs"
          variant="outline"
        >
          Back
        </Button>
        <Text>Character not found</Text>
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
          {userCharacter && shopId && sellable && sellable.length ? (
            <ShopHalf
              characterId={userCharacter.id}
              shop={shop}
              items={sellable}
              name={`Character’s Inventory - ${etherToFixedNumber(userCharacter.externalGoldBalance)} $GOLD`}
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
          {userCharacter && shopId && buyable && buyable.length ? (
            <ShopHalf
              characterId={userCharacter.id}
              items={buyable}
              name={`Shopkeeper’s Inventory - ${etherToFixedNumber(BigInt(shop.gold)).toString()} $GOLD`}
              shop={shop}
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
