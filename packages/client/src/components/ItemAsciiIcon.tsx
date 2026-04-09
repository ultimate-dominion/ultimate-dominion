/**
 * ItemAsciiIcon — Pixelated item art with rarity-driven resolution.
 *
 * Higher rarity = smaller pixels = more detail. Worn gear is chunky and
 * crude (8px blocks); Legendary is crisp and refined (3px blocks + glow).
 * The visual language matches the ASCII aesthetic of the rest of the game.
 *
 * Pipeline: load WebP source → downsample to rarity grid → render with
 * nearest-neighbor scaling → tint with rarity color via multiply blend.
 *
 * Fallback: emoji for items without art.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';

type Props = {
  name: string;
  itemType: ItemType;
  rarity?: number;
  size?: string | Record<string, string>;
  alt?: string;
};

// ---------------------------------------------------------------------------
// Rarity → pixel block size (lower = more detail = higher rarity)
// ---------------------------------------------------------------------------
const RARITY_PIXEL_SIZE: Record<number, number> = {
  [Rarity.Worn]:      8,  // 6x6 grid — barely recognizable
  [Rarity.Common]:    6,  // 8x8 grid — chunky, basic
  [Rarity.Uncommon]:  5,  // ~10x10 grid — starting to read
  [Rarity.Rare]:      4,  // 12x12 grid — clear shape
  [Rarity.Epic]:      3,  // 16x16 grid — crisp
  [Rarity.Legendary]: 3,  // 16x16 grid — crisp + glow
};

// ---------------------------------------------------------------------------
// Rarity tint colors — tuned for white-on-black multiply blend
// Brighter/more saturated than border colors so they read at small sizes
// ---------------------------------------------------------------------------
const RARITY_TINT: Record<number, string> = {
  [Rarity.Worn]:      '#706866',   // Dim warm gray
  [Rarity.Common]:    '#B0A890',   // Parchment
  [Rarity.Uncommon]:  '#5CAA6A',   // Bright forest green
  [Rarity.Rare]:      '#5A90D0',   // Bright steel blue
  [Rarity.Epic]:      '#9A6AD8',   // Bright purple
  [Rarity.Legendary]: '#E8A030',   // Bright gold
};

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Pixelated renderer — downsample then scale up with nearest-neighbor
// ---------------------------------------------------------------------------
function renderPixelated(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  tintColor: string,
  pixelSize: number,
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (w === 0 || h === 0) return;

  // Grid resolution based on rarity pixel size
  const gridW = Math.max(4, Math.floor(w / pixelSize));
  const gridH = Math.max(4, Math.floor(h / pixelSize));

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Step 1: Draw source image to a tiny offscreen canvas (downsample)
  const tiny = document.createElement('canvas');
  tiny.width = gridW;
  tiny.height = gridH;
  const tinyCtx = tiny.getContext('2d');
  if (!tinyCtx) return;

  // Smooth downsample for clean pixel blocks
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.imageSmoothingQuality = 'medium';
  tinyCtx.drawImage(img, 0, 0, gridW, gridH);

  // Apply multiply tint on the tiny canvas
  tinyCtx.globalCompositeOperation = 'multiply';
  tinyCtx.fillStyle = tintColor;
  tinyCtx.fillRect(0, 0, gridW, gridH);
  tinyCtx.globalCompositeOperation = 'source-over';

  // Step 2: Scale up with nearest-neighbor (no smoothing) for pixel art look
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TintedItemCanvas = memo(({
  imageSrc,
  rarity,
  size,
}: {
  imageSrc: string;
  rarity: number;
  size: string | Record<string, string>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(!!imageCache.get(imageSrc));
  const tintColor = RARITY_TINT[rarity] ?? RARITY_TINT[Rarity.Common];
  const pixelSize = RARITY_PIXEL_SIZE[rarity] ?? RARITY_PIXEL_SIZE[Rarity.Common];
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);

  useEffect(() => {
    loadImage(imageSrc)
      .then(img => {
        setLoaded(true);
        if (canvasRef.current) {
          renderPixelated(canvasRef.current, img, tintColor, pixelSize);
        }
      })
      .catch(() => {});
  }, [imageSrc, tintColor, pixelSize]);

  // Re-render when canvas mounts after image is already cached
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imageCache.get(imageSrc);
    if (img) renderPixelated(canvasRef.current, img, tintColor, pixelSize);
  }, [loaded, imageSrc, tintColor, pixelSize]);

  // Rarity glow filter for epic+ items
  const glowFilter = rarity >= Rarity.Epic
    ? `drop-shadow(0 0 ${rarity >= Rarity.Legendary ? '6px' : '4px'} ${rarityBorderColor}80)`
    : rarity >= Rarity.Rare
      ? `drop-shadow(0 0 3px ${rarityBorderColor}50)`
      : undefined;

  return (
    <Box
      boxSize={size}
      flexShrink={0}
      position="relative"
      animation={rarityAnimation}
      borderRadius="sm"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          filter: glowFilter,
        }}
      />
    </Box>
  );
});

TintedItemCanvas.displayName = 'TintedItemCanvas';

const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px' }: Props) => {
  const cleanName = removeEmoji(name);
  const imageSrc = getItemImage(cleanName);

  if (imageSrc) {
    return (
      <TintedItemCanvas
        imageSrc={imageSrc}
        rarity={rarity}
        size={size}
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
