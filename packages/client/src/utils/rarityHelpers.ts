import { keyframes } from '@chakra-ui/react';

import { Rarity, RARITY_COLORS, RARITY_NAMES } from './types';

export const getRarityColor = (rarity?: Rarity): string => {
  if (rarity === undefined) return RARITY_COLORS[Rarity.Common];
  return RARITY_COLORS[rarity];
};

export const getRarityName = (rarity?: Rarity): string => {
  if (rarity === undefined) return RARITY_NAMES[Rarity.Common];
  return RARITY_NAMES[rarity];
};

export const getRarityGlow = (rarity?: Rarity): string => {
  const color = getRarityColor(rarity);
  if (rarity === Rarity.Rare) {
    return `0 0 8px ${color}40, 0 0 16px ${color}20`;
  }
  if (rarity === Rarity.Uncommon) {
    return `0 0 6px ${color}30, 0 0 12px ${color}15`;
  }
  return 'none';
};

const epicBreathing = (color: string) => keyframes`
  0%, 100% {
    box-shadow: 0 0 6px ${color}30, 0 0 12px ${color}15;
  }
  50% {
    box-shadow: 0 0 10px ${color}60, 0 0 20px ${color}30;
  }
`;

const legendaryBreathing = (color: string) => keyframes`
  0%, 100% {
    box-shadow: 0 0 8px ${color}50, 0 0 18px ${color}25, 0 0 30px ${color}10;
  }
  50% {
    box-shadow: 0 0 14px ${color}80, 0 0 28px ${color}45, 0 0 42px ${color}20;
  }
`;

const uncommonBreathing = (color: string) => keyframes`
  0%, 100% {
    box-shadow: 0 0 4px ${color}20, 0 0 8px ${color}10;
  }
  50% {
    box-shadow: 0 0 8px ${color}40, 0 0 14px ${color}20;
  }
`;

export const getRarityAnimation = (rarity?: Rarity): string | undefined => {
  const color = getRarityColor(rarity);
  if (rarity === Rarity.Legendary) {
    return `${legendaryBreathing(color)} 2.5s ease-in-out infinite`;
  }
  if (rarity === Rarity.Epic) {
    return `${epicBreathing(color)} 3s ease-in-out infinite`;
  }
  if (rarity === Rarity.Uncommon) {
    return `${uncommonBreathing(color)} 3.5s ease-in-out infinite`;
  }
  return undefined;
};
