/**
 * ItemAsciiIcon — Posterized pixel art icons with rarity-driven detail.
 *
 * Higher rarity = smaller pixels + more tonal levels.
 * Worn/Common: 2-color (black + tint) — bold and crude.
 * Uncommon/Rare: 3-color (black + dark shade + bright) — depth emerges.
 * Epic/Legendary: 4-color (black + shadow + mid + highlight) — rich detail.
 *
 * Posterization prevents the muddy-gradient problem that multiply blend
 * creates on downsampled images. Every pixel snaps to a defined tone.
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
// Rarity → tonal palette (posterization levels)
// Each entry is [threshold, [r, g, b, a]] — pixels above threshold get that color.
// Evaluated top-to-bottom; first match wins. Below all thresholds → black.
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
      // 2-color: black + full tint
      return [
        { threshold: 80, color: [r, g, b, 255] },
      ];

    case Rarity.Uncommon:
    case Rarity.Rare:
      // 3-color: black + dark shade + bright
      return [
        { threshold: 160, color: [r, g, b, 255] },
        { threshold: 60,  color: [Math.floor(r * 0.45), Math.floor(g * 0.45), Math.floor(b * 0.45), 255] },
      ];

    case Rarity.Epic:
      // 4-color: black + shadow + mid + highlight
      return [
        { threshold: 200, color: [Math.min(255, Math.floor(r * 1.3)), Math.min(255, Math.floor(g * 1.3)), Math.min(255, Math.floor(b * 1.3)), 255] },
        { threshold: 120, color: [r, g, b, 255] },
        { threshold: 50,  color: [Math.floor(r * 0.35), Math.floor(g * 0.35), Math.floor(b * 0.35), 255] },
      ];

    case Rarity.Legendary:
      // 4-color + brighter highlight for that legendary glow
      return [
        { threshold: 180, color: [Math.min(255, Math.floor(r * 1.5)), Math.min(255, Math.floor(g * 1.4)), Math.min(255, Math.floor(b * 1.1)), 255] },
        { threshold: 110, color: [r, g, b, 255] },
        { threshold: 45,  color: [Math.floor(r * 0.4), Math.floor(g * 0.4), Math.floor(b * 0.4), 255] },
      ];

    default:
      return [{ threshold: 80, color: [r, g, b, 255] }];
  }
}

// ---------------------------------------------------------------------------
// Rarity tint hex values
// ---------------------------------------------------------------------------
const RARITY_TINT: Record<number, string> = {
  [Rarity.Worn]:      '#706866',
  [Rarity.Common]:    '#B0A890',
  [Rarity.Uncommon]:  '#5CAA6A',
  [Rarity.Rare]:      '#5A90D0',
  [Rarity.Epic]:      '#9A6AD8',
  [Rarity.Legendary]: '#E8A030',
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
// Posterized pixel renderer
// ---------------------------------------------------------------------------
function renderPosterized(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  rarity: number,
  pixelSize: number,
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (w === 0 || h === 0) return;

  const tintHex = RARITY_TINT[rarity] ?? RARITY_TINT[Rarity.Common];
  const palette = buildPalette(rarity, tintHex);

  // Grid resolution
  const gridW = Math.max(4, Math.floor(w / pixelSize));
  const gridH = Math.max(4, Math.floor(h / pixelSize));

  // Step 1: Downsample source to tiny canvas
  const tiny = document.createElement('canvas');
  tiny.width = gridW;
  tiny.height = gridH;
  const tinyCtx = tiny.getContext('2d');
  if (!tinyCtx) return;

  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.imageSmoothingQuality = 'medium';
  tinyCtx.drawImage(img, 0, 0, gridW, gridH);

  // Step 2: Posterize — snap each pixel to palette based on brightness
  const imageData = tinyCtx.getImageData(0, 0, gridW, gridH);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance from the white-on-black source
    const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Find matching palette level (highest threshold first)
    let matched = false;
    for (const level of palette) {
      if (brightness >= level.threshold) {
        data[i]     = level.color[0];
        data[i + 1] = level.color[1];
        data[i + 2] = level.color[2];
        data[i + 3] = level.color[3];
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Below all thresholds → black
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }

  tinyCtx.putImageData(imageData, 0, 0);

  // Step 3: Scale up with nearest-neighbor
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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
  const pixelSize = RARITY_PIXEL_SIZE[rarity] ?? RARITY_PIXEL_SIZE[Rarity.Common];
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);

  useEffect(() => {
    loadImage(imageSrc)
      .then(img => {
        setLoaded(true);
        if (canvasRef.current) {
          renderPosterized(canvasRef.current, img, rarity, pixelSize);
        }
      })
      .catch(() => {});
  }, [imageSrc, rarity, pixelSize]);

  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imageCache.get(imageSrc);
    if (img) renderPosterized(canvasRef.current, img, rarity, pixelSize);
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
