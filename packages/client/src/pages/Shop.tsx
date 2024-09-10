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
import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate, useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { ShopHalf } from '../components/ShopHalf';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH } from '../Routes';
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
  const { renderError } = useToast();
  const navigate = useNavigate();
  const { mobId } = useParams();

  const {
    armorTemplates,
    weaponTemplates,
    spellTemplates,
    isLoading: isItemsLoading,
  } = useItems();
  const { character: userCharacter } = useCharacter();
  const { allShops } = useMap();

  const {
    components: { ItemsOwners },
    isSynced,
  } = useMUD();

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
      fetchCharacterItems(userCharacter);
    }
  }, [
    fetchCharacterItems,
    shop,
    userCharacter,
    isItemsLoading,
    isSynced,
    spellTemplates,
  ]);

  const items = useMemo(
    () => [...weapons, ...armor, ...spells],
    [weapons, armor, spells],
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
      .filter(
        item =>
          shop.sellableItems
            .map(item => item.toString())
            .indexOf(item.tokenId.toString()) > -1,
      )
      .filter(
        item =>
          items
            .map(x => x.tokenId.toString())
            .indexOf(item.tokenId.toString()) > -1,
      );

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
        <Divider border="1px solid black" mx={8} orientation="vertical" />
        <Stack h="100%" w="100%">
          {buyable && buyable.length > 0 ? (
            <ShopHalf
              items={buyable}
              name="Shopkeeper’s Inventory - 55 $GOLD"
            />
          ) : (
            <Text>No buyable items</Text>
          )}
        </Stack>
        <Spacer />
      </HStack>
    </VStack>
  );
};
