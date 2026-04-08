import { Box, HStack, keyframes, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { removeEmoji } from '../utils/helpers';
import { ItemAsciiIcon } from './ItemAsciiIcon';
import {
  type Armor,
  type Consumable,
  ItemType,
  Rarity,
  RARITY_COLORS,
  RARITY_I18N_KEYS,
  type Spell,
  type Weapon,
} from '../utils/types';

type LootItem = Armor | Consumable | Spell | Weapon;

type LootRevealProps = {
  items: LootItem[];
  onItemClick?: (item: LootItem) => void;
};

// --- Keyframes ---

const fadeSlideIn = keyframes`
  0% { opacity: 0; transform: translateY(12px) scale(0.96); }
  60% { opacity: 1; transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const uncommonShimmer = keyframes`
  0% { border-color: ${RARITY_COLORS[Rarity.Uncommon]}40; }
  50% { border-color: ${RARITY_COLORS[Rarity.Uncommon]}90; }
  100% { border-color: ${RARITY_COLORS[Rarity.Uncommon]}40; }
`;

const rarePulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px ${RARITY_COLORS[Rarity.Rare]}30, 0 0 16px ${RARITY_COLORS[Rarity.Rare]}10;
  }
  50% {
    box-shadow: 0 0 16px ${RARITY_COLORS[Rarity.Rare]}60, 0 0 32px ${RARITY_COLORS[Rarity.Rare]}25;
  }
`;

const epicBurst = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.6);
    box-shadow: 0 0 0 0 ${RARITY_COLORS[Rarity.Epic]}00;
  }
  40% {
    opacity: 1;
    transform: scale(1.06);
    box-shadow: 0 0 24px 8px ${RARITY_COLORS[Rarity.Epic]}40, 0 0 48px 16px ${RARITY_COLORS[Rarity.Epic]}15;
  }
  70% {
    transform: scale(0.98);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 12px 4px ${RARITY_COLORS[Rarity.Epic]}30, 0 0 24px 8px ${RARITY_COLORS[Rarity.Epic]}12;
  }
`;

const epicBreathing = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px ${RARITY_COLORS[Rarity.Epic]}30, 0 0 20px ${RARITY_COLORS[Rarity.Epic]}12;
  }
  50% {
    box-shadow: 0 0 18px ${RARITY_COLORS[Rarity.Epic]}55, 0 0 36px ${RARITY_COLORS[Rarity.Epic]}22;
  }
`;

const legendaryReveal = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-2deg);
    box-shadow: 0 0 0 0 ${RARITY_COLORS[Rarity.Legendary]}00;
    filter: brightness(2.5) saturate(0.3);
  }
  30% {
    opacity: 1;
    transform: scale(1.12) rotate(0.5deg);
    box-shadow: 0 0 40px 16px ${RARITY_COLORS[Rarity.Legendary]}50, 0 0 80px 32px ${RARITY_COLORS[Rarity.Legendary]}20;
    filter: brightness(1.5) saturate(1);
  }
  60% {
    transform: scale(0.97) rotate(-0.3deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
    box-shadow: 0 0 20px 8px ${RARITY_COLORS[Rarity.Legendary]}40, 0 0 40px 16px ${RARITY_COLORS[Rarity.Legendary]}15;
    filter: brightness(1) saturate(1);
  }
`;

const legendaryBreathing = keyframes`
  0%, 100% {
    box-shadow:
      0 0 14px ${RARITY_COLORS[Rarity.Legendary]}40,
      0 0 28px ${RARITY_COLORS[Rarity.Legendary]}18,
      inset 0 0 8px ${RARITY_COLORS[Rarity.Legendary]}10;
  }
  50% {
    box-shadow:
      0 0 22px ${RARITY_COLORS[Rarity.Legendary]}65,
      0 0 44px ${RARITY_COLORS[Rarity.Legendary]}30,
      0 0 60px ${RARITY_COLORS[Rarity.Legendary]}10,
      inset 0 0 14px ${RARITY_COLORS[Rarity.Legendary]}18;
  }
`;

const legendaryTextShimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const legendaryBeams = keyframes`
  0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
  40% { opacity: 0.5; transform: scale(1.2) rotate(45deg); }
  100% { opacity: 0; transform: scale(1.6) rotate(90deg); }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
`;

// --- Helpers ---

const REVEAL_DELAY_MS = 300;
const BASE_DELAY_MS = 200;

const getItemAnimation = (rarity: Rarity | undefined): string => {
  switch (rarity) {
    case Rarity.Legendary:
      return `${legendaryReveal} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    case Rarity.Epic:
      return `${epicBurst} 0.7s cubic-bezier(0.34, 1.2, 0.64, 1) forwards`;
    case Rarity.Rare:
      return `${fadeSlideIn} 0.5s ease-out forwards`;
    case Rarity.Uncommon:
      return `${fadeSlideIn} 0.45s ease-out forwards`;
    default:
      return `${fadeSlideIn} 0.35s ease-out forwards`;
  }
};

const getIdleAnimation = (rarity: Rarity | undefined): string | undefined => {
  switch (rarity) {
    case Rarity.Legendary:
      return `${legendaryBreathing} 2.5s ease-in-out infinite`;
    case Rarity.Epic:
      return `${epicBreathing} 3s ease-in-out infinite`;
    case Rarity.Rare:
      return `${rarePulse} 3.5s ease-in-out infinite`;
    case Rarity.Uncommon:
      return `${uncommonShimmer} 4s ease-in-out infinite`;
    default:
      return undefined;
  }
};

const getRevealDelay = (index: number): number => {
  return BASE_DELAY_MS + index * REVEAL_DELAY_MS;
};

// --- Component ---

export const LootReveal: React.FC<LootRevealProps> = ({ items, onItemClick }) => {
  const { t } = useTranslation('ui');
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;

    // Reveal items one by one
    const timers: ReturnType<typeof setTimeout>[] = [];
    items.forEach((_, i) => {
      timers.push(
        setTimeout(() => setRevealedCount(i + 1), getRevealDelay(i)),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (items.length === 0) return null;

  const bestRarity = Math.max(...items.map(i => i.rarity ?? 0));

  return (
    <VStack spacing={3} w="100%" position="relative">
      {/* Ambient glow for epic+ drops */}
      {bestRarity >= Rarity.Epic && (
        <Box
          bg={`radial-gradient(ellipse at center, ${RARITY_COLORS[bestRarity as Rarity]}12 0%, transparent 70%)`}
          h="100%"
          left="-20%"
          pointerEvents="none"
          position="absolute"
          top="-10%"
          w="140%"
          zIndex={0}
        />
      )}

      <Text fontWeight="bold" zIndex={1}>{t('loot.title')}</Text>

      {items.map((item, index) => {
        const isRevealed = index < revealedCount;
        if (!isRevealed) return null;

        const rarity = item.rarity ?? 0;
        const color = RARITY_COLORS[rarity as Rarity] ?? RARITY_COLORS[Rarity.Common];
        const itemName = removeEmoji(item.name);
        const isLegendary = rarity === Rarity.Legendary;
        const isEpic = rarity === Rarity.Epic;
        const isRare = rarity === Rarity.Rare;
        const isSpecial = rarity >= Rarity.Uncommon;

        return (
          <Box
            key={`loot-reveal-${item.tokenId}`}
            animation={getItemAnimation(rarity as Rarity)}
            cursor={onItemClick ? 'pointer' : undefined}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
            opacity={0}
            position="relative"
            w="100%"
            zIndex={1}
            _hover={onItemClick ? {
              transform: 'scale(1.01)',
              transition: 'transform 0.15s',
            } : undefined}
          >
            {/* Legendary light beams */}
            {isLegendary && (
              <Box
                animation={`${legendaryBeams} 1.5s ease-out forwards`}
                bg={`conic-gradient(from 0deg, transparent 0%, ${color}15 10%, transparent 20%, ${color}10 30%, transparent 40%, ${color}15 50%, transparent 60%, ${color}10 70%, transparent 80%, ${color}15 90%, transparent 100%)`}
                h="200%"
                left="-50%"
                pointerEvents="none"
                position="absolute"
                top="-50%"
                w="200%"
                zIndex={0}
              />
            )}

            {/* Card container */}
            <Box
              animation={isSpecial ? getIdleAnimation(rarity as Rarity) : undefined}
              bg={isLegendary
                ? `linear-gradient(135deg, rgba(196,122,42,0.12) 0%, rgba(20,18,15,0.95) 40%, rgba(196,122,42,0.08) 100%)`
                : isEpic
                  ? `linear-gradient(135deg, rgba(123,74,181,0.08) 0%, rgba(20,18,15,0.95) 50%, rgba(123,74,181,0.05) 100%)`
                  : '#1C1814'
              }
              border="1px solid"
              borderColor={isSpecial ? `${color}50` : '#3A3228'}
              borderRadius="8px"
              overflow="hidden"
              position="relative"
              px={{ base: 3, sm: 4 }}
              py={3}
            >
              <HStack spacing={3} align="center">
                {/* Item image */}
                <Box
                  alignItems="center"
                  bg={isLegendary
                    ? `radial-gradient(circle, ${color}18 0%, transparent 70%)`
                    : isEpic
                      ? `radial-gradient(circle, ${color}12 0%, transparent 70%)`
                      : 'transparent'
                  }
                  display="flex"
                  flexShrink={0}
                  h={{ base: '52px', sm: '60px' }}
                  justifyContent="center"
                  position="relative"
                  textAlign="center"
                  w={{ base: '52px', sm: '60px' }}
                >
                  <ItemAsciiIcon
                    name={item.name}
                    itemType={item.itemType}
                    rarity={rarity}
                    size={{ base: '44px', sm: '52px' }}
                  />

                  {/* Sparkles for epic+ */}
                  {isEpic && (
                    <>
                      {[0, 1, 2, 3].map(i => (
                        <Box
                          key={`sparkle-${i}`}
                          animation={`${sparkle} ${1.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`}
                          bg={color}
                          borderRadius="50%"
                          h="3px"
                          left={`${20 + i * 18}%`}
                          opacity={0}
                          pointerEvents="none"
                          position="absolute"
                          top={`${10 + (i % 2) * 60}%`}
                          w="3px"
                          boxShadow={`0 0 4px ${color}`}
                        />
                      ))}
                    </>
                  )}
                </Box>

                {/* Item info */}
                <VStack align="start" spacing={0} flex={1} minW={0}>
                  {/* Rarity label */}
                  {rarity >= Rarity.Uncommon && (
                    <Text
                      color={color}
                      fontSize="10px"
                      fontWeight={700}
                      letterSpacing="1.5px"
                      lineHeight={1}
                      mb={0.5}
                      textTransform="uppercase"
                    >
                      {t(RARITY_I18N_KEYS[rarity as Rarity])}
                    </Text>
                  )}

                  {/* Item name */}
                  {isLegendary ? (
                    <Text
                      animation={`${legendaryTextShimmer} 3s linear infinite`}
                      backgroundClip="text"
                      backgroundImage={`linear-gradient(90deg, ${color} 0%, #EFD31C 25%, ${color} 50%, #EFD31C 75%, ${color} 100%)`}
                      backgroundSize="200% auto"
                      fontFamily="'Cinzel', serif"
                      fontSize={{ base: 'md', sm: 'lg' }}
                      fontWeight={700}
                      letterSpacing="0.5px"
                      lineHeight={1.2}
                      sx={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      {itemName}
                    </Text>
                  ) : (
                    <Text
                      color={rarity >= Rarity.Uncommon ? color : '#E8DCC8'}
                      fontFamily={rarity >= Rarity.Rare ? "'Cinzel', serif" : undefined}
                      fontSize={{ base: 'sm', sm: 'md' }}
                      fontWeight={rarity >= Rarity.Rare ? 700 : 600}
                      letterSpacing={rarity >= Rarity.Rare ? '0.3px' : undefined}
                      lineHeight={1.2}
                    >
                      {itemName}
                    </Text>
                  )}

                  {/* Stat line */}
                  <LootStatLine item={item} />
                </VStack>

                {/* Equip prompt */}
                {onItemClick && (
                  <Text
                    color="#5A5040"
                    fontSize="2xs"
                    flexShrink={0}
                    _groupHover={{ color: '#8A7E6A' }}
                  >
                    {t('equip.equip')}
                  </Text>
                )}
              </HStack>
            </Box>
          </Box>
        );
      })}
    </VStack>
  );
};

// --- Stat line sub-component ---

const LootStatLine: React.FC<{ item: LootItem }> = ({ item }) => {
  if (item.itemType === ItemType.Spell || item.itemType === ItemType.Consumable) {
    return null;
  }

  const typed = item as Armor | Weapon;
  const stats: { label: string; val: number }[] = [];

  if (Number(typed.strModifier) !== 0) stats.push({ label: 'STR', val: Number(typed.strModifier) });
  if (Number(typed.agiModifier) !== 0) stats.push({ label: 'AGI', val: Number(typed.agiModifier) });
  if (Number(typed.intModifier) !== 0) stats.push({ label: 'INT', val: Number(typed.intModifier) });
  if (Number(typed.hpModifier) !== 0) stats.push({ label: 'HP', val: Number(typed.hpModifier) });

  if (stats.length === 0) return null;

  return (
    <HStack spacing={2} mt={0.5}>
      {stats.map(s => (
        <Text
          key={s.label}
          color="#8A7E6A"
          fontFamily="'Fira Code', monospace"
          fontSize={{ base: '2xs', sm: 'xs' }}
        >
          {s.label}{' '}
          <Text as="span" color={s.val > 0 ? '#5A8A3E' : '#B83A2A'} fontWeight={600}>
            {s.val > 0 ? '+' : ''}{s.val}
          </Text>
        </Text>
      ))}
    </HStack>
  );
};
