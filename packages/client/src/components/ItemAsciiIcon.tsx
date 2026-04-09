/**
 * ItemAsciiIcon — Posterized pixel art with max-pool downsampling.
 *
 * The secret sauce: max-pooling instead of bilinear averaging when
 * downsampling. For each output pixel, we take the BRIGHTEST source
 * pixel in that block — so thin white features (sword blades, bow
 * strings, staff details) survive instead of getting averaged into mud.
 *
 * Higher rarity = smaller pixels + more tonal levels.
 * Worn/Common: 2-color (black + tint) — bold, crude.
 * Uncommon/Rare: 3-color (black + dark + bright) — depth emerges.
 * Epic/Legendary: 4-color (black + shadow + mid + highlight) — crisp.
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
// Rarity → pixel block size
// ---------------------------------------------------------------------------
const RARITY_PIXEL_SIZE: Record<number, number> = {
  [Rarity.Worn]:      8,
  [Rarity.Common]:    6,
  [Rarity.Uncommon]:  5,
  [Rarity.Rare]:      4,
  [Rarity.Epic]:      3,
  [Rarity.Legendary]: 3,
};

// ---------------------------------------------------------------------------
// Tonal palette per rarity
// ---------------------------------------------------------------------------
type TonalLevel = { threshold: number; color: [number, number, number, number] };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function buildPalette(rarity: number, tintHex: string): TonalLevel[] {
  const [r, g, b] = hexToRgb(tintHex);

  switch (rarity) {
    case Rarity.Worn:
    case Rarity.Common:
      return [
        { threshold: 60, color: [r, g, b, 255] },
      ];

    case Rarity.Uncommon:
    case Rarity.Rare:
      return [
        { threshold: 150, color: [r, g, b, 255] },
        { threshold: 40,  color: [Math.floor(r * 0.4), Math.floor(g * 0.4), Math.floor(b * 0.4), 255] },
      ];

    case Rarity.Epic:
      return [
        { threshold: 190, color: [Math.min(255, Math.floor(r * 1.3)), Math.min(255, Math.floor(g * 1.3)), Math.min(255, Math.floor(b * 1.3)), 255] },
        { threshold: 100, color: [r, g, b, 255] },
        { threshold: 35,  color: [Math.floor(r * 0.35), Math.floor(g * 0.35), Math.floor(b * 0.35), 255] },
      ];

    case Rarity.Legendary:
      return [
        { threshold: 170, color: [Math.min(255, Math.floor(r * 1.5)), Math.min(255, Math.floor(g * 1.4)), Math.min(255, Math.floor(b * 1.1)), 255] },
        { threshold: 90,  color: [r, g, b, 255] },
        { threshold: 30,  color: [Math.floor(r * 0.4), Math.floor(g * 0.4), Math.floor(b * 0.4), 255] },
      ];

    default:
      return [{ threshold: 60, color: [r, g, b, 255] }];
  }
}

const RARITY_TINT: Record<number, string> = {
  [Rarity.Worn]:      '#706866',
  [Rarity.Common]:    '#B0A890',
  [Rarity.Uncommon]:  '#5CAA6A',
  [Rarity.Rare]:      '#5A90D0',
  [Rarity.Epic]:      '#9A6AD8',
  [Rarity.Legendary]: '#E8A030',
};

// ---------------------------------------------------------------------------
// Image cache — stores both the element and its full-res pixel data
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();
const pixelDataCache = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();

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

/** Extract full-res pixel data from source image (cached). */
function getSourcePixels(img: HTMLImageElement, src: string): { data: Uint8ClampedArray; w: number; h: number } {
  const cached = pixelDataCache.get(src);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, c.width, c.height);
  const result = { data: imageData.data, w: c.width, h: c.height };
  pixelDataCache.set(src, result);
  return result;
}

// ---------------------------------------------------------------------------
// Max-pool downsampler + posterizer
// ---------------------------------------------------------------------------
function renderMaxPooled(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  src: string,
  rarity: number,
  pixelSize: number,
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const displayW = Math.floor(rect.width);
  const displayH = Math.floor(rect.height);
  if (displayW === 0 || displayH === 0) return;

  const tintHex = RARITY_TINT[rarity] ?? RARITY_TINT[Rarity.Common];
  const palette = buildPalette(rarity, tintHex);

  const gridW = Math.max(4, Math.floor(displayW / pixelSize));
  const gridH = Math.max(4, Math.floor(displayH / pixelSize));

  // Get full-res source pixel data
  const source = getSourcePixels(img, src);
  const srcW = source.w;
  const srcH = source.h;
  const srcData = source.data;

  // Build max-pooled + posterized grid
  const grid = document.createElement('canvas');
  grid.width = gridW;
  grid.height = gridH;
  const gridCtx = grid.getContext('2d')!;
  const output = gridCtx.createImageData(gridW, gridH);
  const out = output.data;

  const blockW = srcW / gridW;
  const blockH = srcH / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      // Find max brightness in this block of the source image
      const srcX0 = Math.floor(gx * blockW);
      const srcY0 = Math.floor(gy * blockH);
      const srcX1 = Math.min(srcW, Math.floor((gx + 1) * blockW));
      const srcY1 = Math.min(srcH, Math.floor((gy + 1) * blockH));

      let maxBrightness = 0;

      // Sample every Nth pixel for performance (stride of 2-4 for large blocks)
      const stride = blockW > 40 ? 4 : blockW > 20 ? 2 : 1;

      for (let sy = srcY0; sy < srcY1; sy += stride) {
        for (let sx = srcX0; sx < srcX1; sx += stride) {
          const si = (sy * srcW + sx) * 4;
          const brightness = srcData[si] * 0.299 + srcData[si + 1] * 0.587 + srcData[si + 2] * 0.114;
          if (brightness > maxBrightness) maxBrightness = brightness;
        }
      }

      // Posterize: map max brightness to palette
      const oi = (gy * gridW + gx) * 4;
      let matched = false;
      for (const level of palette) {
        if (maxBrightness >= level.threshold) {
          out[oi]     = level.color[0];
          out[oi + 1] = level.color[1];
          out[oi + 2] = level.color[2];
          out[oi + 3] = level.color[3];
          matched = true;
          break;
        }
      }
      if (!matched) {
        out[oi] = 0;
        out[oi + 1] = 0;
        out[oi + 2] = 0;
        out[oi + 3] = 255;
      }
    }
  }

  gridCtx.putImageData(output, 0, 0);

  // Scale up with nearest-neighbor
  canvas.width = displayW * dpr;
  canvas.height = displayH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grid, 0, 0, displayW, displayH);
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
  const pixelSize = RARITY_PIXEL_SIZE[rarity] ?? RARITY_PIXEL_SIZE[Rarity.Common];
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);

  useEffect(() => {
    loadImage(imageSrc)
      .then(img => {
        setLoaded(true);
        if (canvasRef.current) {
          renderMaxPooled(canvasRef.current, img, imageSrc, rarity, pixelSize);
        }
      })
      .catch(() => {});
  }, [imageSrc, rarity, pixelSize]);

  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imageCache.get(imageSrc);
    if (img) renderMaxPooled(canvasRef.current, img, imageSrc, rarity, pixelSize);
  }, [loaded, imageSrc, rarity, pixelSize]);

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
