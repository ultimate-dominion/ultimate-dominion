import { Box, Center, HStack, Image, Stack, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';

import { getEmoji, getStatSymbol, removeEmoji } from '../utils/helpers';
import { getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor, getRarityGlow, getRarityName } from '../utils/rarityHelpers';
import {
  type Armor,
  type Consumable,
  ItemType,
  Rarity,
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
  const { balance, name, rarity } = item;
  const rarityColor = getRarityColor(rarity);
  const rarityName = getRarityName(rarity);
  const rarityGlow = getRarityGlow(rarity);
  const rarityAnimation = getRarityAnimation(rarity);

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

    if (item.itemType === ItemType.Spell || item.itemType === ItemType.Weapon) {
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
              Damage Range:
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
    } = item as Armor;

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
    <Tooltip
      label={
        <VStack align="start" spacing={1} p={1}>
          <Text fontWeight="bold" color={rarityColor}>{rarityName}</Text>
          {itemStats}
        </VStack>
      }
      placement="top"
      hasArrow
    >
      <HStack
        animation={rarityAnimation}
        border={isEquipped ? '2px solid' : '2px solid'}
        borderBottom="2px solid"
        borderColor={isEquipped ? '#C87A2A' : rarityColor}
        boxShadow={
          isEquipped
            ? '0 0 12px rgba(200,122,42,0.4), 0 0 4px rgba(200,122,42,0.2)'
            : rarityGlow !== 'none'
              ? rarityGlow
              : '2px 2px 6px rgba(0,0,0,0.5) inset, -1px -1px 3px rgba(60,50,40,0.15) inset'
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
          {getItemImage(removeEmoji(name)) ? (
            <Image
              src={getItemImage(removeEmoji(name))}
              alt={removeEmoji(name)}
              boxSize={{ base: '40px', lg: '56px' }}
              objectFit="contain"
            />
          ) : (
            <Text fontSize={{ base: 'xl', lg: '3xl' }}>{getEmoji(name)}</Text>
          )}
        </Center>
        <VStack alignItems="start" className="data-dense" spacing={0}>
          <HStack spacing={2} mb={1}>
            <Text
              fontWeight="bold"
              size={{ base: 'xs', sm: 'md' }}
              color={rarityColor}
              textShadow={rarity && rarity >= Rarity.Rare ? `0 0 5px ${rarityColor}` : 'none'}
            >
              {removeEmoji(name)}
            </Text>
            {showBalance && (
              <Text as="span" size="xs">
                x {balance.toString()}
              </Text>
            )}
          </HStack>
          <Text size="2xs" color={rarityColor} fontStyle="italic" mb={1}>
            {rarityName}
          </Text>
          {itemStats}
        </VStack>
      </HStack>
    </Tooltip>
  );
};

export const ItemCardSmall: React.FC<ItemCardProps> = ({
  ...item
}): JSX.Element => {
  const { rarity } = item;
  const rarityColor = getRarityColor(rarity);
  const hasGlow = rarity !== undefined && rarity >= Rarity.Rare;

  if (item.itemType === ItemType.Spell) {
    return (
      <HStack
        borderLeft={`3px solid ${rarityColor}`}
        boxShadow={
          hasGlow
            ? `inset 0 1px 3px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(196,184,158,0.05), -4px 0 8px ${rarityColor}30`
            : 'inset 0 1px 3px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(196,184,158,0.05)'
        }
        px={{ base: 4, sm: 10 }}
        w="100%"
      >
        <Stack alignItems="center" h="60px" justifyContent="center" mr={8}>
          {getItemImage(removeEmoji(item.name)) ? (
            <Image
              src={getItemImage(removeEmoji(item.name))}
              alt={removeEmoji(item.name)}
              boxSize="40px"
              objectFit="contain"
            />
          ) : (
            <Text color="white" fontSize="2xl">
              {getEmoji(item.name)}
            </Text>
          )}
        </Stack>
        <Box>
          <Text fontWeight={700} size={{ base: 'sm', sm: 'lg' }} color={rarityColor}>
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
      borderLeft={`3px solid ${rarityColor}`}
      boxShadow={
        hasGlow
          ? `2px 2px 6px rgba(0,0,0,0.5) inset, -1px -1px 3px rgba(60,50,40,0.15) inset, -4px 0 8px ${rarityColor}30`
          : '2px 2px 6px rgba(0,0,0,0.5) inset, -1px -1px 3px rgba(60,50,40,0.15) inset'
      }
      px={{ base: 4, sm: 10 }}
      w="100%"
    >
      <Stack alignItems="center" h="60px" justifyContent="center" mr={8}>
        {getItemImage(removeEmoji(item.name)) ? (
          <Image
            src={getItemImage(removeEmoji(item.name))}
            alt={removeEmoji(item.name)}
            boxSize="40px"
            objectFit="contain"
          />
        ) : (
          <Text color="white" fontSize="2xl">
            {getEmoji(item.name)}
          </Text>
        )}
      </Stack>
      <Box>
        <Text fontWeight={700} size={{ base: 'sm', sm: 'lg' }} color={rarityColor}>
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
