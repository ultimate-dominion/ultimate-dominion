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
import { parseEther } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { SystemToAllow } from '../utils/types';

export const LootManagerAllowanceModal = ({
  amount,
  heading = 'Loot Manager Allowance',
  isOpen,
  message,
  onClose,
  successMessage = 'You can use your token with the Loot Manager.',
}: {
  // If you set an amount, it is assumed that you are approving $GOLD. Otherwise, it will be assumed that you are approving items.
  amount?: string;
  heading?: string;
  isOpen: boolean;
  message?: string;
  onClose: () => void;
  successMessage?: string;
}): JSX.Element => {
  const {
    goldLootManagerAllowance,
    isApprovingGold,
    isApprovingItems,
    itemsLootManagerAllowance,
    onApproveGoldAllowance,
    onSetApprovalForAllItems,
  } = useAllowance();

  if (
    (amount && goldLootManagerAllowance >= parseEther(amount)) ||
    (!amount && itemsLootManagerAllowance)
  ) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{heading}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack p={4} spacing={10}>
              <Text textAlign="center">
                Allowance was succesful! {successMessage}
              </Text>
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
  }

  if (amount && goldLootManagerAllowance < parseEther(amount)) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{heading}</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={4}>
            <VStack spacing={10} textAlign="center">
              {!message && (
                <Text>
                  Allow {amount} $GOLD to be used by the Loot Manager?
                </Text>
              )}
              {message && <Text>{message}</Text>}
              <Button
                isLoading={isApprovingGold}
                onClick={() =>
                  onApproveGoldAllowance(
                    SystemToAllow.LootManager,
                    parseEther(amount),
                  )
                }
              >
                Allow
              </Button>
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
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{heading}</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          <VStack spacing={10} textAlign="center">
            {!message && (
              <Text>Allow all items to be used by the Loot Manager?</Text>
            )}
            {message && <Text>{message}</Text>}
            <Button
              isLoading={isApprovingItems}
              onClick={() =>
                onSetApprovalForAllItems(SystemToAllow.LootManager)
              }
            >
              Allow
            </Button>
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
