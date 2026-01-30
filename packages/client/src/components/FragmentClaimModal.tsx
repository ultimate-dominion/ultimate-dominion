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
  const { claimFragment, isClaiming } = useFragments();

  const handleClaim = async () => {
    await claimFragment(fragment.fragmentType);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="#070D2A" color="white" borderRadius="md">
        <ModalHeader textAlign="center" pb={0}>
          <Text color="gray.400" fontSize="sm" fontFamily="mono">
            --- Fragment {getRomanNumeral(fragment.fragmentType)} of{' '}
            {getRomanNumeral(TOTAL_FRAGMENTS)} ---
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Fragment artwork placeholder */}
            <Box
              bg="whiteAlpha.100"
              borderRadius="md"
              h="150px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Text color="gray.500" fontSize="sm">
                Fragment {getRomanNumeral(fragment.fragmentType)} Artwork
              </Text>
            </Box>

            {/* Fragment title */}
            <Text
              textAlign="center"
              fontSize="xl"
              fontWeight="bold"
              color="yellow.400"
              fontFamily="mono"
            >
              {'<< '}
              {fragment.name.toUpperCase()}
              {' >>'}
            </Text>

            {/* Narrative text */}
            <Box
              maxH="250px"
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
              <Text
                fontSize="sm"
                lineHeight="tall"
                whiteSpace="pre-line"
                color="gray.200"
              >
                {fragment.narrative}
              </Text>
            </Box>

            {/* Trigger location */}
            <Text fontSize="xs" color="gray.500" textAlign="center">
              Discovered at ({fragment.triggerTileX}, {fragment.triggerTileY})
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center" pt={4}>
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
