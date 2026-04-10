/**
 * ItemAsciiIcon — GLB-first pixelated item icons.
 *
 * Primary path: render the item's 3D model (GLB) to an offscreen canvas,
 * then run through threshold-dilate-downsample for crisp pixel art.
 * Fallback: WebP illustration (same pipeline).
 *
 * The GLB models have solid geometry that downsamples perfectly — no thin
 * ink lines, no artistic noise, just the weapon's actual shape. This is
 * the same 3D model used in combat and (eventually) equipped on characters.
 *
 * Rarity controls pixel resolution: Worn=8px crude → Epic/Legendary=3px crisp.
 * Rarity color applied via posterized coverage mapping.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';
import { itemSlug, renderItemIconCanvas } from './pretext/game/glbItemLoader';

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
// Rarity tint colors
// ---------------------------------------------------------------------------
const RARITY_TINT: Record<number, string> = {
  [Rarity.Worn]:      '#706866',
  [Rarity.Common]:    '#B0A890',
  [Rarity.Uncommon]:  '#5CAA6A',
  [Rarity.Rare]:      '#5A90D0',
  [Rarity.Epic]:      '#9A6AD8',
  [Rarity.Legendary]: '#E8A030',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ---------------------------------------------------------------------------
// Image source types — GLB canvas or WebP HTMLImageElement
// ---------------------------------------------------------------------------
type ImageSource =
  | { type: 'canvas'; canvas: HTMLCanvasElement }
  | { type: 'image'; img: HTMLImageElement };

const imageCache = new Map<string, HTMLImageElement>();

function loadWebPImage(src: string): Promise<HTMLImageElement> {
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
// Binary mask cache (works for both canvas and image sources)
// ---------------------------------------------------------------------------
const binaryCache = new Map<string, { mask: Uint8Array; w: number; h: number }>();

function otsuThreshold(data: Uint8ClampedArray, pixelCount: number): number {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[brightness]++;
  }

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

function getBinaryMask(source: ImageSource, cacheKey: string): { mask: Uint8Array; w: number; h: number } {
  const cached = binaryCache.get(cacheKey);
  if (cached) return cached;

  let w: number, h: number, data: Uint8ClampedArray;

  if (source.type === 'canvas') {
    w = source.canvas.width;
    h = source.canvas.height;
    const ctx = source.canvas.getContext('2d')!;
    data = ctx.getImageData(0, 0, w, h).data;
  } else {
    w = source.img.naturalWidth;
    h = source.img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(source.img, 0, 0);
    data = ctx.getImageData(0, 0, w, h).data;
  }

  // Otsu threshold → binary
  const threshold = otsuThreshold(data, w * h);
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < binary.length; i++) {
    const brightness = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    binary[i] = brightness > threshold ? 1 : 0;
  }

  // Morphological dilation with 3x3 cross
  const dilated = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (binary[idx] === 1) {
        dilated[idx] = 1;
        continue;
      }
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
  binaryCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Coverage-ratio downsampler + rarity tint
// ---------------------------------------------------------------------------
function renderCoverage(
  canvas: HTMLCanvasElement,
  source: ImageSource,
  cacheKey: string,
  rarity: number,
  pixelSize: number,
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const displayW = Math.floor(rect.width);
  const displayH = Math.floor(rect.height);
  if (displayW === 0 || displayH === 0) return;

  const tintHex = RARITY_TINT[rarity] ?? RARITY_TINT[Rarity.Common];
  const [r, g, b] = hexToRgb(tintHex);

  const gridW = Math.max(4, Math.floor(displayW / pixelSize));
  const gridH = Math.max(4, Math.floor(displayH / pixelSize));

  const { mask, w: srcW, h: srcH } = getBinaryMask(source, cacheKey);

  const blockW = srcW / gridW;
  const blockH = srcH / gridH;

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

      let onCount = 0;
      let totalCount = 0;
      const stride = blockW > 40 ? 3 : blockW > 20 ? 2 : 1;

      for (let sy = srcY0; sy < srcY1; sy += stride) {
        for (let sx = srcX0; sx < srcX1; sx += stride) {
          totalCount++;
          if (mask[sy * srcW + sx] === 1) onCount++;
        }
      }

      const coverage = totalCount > 0 ? onCount / totalCount : 0;
      const oi = (gy * gridW + gx) * 4;

      if (coverage >= 0.08) {
        out[oi]     = r;
        out[oi + 1] = g;
        out[oi + 2] = b;
        out[oi + 3] = 255;
      } else {
        out[oi] = 0;
        out[oi + 1] = 0;
        out[oi + 2] = 0;
        out[oi + 3] = 255;
      }
    }
  }

  gridCtx.putImageData(output, 0, 0);

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
const ItemIconCanvas = memo(({
  name,
  rarity,
  size,
}: {
  name: string;
  rarity: number;
  size: string | Record<string, string>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<ImageSource | null>(null);
  const [cacheKey, setCacheKey] = useState<string>('');
  const pixelSize = RARITY_PIXEL_SIZE[rarity] ?? RARITY_PIXEL_SIZE[Rarity.Common];
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);

  const cleanName = removeEmoji(name);
  const slug = itemSlug(cleanName);

  // Load source: try GLB first, fall back to WebP
  useEffect(() => {
    let cancelled = false;

    async function loadSource() {
      // Try GLB model
      const glbCanvas = await renderItemIconCanvas(slug).catch(() => null);
      if (!cancelled && glbCanvas) {
        setSource({ type: 'canvas', canvas: glbCanvas });
        setCacheKey(`glb:${slug}`);
        return;
      }

      // Fall back to WebP
      const webpSrc = getItemImage(cleanName);
      if (webpSrc) {
        const img = await loadWebPImage(webpSrc).catch(() => null);
        if (!cancelled && img) {
          setSource({ type: 'image', img });
          setCacheKey(`webp:${webpSrc}`);
        }
      }
    }

    loadSource();
    return () => { cancelled = true; };
  }, [slug, cleanName]);

  // Render when source is ready or params change
  useEffect(() => {
    if (!source || !canvasRef.current || !cacheKey) return;
    renderCoverage(canvasRef.current, source, cacheKey, rarity, pixelSize);
  }, [source, cacheKey, rarity, pixelSize]);

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

ItemIconCanvas.displayName = 'ItemIconCanvas';

const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px' }: Props) => {
  const cleanName = removeEmoji(name);
  const imageSrc = getItemImage(cleanName);

  // Use GLB+threshold pipeline for weapons and armor that might have 3D models.
  // Consumables and quest items without models fall back to WebP or emoji.
  if (itemType === ItemType.Weapon || itemType === ItemType.Armor || imageSrc) {
    return (
      <ItemIconCanvas
        name={name}
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
