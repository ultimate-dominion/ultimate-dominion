import { useState } from 'react';
import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { useCharacter } from '../contexts/CharacterContext';
import { useFragments, type FragmentStatus } from '../contexts/FragmentContext';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

type FragmentClaimModalProps = {
  fragment: FragmentStatus;
  isOpen: boolean;
  onClose: () => void;
};

export const FragmentClaimModal = ({
  fragment,
  isOpen,
  onClose,
}: FragmentClaimModalProps): JSX.Element => {
  const { claimFragment, isClaiming, fragments } = useFragments();
  const { refreshCharacter } = useCharacter();
  const [isClaimed, setIsClaimed] = useState(false);

  const handleClaim = async () => {
    await claimFragment(fragment.fragmentType);
    setIsClaimed(true);
    refreshCharacter();
  };

  const handleClose = () => {
    setIsClaimed(false);
    onClose();
  };

  // Count how many are claimed (including this one if just claimed)
  const claimedCount = isClaimed
    ? fragments.filter(f => f.claimed || f.fragmentType === fragment.fragmentType).length
    : fragments.filter(f => f.claimed).length;
  const isAllCollected = claimedCount >= TOTAL_FRAGMENTS;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="#1C1814" color="#E8DCC8" borderRadius="md">
        <ModalHeader textAlign="center" pb={0}>
          <Text color="gray.400" fontSize="sm" fontFamily="mono">
            --- Fragment {getRomanNumeral(fragment.fragmentType)} of{' '}
            {getRomanNumeral(TOTAL_FRAGMENTS)} ---
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {!isClaimed ? (
              <>
                {/* Pre-claim: artwork + title only */}
                <Box
                  bg="whiteAlpha.100"
                  borderRadius="md"
                  h="200px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                >
                  <Text color="gray.500" fontSize="md">
                    Fragment {getRomanNumeral(fragment.fragmentType)} Artwork
                  </Text>
                </Box>

                <Text
                  textAlign="center"
                  fontSize="2xl"
                  fontWeight="bold"
                  color="yellow.400"
                  fontFamily="mono"
                >
                  {'<< '}
                  {fragment.name.toUpperCase()}
                  {' >>'}
                </Text>

                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Discovered at ({fragment.triggerTileX}, {fragment.triggerTileY})
                </Text>
              </>
            ) : (
              <>
                {/* Post-claim: narrative reveal */}
                <Text
                  textAlign="center"
                  fontSize="2xl"
                  fontWeight="bold"
                  color="yellow.400"
                  fontFamily="mono"
                >
                  {'<< '}
                  {fragment.name.toUpperCase()}
                  {' >>'}
                </Text>

                <Text
                  textAlign="center"
                  fontSize="xl"
                  fontWeight="bold"
                  fontFamily="mono"
                  color="#A8DEFF"
                >
                  +100 XP
                </Text>

                <Box
                  maxH="300px"
                  overflowY="auto"
                  px={2}
                  css={{
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '2px',
                    },
                  }}
                >
                  <Typist
                    avgTypingDelay={10}
                    cursor={{ show: false }}
                    stdTypingDelay={10}
                  >
                    <Text
                      fontSize="md"
                      lineHeight="tall"
                      whiteSpace="pre-line"
                      color="gray.200"
                    >
                      {fragment.narrative}
                    </Text>
                  </Typist>
                </Box>

                <Text fontSize="xs" color="gray.500" textAlign="center">
                  Discovered at ({fragment.triggerTileX}, {fragment.triggerTileY})
                </Text>

                {isAllCollected && (
                  <VStack
                    alignItems="center"
                    spacing={3}
                    border="2px solid"
                    borderColor="#A8DEFF"
                    borderRadius="md"
                    p={4}
                    boxShadow="0 0 15px rgba(168, 222, 255, 0.3)"
                    bg="rgba(168, 222, 255, 0.05)"
                  >
                    <Text fontWeight="bold" color="#A8DEFF" fontSize="lg">
                      Depths Relic Hunter
                    </Text>
                    <Text fontSize="md" textAlign="center" color="gray.300">
                      All {TOTAL_FRAGMENTS} fragments collected. The fallen speak
                      through you now. A badge has been forged in your name.
                    </Text>
                  </VStack>
                )}
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center" pt={4}>
          {!isClaimed ? (
            <Button
              onClick={handleClaim}
              isLoading={isClaiming}
              loadingText="Claiming..."
              colorScheme="yellow"
              size="lg"
              px={12}
            >
              CLAIM FRAGMENT
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              variant="outline"
              colorScheme="whiteAlpha"
              size="lg"
              px={12}
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
