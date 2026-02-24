import {
  Box,
  Grid,
  GridItem,
  keyframes,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FaCheck, FaQuestion } from 'react-icons/fa';

const fragmentGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 8px rgba(255, 215, 0, 0.4),
      0 0 16px rgba(255, 215, 0, 0.2),
      inset 0 0 8px rgba(255, 215, 0, 0.1);
    border-color: rgba(234, 179, 8, 0.7);
  }
  50% {
    box-shadow:
      0 0 14px rgba(255, 215, 0, 0.7),
      0 0 28px rgba(255, 215, 0, 0.4),
      0 0 42px rgba(255, 215, 0, 0.15),
      inset 0 0 12px rgba(255, 215, 0, 0.2);
    border-color: rgba(250, 204, 21, 1);
  }
`;

const fragmentPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
`;

import {
  useFragments,
  type FragmentStatus,
} from '../contexts/FragmentContext';
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
      bg="#070D2A"
      color="white"
    >
      <Box
        bg={isClaimed ? 'green.900' : isTriggered ? 'yellow.900' : 'gray.700'}
        borderRadius="md"
        p={3}
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
            ? 'green.500'
            : isTriggered
              ? 'yellow.500'
              : 'transparent'
        }
        transition="all 0.2s"
        animation={
          isTriggered && !isClaimed
            ? `${fragmentGlow} 2s ease-in-out infinite, ${fragmentPulse} 2s ease-in-out infinite`
            : undefined
        }
        _hover={
          isClickable
            ? {
                transform: 'scale(1.08)',
                borderColor: isClaimed ? 'green.400' : 'yellow.400',
                boxShadow: isTriggered
                  ? '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4)'
                  : undefined,
              }
            : {}
        }
        position="relative"
      >
        {isClaimed ? (
          <>
            <Box color="green.400" mb={1}>
              <FaCheck size={20} />
            </Box>
            <Text fontSize="xs" color="green.300" fontWeight="bold">
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        ) : isTriggered ? (
          <>
            <Box
              color="yellow.400"
              mb={1}
            >
              <Text
                fontSize="xl"
                fontWeight="bold"
                textShadow="0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.4)"
              >
                !
              </Text>
            </Box>
            <Text
              fontSize="xs"
              color="yellow.300"
              fontWeight="bold"
              textShadow="0 0 6px rgba(255, 215, 0, 0.5)"
            >
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        ) : (
          <>
            <Box color="gray.500" mb={1}>
              <FaQuestion size={16} />
            </Box>
            <Text fontSize="xs" color="gray.500">
              {getRomanNumeral(fragment.fragmentType)}
            </Text>
          </>
        )}
      </Box>
    </Tooltip>
  );
};
