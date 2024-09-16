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
import { ArmorTemplate, SpellTemplate, WeaponTemplate } from '../utils/types';

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
  const { allShops } = useMap();

  const shop = useMemo(() => {
    if (!mobId || !allShops) return null;
    return allShops.find(shop => shop.mobId === mobId);
  }, [allShops, mobId]);

  const [sellable, setSellable] = useState<
    Array<ArmorTemplate | WeaponTemplate | SpellTemplate>
  >([]);
  const [buyable, setBuyable] = useState<
    Array<ArmorTemplate | WeaponTemplate | SpellTemplate>
  >([]);

  const [balances, setBalances] = useState<Array<string>>([]);
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
      );

    const b = sellableInventory.map(item =>
      items
        .filter(i => i.tokenId.toString() == item.tokenId.toString())[0]
        .balance.toString(),
    );
    setBalances(b);

    const buyableStock = [
      ...weaponTemplates,
      ...spellTemplates,
      ...armorTemplates,
    ].filter(
      item =>
        shop.buyableItems
          .map(item => item.toString())
          .indexOf(item.tokenId.toString()) > -1,
    );

    setSellable(sellableInventory);
    setBuyable(buyableStock);
  }, [
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
          {userCharacter &&
          balances &&
          mobId &&
          sellable &&
          sellable.length > 0 ? (
            <ShopHalf
              characterId={userCharacter.id}
              shopId={mobId}
              items={sellable}
              stock={balances}
              name={`Character’s Inventory - ${userCharacter?.goldBalance} $GOLD`}
              itemIndexes={shop.sellableItems}
              side="sell"
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
              stock={shop.stock.map(s => s.toString())}
              items={buyable}
              name={`Shopkeeper’s Inventory - ${formatEther(BigInt(shop.gold)).toString()} $GOLD`}
              shopId={mobId}
              itemIndexes={shop.buyableItems}
              side="buy"
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
