/**
 * ItemAsciiIcon — Displays item art with rarity-driven visual effects.
 *
 * Shows the WebP illustration directly (already in the game's ink-on-black
 * art style) with CSS filter/glow effects per rarity tier to create clear
 * visual hierarchy. Common items look dim and worn; legendaries glow.
 *
 * Fallback chain: WebP image → emoji.
 */

import { memo } from 'react';
import { Box, Image, Text } from '@chakra-ui/react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { getRarityColor } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';

type Props = {
  /** Item name (may include emoji prefix) */
  name: string;
  /** ItemType enum value */
  itemType: ItemType;
  /** Item rarity (0-5) */
  rarity?: number;
  /** CSS size string for the icon container */
  size?: string | Record<string, string>;
  /** Optional alt text */
  alt?: string;
};

// ---------------------------------------------------------------------------
// Rarity visual effects — each tier should "feel" distinct at a glance
// ---------------------------------------------------------------------------

/** CSS filter per rarity — dims commons, enhances legendaries */
const RARITY_FILTERS: Record<number, string> = {
  [Rarity.Worn]:      'brightness(0.5) saturate(0.3)',
  [Rarity.Common]:    'brightness(0.7) saturate(0.5)',
  [Rarity.Uncommon]:  'brightness(0.9) saturate(0.8)',
  [Rarity.Rare]:      'brightness(1.0) saturate(1.0)',
  [Rarity.Epic]:      'brightness(1.1) saturate(1.2)',
  [Rarity.Legendary]: 'brightness(1.2) saturate(1.3)',
};

/** Drop-shadow glow per rarity — subtle to dramatic */
const getRarityDropShadow = (rarity: number): string | undefined => {
  const color = getRarityColor(rarity);
  switch (rarity) {
    case Rarity.Uncommon:
      return `drop-shadow(0 0 3px ${color}40)`;
    case Rarity.Rare:
      return `drop-shadow(0 0 4px ${color}50) drop-shadow(0 0 8px ${color}25)`;
    case Rarity.Epic:
      return `drop-shadow(0 0 5px ${color}60) drop-shadow(0 0 12px ${color}30)`;
    case Rarity.Legendary:
      return `drop-shadow(0 0 6px ${color}70) drop-shadow(0 0 14px ${color}40) drop-shadow(0 0 24px ${color}20)`;
    default:
      return undefined;
  }
};

const getImageFilter = (rarity: number): string => {
  const base = RARITY_FILTERS[rarity] ?? RARITY_FILTERS[Rarity.Common];
  const glow = getRarityDropShadow(rarity);
  return glow ? `${base} ${glow}` : base;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px', alt }: Props) => {
  const cleanName = removeEmoji(name);
  const imageSrc = getItemImage(cleanName);

  if (imageSrc) {
    return (
      <Box boxSize={size} flexShrink={0}>
        <Image
          src={imageSrc}
          alt={alt ?? cleanName}
          boxSize="100%"
          objectFit="contain"
          filter={getImageFilter(rarity)}
          transition="filter 0.3s ease"
        />
      </Box>
    );
  }

  // Emoji fallback for items without art
  return (
    <Text fontSize="xl" lineHeight={1}>
      {itemType === ItemType.Consumable
        ? getConsumableEmoji(cleanName)
        : getEmoji(name)}
    </Text>
  );
};

export const ItemAsciiIcon = memo(ItemAsciiIconInner);
