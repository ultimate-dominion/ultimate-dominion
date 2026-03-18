import {
  Box,
  Grid,
  GridItem,
  Image,
  keyframes,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FaCheck, FaLock } from 'react-icons/fa';

/* Scale + opacity only — both GPU-composited for 60fps.
   The actual glow lives on a ::before pseudo with a fixed box-shadow;
   we just scale and fade the pseudo in sync with the tile. */
const fragmentPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
`;
const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.08); }
`;

import {
  useFragments,
  type FragmentStatus,
} from '../contexts/FragmentContext';
import { getFragmentImage } from '../utils/fragmentImages';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

import { FragmentClaimModal } from './FragmentClaimModal';
import { FragmentReadModal } from './FragmentReadModal';
import { PolygonalCard } from './PolygonalCard';

export const FragmentCollection = (): JSX.Element => {
  const { fragments, isLoading } = useFragments();
  const [selectedFragment, setSelectedFragment] =
    useState<FragmentStatus | null>(null);
  const {
    isOpen: isClaimOpen,
    onOpen: onOpenClaim,
    onClose: onCloseClaim,
  } = useDisclosure();
  const {
    isOpen: isReadOpen,
    onOpen: onOpenRead,
    onClose: onCloseRead,
  } = useDisclosure();

  const handleFragmentClick = (fragment: FragmentStatus) => {
    setSelectedFragment(fragment);
    if (fragment.claimed) {
      onOpenRead();
    } else if (fragment.triggered) {
      onOpenClaim();
    }
  };

  const claimedCount = fragments.filter(f => f.claimed).length;

  if (isLoading) {
    return <Box />;
  }

  return (
    <Box mt={6}>
      <PolygonalCard clipPath="none" p={6}>
        <VStack align="stretch" spacing={4}>
          <Text fontWeight="bold" size="lg">
            Fragments of the Fallen ({claimedCount}/{TOTAL_FRAGMENTS})
          </Text>

          <Grid
            templateColumns="repeat(4, 1fr)"
            gap={3}
          >
            {fragments.map(fragment => (
              <GridItem key={fragment.fragmentType}>
                <FragmentTile
                  fragment={fragment}
                  onClick={() => handleFragmentClick(fragment)}
                />
              </GridItem>
            ))}
          </Grid>

          <Text fontSize="xs" color="gray.500" textAlign="center">
            Discover lore fragments throughout the Dark Cave
          </Text>
        </VStack>
      </PolygonalCard>

      {selectedFragment && selectedFragment.triggered && !selectedFragment.claimed && (
        <FragmentClaimModal
          fragment={selectedFragment}
          isOpen={isClaimOpen}
          onClose={() => {
            onCloseClaim();
            setSelectedFragment(null);
          }}
        />
      )}

      {selectedFragment && selectedFragment.claimed && (
        <FragmentReadModal
          fragment={selectedFragment}
          isOpen={isReadOpen}
          onClose={() => {
            onCloseRead();
            setSelectedFragment(null);
          }}
        />
      )}
    </Box>
  );
};

type FragmentTileProps = {
  fragment: FragmentStatus;
  onClick: () => void;
};

const FragmentTile = ({ fragment, onClick }: FragmentTileProps): JSX.Element => {
  const isClaimed = fragment.claimed;
  const isTriggered = fragment.triggered;
  const isClickable = isClaimed || isTriggered;
  const imageSrc = getFragmentImage(fragment.name);

  const tooltipLabel = isClaimed
    ? `${fragment.name} - Click to read`
    : isTriggered
      ? `${fragment.name} - Click to claim!`
      : fragment.hint;

  return (
    <Tooltip
      label={tooltipLabel}
      placement="top"
      hasArrow
      bg="#14120F"
      color="white"
    >
      <Box
        borderRadius="md"
        aspectRatio="1/1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        cursor={isClickable ? 'pointer' : 'default'}
        onClick={isClickable ? onClick : undefined}
        border="2px solid"
        borderColor={
          isClaimed
            ? 'rgba(168, 222, 255, 0.4)'
            : isTriggered
              ? 'rgba(168, 222, 255, 0.7)'
              : 'rgba(255,255,255,0.06)'
        }
        transition="all 0.25s ease"
        animation={
          isTriggered && !isClaimed
            ? `${fragmentPulse} 3s cubic-bezier(0.4, 0, 0.6, 1) infinite`
            : undefined
        }
        _hover={
          isClickable
            ? {
                transform: 'scale(1.05)',
                borderColor: 'rgba(168, 222, 255, 0.9)',
              }
            : {}
        }
        position="relative"
        overflow="visible"
        bg={isClaimed ? 'transparent' : isTriggered ? 'rgba(168, 222, 255, 0.06)' : '#1a1816'}
        css={isTriggered && !isClaimed ? {
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '-4px',
            borderRadius: 'inherit',
            boxShadow: '0 0 14px 6px rgba(168, 222, 255, 0.5), 0 0 30px 12px rgba(168, 222, 255, 0.25), 0 0 50px 20px rgba(168, 222, 255, 0.1)',
            animation: `${glowPulse} 3s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
            pointerEvents: 'none',
            zIndex: -1,
          },
        } : undefined}
      >
        {/* Claimed: show fragment artwork */}
        {isClaimed && imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt={fragment.name}
              position="absolute"
              inset={0}
              w="100%"
              h="100%"
              objectFit="cover"
              borderRadius="md"
            />
            {/* Gradient overlay for legibility */}
            <Box
              position="absolute"
              inset={0}
              bgGradient="linear(to-t, blackAlpha.700, transparent 50%)"
              borderRadius="md"
            />
            {/* Roman numeral label */}
            <Text
              position="absolute"
              bottom={1}
              fontSize="xs"
              fontWeight="bold"
              color="#A8DEFF"
              textShadow="0 1px 3px rgba(0,0,0,0.8)"
              zIndex={1}
            >
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
            {/* Claimed check */}
            <Box
              position="absolute"
              top={1}
              right={1}
              color="#A8DEFF"
              bg="blackAlpha.600"
              borderRadius="full"
              p="3px"
              lineHeight={1}
              zIndex={1}
            >
              <FaCheck size={10} />
            </Box>
          </>
        ) : isClaimed ? (
          /* Claimed but no image (fallback) */
          <>
            <Box color="#A8DEFF" mb={1}>
              <FaCheck size={20} />
            </Box>
            <Text fontSize="xs" color="#A8DEFF" fontWeight="bold">
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        ) : isTriggered ? (
          <>
            <Box color="#A8DEFF" mb={1}>
              <Text
                fontSize="xl"
                fontWeight="bold"
                textShadow="0 0 10px rgba(168, 222, 255, 0.8), 0 0 20px rgba(168, 222, 255, 0.4)"
              >
                !
              </Text>
            </Box>
            <Text
              fontSize="xs"
              color="#A8DEFF"
              fontWeight="bold"
              textShadow="0 0 6px rgba(168, 222, 255, 0.5)"
            >
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        ) : (
          <>
            <Box color="gray.600" mb={1} opacity={0.5}>
              <FaLock size={14} />
            </Box>
            <Text fontSize="xs" color="gray.600">
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        )}
      </Box>
    </Tooltip>
  );
};
