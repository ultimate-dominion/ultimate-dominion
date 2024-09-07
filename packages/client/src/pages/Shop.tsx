import {
  Center,
  Divider,
  HStack,
  Spacer,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { ShopHalf } from '../components/ShopHalf';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  Armor,
  ArmorTemplate,
  Character,
  Spell,
  SpellTemplate,
  Weapon,
  WeaponTemplate,
} from '../utils/types';

export const Shop = (): JSX.Element => {
  const { shopId } = useParams();
  const {
    armorTemplates,
    weaponTemplates,
    spellTemplates,
    isLoading: isItemsLoading,
  } = useItems();
  const { character: userCharacter } = useCharacter();
  const { renderError } = useToast();

  const {
    components: { Shops, ItemsOwners },
    isSynced,
  } = useMUD();
  const shop = useComponentValue(
    Shops,
    encodeEntity({ mobId: 'uint256' }, { mobId: BigInt(shopId || 1) }),
  );

  const [sellable, setSellable] = useState<
    Array<ArmorTemplate | WeaponTemplate | SpellTemplate>
  >([]);
  const [buyable, setBuyable] = useState<
    Array<ArmorTemplate | WeaponTemplate | SpellTemplate>
  >([]);
  const [armor, setArmor] = useState<Armor[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);

  const fetchCharacterItems = useCallback(
    (_character: Character) => {
      try {
        const _armor = armorTemplates
          .map(armor => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(armor.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...armor,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Armor;
          })
          .filter(a => a.balance !== '0');

        const _spells = spellTemplates
          .map(spell => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(spell.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...spell,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Spell;
          })
          .filter(s => s.balance !== '0');

        const _weapons = weaponTemplates
          .map(weapon => {
            const tokenOwnersEntity = encodeEntity(
              { owner: 'address', tokenId: 'uint256' },
              {
                owner: _character.owner as `0x${string}`,
                tokenId: BigInt(weapon.tokenId),
              },
            );

            const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);

            return {
              ...weapon,
              balance: itemOwner ? itemOwner.balance.toString() : '0',
              itemId: tokenOwnersEntity,
              owner: _character.owner,
            } as Weapon;
          })
          .filter(w => w.balance !== '0');

        setArmor(_armor);
        setSpells(_spells);
        setWeapons(_weapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character items.',
          e,
        );
      }
    },
    [armorTemplates, spellTemplates, weaponTemplates, ItemsOwners, renderError],
  );
  useEffect(() => {
    if (userCharacter && isSynced && !isItemsLoading) {
      (async (): Promise<void> => {
        fetchCharacterItems(userCharacter);
      })();
    }
  }, [
    fetchCharacterItems,
    shop,
    userCharacter,
    isSynced,
    isItemsLoading,
    spellTemplates,
  ]);
  const items = useMemo(
    () => [...weapons, ...armor, ...spells],
    [weapons, armor, spells],
  );
  useEffect(() => {
    if (items.length > 0) {
      const sellableInventory = [
        ...weaponTemplates,
        ...spellTemplates,
        ...armorTemplates,
      ]
        .filter(item =>
          shop
            ? shop.sellableItems
                .map(item => item.toString())
                .indexOf(item.tokenId.toString()) > -1
            : false,
        )
        .filter(
          item =>
            items
              .map(x => x.tokenId.toString())
              .indexOf(item.tokenId.toString()) > -1,
        );
      setSellable(sellableInventory);
      const buyableStock = [
        ...weaponTemplates,
        ...spellTemplates,
        ...armorTemplates,
      ].filter(item =>
        shop
          ? shop.buyableItems
              .map(item => item.toString())
              .indexOf(item.tokenId.toString()) > -1
          : false,
      );
      setBuyable(buyableStock);
    }
  }, [
    armor,
    armorTemplates,
    items,
    shop,
    spellTemplates,
    spells,
    weaponTemplates,
    weapons,
  ]);

  return (
    <VStack mt={16}>
      <Typist avgTypingDelay={10} cursor={{ show: false }} stdTypingDelay={10}>
        <Text textAlign="center" w="100%">
          Hello, and welcome to my shop! Please have a look at my wares. Let me
          know if you need any help.
        </Text>
      </Typist>
      <HStack border="2px solid" h="100%" mt={8} p={8} w="100%">
        <Spacer />
        {shopId ? (
          <Stack h="100%" w="100%">
            {sellable && sellable.length > 0 ? (
              <ShopHalf
                items={sellable}
                name={`Character’s Inventory - ${userCharacter?.goldBalance} $GOLD`}
              />
            ) : (
              <Center>
                <Text>No Sellable Items</Text>
              </Center>
            )}
          </Stack>
        ) : (
          <Stack>
            <Text>No Data</Text>
          </Stack>
        )}
        <Divider border="1px solid black" mx={8} orientation="vertical" />
        <Stack h="100%" w="100%">
          {buyable && buyable.length > 0 ? (
            <ShopHalf
              items={buyable}
              name="Shopkeeper’s Inventory - 55 $GOLD"
            />
          ) : (
            <Text>No Data</Text>
          )}
        </Stack>
        <Spacer />
      </HStack>
    </VStack>
  );
};
