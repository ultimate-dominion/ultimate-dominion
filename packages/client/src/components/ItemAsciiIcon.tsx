/**
 * ItemAsciiIcon — Items rendered through the MonsterAsciiRenderer.
 *
 * Same pipeline that makes creatures look incredible: GLB → toon shade →
 * area-averaged color sampling → edge detection → half-block interior →
 * rim lighting → glow. Rendered at oversized resolution then compressed.
 *
 * Epic+ items with GLB models animate: slow Y-axis rotation re-rendered
 * every ~250ms for a living 3D-in-ASCII feel.
 *
 * For items without GLB models, falls back to WebP → same renderer.
 * For items without any art, falls back to emoji.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';

import { getEmoji, removeEmoji } from '../utils/helpers';
import { getConsumableEmoji, getItemImage } from '../utils/itemImages';
import { getRarityAnimation, getRarityColor } from '../utils/rarityHelpers';
import { ItemType, Rarity } from '../utils/types';
import {
  itemSlug,
  loadItemModel,
  getItemDrawFn,
  isItemModelReady,
  loadItemManifest,
  setItemRotation,
} from './pretext/game/glbItemLoader';
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
// Rarity → cellSize
// ---------------------------------------------------------------------------
const RARITY_CELL_SIZE: Record<number, number> = {
  [Rarity.Worn]:      5,
  [Rarity.Common]:    4,
  [Rarity.Uncommon]:  3,
  [Rarity.Rare]:      3,
  [Rarity.Epic]:      3,
  [Rarity.Legendary]: 3,
};

// Render at larger size then display smaller for density.
const RARITY_RENDER_SCALE: Record<number, number> = {
  [Rarity.Worn]:      2,
  [Rarity.Common]:    2,
  [Rarity.Uncommon]:  3,
  [Rarity.Rare]:      3,
  [Rarity.Epic]:      4,
  [Rarity.Legendary]: 4,
};

// ---------------------------------------------------------------------------
// Rarity tint RGB for WebP fallback draw function
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
// Caches
// ---------------------------------------------------------------------------
const iconCache = new Map<string, HTMLCanvasElement>();
const renderPromises = new Map<string, Promise<HTMLCanvasElement | null>>();

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

function makeWebPDrawFn(
  img: HTMLImageElement,
  tint: [number, number, number],
): (ctx: CanvasRenderingContext2D, w: number, h: number) => void {
  return (ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  };
}

// ---------------------------------------------------------------------------
// Template builder (shared between static and animated paths)
// ---------------------------------------------------------------------------
function buildItemTemplate(
  slug: string,
  cleanName: string,
  rarity: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): MonsterTemplate {
  return {
    id: `item-icon:${slug}:${rarity}`,
    name: cleanName,
    gridWidth: 1,
    gridHeight: 1,
    monsterClass: 0,
    level: 1,
    dynamic: true,
    renderOverrides: {
      gamma: 0.35,
      ambient: 0.95,
      brightnessBoost: 2.5,
      charDensityFloor: 0.15,
    },
    draw: drawFn,
  };
}

// ---------------------------------------------------------------------------
// Static render (cached, for Worn–Rare or WebP fallback)
// ---------------------------------------------------------------------------
async function renderItemIcon(
  name: string,
  rarity: number,
  displaySize: number,
): Promise<HTMLCanvasElement | null> {
  const cacheKey = `${name}:${rarity}:${displaySize}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

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
  const renderScale = RARITY_RENDER_SCALE[rarity] ?? 2;
  const renderSize = displaySize * renderScale;

  let drawFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null;

  const manifest = await loadItemManifest();
  if (manifest[slug]) {
    await loadItemModel(slug);
    if (isItemModelReady(slug)) {
      drawFn = getItemDrawFn(slug);
    }
  }

  if (!drawFn) {
    const webpSrc = getItemImage(cleanName);
    if (webpSrc) {
      const img = await loadWebPImage(webpSrc).catch(() => null);
      if (img) drawFn = makeWebPDrawFn(img, tint);
    }
  }

  if (!drawFn) return null;

  const template = buildItemTemplate(slug, cleanName, rarity, drawFn);

  const canvas = document.createElement('canvas');
  canvas.width = renderSize;
  canvas.height = renderSize;
  const ctx = canvas.getContext('2d')!;

  renderMonster(ctx, template, 0, 0, renderSize, renderSize, {
    cellSize,
    enable3D: false,
    enableBgFill: true,
    enableHalfBlock: true,
    enableGlow: rarity >= Rarity.Rare,
    elapsed: 0,
    alpha: 1,
  });

  iconCache.set(cacheKey, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// Animated component for Epic+ GLB items — slow rotation
// ---------------------------------------------------------------------------
const ANIM_INTERVAL = 250; // ms between re-renders
const ROTATION_SPEED = 0.003; // radians per ms — full turn in ~2s

const AnimatedItemIcon = memo(({
  name,
  rarity,
  size,
}: {
  name: string;
  rarity: number;
  size: string | Record<string, string>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const readyRef = useRef(false);
  const slugRef = useRef('');
  const templateRef = useRef<MonsterTemplate | null>(null);

  const displaySize = typeof size === 'string' ? parseInt(size, 10) || 48 : 48;
  const cellSize = RARITY_CELL_SIZE[rarity] ?? 3;
  const renderScale = RARITY_RENDER_SCALE[rarity] ?? 4;
  const renderSize = displaySize * renderScale;
  const rarityBorderColor = getRarityColor(rarity);

  const cleanName = removeEmoji(name);
  const slug = itemSlug(cleanName);

  // Load GLB model on mount
  useEffect(() => {
    let cancelled = false;
    slugRef.current = slug;

    async function init() {
      const manifest = await loadItemManifest();
      if (cancelled || !manifest[slug]) return;
      await loadItemModel(slug);
      if (cancelled || !isItemModelReady(slug)) return;

      const drawFn = getItemDrawFn(slug);
      if (!drawFn) return;

      templateRef.current = buildItemTemplate(slug, cleanName, rarity, drawFn);
      readyRef.current = true;
    }

    init();
    return () => { cancelled = true; };
  }, [slug, cleanName, rarity]);

  // Animation loop — re-render with slow rotation every ANIM_INTERVAL
  const renderFrame = useCallback(() => {
    if (!readyRef.current || !canvasRef.current || !templateRef.current) return;

    const now = performance.now();
    const yRotation = now * ROTATION_SPEED;

    // Rotate the GLB model
    setItemRotation(slugRef.current, 0, yRotation);

    const canvas = canvasRef.current;
    canvas.width = renderSize;
    canvas.height = renderSize;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, renderSize, renderSize);

    renderMonster(ctx, templateRef.current, 0, 0, renderSize, renderSize, {
      cellSize,
      enable3D: false,
      enableBgFill: true,
      enableHalfBlock: true,
      enableGlow: true,
      elapsed: now,
      alpha: 1,
    });
  }, [renderSize, cellSize]);

  useEffect(() => {
    let lastRender = 0;
    let frameId: number;

    function tick() {
      const now = performance.now();
      if (now - lastRender >= ANIM_INTERVAL) {
        renderFrame();
        lastRender = now;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [renderFrame]);

  const glowFilter = `drop-shadow(0 0 ${rarity >= Rarity.Legendary ? '6px' : '4px'} ${rarityBorderColor}80)`;

  return (
    <Box
      boxSize={size}
      flexShrink={0}
      position="relative"
      animation={getRarityAnimation(rarity)}
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

AnimatedItemIcon.displayName = 'AnimatedItemIcon';

// ---------------------------------------------------------------------------
// Static component (Worn–Rare, or no GLB)
// ---------------------------------------------------------------------------
const StaticItemIcon = memo(({
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
  const rarityBorderColor = getRarityColor(rarity);

  const displaySize = typeof size === 'string' ? parseInt(size, 10) || 48 : 48;

  useEffect(() => {
    let cancelled = false;
    renderItemIcon(name, rarity, displaySize).then(result => {
      if (!cancelled && result) setIconCanvas(result);
    });
    return () => { cancelled = true; };
  }, [name, rarity, displaySize]);

  useEffect(() => {
    if (!iconCanvas || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = iconCanvas.width;
    canvas.height = iconCanvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(iconCanvas, 0, 0);
  }, [iconCanvas]);

  const glowFilter = rarity >= Rarity.Epic
    ? `drop-shadow(0 0 4px ${rarityBorderColor}80)`
    : rarity >= Rarity.Rare
      ? `drop-shadow(0 0 3px ${rarityBorderColor}50)`
      : undefined;

  return (
    <Box
      boxSize={size}
      flexShrink={0}
      position="relative"
      animation={getRarityAnimation(rarity)}
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

StaticItemIcon.displayName = 'StaticItemIcon';

// ---------------------------------------------------------------------------
// Entry point — routes to animated or static based on rarity
// ---------------------------------------------------------------------------
const ItemAsciiIconInner = ({ name, itemType, rarity = 0, size = '40px' }: Props) => {
  const cleanName = removeEmoji(name);
  const imageSrc = getItemImage(cleanName);

  if (itemType === ItemType.Weapon || itemType === ItemType.Armor || imageSrc) {
    // Epic+ items with potential GLB models get the animated treatment
    if (rarity >= Rarity.Epic) {
      return <AnimatedItemIcon name={name} rarity={rarity} size={size} />;
    }
    return <StaticItemIcon name={name} rarity={rarity} size={size} />;
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
