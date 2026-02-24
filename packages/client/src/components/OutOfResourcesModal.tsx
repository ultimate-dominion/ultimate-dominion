import {
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

import { useAuth } from '../contexts/AuthContext';

import { PolygonalCard } from './PolygonalCard';

/**
 * Shown when a level 3+ player has both 0 ETH and 0 Gold.
 *
 * - Embedded users: "Fight monsters to earn Gold" (paymaster mercy clause
 *   will sponsor the next combat tx so they can earn Gold for GasStation).
 * - External users: "Deposit ETH from your main wallet".
 */
export const OutOfResourcesModal = ({
  isOpen,
  onClose,
  onOpenWalletDetails,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenWalletDetails: () => void;
}): JSX.Element => {
  const { authMethod } = useAuth();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>Out of Resources</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} alignItems="start">
            <Text>
              You have no ETH for gas and no Gold to auto-swap. You need
              resources to continue playing.
            </Text>
            {authMethod === 'embedded' ? (
              <>
                <Text fontWeight={700}>
                  Fight a monster to earn Gold. Your next transaction will be
                  sponsored so you can get back on your feet.
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Once you earn Gold, the GasStation will automatically swap it
                  for ETH to cover future gas costs.
                </Text>
              </>
            ) : (
              <>
                <Text fontWeight={700}>
                  Deposit ETH from your main wallet to continue playing.
                </Text>
                <Button
                  onClick={() => {
                    onClose();
                    onOpenWalletDetails();
                  }}
                  size="sm"
                >
                  Open Wallet
                </Button>
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
