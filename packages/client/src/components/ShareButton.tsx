import { HStack, IconButton, Text, Tooltip, useClipboard } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { FaCheck, FaCopy, FaDownload } from 'react-icons/fa';
import { FaShareNodes } from 'react-icons/fa6';

const GAME_URL = 'https://ultimatedominion.com';
const HASHTAG = '#UltimateDominion';

// Card dimensions (Twitter recommends 1200x675 for inline images)
const CARD_W = 1200;
const CARD_H = 675;

type ShareButtonProps = {
  /** Pre-filled share text (URL + hashtag appended automatically) */
  text: string;
  /** Query params for the /s share page (drives OG meta). If omitted, shares the base game URL. */
  shareParams?: Record<string, string>;
  /** Path to the game image to embed in the share card (e.g. /images/monsters/basilisk.webp) */
  imageSrc?: string;
  /** Accent color for the buttons and card highlight (defaults to muted gold) */
  colorAccent?: string;
};

function buildShareUrl(params?: Record<string, string>): string {
  if (!params) return GAME_URL;
  const qs = new URLSearchParams(params).toString();
  return `${GAME_URL}/s?${qs}`;
}

/** Load an image from a URL and return it when ready */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Render a branded share card on a canvas and return as Blob */
async function renderShareCard(
  title: string,
  subtitle: string,
  imageSrc?: string,
  accentColor = '#D4A54A',
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0A0908';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle radial gradient
  const grad = ctx.createRadialGradient(CARD_W * 0.65, CARD_H * 0.5, 0, CARD_W * 0.65, CARD_H * 0.5, 500);
  grad.addColorStop(0, '#1A1510');
  grad.addColorStop(1, '#0A0908');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Game image (right side)
  if (imageSrc) {
    try {
      const img = await loadImage(imageSrc);
      const maxSize = 420;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = CARD_W - w - 60;
      const y = (CARD_H - h) / 2;

      // Draw with slight transparency
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, x, y, w, h);
      ctx.globalAlpha = 1;

      // Left fade over the image
      const fadeGrad = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
      fadeGrad.addColorStop(0, '#0A0908');
      fadeGrad.addColorStop(1, 'rgba(10, 9, 8, 0)');
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(x - 80, 0, 160, CARD_H);
    } catch {
      // Image failed to load — continue without it
    }
  }

  // Accent line (left border)
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 4, CARD_H);

  // Title text
  ctx.fillStyle = '#E8DCC8';
  ctx.font = 'bold 52px serif';
  ctx.textBaseline = 'middle';
  const titleLines = wrapText(ctx, title, 620);
  const titleStartY = CARD_H / 2 - (titleLines.length * 62) / 2 - 20;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 60, titleStartY + i * 62);
  });

  // Subtitle / label
  ctx.fillStyle = accentColor;
  ctx.font = '18px sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(subtitle.toUpperCase(), 60, titleStartY - 36);

  // Bottom branding
  ctx.fillStyle = '#5A5347';
  ctx.font = '18px sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('ultimatedominion.com', 60, CARD_H - 40);

  // Bottom accent line
  ctx.fillStyle = accentColor + '30';
  ctx.fillRect(0, CARD_H - 3, CARD_W, 3);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

/** Word-wrap text to fit within maxWidth */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/** Map share type to a human label for the card */
function getCardSubtitle(params?: Record<string, string>): string {
  if (!params) return 'Ultimate Dominion';
  switch (params.type) {
    case 'kill': return 'Monster Slain';
    case 'pvp': return 'PvP Victory';
    case 'drop': return `${params.rarity ? (['Worn', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][Number(params.rarity)] || '') + ' ' : ''}Item Found`;
    case 'levelup': return 'Level Up';
    case 'fragment': return `Fragment ${params.num || ''} of 8`;
    case 'class': return 'Advanced Class Chosen';
    default: return 'Ultimate Dominion';
  }
}

export const ShareButton = ({
  text,
  shareParams,
  imageSrc,
  colorAccent = '#8A7E6A',
}: ShareButtonProps): JSX.Element => {
  const shareUrl = buildShareUrl(shareParams);
  const fullText = `${text}\n\n${shareUrl}\n\n${HASHTAG}`;
  const { hasCopied, onCopy } = useClipboard(fullText);
  const [isGenerating, setIsGenerating] = useState(false);

  /** Generate the card image and share/download it */
  const handleShare = useCallback(async () => {
    setIsGenerating(true);
    try {
      const subtitle = getCardSubtitle(shareParams);
      const blob = await renderShareCard(text, subtitle, imageSrc, colorAccent);
      const file = new File([blob], 'ultimate-dominion.png', { type: 'image/png' });

      // Try native share with image (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          text: `${text}\n\n${shareUrl}\n\n${HASHTAG}`,
          files: [file],
        });
        return;
      }

      // Desktop fallback: download image + copy text
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ultimate-dominion.png';
      a.click();
      URL.revokeObjectURL(url);

      // Also copy the share text so they can paste it with the image
      try {
        await navigator.clipboard.writeText(fullText);
      } catch {
        // Clipboard may not be available
      }
    } catch {
      // Fallback: just open X intent without image
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(fullText)}`,
        '_blank',
        'noopener',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [text, shareParams, imageSrc, colorAccent, shareUrl, fullText]);

  return (
    <HStack spacing={1}>
      <Tooltip label="Share with image" placement="top" hasArrow>
        <IconButton
          aria-label="Share"
          icon={<FaShareNodes />}
          onClick={handleShare}
          isLoading={isGenerating}
          variant="ghost"
          size="xs"
          color={colorAccent}
          _hover={{ color: '#E8DCC8', bg: `${colorAccent}20` }}
        />
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied!' : 'Copy text'} placement="top" hasArrow>
        <IconButton
          aria-label="Copy to clipboard"
          icon={hasCopied ? <FaCheck /> : <FaCopy />}
          onClick={onCopy}
          variant="ghost"
          size="xs"
          color={hasCopied ? '#5A8A3E' : colorAccent}
          _hover={{ color: '#E8DCC8', bg: `${colorAccent}20` }}
        />
      </Tooltip>
      {hasCopied && (
        <Text fontSize="9px" color="#5A8A3E" fontFamily="mono">
          Copied!
        </Text>
      )}
    </HStack>
  );
};
