import { Box, keyframes } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

/* ──────────────────────── Keyframes ──────────────────────── */

const screenShake = keyframes`
  0%   { transform: translate(0, 0); }
  10%  { transform: translate(-2px, 1px); }
  20%  { transform: translate(2px, -1px); }
  30%  { transform: translate(-1px, -2px); }
  40%  { transform: translate(1px, 2px); }
  50%  { transform: translate(-2px, -1px); }
  60%  { transform: translate(2px, 1px); }
  70%  { transform: translate(-1px, 2px); }
  80%  { transform: translate(1px, -1px); }
  90%  { transform: translate(-2px, 1px); }
  100% { transform: translate(0, 0); }
`;

const crackWiden = keyframes`
  0%   { width: 2px; height: 2px; opacity: 0; }
  15%  { width: 4px; height: 4px; opacity: 0.6; }
  40%  { width: 120px; height: 3px; opacity: 1; }
  70%  { width: 200px; height: 4px; opacity: 1; }
  100% { width: 280px; height: 6px; opacity: 0.8; }
`;

const crackGlow = keyframes`
  0%   { box-shadow: 0 0 4px rgba(200, 122, 42, 0.4); background: rgba(200, 122, 42, 0.6); }
  50%  { box-shadow: 0 0 30px rgba(180, 198, 212, 0.8), 0 0 60px rgba(180, 198, 212, 0.3); background: rgba(180, 198, 212, 0.9); }
  100% { box-shadow: 0 0 40px rgba(180, 198, 212, 0.6), 0 0 80px rgba(180, 198, 212, 0.2); background: rgba(180, 198, 212, 0.7); }
`;

const lightRaySpread = keyframes`
  0%   { opacity: 0; transform: translateX(-50%) scaleX(0); }
  30%  { opacity: 0.3; transform: translateX(-50%) scaleX(0.3); }
  100% { opacity: 0.6; transform: translateX(-50%) scaleX(1); }
`;

const overlayFadeOut = keyframes`
  0%   { opacity: 1; }
  100% { opacity: 0; }
`;

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/* ──────────────────────── Component ──────────────────────── */

type CaveReactionOverlayProps = {
  onComplete: () => void;
};

export const CaveReactionOverlay = ({
  onComplete,
}: CaveReactionOverlayProps): JSX.Element => {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'fade'>('shake');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('crack'), 800),
      setTimeout(() => setPhase('fade'), 2800),
      setTimeout(onComplete, 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={9999}
      pointerEvents="none"
      animation={
        phase === 'shake'
          ? `${overlayFadeIn} 0.3s ease-out, ${screenShake} 0.8s ease-in-out`
          : phase === 'fade'
            ? `${overlayFadeOut} 0.7s ease-out forwards`
            : undefined
      }
    >
      {/* Dark overlay */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.500"
        transition="opacity 0.5s ease"
        opacity={phase === 'fade' ? 0 : 1}
      />

      {/* Crack of light at top-center */}
      <Box
        position="absolute"
        top="6%"
        left="50%"
        transform="translateX(-50%)"
        borderRadius="full"
        animation={
          phase !== 'shake'
            ? `${crackWiden} 2s ease-out forwards, ${crackGlow} 2s 0.3s ease-out forwards`
            : undefined
        }
        w="2px"
        h="2px"
        opacity={0}
      />

      {/* Light rays spreading down from crack */}
      {phase !== 'shake' && (
        <Box
          position="absolute"
          top="6%"
          left="50%"
          w="400px"
          h="120px"
          background="linear-gradient(180deg, rgba(180, 198, 212, 0.3) 0%, transparent 100%)"
          borderRadius="0 0 50% 50%"
          animation={`${lightRaySpread} 2s 0.5s ease-out forwards`}
          opacity={0}
          transformOrigin="top center"
          pointerEvents="none"
        />
      )}
    </Box>
  );
};
