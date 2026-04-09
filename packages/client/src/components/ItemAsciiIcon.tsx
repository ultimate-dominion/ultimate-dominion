/**
 * ItemAsciiIcon — Threshold-Dilate-Downsample pixel art icons.
 *
 * Pipeline (runs once per image, cached):
 * 1. Otsu threshold at full resolution → binary (ink ON / OFF)
 * 2. Morphological dilation (3x3 cross) → thickens thin features
 * 3. Block coverage downsample → count ON pixels per grid cell
 * 4. Posterize coverage to rarity tonal palette → crisp pixel art
 *
 * Why this works: binarizing at 1008px preserves features that bilinear
 * averaging destroys. A 1px sword blade is ON at full res, dilation makes
 * it 3px wide, and it survives the 80:1 block average. Max-pooling picked
 * up noise; averaging lost detail; this approach does neither.
 *
 * Rarity controls both pixel size AND tonal depth.
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
type TonalLevel = { minCoverage: number; color: [number, number, number, number] };

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
      // 2-color: black + full tint. Any cell with >8% ink coverage lights up.
      return [
        { minCoverage: 0.08, color: [r, g, b, 255] },
      ];

    case Rarity.Uncommon:
    case Rarity.Rare:
      // 3-color: black + dark shade + bright
      return [
        { minCoverage: 0.50, color: [r, g, b, 255] },
        { minCoverage: 0.08, color: [Math.floor(r * 0.45), Math.floor(g * 0.45), Math.floor(b * 0.45), 255] },
      ];

    case Rarity.Epic:
      // 4-color: black + shadow + mid + highlight
      return [
        { minCoverage: 0.65, color: [Math.min(255, Math.floor(r * 1.3)), Math.min(255, Math.floor(g * 1.3)), Math.min(255, Math.floor(b * 1.3)), 255] },
        { minCoverage: 0.30, color: [r, g, b, 255] },
        { minCoverage: 0.06, color: [Math.floor(r * 0.35), Math.floor(g * 0.35), Math.floor(b * 0.35), 255] },
      ];

    case Rarity.Legendary:
      // 4-color with hotter highlights
      return [
        { minCoverage: 0.60, color: [Math.min(255, Math.floor(r * 1.5)), Math.min(255, Math.floor(g * 1.4)), Math.min(255, Math.floor(b * 1.1)), 255] },
        { minCoverage: 0.25, color: [r, g, b, 255] },
        { minCoverage: 0.05, color: [Math.floor(r * 0.4), Math.floor(g * 0.4), Math.floor(b * 0.4), 255] },
      ];

    default:
      return [{ minCoverage: 0.08, color: [r, g, b, 255] }];
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
// Image + binary mask cache
// ---------------------------------------------------------------------------
const imageCache = new Map<string, HTMLImageElement>();
const binaryCache = new Map<string, { mask: Uint8Array; w: number; h: number }>();

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
// Otsu threshold — finds optimal binary split for white-on-black ink
// ---------------------------------------------------------------------------
function otsuThreshold(data: Uint8ClampedArray, pixelCount: number): number {
  // Build brightness histogram
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[brightness]++;
  }

  // Find threshold that maximizes inter-class variance
  let bestThreshold = 0;
  let bestVariance = 0;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * histogram[i];

  let sumBg = 0;
  let weightBg = 0;

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;
    const weightFg = pixelCount - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumTotal - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);

    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

// ---------------------------------------------------------------------------
// Build dilated binary mask from source image (cached per src)
// ---------------------------------------------------------------------------
function getBinaryMask(img: HTMLImageElement, src: string): { mask: Uint8Array; w: number; h: number } {
  const cached = binaryCache.get(src);
  if (cached) return cached;

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Extract pixel data
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Otsu threshold → binary
  const threshold = otsuThreshold(data, w * h);
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < binary.length; i++) {
    const brightness = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    binary[i] = brightness > threshold ? 1 : 0;
  }

  // Morphological dilation with 3x3 cross structuring element
  // This thickens thin features by 1px in each cardinal direction
  const dilated = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (binary[idx] === 1) {
        dilated[idx] = 1;
        continue;
      }
      // Check 3x3 cross neighbors
      if (
        (x > 0 && binary[idx - 1] === 1) ||
        (x < w - 1 && binary[idx + 1] === 1) ||
        (y > 0 && binary[idx - w] === 1) ||
        (y < h - 1 && binary[idx + w] === 1)
      ) {
        dilated[idx] = 1;
      }
    }
  }

  const result = { mask: dilated, w, h };
  binaryCache.set(src, result);
  return result;
}

// ---------------------------------------------------------------------------
// Coverage-ratio downsampler + posterizer
// ---------------------------------------------------------------------------
function renderCoverage(
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

  // Get pre-computed dilated binary mask
  const { mask, w: srcW, h: srcH } = getBinaryMask(img, src);

  const blockW = srcW / gridW;
  const blockH = srcH / gridH;

  // Build posterized grid from coverage ratios
  const grid = document.createElement('canvas');
  grid.width = gridW;
  grid.height = gridH;
  const gridCtx = grid.getContext('2d')!;
  const output = gridCtx.createImageData(gridW, gridH);
  const out = output.data;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const srcX0 = Math.floor(gx * blockW);
      const srcY0 = Math.floor(gy * blockH);
      const srcX1 = Math.min(srcW, Math.floor((gx + 1) * blockW));
      const srcY1 = Math.min(srcH, Math.floor((gy + 1) * blockH));

      // Count ON pixels in this block
      let onCount = 0;
      let totalCount = 0;

      // Stride for performance on large blocks
      const stride = blockW > 40 ? 3 : blockW > 20 ? 2 : 1;

      for (let sy = srcY0; sy < srcY1; sy += stride) {
        for (let sx = srcX0; sx < srcX1; sx += stride) {
          totalCount++;
          if (mask[sy * srcW + sx] === 1) onCount++;
        }
      }

      const coverage = totalCount > 0 ? onCount / totalCount : 0;

      // Map coverage to palette (highest coverage threshold first)
      const oi = (gy * gridW + gx) * 4;
      let matched = false;
      for (const level of palette) {
        if (coverage >= level.minCoverage) {
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
          renderCoverage(canvasRef.current, img, imageSrc, rarity, pixelSize);
        }
      })
      .catch(() => {});
  }, [imageSrc, rarity, pixelSize]);

  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imageCache.get(imageSrc);
    if (img) renderCoverage(canvasRef.current, img, imageSrc, rarity, pixelSize);
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
