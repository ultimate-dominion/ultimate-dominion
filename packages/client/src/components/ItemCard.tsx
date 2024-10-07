import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Center,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
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
          <HStack alignItems="start">
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
          </HStack>
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
        <>
          <HStack alignItems="start">
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Damage:
            </Text>
            <Text size={{ base: '2xs', sm: 'xs' }}>
              {minDamage.toString()} - {maxDamage.toString()}
            </Text>
          </HStack>
          <HStack alignItems="start">
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Requirements:
            </Text>
            <Text size={{ base: '2xs', sm: 'xs' }}>
              LVL {minLevel.toString()} STR{' '}
              {statRestrictions.minStrength.toString()} AGI{' '}
              {statRestrictions.minAgility.toString()} INT{' '}
              {statRestrictions.minIntelligence.toString()}
            </Text>
          </HStack>
        </>
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
      <>
        <HStack alignItems="start">
          <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
            Mods:
          </Text>
          <Text size={{ base: '2xs', sm: 'xs' }}>
            STR {getStatSymbol(strModifier.toString())}
            {strModifier.toString()} AGI {getStatSymbol(agiModifier.toString())}
            {agiModifier.toString()} INT {getStatSymbol(intModifier.toString())}
            {intModifier.toString()}{' '}
            {(item as Armor).armorModifier
              ? `ARM ${getStatSymbol((item as Armor).armorModifier.toString())}${(item as Armor).armorModifier}`
              : ''}
          </Text>
        </HStack>
        <HStack alignItems="start">
          <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
            Requirements:
          </Text>
          <Text size={{ base: '2xs', sm: 'xs' }}>
            LVL {minLevel.toString()} STR{' '}
            {statRestrictions.minStrength.toString()} AGI{' '}
            {statRestrictions.minAgility.toString()} INT{' '}
            {statRestrictions.minIntelligence.toString()}
          </Text>
        </HStack>
      </>
    );
  }, [item]);

  return (
    <Card
      border={isEquipped ? '3px solid' : '2px solid'}
      borderColor={isEquipped ? 'black' : 'grey300'}
      borderRadius={2}
      cursor={onClick ? 'pointer' : 'default'}
      direction="row"
      onClick={onClick}
      overflow="hidden"
      transition="all 0.2s"
      variant="light"
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
      <CardHeader backgroundColor="grey300" w="75px">
        <Center h="100%">
          <Text fontSize={{ base: 'xl', lg: '3xl' }}>{getEmoji(name)}</Text>
        </Center>
      </CardHeader>
      <CardBody>
        <Text fontWeight="bold" size={{ base: 'xs', sm: 'md' }}>
          {removeEmoji(name)}
          {showBalance && (
            <Text as="span" size="xs">
              {' '}
              x {balance.toString()}
            </Text>
          )}
        </Text>

        {itemStats}
      </CardBody>
    </Card>
  );
};

export const ItemCardSmall: React.FC<ItemCardProps> = ({
  ...item
}): JSX.Element => {
  if (item.itemType === ItemType.Spell) {
    return (
      <HStack border="1px solid" borderColor="grey400" w="100%">
        <Stack
          alignItems="center"
          bgColor="grey400"
          h="50px"
          justifyContent="center"
          w="50px"
        >
          <Text color="white" fontSize="2xl">
            {getEmoji(item.name)}
          </Text>
        </Stack>
        <Box>
          <Text size="xs">{removeEmoji(item.name)}</Text>
        </Box>
      </HStack>
    );
  }

  const { name, strModifier, agiModifier, intModifier } = item as
    | Armor
    | Weapon;

  return (
    <HStack border="1px solid" borderColor="grey400" w="100%">
      <Stack
        alignItems="center"
        bgColor="grey400"
        h="50px"
        justifyContent="center"
        w="50px"
      >
        <Text color="white" fontSize="2xl">
          {getEmoji(item.name)}
        </Text>
      </Stack>
      <Box>
        <Text size="xs">{removeEmoji(name)}</Text>
        <Text size="xs">
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
