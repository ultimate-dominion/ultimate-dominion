// UD torchlit dungeon palette — canvas rendering constants
// Mirrors packages/client/src/utils/theme.ts values for canvas context

export const COLORS = {
  bg: '#12100E',
  bgSecondary: '#14120F',
  bgCard: '#1C1814',
  bgPanel: '#24201A',
  bgHover: '#2E2820',
  textPrimary: '#E8DCC8',
  textBody: '#C4B89E',
  textMuted: '#8A7E6A',
  textHeading: '#E8DCC8',
  amber: '#C87A2A',
  glow: '#E8A840',
  success: '#5A8A3E',
  danger: '#B83A2A',
  border: '#3A3228',
  rarityWorn: '#8a8a8a',
  rarityCommon: '#C4B89E',
  rarityUncommon: '#3d8a4e',
  rarityRare: '#3d6fb5',
  rarityEpic: '#7b4ab5',
  rarityLegendary: '#c47a2a',
} as const;

// Font families — use named fonts, never system-ui (macOS canvas/DOM mismatch)
export const FONTS = {
  serif: 'Cormorant Garamond',
  heading: 'Cinzel',
  mono: 'Fira Code',
  ui: 'Inter',
} as const;

// CSS font strings for Pretext prepare()
export function fontString(
  family: keyof typeof FONTS,
  size: number,
  weight: number = 400,
  style: 'normal' | 'italic' = 'normal',
): string {
  const parts: string[] = [];
  if (style === 'italic') parts.push('italic');
  if (weight !== 400) parts.push(String(weight));
  parts.push(`${size}px`);
  parts.push(FONTS[family]);
  return parts.join(' ');
}

// Rarity color lookup
export function rarityColor(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case 'worn': return COLORS.rarityWorn;
    case 'common': return COLORS.rarityCommon;
    case 'uncommon': return COLORS.rarityUncommon;
    case 'rare': return COLORS.rarityRare;
    case 'epic': return COLORS.rarityEpic;
    case 'legendary': return COLORS.rarityLegendary;
    default: return COLORS.textBody;
  }
}
