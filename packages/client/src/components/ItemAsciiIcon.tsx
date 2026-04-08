/**
 * ItemAsciiIcon — Renders weapon/armor items as ASCII art on a small canvas.
 *
 * Uses subtype-based silhouette templates (itemAsciiArt.ts) processed through
 * the MonsterAsciiRenderer for a consistent ASCII look across the UI.
 *
 * Falls back to WebP image for consumables/spells (no ASCII template).
 */

import { useCallback, useMemo, memo } from 'react';
import { Box, Image, Text } from '@chakra-ui/react';

import { useCanvas } from './pretext/hooks/useCanvas';
import { renderMonster } from './pretext/game/MonsterAsciiRenderer';
import { getItemAsciiTemplate } from './pretext/game/itemAsciiArt';
import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { ItemType } from '../utils/types';

type Props = {
  /** Item name (may include emoji prefix) */
  name: string;
  /** ItemType enum value */
  itemType: ItemType;
  /** Item rarity (0-4) */
  rarity?: number;
  /** CSS size string for the icon container */
  size?: string | Record<string, string>;
  /** Optional alt text */
  alt?: string;
};

/** Cell size for ASCII rendering — smaller = more detail */
const CELL_SIZE = 4;

const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px', alt }: Props) => {
  const cleanName = removeEmoji(name);
  const isWeaponOrArmor = itemType === ItemType.Weapon || itemType === ItemType.Armor;

  const template = useMemo(() => {
    if (!isWeaponOrArmor) return null;
    const type = itemType === ItemType.Weapon ? 'weapon' : 'armor';
    return getItemAsciiTemplate(cleanName, type, rarity);
  }, [cleanName, itemType, rarity, isWeaponOrArmor]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!template) return;
      const { width, height } = ctx.canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      renderMonster(ctx, template, 0, 0, width, height, {
        cellSize: CELL_SIZE,
        enable3D: false,
        enableGlow: rarity >= 3,
        enableBgFill: true,
      });
    },
    [template, rarity],
  );

  const { canvasRef } = useCanvas({ onFrame, static: true });

  // Weapons and armor get ASCII rendering
  if (isWeaponOrArmor && template) {
    return (
      <Box
        boxSize={size}
        flexShrink={0}
        position="relative"
      >
        <canvas
          ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    );
  }

  // Consumables and spells fall back to WebP image or emoji
  const imageSrc = getItemImage(cleanName);
  if (imageSrc) {
    return (
      <Image
        src={imageSrc}
        alt={alt ?? cleanName}
        boxSize={size}
        objectFit="contain"
        flexShrink={0}
      />
    );
  }

  return (
    <Text fontSize="xl" lineHeight={1}>
      {itemType === ItemType.Consumable
        ? getConsumableEmoji(cleanName)
        : getEmoji(name)}
    </Text>
  );
};

export const ItemAsciiIcon = memo(ItemAsciiIconInner);
