/**
 * ItemAsciiIcon — Displays item art tinted by rarity color.
 *
 * Loads the WebP illustration (white ink on black) and applies a canvas
 * multiply blend with the rarity color so white→rarity color, black→black.
 * Common items render dim gray, Legendaries glow gold. Each tier is
 * instantly recognizable.
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
// Tinted canvas renderer
// ---------------------------------------------------------------------------
function renderTinted(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  tintColor: string,
  sizePx?: number,
) {
  const dpr = window.devicePixelRatio || 1;
  // Use provided size to avoid getBoundingClientRect layout thrash
  let w: number, h: number;
  if (sizePx && sizePx > 0) {
    w = sizePx;
    h = sizePx;
  } else {
    const rect = canvas.getBoundingClientRect();
    w = Math.floor(rect.width);
    h = Math.floor(rect.height);
  }
  if (w === 0 || h === 0) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Draw original white-on-black image
  ctx.drawImage(img, 0, 0, w, h);

  // Multiply blend: white * color = color, black * color = black
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tintColor;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
// Parse pixel size from string prop (e.g. '40px' → 40)
function parsePxSize(size: string | Record<string, string>): number | undefined {
  if (typeof size !== 'string') return undefined;
  const m = size.match(/^(\d+)px$/);
  return m ? parseInt(m[1], 10) : undefined;
}

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
  const rarityAnimation = getRarityAnimation(rarity);
  const rarityBorderColor = getRarityColor(rarity);
  const pxSize = parsePxSize(size);

  useEffect(() => {
    loadImage(imageSrc)
      .then(img => {
        setLoaded(true);
        if (canvasRef.current) {
          renderTinted(canvasRef.current, img, tintColor, pxSize);
        }
      })
      .catch(() => {});
  }, [imageSrc, tintColor, pxSize]);

  // Re-render when canvas mounts after image is already cached
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imageCache.get(imageSrc);
    if (img) renderTinted(canvasRef.current, img, tintColor, pxSize);
  }, [loaded, imageSrc, tintColor, pxSize]);

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
