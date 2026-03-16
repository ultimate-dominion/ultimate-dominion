import { Box, Center, HStack, Image, Spinner, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useBattle } from '../contexts/BattleContext';
import { useItems } from '../contexts/ItemsContext';
import { useSlotOrder } from '../hooks/useSlotOrder';
import { SLOT_ORDER_KEY_PREFIX } from '../utils/constants';
import { getEmoji, getStatSymbol, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
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

const FilledSlot = ({
  item,
  slotNumber,
  onClick,
  isInBattle,
}: {
  item: SlotItem;
  slotNumber: number;
  onClick?: () => void;
  isInBattle: boolean;
}): JSX.Element => {
  const rarityColor = getRarityColor(item.rarity);
  const rarityAnimation = getRarityAnimation(item.rarity);
  const imageSrc = getItemImage(removeEmoji(item.name));
  const canClick = onClick && !isInBattle;

  return (
    <Tooltip
      hasArrow
      label={`${getItemTooltip(item)}${canClick ? ' — tap to set as #1' : ''}`}
      placement="top"
    >
      <Center
        animation={rarityAnimation}
        border="2px solid"
        borderColor={rarityColor}
        borderRadius="md"
        h={SLOT_SIZE}
        w={SLOT_SIZE}
        flexShrink={0}
        cursor={canClick ? 'pointer' : 'default'}
        onClick={canClick ? onClick : undefined}
        position="relative"
        _hover={canClick ? { opacity: 0.8, transform: 'scale(1.05)' } : undefined}
        transition="transform 0.1s ease, opacity 0.1s ease"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={removeEmoji(item.name)}
            boxSize="32px"
            objectFit="contain"
          />
        ) : (
          <Text fontSize="lg">
            {item.itemType === ItemType.Consumable
              ? getConsumableEmoji(removeEmoji(item.name))
              : getEmoji(item.name)}
          </Text>
        )}
        <Text
          color="#8A7E6A"
          fontFamily="mono"
          fontSize="7px"
          fontWeight={700}
          position="absolute"
          bottom="-1px"
          right="2px"
          lineHeight={1}
        >
          {slotNumber}
        </Text>
      </Center>
    </Tooltip>
  );
};

export const EquippedLoadout = (): JSX.Element | null => {
  const { character, equippedArmor, equippedConsumables, equippedSpells, equippedWeapons } =
    useCharacter();
  const { currentBattle } = useBattle();
  const { isLoading: isLoadingItemTemplates } = useItems();

  const storageKey = character ? `${SLOT_ORDER_KEY_PREFIX}${character.id}` : '';

  const attackItems = useMemo(
    () => [...equippedWeapons, ...equippedSpells] as SlotItem[],
    [equippedWeapons, equippedSpells],
  );

  const { orderedItems: orderedAttackItems, promoteToFirst } = useSlotOrder(storageKey, attackItems);

  const actionSlots = useMemo(
    () => [...orderedAttackItems, ...equippedConsumables] as SlotItem[],
    [orderedAttackItems, equippedConsumables],
  );

  const isInBattle = currentBattle !== null && currentBattle.end === BigInt(0);

  const handlePromote = useCallback(
    (index: number) => {
      // Only attack items (not consumables) can be promoted
      if (index >= orderedAttackItems.length) return;
      promoteToFirst(index);
    },
    [orderedAttackItems.length, promoteToFirst],
  );

  if (!character) return null;

  // Don't render empty slots while item templates are still loading —
  // equipped arrays are empty during this window, not because the player
  // has nothing equipped.
  if (isLoadingItemTemplates) {
    return (
      <VStack spacing={1.5} w="100%">
        <Text color="#5A5040" fontSize="2xs" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
          Loadout
        </Text>
        <Center h="44px">
          <Spinner size="xs" color="#5A5040" />
        </Center>
      </VStack>
    );
  }

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
          {armor ? (
            <FilledSlot item={armor} slotNumber={0} isInBattle={isInBattle} />
          ) : (
            <EmptySlot label="Armor — empty" />
          )}
          <Text
            color="#5A5040"
            fontSize="6px"
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
              <FilledSlot
                item={actionSlots[i]}
                slotNumber={i + 1}
                onClick={i > 0 && i < orderedAttackItems.length ? () => handlePromote(i) : undefined}
                isInBattle={isInBattle}
              />
            ) : (
              <EmptySlot />
            )}
          </Box>
        ))}
      </HStack>
    </VStack>
  );
};
