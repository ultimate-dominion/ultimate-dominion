import { Box, HStack, Text, Tooltip, VStack } from '@chakra-ui/react';
import {
  GiCrossedSwords,
  GiCrownedSkull,
  GiScrollQuill,
  GiLaurelsTrophy,
} from 'react-icons/gi';
import type { Badge, BadgeType } from '../hooks/useBadges';

const BADGE_ICONS: Record<BadgeType, React.ElementType> = {
  adventurer: GiCrossedSwords,
  founder: GiLaurelsTrophy,
  zone_conqueror: GiCrownedSkull,
  zone_fragment: GiScrollQuill,
};

/**
 * Compact inline badge icons — sits next to character name.
 */
export const BadgeIcons = ({ badges }: { badges: Badge[] }): JSX.Element | null => {
  if (badges.length === 0) return null;

  return (
    <HStack spacing={1}>
      {badges.map((badge) => {
        const Icon = BADGE_ICONS[badge.type];
        return (
          <Tooltip
            bg="#14120F"
            border="1px solid"
            borderColor={badge.color}
            hasArrow
            key={badge.type}
            label={`${badge.label} — ${badge.description}`}
            placement="top"
            shouldWrapChildren
          >
            <Box
              alignItems="center"
              bg={`${badge.color}15`}
              border="1px solid"
              borderColor={`${badge.color}40`}
              borderRadius="4px"
              color={badge.color}
              display="flex"
              h="24px"
              justifyContent="center"
              transition="all 0.2s ease"
              w="24px"
              _hover={{
                bg: `${badge.color}25`,
                borderColor: `${badge.color}80`,
                transform: 'scale(1.1)',
              }}
            >
              <Icon size={14} />
            </Box>
          </Tooltip>
        );
      })}
    </HStack>
  );
};

/**
 * Full badge showcase — displayed on the character profile page.
 * Shows all earned badges with labels and descriptions.
 */
export const BadgeShowcase = ({ badges }: { badges: Badge[] }): JSX.Element => {
  return (
    <VStack align="start" spacing={3} w="100%">
      <Text color="#8A7E6A" fontWeight={600} size="sm" letterSpacing="0.05em" textTransform="uppercase">
        Badges
      </Text>
      {badges.length === 0 ? (
        <Text color="#5A5040" fontStyle="italic" size="sm">
          No badges earned yet
        </Text>
      ) : (
        <HStack spacing={3} flexWrap="wrap">
          {badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.type];
            return (
              <Tooltip
                bg="#14120F"
                border="1px solid"
                borderColor={badge.color}
                hasArrow
                key={badge.type}
                label={badge.description}
                placement="top"
                shouldWrapChildren
              >
                <HStack
                  bg={`${badge.color}10`}
                  border="1px solid"
                  borderColor={`${badge.color}30`}
                  borderRadius="6px"
                  px={3}
                  py={1.5}
                  spacing={2}
                  transition="all 0.2s ease"
                  _hover={{
                    bg: `${badge.color}20`,
                    borderColor: `${badge.color}60`,
                  }}
                >
                  <Box color={badge.color}>
                    <Icon size={16} />
                  </Box>
                  <Text color={badge.color} fontWeight={600} size="sm">
                    {badge.label}
                  </Text>
                </HStack>
              </Tooltip>
            );
          })}
        </HStack>
      )}
    </VStack>
  );
};
