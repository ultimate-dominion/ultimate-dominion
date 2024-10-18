import {
  Button,
  HStack,
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

import { useAllowance } from '../contexts/AllowanceContext';
import { etherToFixedNumber } from '../utils/helpers';
import { OrderType, SystemToAllow } from '../utils/types';

export const MarketplaceAllowanceModal = ({
  completeMessage = 'Allowance was successful!',
  isCompleting,
  isOpen,
  itemName,
  onClose,
  onComplete,
  orderPrice,
  orderType,
}: {
  completeMessage?: string;
  isCompleting: boolean;
  isOpen: boolean;
  itemName: string;
  onClose: () => void;
  onComplete: (e: React.FormEvent) => void;
  orderPrice: bigint;
  orderType: OrderType;
}): JSX.Element => {
  const {
    goldMarketplaceAllowance,
    isApprovingGold,
    isApprovingItems,
    itemsMarketplaceAllowance,
    onApproveGoldAllowance,
    onApproveMaxGoldAllowance,
    onSetApprovalForAllItems,
  } = useAllowance();

  if (
    (goldMarketplaceAllowance >= orderPrice &&
      orderType === OrderType.Buying) ||
    (itemsMarketplaceAllowance && orderType === OrderType.Selling)
  ) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Marketplace Allowances</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack p={4} spacing={10}>
              <Text textAlign="center">{completeMessage}</Text>
              <Button isLoading={isCompleting} onClick={onComplete}>
                Complete
              </Button>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} variant="ghost">
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
        <ModalHeader>Marketplace Allowances</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          {orderType === OrderType.Buying && (
            <VStack spacing={10}>
              <Text alignSelf="start">
                In order to buy {itemName}, you must allow the marketplace to
                use {etherToFixedNumber(orderPrice)} of your $GOLD.
              </Text>
              <HStack>
                <Button
                  isLoading={isApprovingGold}
                  onClick={() =>
                    onApproveMaxGoldAllowance(
                      SystemToAllow.Marketplace,
                      orderPrice,
                    )
                  }
                  variant="ghost"
                >
                  Allow All
                </Button>
                <Button
                  isLoading={isApprovingGold}
                  onClick={() =>
                    onApproveGoldAllowance(
                      SystemToAllow.Marketplace,
                      orderPrice,
                    )
                  }
                >
                  Allow
                </Button>
              </HStack>
            </VStack>
          )}
          {orderType === OrderType.Selling && (
            <VStack p={4} spacing={10}>
              <Text>
                In order to sell {itemName}, you must allow the marketplace to
                manage your items.
              </Text>
              <Button
                onClick={() =>
                  onSetApprovalForAllItems(SystemToAllow.Marketplace)
                }
                isLoading={isApprovingItems}
              >
                Allow
              </Button>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
