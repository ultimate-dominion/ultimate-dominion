import { Box, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';

import { removeEmoji } from '../utils/helpers';
import { getRarityColor, getRarityName } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';

type Props = {
  name: string;
  itemType: ItemType;
  rarity?: number;
  size?: string | Record<string, string>;
  alt?: string;
};

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  [ItemType.Weapon]: 'WPN',
  [ItemType.Armor]: 'ARM',
  [ItemType.Spell]: 'SPL',
  [ItemType.Consumable]: 'USE',
  [ItemType.QuestItem]: 'QST',
};

/**
 * Text-only item mark.
 *
 * The legacy name is retained so item cards can move off the art pipeline
 * without changing their data flow. Every item — including future content —
 * renders from its type and rarity alone.
 */
const ItemAsciiIconInner = ({
  name,
  itemType,
  rarity = Rarity.Worn,
  size = '40px',
  alt,
}: Props) => {
  const cleanName = removeEmoji(name);
  const typeLabel = ITEM_TYPE_LABELS[itemType] ?? 'ITEM';
  const rarityColor = getRarityColor(rarity);
  const accessibleLabel =
    alt ?? `${getRarityName(rarity)} ${cleanName || typeLabel}`;

  return (
    <Tooltip
      aria-label={accessibleLabel}
      bg="#14120F"
      hasArrow
      label={accessibleLabel}
      shouldWrapChildren
    >
      <Box
        alignItems="center"
        aria-label={accessibleLabel}
        background="linear-gradient(145deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18))"
        border="1px solid"
        borderColor={rarityColor}
        boxShadow={`inset 0 0 0 1px ${rarityColor}22`}
        boxSize={size}
        display="flex"
        flexShrink={0}
        justifyContent="center"
        role="group"
      >
        <Text
          color={rarityColor}
          fontFamily="'Fira Code', monospace"
          fontSize={{ base: '8px', md: '9px' }}
          fontWeight={800}
          letterSpacing="0.08em"
          lineHeight={1}
        >
          {typeLabel}
        </Text>
      </Box>
    </Tooltip>
  );
};

export const ItemAsciiIcon = memo(ItemAsciiIconInner);
