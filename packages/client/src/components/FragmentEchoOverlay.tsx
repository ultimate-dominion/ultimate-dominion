import { Box, keyframes, Text, useDisclosure } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';

import {
  useFragments,
  type FragmentStatus,
} from '../contexts/FragmentContext';
import { getRomanNumeral } from '../utils/fragmentNarratives';

import { FragmentClaimModal } from './FragmentClaimModal';

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
`;

const glowAnimation = keyframes`
  0%, 100% {
    box-shadow: 0 0 6px rgba(120, 200, 255, 0.6),
                0 0 14px rgba(120, 200, 255, 0.3),
                0 0 24px rgba(120, 200, 255, 0.15);
  }
  50% {
    box-shadow: 0 0 10px rgba(120, 200, 255, 0.9),
                0 0 22px rgba(120, 200, 255, 0.5),
                0 0 40px rgba(120, 200, 255, 0.25);
  }
`;

type FragmentEchoOverlayProps = {
  tileSize?: number;
};

export const FragmentEchoOverlay = ({
  tileSize = 30,
}: FragmentEchoOverlayProps): JSX.Element | null => {
  const { pendingEcho } = useFragments();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Hold onto the fragment data while the modal is open so it doesn't
  // unmount when pendingEcho clears after a successful claim.
  const fragmentRef = useRef<FragmentStatus | null>(null);
  useEffect(() => {
    if (pendingEcho) {
      fragmentRef.current = pendingEcho;
    }
  }, [pendingEcho]);

  const handleClose = () => {
    onClose();
    // Clear the ref after the modal fully closes
    if (!pendingEcho) {
      fragmentRef.current = null;
    }
  };

  const fragment = pendingEcho ?? fragmentRef.current;

  if (!fragment && !isOpen) {
    return null;
  }

  return (
    <>
      {pendingEcho && (
        <Box
          position="absolute"
          zIndex={10}
          cursor="pointer"
          onClick={onOpen}
          bg="rgba(120, 200, 255, 0.15)"
          borderRadius="50%"
          w={`${tileSize * 0.8}px`}
          h={`${tileSize * 0.8}px`}
          display="flex"
          alignItems="center"
          justifyContent="center"
          animation={`${pulseAnimation} 2s ease-in-out infinite, ${glowAnimation} 2s ease-in-out infinite`}
          border="1.5px solid rgba(120, 200, 255, 0.7)"
          _hover={{
            bg: 'rgba(120, 200, 255, 0.3)',
            transform: 'scale(1.15)',
          }}
          transition="all 0.2s"
        >
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="#A8DEFF"
            textShadow="0 0 6px rgba(120, 200, 255, 0.9)"
          >
            {getRomanNumeral(pendingEcho.fragmentType)}
          </Text>
        </Box>
      )}

      {fragment && (
        <FragmentClaimModal
          fragment={fragment}
          isOpen={isOpen}
          onClose={handleClose}
        />
      )}
    </>
  );
};

/**
 * Wrapper component for positioning the echo on a specific map tile
 */
type FragmentEchoTileProps = {
  x: number;
  y: number;
  tileSize: number;
};

export const FragmentEchoTile = ({
  x,
  y,
  tileSize,
}: FragmentEchoTileProps): JSX.Element | null => {
  const { pendingEcho } = useFragments();

  // Only show if there's a pending echo and we're on the right tile
  if (
    !pendingEcho ||
    pendingEcho.triggerTileX !== x ||
    pendingEcho.triggerTileY !== y
  ) {
    return null;
  }

  return <FragmentEchoOverlay tileSize={tileSize} />;
};

/**
 * Compact fragment marker for the mini-map grid.
 * Shows a small pulsing glow on the tile where a pending fragment echo exists.
 */
const mapMarkerPulse = keyframes`
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
`;

const mapMarkerGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(120, 200, 255, 0.6), 0 0 8px rgba(120, 200, 255, 0.3); }
  50% { box-shadow: 0 0 6px rgba(120, 200, 255, 0.9), 0 0 14px rgba(120, 200, 255, 0.5), 0 0 20px rgba(120, 200, 255, 0.2); }
`;

export const FragmentMapMarker = ({
  x,
  y,
}: {
  x: number;
  y: number;
}): JSX.Element | null => {
  const { pendingEcho } = useFragments();

  if (
    !pendingEcho ||
    pendingEcho.triggerTileX !== x ||
    pendingEcho.triggerTileY !== y
  ) {
    return null;
  }

  return (
    <Box
      animation={`${mapMarkerPulse} 2s ease-in-out infinite, ${mapMarkerGlow} 2s ease-in-out infinite`}
      bg="rgba(120, 200, 255, 0.35)"
      border="1px solid rgba(120, 200, 255, 0.7)"
      borderRadius="50%"
      h="8px"
      left="50%"
      pointerEvents="none"
      position="absolute"
      top="50%"
      transform="translate(-50%, -50%)"
      w="8px"
      zIndex={8}
    />
  );
};
