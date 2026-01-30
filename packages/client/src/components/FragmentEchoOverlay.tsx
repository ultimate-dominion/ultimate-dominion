import { Box, keyframes, Text, useDisclosure } from '@chakra-ui/react';

import {
  useFragments,
  type FragmentStatus,
} from '../contexts/FragmentContext';
import { getRomanNumeral } from '../utils/fragmentNarratives';

import { FragmentClaimModal } from './FragmentClaimModal';

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
`;

const glowAnimation = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5),
                0 0 20px rgba(255, 215, 0, 0.3),
                0 0 30px rgba(255, 215, 0, 0.1);
  }
  50% {
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.7),
                0 0 30px rgba(255, 215, 0, 0.5),
                0 0 45px rgba(255, 215, 0, 0.3);
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

  if (!pendingEcho) {
    return null;
  }

  return (
    <>
      <Box
        position="absolute"
        zIndex={10}
        cursor="pointer"
        onClick={onOpen}
        bg="rgba(255, 215, 0, 0.2)"
        borderRadius="50%"
        w={`${tileSize * 0.8}px`}
        h={`${tileSize * 0.8}px`}
        display="flex"
        alignItems="center"
        justifyContent="center"
        animation={`${pulseAnimation} 2s ease-in-out infinite, ${glowAnimation} 2s ease-in-out infinite`}
        border="2px solid"
        borderColor="yellow.400"
        _hover={{
          bg: 'rgba(255, 215, 0, 0.4)',
          transform: 'scale(1.1)',
        }}
        transition="background 0.2s"
      >
        <Text
          fontSize="xs"
          fontWeight="bold"
          color="yellow.200"
          textShadow="0 0 5px rgba(255, 215, 0, 0.8)"
        >
          {getRomanNumeral(pendingEcho.fragmentType)}
        </Text>
      </Box>

      <FragmentClaimModal
        fragment={pendingEcho}
        isOpen={isOpen}
        onClose={onClose}
      />
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
