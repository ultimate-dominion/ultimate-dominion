import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { IoNavigate } from 'react-icons/io5';
import { useParams } from 'react-router-dom';

import { PolygonalCard } from '../components/PolygonalCard';
import { ShopHalf } from '../components/ShopHalf';
import { ShopSvg } from '../components/SVGs/ShopSvg';
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
    equippedArmor,
    equippedSpells,
    equippedWeapons,
  } = useCharacter();
  const { allShops } = useMap();

  const shop = useMemo(() => {
    if (!(shopId && allShops)) return null;
    return allShops.find(shop => shop.shopId === shopId) ?? null;
  }, [allShops, shopId]);

  const [sellable, setSellable] = useState<
    Array<{
      balance: bigint | null;
      index: string;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
      unsellable: boolean;
    }>
  >([]);

  const [buyable, setBuyable] = useState<
    Array<{
      balance: bigint | null;
      index: string;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
      unsellable: boolean;
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
        let unsellable = false;
        if (item.balance == BigInt(1)) {
          if (equippedArmor.filter(armor => armor.tokenId == index))
            unsellable = true;
          if (equippedSpells.filter(spell => spell.tokenId == index))
            unsellable = true;
          if (equippedWeapons.filter(weapon => weapon.tokenId == index))
            unsellable = true;
        }
        return {
          balance: item.balance,
          index: index,
          item: item,
          stock: null,
          unsellable: unsellable,
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
          balance: null,
          index: index,
          item: item,
          stock: shop.stock[Number(index)],
          unsellable: true,
        };
      });

    setSellable(sellableInventory);
    setBuyable(buyableStock);
  }, [
    armorTemplates,
    consumableTemplates,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    isItemsLoading,
    items,
    shop,
    spellTemplates,
    weaponTemplates,
  ]);

  if (!shop) {
    return (
      <VStack>
        <Text>Shop not found</Text>
      </VStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Text>Character not found</Text>
      </VStack>
    );
  }

  return (
    <Box>
      <HStack bgColor="#1A244E" color="white" h="68px" px={6}>
        <ShopSvg />
        <Heading>Pawnshop</Heading>
        <Spacer />
        <IoNavigate size={20} />
        <Text fontWeight={700} size="xl">
          {shop.position.x},{shop.position.y}
        </Text>
      </HStack>

      <Grid
        gap={4}
        mt={4}
        templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
      >
        <GridItem>
          <HStack bgColor="#1A244E" h="68px" px={6}>
            <Heading color="white">My Inventory</Heading>
            <Spacer />
            <Text color="yellow" fontWeight={700} size="xl">
              {etherToFixedNumber(userCharacter.externalGoldBalance)} $GOLD
            </Text>
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && sellable && sellable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                shop={shop}
                items={sellable}
                orderType={OrderType.Selling}
              />
            ) : (
              <VStack p={6}>
                <Text>No Sellable Items</Text>
              </VStack>
            )}
          </PolygonalCard>
        </GridItem>
        <GridItem>
          <HStack bgColor="#1A244E" h="68px" px={6}>
            <Heading color="white">Shopkeeper&apos;s Inventory</Heading>
            <Spacer />
            <Text color="yellow" fontWeight={700} size="xl">
              {etherToFixedNumber(BigInt(shop.gold)).toString()} $GOLD
            </Text>
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && buyable && buyable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                items={buyable}
                shop={shop}
                orderType={OrderType.Buying}
              />
            ) : (
              <VStack p={6}>
                <Text>No Buyable Items</Text>
              </VStack>
            )}
          </PolygonalCard>
        </GridItem>
      </Grid>
    </Box>
  );
};
