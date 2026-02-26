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

import { type FragmentStatus } from '../contexts/FragmentContext';
import { getRomanNumeral, TOTAL_FRAGMENTS } from '../utils/fragmentNarratives';

type FragmentReadModalProps = {
  fragment: FragmentStatus;
  isOpen: boolean;
  onClose: () => void;
};

export const FragmentReadModal = ({
  fragment,
  isOpen,
  onClose,
}: FragmentReadModalProps): JSX.Element => {
  const claimedDate = fragment.claimedAt
    ? new Date(fragment.claimedAt * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
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
            {/* Fragment artwork placeholder */}
            <Box
              bg="whiteAlpha.100"
              borderRadius="md"
              h="150px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="1px solid"
              borderColor="green.500"
              position="relative"
            >
              <Text color="gray.500" fontSize="sm">
                Fragment {getRomanNumeral(fragment.fragmentType)} Artwork
              </Text>
              <Box
                position="absolute"
                top={2}
                right={2}
                bg="green.500"
                px={2}
                py={0.5}
                borderRadius="sm"
              >
                <Text fontSize="xs" fontWeight="bold">
                  CLAIMED
                </Text>
              </Box>
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

            {/* Claim info */}
            <VStack spacing={1}>
              <Text fontSize="xs" color="gray.500">
                Claimed on: {claimedDate}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Token ID: #{fragment.tokenId.toString()}
              </Text>
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center" pt={4}>
          <Button
            onClick={onClose}
            colorScheme="gray"
            variant="outline"
            size="lg"
            px={12}
            isDisabled
          >
            CLAIMED
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
