/**
 * ItemAsciiIcon — Items rendered through the MonsterAsciiRenderer.
 *
 * Same pipeline that makes creatures look incredible: GLB → toon shade →
 * area-averaged color sampling → edge detection → half-block interior →
 * rim lighting → glow. Just renders to a smaller canvas and caches it.
 *
 * For items without GLB models, falls back to WebP → canvas → same renderer.
 * For items without any art, falls back to emoji.
 *
 * Rarity controls cellSize: Worn=8px crude → Epic=3px crisp detail.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';
import { itemSlug, loadItemModel, getItemDrawFn, isItemModelReady, loadItemManifest } from './pretext/game/glbItemLoader';
import { renderMonster } from './pretext/game/MonsterAsciiRenderer';
import type { MonsterTemplate } from './pretext/game/monsterTemplates';

type Props = {
  name: string;
  itemType: ItemType;
  rarity?: number;
  size?: string | Record<string, string>;
  alt?: string;
};

// ---------------------------------------------------------------------------
// Rarity → cellSize (same concept as battle scene, smaller = more detail)
// ---------------------------------------------------------------------------
const RARITY_CELL_SIZE: Record<number, number> = {
  [Rarity.Worn]:      7,
  [Rarity.Common]:    6,
  [Rarity.Uncommon]:  5,
  [Rarity.Rare]:      4,
  [Rarity.Epic]:      3,
  [Rarity.Legendary]: 3,
};

// ---------------------------------------------------------------------------
// Rarity tint RGB for the draw function
// ---------------------------------------------------------------------------
const RARITY_TINT_RGB: Record<number, [number, number, number]> = {
  [Rarity.Worn]:      [112, 104, 102],
  [Rarity.Common]:    [176, 168, 144],
  [Rarity.Uncommon]:  [92, 170, 106],
  [Rarity.Rare]:      [90, 144, 208],
  [Rarity.Epic]:      [154, 106, 216],
  [Rarity.Legendary]: [232, 160, 48],
};

// ---------------------------------------------------------------------------
// Cached rendered icon canvases
// ---------------------------------------------------------------------------
const iconCache = new Map<string, HTMLCanvasElement>();
const renderPromises = new Map<string, Promise<HTMLCanvasElement | null>>();

// WebP image cache
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

/**
 * Build a draw function that renders a WebP image tinted with rarity color.
 * Used as fallback when no GLB model exists.
 */
function makeWebPDrawFn(
  img: HTMLImageElement,
  tint: [number, number, number],
): (ctx: CanvasRenderingContext2D, w: number, h: number) => void {
  return (ctx, w, h) => {
    // Draw image
    ctx.drawImage(img, 0, 0, w, h);
    // Multiply blend with rarity color
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  };
}

/** Render an item icon using the MonsterAsciiRenderer and cache the result. */
async function renderItemIcon(
  name: string,
  rarity: number,
  displaySize: number,
): Promise<HTMLCanvasElement | null> {
  const cacheKey = `${name}:${rarity}:${displaySize}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  // Deduplicate concurrent renders
  const inflight = renderPromises.get(cacheKey);
  if (inflight) return inflight;

  const promise = _renderItemIconInner(name, rarity, displaySize, cacheKey);
  renderPromises.set(cacheKey, promise);
  const result = await promise;
  renderPromises.delete(cacheKey);
  return result;
}

async function _renderItemIconInner(
  name: string,
  rarity: number,
  displaySize: number,
  cacheKey: string,
): Promise<HTMLCanvasElement | null> {
  const cleanName = removeEmoji(name);
  const slug = itemSlug(cleanName);
  const tint = RARITY_TINT_RGB[rarity] ?? RARITY_TINT_RGB[Rarity.Common];
  const cellSize = RARITY_CELL_SIZE[rarity] ?? RARITY_CELL_SIZE[Rarity.Common];

  let drawFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null;

  // Try GLB model first
  const manifest = await loadItemManifest();
  if (manifest[slug]) {
    await loadItemModel(slug);
    if (isItemModelReady(slug)) {
      drawFn = getItemDrawFn(slug);
    }
  }

  // Fall back to WebP
  if (!drawFn) {
    const webpSrc = getItemImage(cleanName);
    if (webpSrc) {
      const img = await loadWebPImage(webpSrc).catch(() => null);
      if (img) {
        drawFn = makeWebPDrawFn(img, tint);
      }
    }
  }

  if (!drawFn) return null;

  // Create a MonsterTemplate that wraps the item's draw function.
  // renderOverrides tuned for small icon rendering (brighter than battle defaults).
  const template: MonsterTemplate = {
    id: `item-icon:${slug}:${rarity}`,
    name: cleanName,
    gridWidth: 1,
    gridHeight: 1,
    monsterClass: 0,
    level: 1,
    dynamic: true,
    renderOverrides: {
      gamma: 0.35,             // aggressive lift — small icons need brightness
      ambient: 0.95,           // near-full ambient — no dark shadows at icon size
      brightnessBoost: 2.5,    // strong boost for template stage
      charDensityFloor: 0.15,  // show characters in dimmer regions
    },
    draw: drawFn,
  };

  // Render using MonsterAsciiRenderer onto an offscreen canvas
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = displaySize * dpr;
  canvas.height = displaySize * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  renderMonster(ctx, template, 0, 0, displaySize, displaySize, {
    cellSize,
    enable3D: false,
    enableBgFill: true,       // fill cell backgrounds for solid body regions
    enableHalfBlock: true,
    enableGlow: rarity >= Rarity.Rare,
    elapsed: 0,
    alpha: 1,
  });

  iconCache.set(cacheKey, canvas);
  return canvas;
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
  const [iconCanvas, setIconCanvas] = useState<HTMLCanvasElement | null>(null);
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);

  // Parse display size from size prop (handle string like "40px")
  const displaySize = typeof size === 'string' ? parseInt(size, 10) || 48 : 48;

  useEffect(() => {
    let cancelled = false;
    renderItemIcon(name, rarity, displaySize).then(result => {
      if (!cancelled && result) setIconCanvas(result);
    });
    return () => { cancelled = true; };
  }, [name, rarity, displaySize]);

  // Paint cached icon canvas onto our visible canvas
  useEffect(() => {
    if (!iconCanvas || !canvasRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(iconCanvas, 0, 0);
  }, [iconCanvas, displaySize]);

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
