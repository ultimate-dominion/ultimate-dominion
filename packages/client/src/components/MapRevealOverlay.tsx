import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, keyframes, Text } from '@chakra-ui/react';

const GRID_SIZE = 10;
const ALCOVE_SIZE = 5;
const TOTAL_DURATION = 6.5; // seconds

/* ──────────────────────── Keyframes ──────────────────────── */

/**
 * Grid container: fade-in → rumble → zoom-out expansion
 *
 * Timeline (mapped to %):
 *   0–15%  (0–1s)    fade in at scale(2), centered on Alcove
 *   17–38% (1–2.5s)  jittery rumble at scale(2)
 *   38–77% (2.5–5s)  zoom-out to scale(1) revealing full 10×10
 *   77–100% (5–6.5s) hold at scale(1)
 */
const gridSequence = keyframes`
  0%   { opacity: 0; transform: scale(2); }
  15%  { opacity: 1; transform: scale(2); }
  17%  { opacity: 1; transform: scale(2) translate(-2px, 1px); }
  19%  { opacity: 1; transform: scale(2) translate(2px, -1px); }
  21%  { opacity: 1; transform: scale(2) translate(-1px, -2px); }
  23%  { opacity: 1; transform: scale(2) translate(1px, 2px); }
  25%  { opacity: 1; transform: scale(2) translate(-2px, -1px); }
  27%  { opacity: 1; transform: scale(2) translate(2px, 1px); }
  29%  { opacity: 1; transform: scale(2) translate(1px, -2px); }
  31%  { opacity: 1; transform: scale(2) translate(-1px, 2px); }
  33%  { opacity: 1; transform: scale(2) translate(2px, -1px); }
  35%  { opacity: 1; transform: scale(2) translate(-1px, 1px); }
  38%  { opacity: 1; transform: scale(2); }
  77%  { opacity: 1; transform: scale(1); }
  100% { opacity: 1; transform: scale(1); }
`;

/** New tiles: invisible → amber flash → settle */
const tileReveal = keyframes`
  0%   { opacity: 0; background-color: rgba(200, 122, 42, 0.3); }
  40%  { opacity: 1; background-color: rgba(200, 122, 42, 0.15); }
  100% { opacity: 1; background-color: transparent; }
`;

/** Amber cracks at boundary — glow then fade */
const crackGlow = keyframes`
  0%   { opacity: 0; }
  50%  { opacity: 1; }
  100% { opacity: 0; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; }
`;

/* ──────────────────────── Component ──────────────────────── */

type MapRevealOverlayProps = {
  onComplete: () => void;
};

export const MapRevealOverlay = ({ onComplete }: MapRevealOverlayProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const [isExiting, setIsExiting] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);

  // Enable button interaction after the landing phase begins
  useEffect(() => {
    const timer = setTimeout(() => setButtonReady(true), 5500);
    return () => clearTimeout(timer);
  }, []);

  const cells = useMemo(
    () =>
      Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
        const visualRow = Math.floor(i / GRID_SIZE);
        const visualCol = i % GRID_SIZE;
        // Game coords: y increases upward, visual row 0 = game row 9
        const gameRow = GRID_SIZE - 1 - visualRow;
        const gameCol = visualCol;

        const isOriginal = gameCol < ALCOVE_SIZE && gameRow < ALCOVE_SIZE;
        const distanceFromBoundary = isOriginal
          ? 0
          : Math.max(0, gameCol - (ALCOVE_SIZE - 1)) + Math.max(0, gameRow - (ALCOVE_SIZE - 1));

        // Safe-zone boundary borders (matches MapPanel logic)
        const hasSafeZoneTopBorder = gameRow === 4 && gameCol <= 4;
        const hasSafeZoneRightBorder = gameCol === 4 && gameRow <= 4;
        const hasSafeZoneBottomBorder = gameRow === 0 && gameCol <= 4;
        const hasSafeZoneLeftBorder = gameCol === 0 && gameRow <= 4;

        return {
          isOriginal,
          distanceFromBoundary,
          hasSafeZoneTopBorder,
          hasSafeZoneRightBorder,
          hasSafeZoneBottomBorder,
          hasSafeZoneLeftBorder,
        };
      }),
    [],
  );

  const handleContinue = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(onComplete, 600);
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="#12100E"
      zIndex={9999}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={6}
      overflow="hidden"
      animation={isExiting ? `${fadeOut} 0.6s ease-out forwards` : undefined}
    >
      {/* Animated grid container */}
      <Box
        position="relative"
        w={{ base: '80vw', md: '45vh' }}
        maxW="400px"
        animation={`${gridSequence} ${TOTAL_DURATION}s ease-out forwards`}
        transformOrigin="25% 75%"
        willChange="transform, opacity"
      >
        {/* 10×10 CSS grid */}
        <Box
          aspectRatio="1/1"
          border="0.5px solid"
          borderColor="#3A3228"
          display="grid"
          gridTemplateColumns="repeat(10, 1fr)"
          gridTemplateRows="repeat(10, 1fr)"
        >
          {cells.map((cell, i) => (
            <Box
              key={i}
              bgColor={cell.isOriginal ? 'rgba(200,122,42,0.06)' : 'transparent'}
              borderBottom={cell.hasSafeZoneBottomBorder ? '1.5px solid' : '0.5px solid'}
              borderBottomColor={cell.hasSafeZoneBottomBorder ? '#C87A2A' : '#3A3228'}
              borderLeft={cell.hasSafeZoneLeftBorder ? '1.5px solid' : '0.5px solid'}
              borderLeftColor={cell.hasSafeZoneLeftBorder ? '#C87A2A' : '#3A3228'}
              borderRight={cell.hasSafeZoneRightBorder ? '1.5px solid' : '0.5px solid'}
              borderRightColor={cell.hasSafeZoneRightBorder ? '#C87A2A' : '#3A3228'}
              borderTop={cell.hasSafeZoneTopBorder ? '1.5px solid' : '0.5px solid'}
              borderTopColor={cell.hasSafeZoneTopBorder ? '#C87A2A' : '#3A3228'}
              opacity={cell.isOriginal ? 1 : 0}
              animation={
                !cell.isOriginal
                  ? `${tileReveal} 0.8s ${2.5 + cell.distanceFromBoundary * 0.12}s ease-out forwards`
                  : undefined
              }
            />
          ))}
        </Box>

        {/* Amber crack — top edge of Alcove boundary */}
        <Box
          position="absolute"
          bottom="50%"
          left={0}
          w="50%"
          h="2px"
          bg="#C87A2A"
          boxShadow="0 0 8px rgba(200, 122, 42, 0.6), 0 0 16px rgba(200, 122, 42, 0.3)"
          animation={`${crackGlow} 1.5s 1s ease-in-out forwards`}
          opacity={0}
          pointerEvents="none"
        />

        {/* Amber crack — right edge of Alcove boundary */}
        <Box
          position="absolute"
          bottom={0}
          left="50%"
          w="2px"
          h="50%"
          bg="#C87A2A"
          boxShadow="0 0 8px rgba(200, 122, 42, 0.6), 0 0 16px rgba(200, 122, 42, 0.3)"
          animation={`${crackGlow} 1.5s 1s ease-in-out forwards`}
          opacity={0}
          pointerEvents="none"
        />
      </Box>

      {/* "The Winding Dark" label */}
      <Text
        fontFamily="'Cinzel', serif"
        fontSize={{ base: 'lg', md: 'xl' }}
        fontWeight={600}
        color="#D4A54A"
        letterSpacing="0.1em"
        textTransform="uppercase"
        textShadow="0 0 20px rgba(212, 165, 74, 0.3)"
        opacity={0}
        animation={`${fadeUp} 0.8s 5s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
      >
        {t('mapReveal.windingDark')}
      </Text>

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        variant="gold"
        size="md"
        opacity={0}
        pointerEvents={buttonReady ? 'auto' : 'none'}
        animation={`${fadeUp} 0.6s 5.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`}
      >
        {t('common.continue')}
      </Button>
    </Box>
  );
};
