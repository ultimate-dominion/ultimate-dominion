import { Box, Center, HStack, Image, keyframes, Stack, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
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

const equipPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(184,58,42,0.5); }
  50% { box-shadow: 0 0 16px 4px rgba(184,58,42,0.3); }
  100% { box-shadow: 0 0 0 0 rgba(184,58,42,0); }
`;

export const ItemCard: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
  showBalance = true,
  ...item
}): JSX.Element => {
  const { balance, name, rarity } = item;
  const { t } = useTranslation('ui');
  const rarityColor = getRarityColor(rarity);
  const rarityName = getRarityName(rarity);
  const rarityGlow = getRarityGlow(rarity);
  const rarityAnimation = getRarityAnimation(rarity);

  // Track equipped state changes for pulse animation
  const prevEquipped = useRef(isEquipped);
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    if (prevEquipped.current !== isEquipped) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 600);
      prevEquipped.current = isEquipped;
      return () => clearTimeout(timer);
    }
  }, [isEquipped]);

  const itemStats = useMemo(() => {
    // Helper to format a stat modifier: returns "LABEL +N" or null if zero
    const fmtMod = (label: string, val: bigint) => {
      const n = Number(val);
      if (n === 0) return null;
      return { label, value: `${n >= 0 ? '+' : ''}${n}`, positive: n > 0 };
    };

    // Helper to render stat chips (non-zero mods only)
    const renderMods = (mods: { label: string; value: string; positive: boolean }[]) => {
      if (mods.length === 0) return null;
      return (
        <HStack spacing={1} flexWrap="wrap">
          {mods.map(m => (
            <Text
              key={m.label}
              as="span"
              size={{ base: '2xs', sm: 'xs' }}
              fontFamily="'Fira Code', monospace"
            >
              <Text as="span" color="#8A7E6A">{m.label}</Text>{' '}
              <Text as="span" color={m.positive ? '#5A8A3E' : '#B83A2A'} fontWeight={600}>
                {m.value}
              </Text>
            </Text>
          ))}
        </HStack>
      );
    };

    // Helper to render requirements (non-zero only)
    const renderReqs = (minLevel: bigint, reqs: { minStrength: bigint; minAgility: bigint; minIntelligence: bigint }) => {
      const parts: string[] = [];
      if (Number(minLevel) > 0) parts.push(`LVL ${minLevel}`);
      if (Number(reqs.minStrength) > 0) parts.push(`STR ${reqs.minStrength}`);
      if (Number(reqs.minAgility) > 0) parts.push(`AGI ${reqs.minAgility}`);
      if (Number(reqs.minIntelligence) > 0) parts.push(`INT ${reqs.minIntelligence}`);
      if (parts.length === 0) return null;
      return (
        <Text size="2xs" color="#C87A2A" fontFamily="'Fira Code', monospace">
          {t('itemCard.requires')} {parts.join(' ')}
        </Text>
      );
    };

    if (item.itemType === ItemType.Consumable) {
      const { agiModifier, hpRestoreAmount, intModifier, strModifier } =
        item as Consumable;

      if (hpRestoreAmount > BigInt(0)) {
        return (
          <Text size={{ base: '2xs', sm: 'xs' }} color="#5A8A3E" fontWeight={600}>
            {t('itemCard.restoresHp', { hp: hpRestoreAmount.toString() })}
          </Text>
        );
      }

      const mods = [
        fmtMod('STR', strModifier),
        fmtMod('AGI', agiModifier),
        fmtMod('INT', intModifier),
      ].filter(Boolean) as { label: string; value: string; positive: boolean }[];

      return renderMods(mods);
    }

    if (item.itemType === ItemType.Spell || item.itemType === ItemType.Weapon) {
      const { minDamage, minLevel, maxDamage, statRestrictions } =
        item as Spell;

      const weaponMods = item.itemType === ItemType.Weapon
        ? [
            fmtMod('STR', (item as Weapon).strModifier),
            fmtMod('AGI', (item as Weapon).agiModifier),
            fmtMod('INT', (item as Weapon).intModifier),
            fmtMod('HP', (item as Weapon).hpModifier),
          ].filter(Boolean) as { label: string; value: string; positive: boolean }[]
        : [];

      return (
        <VStack alignItems="start" spacing={0.5}>
          <Text size={{ base: '2xs', sm: 'xs' }} fontFamily="'Fira Code', monospace">
            <Text as="span" color="#8A7E6A">DMG</Text>{' '}
            <Text as="span" color="#E8DCC8" fontWeight={600}>{minDamage.toString()}–{maxDamage.toString()}</Text>
          </Text>
          {weaponMods.length > 0 && renderMods(weaponMods)}
          {renderReqs(minLevel, statRestrictions)}
        </VStack>
      );
    }

    // Armor and Weapon (non-spell)
    const {
      minLevel,
      statRestrictions,
      strModifier,
      agiModifier,
      intModifier,
    } = item as Armor;

    const mods = [
      fmtMod('STR', strModifier),
      fmtMod('AGI', agiModifier),
      fmtMod('INT', intModifier),
      fmtMod('HP', (item as Armor).hpModifier),
      fmtMod('ARM', (item as Armor).armorModifier),
    ].filter(Boolean) as { label: string; value: string; positive: boolean }[];

    return (
      <VStack alignItems="start" spacing={0.5}>
        {renderMods(mods)}
        {renderReqs(minLevel, statRestrictions)}
      </VStack>
    );
  }, [item, t]);

  return (
    <Tooltip
      label={
        <VStack align="start" spacing={1} p={1}>
          <Text fontWeight="bold" color={rarityColor}>{rarityName}</Text>
          {item.description && (
            <Text size="xs" color="#A89A82" fontStyle="italic">{item.description}</Text>
          )}
          {itemStats}
        </VStack>
      }
      placement="top"
      hasArrow
      shouldWrapChildren
    >
      <Box position="relative" w="100%">
        {isEquipped && (
          <Box
            bg="#8B2020"
            borderRadius="2px"
            color="#E8DCC8"
            fontFamily="'Cinzel', serif"
            fontSize="11px"
            fontWeight={700}
            letterSpacing="0.12em"
            lineHeight="1"
            position="absolute"
            px="6px"
            py="3px"
            right="8px"
            textTransform="uppercase"
            top="-1px"
            transform="translateY(-50%)"
            zIndex={2}
          >
            {t('itemCard.equipped')}
          </Box>
        )}
        <HStack
          animation={showPulse ? `${equipPulse} 0.6s ease-out` : rarityAnimation}
          border="2px solid"
          borderBottom="2px solid"
          borderColor={isEquipped ? '#8B2020' : rarityColor}
          boxShadow={
            isEquipped
              ? '0 0 10px rgba(139,32,32,0.3), 0 0 4px rgba(139,32,32,0.15)'
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
              borderColor: '#3A3228',
            }
          }
          _hover={
            onClick && {
              borderColor: '#3A3228',
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
              <Text fontSize={{ base: 'xl', lg: '3xl' }}>
                {item.itemType === ItemType.Consumable
                  ? getConsumableEmoji(removeEmoji(name))
                  : getEmoji(name)}
              </Text>
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
      </Box>
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
            <Text color="#E8DCC8" fontSize="2xl">
              {item.itemType === ItemType.Consumable
                  ? getConsumableEmoji(removeEmoji(item.name))
                  : getEmoji(item.name)}
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
          <Text color="#E8DCC8" fontSize="2xl">
            {item.itemType === ItemType.Consumable
                  ? getConsumableEmoji(removeEmoji(item.name))
                  : getEmoji(item.name)}
          </Text>
        )}
      </Stack>
      <Box>
        <Text fontWeight={700} size={{ base: 'sm', sm: 'lg' }} color={rarityColor}>
          {removeEmoji(name)}
        </Text>
        <HStack spacing={1} flexWrap="wrap">
          {[
            { label: 'STR', val: strModifier },
            { label: 'AGI', val: agiModifier },
            { label: 'INT', val: intModifier },
            { label: 'ARM', val: (item as Armor).armorModifier },
          ]
            .filter(s => s.val && Number(s.val) !== 0)
            .map(s => (
              <Text key={s.label} fontWeight={500} size={{ base: 'xs', sm: 'sm' }} fontFamily="'Fira Code', monospace">
                <Text as="span" color="#8A7E6A">{s.label}</Text>{' '}
                <Text as="span" color={Number(s.val) > 0 ? '#5A8A3E' : '#B83A2A'}>
                  {Number(s.val) >= 0 ? '+' : ''}{s.val?.toString()}
                </Text>
              </Text>
            ))}
        </HStack>
      </Box>
    </HStack>
  );
};
