import { Text, type TextProps } from '@chakra-ui/react';
import { COLORS } from '../theme';

function threatToWeight(threat: number): number {
  if (threat <= 2) return 300;
  if (threat <= 4) return 400;
  if (threat <= 6) return 500;
  if (threat <= 8) return 600;
  return 700;
}

function threatToColor(threat: number): string {
  if (threat <= 2) return COLORS.textMuted;
  if (threat <= 4) return COLORS.textBody;
  if (threat <= 6) return COLORS.textPrimary;
  if (threat <= 8) return COLORS.amber;
  return COLORS.danger;
}

function threatToGlow(threat: number): string | undefined {
  if (threat <= 6) return undefined;
  if (threat <= 8) return `0 0 8px ${COLORS.amber}`;
  return `0 0 20px ${COLORS.danger}`;
}

/**
 * Renders a monster name where font weight, color, and glow encode threat level.
 * Threat 1-2: light gray, weight 300. Threat 9-10: red, weight 700, glow.
 */
export function ThreatWeightedName({
  name,
  threat,
  defeated,
  ...textProps
}: {
  name: string;
  threat: number;
  defeated?: boolean;
} & Omit<TextProps, 'children'>) {
  const clampedThreat = Math.max(1, Math.min(10, threat));

  return (
    <Text
      fontFamily="Cinzel, serif"
      fontWeight={threatToWeight(clampedThreat)}
      color={defeated ? COLORS.textMuted : threatToColor(clampedThreat)}
      textShadow={defeated ? undefined : threatToGlow(clampedThreat)}
      opacity={defeated ? 0.5 : 1}
      transition="all 0.3s"
      {...textProps}
    >
      {name}
    </Text>
  );
}
