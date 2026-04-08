/**
 * ItemAsciiIcon — Renders item images as ASCII art via MonsterAsciiRenderer.
 *
 * Primary path: loads the item's WebP image, draws it to an offscreen canvas,
 * and feeds that through renderMonster for consistent ASCII styling.
 *
 * Fallback chain: WebP image → silhouette template → emoji.
 */

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { Box, Text } from '@chakra-ui/react';

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

// ---------------------------------------------------------------------------
// Image cache — load each WebP once, reuse forever
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();

function useItemImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(() =>
    src ? imageCache.get(src) ?? null : null,
  );

  useEffect(() => {
    if (!src) return;
    const cached = imageCache.get(src);
    if (cached) { setImg(cached); return; }

    let cancelled = false;
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      imageCache.set(src, el);
      if (!cancelled) setImg(el);
    };
    el.onerror = () => {}; // fallback handled below
    el.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return img;
}

// ---------------------------------------------------------------------------
// Inner canvas component — mounts fresh each time template identity changes,
// so useCanvas's static single-render fires with the correct data.
// ---------------------------------------------------------------------------
const AsciiCanvas = memo(({ templateId, draw, rarity, size, renderOverrides }: {
  templateId: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  rarity: number;
  size: string | Record<string, string>;
  renderOverrides?: Record<string, number>;
}) => {
  const template = useMemo(() => ({
    id: templateId,
    name: templateId,
    gridWidth: 1,
    gridHeight: 1,
    monsterClass: 0,
    level: 1,
    dynamic: false,
    renderOverrides,
    draw,
  }), [templateId, draw, renderOverrides]);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
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

  return (
    <Box boxSize={size} flexShrink={0} position="relative">
      <canvas
        ref={canvasRef as React.LegacyRef<HTMLCanvasElement>}
        style={{ width: '100%', height: '100%' }}
      />
    </Box>
  );
});

AsciiCanvas.displayName = 'AsciiCanvas';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px' }: Props) => {
  const cleanName = removeEmoji(name);
  const imageSrc = getItemImage(cleanName);
  const loadedImage = useItemImage(imageSrc);
  const isWeaponOrArmor = itemType === ItemType.Weapon || itemType === ItemType.Armor;

  // Image-based draw function (primary path)
  const imageDraw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (!loadedImage) return;
      ctx.drawImage(loadedImage, 0, 0, w, h);
    },
    [loadedImage],
  );

  // Silhouette fallback template (only when no image exists)
  const silhouetteTemplate = useMemo(() => {
    if (imageSrc || !isWeaponOrArmor) return null;
    const type = itemType === ItemType.Weapon ? 'weapon' : 'armor';
    return getItemAsciiTemplate(cleanName, type, rarity);
  }, [imageSrc, isWeaponOrArmor, cleanName, itemType, rarity]);

  // Render overrides tuned for photographic WebP sources
  const imageOverrides = useMemo(() => ({
    brightnessBoost: 1.6,
    gamma: 0.5,
    ambient: 0.65,
    charDensityFloor: 0.06,
  }), []);

  // Primary: image-based ASCII rendering
  if (loadedImage) {
    return (
      <AsciiCanvas
        key={`img-${cleanName}`}
        templateId={`item-img-${cleanName}`}
        draw={imageDraw}
        rarity={rarity}
        size={size}
        renderOverrides={imageOverrides}
      />
    );
  }

  // Fallback: silhouette ASCII for weapons/armor without WebP
  if (silhouetteTemplate) {
    return (
      <AsciiCanvas
        key={`sil-${cleanName}`}
        templateId={silhouetteTemplate.id}
        draw={silhouetteTemplate.draw}
        rarity={rarity}
        size={size}
        renderOverrides={silhouetteTemplate.renderOverrides}
      />
    );
  }

  // Final fallback: emoji
  return (
    <Text fontSize="xl" lineHeight={1}>
      {itemType === ItemType.Consumable
        ? getConsumableEmoji(cleanName)
        : getEmoji(name)}
    </Text>
  );
};

export const ItemAsciiIcon = memo(ItemAsciiIconInner);
