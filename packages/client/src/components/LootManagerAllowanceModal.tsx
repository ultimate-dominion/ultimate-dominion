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
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { parseEther } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { SystemToAllow } from '../utils/types';

import { PolygonalCard } from './PolygonalCard';

export const LootManagerAllowanceModal = ({
  amount,
  heading = 'Loot Manager Permission',
  isOpen,
  message,
  onClose,
  successMessage = 'You can use your token with the Loot Manager.',
}: {
  // If you set an amount, it is assumed that you are approving Gold. Otherwise, it will be assumed that you are approving items.
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
    onApproveMaxGoldAllowance,
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
          <PolygonalCard isModal />
          <ModalHeader>{heading}</ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 6, sm: 8 }}>
            <Text textAlign="center">
              Permission granted! {successMessage}
            </Text>
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
          <PolygonalCard isModal />
          <ModalHeader>{heading}</ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 6, sm: 8 }}>
            <VStack spacing={10} textAlign="center">
              {!message && (
                <Text>
                  Give permission to spend {amount} Gold with the Loot Manager?
                </Text>
              )}
              {message && <Text>{message}</Text>}
            </VStack>
          </ModalBody>
          <ModalFooter alignItems="start" gap={3}>
            <Button onClick={onClose} size="sm" variant="ghost">
              Close
            </Button>
            <VStack spacing={1}>
              <Button
                isLoading={isApprovingGold}
                onClick={() =>
                  onApproveGoldAllowance(
                    SystemToAllow.LootManager,
                    parseEther(amount),
                  )
                }
              >
                Allow Spending
              </Button>
              {!isApprovingGold && (
                <Tooltip
                  bg="#070D2A"
                  hasArrow
                  label="This allows you to deposit Gold into your Adventure Escrow without having to approve each transaction. It is a faster and smoother experience."
                  placement="top"
                  shouldWrapChildren
                >
                  <Button
                    color="blue400"
                    fontWeight={500}
                    isLoading={isApprovingGold}
                    onClick={() =>
                      onApproveMaxGoldAllowance(
                        SystemToAllow.LootManager,
                        parseEther(amount),
                      )
                    }
                    p={1}
                    size="xs"
                    variant="ghost"
                    _active={{
                      textDecoration: 'underline',
                    }}
                    _hover={{
                      textDecoration: 'underline',
                    }}
                  >
                    Always Allow
                  </Button>
                </Tooltip>
              )}
            </VStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>{heading}</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          <VStack spacing={10} textAlign="center">
            {!message && (
              <Text>Allow all items to be used by the Loot Manager?</Text>
            )}
            {message && <Text>{message}</Text>}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
          <Button
            isLoading={isApprovingItems}
            onClick={() => onSetApprovalForAllItems(SystemToAllow.LootManager)}
          >
            Allow Spending
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
