import { Box, Center, HStack, Image, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { getEmoji, getStatSymbol, removeEmoji } from '../utils/helpers';
import { getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor } from '../utils/rarityHelpers';
import {
  type Armor,
  type Consumable,
  ItemType,
  type Spell,
  type Weapon,
} from '../utils/types';

type SlotItem = Armor | Consumable | Spell | Weapon;

const SLOT_SIZE = '44px';

const EmptySlot = ({ label }: { label?: string }): JSX.Element => (
  <Tooltip hasArrow label={label ?? 'Empty slot'} placement="top">
    <Center
      border="1px dashed"
      borderColor="#3A3428"
      borderRadius="md"
      h={SLOT_SIZE}
      w={SLOT_SIZE}
      flexShrink={0}
    >
      <Text color="#3A3428" fontSize="2xs">--</Text>
    </Center>
  </Tooltip>
);

const getItemTooltip = (item: SlotItem): string => {
  const name = removeEmoji(item.name);
  if (item.itemType === ItemType.Consumable) {
    const c = item as Consumable;
    if (c.hpRestoreAmount > BigInt(0)) return `${name} — HP +${c.hpRestoreAmount}`;
    const mods: string[] = [];
    if (c.strModifier !== BigInt(0)) mods.push(`STR ${getStatSymbol(c.strModifier.toString())}${c.strModifier}`);
    if (c.agiModifier !== BigInt(0)) mods.push(`AGI ${getStatSymbol(c.agiModifier.toString())}${c.agiModifier}`);
    if (c.intModifier !== BigInt(0)) mods.push(`INT ${getStatSymbol(c.intModifier.toString())}${c.intModifier}`);
    return `${name} — ${mods.join(' ')}`;
  }
  if (item.itemType === ItemType.Weapon || item.itemType === ItemType.Spell) {
    const w = item as Weapon | Spell;
    return `${name} — ${w.minDamage}–${w.maxDamage} dmg`;
  }
  if (item.itemType === ItemType.Armor) {
    const a = item as Armor;
    const mods: string[] = [];
    if (a.armorModifier) mods.push(`ARM +${a.armorModifier}`);
    if (a.strModifier !== BigInt(0)) mods.push(`STR ${getStatSymbol(a.strModifier.toString())}${a.strModifier}`);
    return `${name}${mods.length ? ` — ${mods.join(' ')}` : ''}`;
  }
  return name;
};

const FilledSlot = ({ item }: { item: SlotItem }): JSX.Element => {
  const rarityColor = getRarityColor(item.rarity);
  const rarityAnimation = getRarityAnimation(item.rarity);
  const imageSrc = getItemImage(removeEmoji(item.name));

  return (
    <Tooltip hasArrow label={getItemTooltip(item)} placement="top">
      <Center
        animation={rarityAnimation}
        border="2px solid"
        borderColor={rarityColor}
        borderRadius="md"
        h={SLOT_SIZE}
        w={SLOT_SIZE}
        flexShrink={0}
        cursor="default"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={removeEmoji(item.name)}
            boxSize="32px"
            objectFit="contain"
          />
        ) : (
          <Text fontSize="lg">{getEmoji(item.name)}</Text>
        )}
      </Center>
    </Tooltip>
  );
};

export const EquippedLoadout = (): JSX.Element | null => {
  const { character, equippedArmor, equippedConsumables, equippedSpells, equippedWeapons } =
    useCharacter();

  const actionSlots = useMemo(
    () => [...equippedWeapons, ...equippedSpells, ...equippedConsumables] as SlotItem[],
    [equippedWeapons, equippedSpells, equippedConsumables],
  );

  if (!character) return null;

  const armor = equippedArmor[0] ?? null;

  return (
    <VStack spacing={1.5} w="100%">
      <HStack justifyContent="space-between" w="100%">
        <Text color="#5A5040" fontSize="2xs" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
          Loadout
        </Text>
        <Text
          as={RouterLink}
          color="#5A5040"
          fontSize="2xs"
          to={`/characters/${character.id}`}
          _hover={{ color: '#8A7E6A', textDecoration: 'underline' }}
        >
          Edit
        </Text>
      </HStack>
      <HStack spacing={1.5} justify="center">
        {/* Slot 0: Armor */}
        <Box position="relative">
          {armor ? <FilledSlot item={armor} /> : <EmptySlot label="Armor — empty" />}
          <Text
            color="#5A5040"
            fontSize="4px"
            fontWeight={700}
            letterSpacing="wider"
            position="absolute"
            bottom="-10px"
            left="50%"
            transform="translateX(-50%)"
            textTransform="uppercase"
            whiteSpace="nowrap"
          >
            ARM
          </Text>
        </Box>

        {/* Divider */}
        <Box bg="#3A3428" h="30px" w="1px" flexShrink={0} />

        {/* Slots 1–4: Weapons/Spells/Consumables */}
        {[0, 1, 2, 3].map(i => (
          <Box key={i}>
            {actionSlots[i] ? (
              <FilledSlot item={actionSlots[i]} />
            ) : (
              <EmptySlot />
            )}
          </Box>
        ))}
      </HStack>
    </VStack>
  );
};
