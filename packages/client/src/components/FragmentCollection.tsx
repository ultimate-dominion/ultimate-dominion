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
import { useTranslation } from 'react-i18next';

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

import { useFragments, type FragmentStatus } from '../contexts/FragmentContext';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

import { FragmentClaimModal } from './FragmentClaimModal';
import { FragmentReadModal } from './FragmentReadModal';
import { PolygonalCard } from './PolygonalCard';

export const FragmentCollection = (): JSX.Element => {
  const { t } = useTranslation('ui');
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
            {t('fragmentCollection.title', {
              claimed: claimedCount,
              total: TOTAL_FRAGMENTS,
            })}
          </Text>

          <Grid templateColumns="repeat(4, 1fr)" gap={3}>
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
            {t('fragmentCollection.discover')}
          </Text>
        </VStack>
      </PolygonalCard>

      {selectedFragment &&
        selectedFragment.triggered &&
        !selectedFragment.claimed && (
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

const FragmentTile = ({
  fragment,
  onClick,
}: FragmentTileProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const isClaimed = fragment.claimed;
  const isTriggered = fragment.triggered;
  const isClickable = isClaimed || isTriggered;

  const tooltipLabel = isClaimed
    ? `${fragment.name} - ${t('fragmentCollection.clickToRead')}`
    : isTriggered
      ? `${fragment.name} - ${t('fragmentCollection.clickToClaim')}`
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
        bg={
          isClaimed
            ? 'transparent'
            : isTriggered
              ? 'rgba(168, 222, 255, 0.06)'
              : '#1a1816'
        }
        css={
          isTriggered && !isClaimed
            ? {
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: 'inherit',
                  boxShadow:
                    '0 0 14px 6px rgba(168, 222, 255, 0.5), 0 0 30px 12px rgba(168, 222, 255, 0.25), 0 0 50px 20px rgba(168, 222, 255, 0.1)',
                  animation: `${glowPulse} 3s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                  pointerEvents: 'none',
                  zIndex: -1,
                },
              }
            : undefined
        }
      >
        <Text
          color={isClaimed || isTriggered ? '#A8DEFF' : 'gray.600'}
          fontFamily="'Cinzel', serif"
          fontSize={{ base: 'xl', md: '2xl' }}
          fontWeight="bold"
        >
          {getRomanNumeral(fragment.fragmentType)}
        </Text>
        <Text
          color={isClaimed || isTriggered ? '#A8DEFF' : 'gray.600'}
          fontFamily="'Fira Code', monospace"
          fontSize="8px"
          fontWeight="bold"
          letterSpacing="wider"
          mt={1}
        >
          {isClaimed ? 'CLAIMED' : isTriggered ? 'FOUND' : 'LOCKED'}
        </Text>
      </Box>
    </Tooltip>
  );
};
