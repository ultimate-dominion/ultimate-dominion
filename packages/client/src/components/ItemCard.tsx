import { Box, Center, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';

import { getEmoji, getStatSymbol, removeEmoji } from '../utils/helpers';
import {
  type Armor,
  type Consumable,
  ItemType,
  type Spell,
  type Weapon,
} from '../utils/types';

type ItemCardProps = (Armor | Consumable | Spell | Weapon) & {
  isEquipped?: boolean;
  onClick?: () => void;
  showBalance?: boolean;
};

export const ItemCard: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
  showBalance = true,
  ...item
}): JSX.Element => {
  const { balance, name } = item;

  const itemStats = useMemo(() => {
    if (item.itemType === ItemType.Consumable) {
      const { agiModifier, hpRestoreAmount, intModifier, strModifier } =
        item as Consumable;

      if (hpRestoreAmount === BigInt(0)) {
        return (
          <Stack
            alignItems="start"
            direction={{ base: 'column', lg: 'row' }}
            spacing={{ base: 0, lg: 2 }}
          >
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Mods:
            </Text>
            <Text size={{ base: '2xs', sm: 'xs' }}>
              STR {getStatSymbol(strModifier.toString())}
              {strModifier.toString()} AGI{' '}
              {getStatSymbol(agiModifier.toString())}
              {agiModifier.toString()} INT{' '}
              {getStatSymbol(intModifier.toString())}
              {intModifier.toString()}
            </Text>
          </Stack>
        );
      }

      return (
        <Text size={{ base: '2xs', sm: 'xs' }}>
          Restores {hpRestoreAmount.toString()} HP
        </Text>
      );
    }

    if (item.itemType === ItemType.Spell) {
      const { minDamage, minLevel, maxDamage, statRestrictions } =
        item as Spell;

      return (
        <VStack alignItems="start" spacing={0}>
          <Stack
            alignItems="start"
            direction={{ base: 'column', lg: 'row' }}
            spacing={{ base: 0, lg: 2 }}
          >
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Damage:
            </Text>
            <Text size="2xs">
              {minDamage.toString()} - {maxDamage.toString()}
            </Text>
          </Stack>
          <Stack
            alignItems="start"
            direction={{ base: 'column', lg: 'row' }}
            spacing={{ base: 0, lg: 2 }}
          >
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Requirements:
            </Text>
            <Text size="2xs">
              LVL {minLevel.toString()} STR{' '}
              {statRestrictions.minStrength.toString()} AGI{' '}
              {statRestrictions.minAgility.toString()} INT{' '}
              {statRestrictions.minIntelligence.toString()}
            </Text>
          </Stack>
        </VStack>
      );
    }

    const {
      minLevel,
      statRestrictions,
      strModifier,
      agiModifier,
      intModifier,
    } = item as Armor | Weapon;

    return (
      <VStack alignItems="start" spacing={0}>
        <Stack
          alignItems="start"
          direction={{ base: 'column', lg: 'row' }}
          spacing={{ base: 0, lg: 2 }}
        >
          <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
            Mods:
          </Text>
          <Text size="2xs">
            STR {getStatSymbol(strModifier.toString())}
            {strModifier.toString()} AGI {getStatSymbol(agiModifier.toString())}
            {agiModifier.toString()} INT {getStatSymbol(intModifier.toString())}
            {intModifier.toString()}{' '}
            {(item as Armor).armorModifier
              ? `ARM ${getStatSymbol((item as Armor).armorModifier.toString())}${(item as Armor).armorModifier}`
              : ''}
          </Text>
        </Stack>
        <Stack
          alignItems="start"
          direction={{ base: 'column', lg: 'row' }}
          spacing={{ base: 0, lg: 2 }}
        >
          <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
            Requirements:
          </Text>
          <Text size="2xs">
            LVL {minLevel.toString()} STR{' '}
            {statRestrictions.minStrength.toString()} AGI{' '}
            {statRestrictions.minAgility.toString()} INT{' '}
            {statRestrictions.minIntelligence.toString()}
          </Text>
        </Stack>
      </VStack>
    );
  }, [item]);

  return (
    <HStack
      border={isEquipped ? '2px solid' : 'none'}
      borderBottom="2px solid"
      borderColor="white"
      boxShadow={
        isEquipped
          ? '-10px -10px 8px 0px #A2A9B0, 10px 10px 8px 0px #54545480, 5px 5px 10px 0px #54545440, -5px -5px 4px 0px #5454547D'
          : '-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset'
      }
      cursor={onClick ? 'pointer' : 'default'}
      direction="row"
      minH="100px"
      onClick={onClick}
      py={4}
      px={{ base: 4, sm: 8 }}
      transition="all 0.3s"
      w="100%"
      _active={
        onClick && {
          bgColor: 'rgba(0, 0, 0, .04)',
          borderColor: 'black',
        }
      }
      _hover={
        onClick && {
          borderColor: 'black',
        }
      }
    >
      <Center h="100%" mr={{ base: 2, sm: 6 }}>
        <Text fontSize={{ base: 'xl', lg: '3xl' }}>{getEmoji(name)}</Text>
      </Center>
      <VStack alignItems="start" spacing={0}>
        <Text fontWeight="bold" mb={2} size={{ base: 'xs', sm: 'md' }}>
          {removeEmoji(name)}
          {showBalance && (
            <Text as="span" size="xs">
              {' '}
              x {balance.toString()}
            </Text>
          )}
        </Text>

        {itemStats}
      </VStack>
    </HStack>
  );
};

export const ItemCardSmall: React.FC<ItemCardProps> = ({
  ...item
}): JSX.Element => {
  if (item.itemType === ItemType.Spell) {
    return (
      <HStack
        borderBottom="2px solid"
        borderColor="white"
        boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
        px={{ base: 4, sm: 10 }}
        w="100%"
      >
        <Stack alignItems="center" h="60px" justifyContent="center" mr={8}>
          <Text color="white" fontSize="2xl">
            {getEmoji(item.name)}
          </Text>
        </Stack>
        <Box>
          <Text fontWeight={700} size={{ base: 'sm', sm: 'lg' }}>
            {removeEmoji(item.name)}
          </Text>
        </Box>
      </HStack>
    );
  }

  const { name, strModifier, agiModifier, intModifier } = item as
    | Armor
    | Weapon;

  return (
    <HStack
      borderBottom="2px solid"
      borderColor="white"
      boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
      px={{ base: 4, sm: 10 }}
      w="100%"
    >
      <Stack alignItems="center" h="60px" justifyContent="center" mr={8}>
        <Text color="white" fontSize="2xl">
          {getEmoji(item.name)}
        </Text>
      </Stack>
      <Box>
        <Text fontWeight={700} size={{ base: 'sm', sm: 'lg' }}>
          {removeEmoji(name)}
        </Text>
        <Text fontWeight={500} size={{ base: 'xs', sm: 'sm' }}>
          STR{getStatSymbol(strModifier.toString())}
          {strModifier.toString()} AGI{getStatSymbol(agiModifier.toString())}
          {agiModifier.toString()} INT{getStatSymbol(intModifier.toString())}
          {intModifier.toString()}{' '}
          {(item as Armor).armorModifier
            ? `ARM${getStatSymbol((item as Armor).armorModifier.toString())}${(item as Armor).armorModifier}`
            : ''}
        </Text>
      </Box>
    </HStack>
  );
};
