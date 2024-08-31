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

import { getEmoji, removeEmoji } from '../utils/helpers';
import { type Armor, ItemType, type Spell, type Weapon } from '../utils/types';

const getStatSymbol = (stat: string): string => (Number(stat) >= 0 ? '+' : '');

type ItemCardProps = (Armor | Spell | Weapon) & {
  isEquipped?: boolean;
  onClick?: () => void;
};

export const ItemCard: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
  ...item
}): JSX.Element => {
  const { balance, name } = item;

  const itemStats = useMemo(() => {
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
              {minDamage} - {maxDamage}
            </Text>
          </HStack>
          <HStack alignItems="start">
            <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
              Requirements:
            </Text>
            <Text size={{ base: '2xs', sm: 'xs' }}>
              LVL {minLevel} STR {statRestrictions.minStrength} AGI{' '}
              {statRestrictions.minAgility} INT{' '}
              {statRestrictions.minIntelligence}
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
            STR {getStatSymbol(strModifier)}
            {strModifier} AGI {getStatSymbol(agiModifier)}
            {agiModifier} INT {getStatSymbol(intModifier)}
            {intModifier}{' '}
            {(item as Armor).armorModifier
              ? `ARM ${getStatSymbol((item as Armor).armorModifier)}${(item as Armor).armorModifier}`
              : ''}
          </Text>
        </HStack>
        <HStack alignItems="start">
          <Text fontWeight="bold" size={{ base: '2xs', sm: 'xs' }}>
            Requirements:
          </Text>
          <Text size={{ base: '2xs', sm: 'xs' }}>
            LVL {minLevel} STR {statRestrictions.minStrength} AGI{' '}
            {statRestrictions.minAgility} INT {statRestrictions.minIntelligence}
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
      variant="light"
      _active={
        onClick && {
          bgColor: 'rgba(0, 0, 0, .04)',
          borderColor: 'black',
        }
      }
    >
      <CardHeader backgroundColor="grey300">
        <Center h="100%">
          <Text fontSize={{ base: 'xl', lg: '3xl' }}>{getEmoji(name)}</Text>
        </Center>
      </CardHeader>
      <CardBody>
        <Text fontWeight="bold" size={{ base: 'xs', sm: 'md' }}>
          {removeEmoji(name)}
          <Text as="span" size="xs">
            {' '}
            x {balance}
          </Text>
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
          STR{getStatSymbol(strModifier)}
          {strModifier} AGI{getStatSymbol(agiModifier)}
          {agiModifier} INT{getStatSymbol(intModifier)}
          {intModifier}{' '}
          {(item as Armor).armorModifier
            ? `ARM${getStatSymbol((item as Armor).armorModifier)}${(item as Armor).armorModifier}`
            : ''}
        </Text>
      </Box>
    </HStack>
  );
};
