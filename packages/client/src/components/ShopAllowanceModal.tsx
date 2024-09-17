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
import { OrderType } from '../utils/types';

export const ShopAllowanceModal = ({
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
  orderPrice: string;
  orderType: OrderType;
}): JSX.Element => {
  const {
    goldAllowanceShops,
    isApprovingGoldShops,
    isApprovingItemsShops,
    itemsAllowanceShops,
    onApproveGoldAllowance,
    onSetApprovalForAllItems,
  } = useAllowance();

  if (
    (goldAllowanceShops >= parseEther(orderPrice) &&
      orderType === OrderType.Buying) ||
    (itemsAllowanceShops && orderType === OrderType.Selling)
  ) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Shop Allowances</ModalHeader>
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
        <ModalHeader>Shop Allowances</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          {orderType === OrderType.Buying && (
            <VStack spacing={10}>
              <Text alignSelf="start">
                In order to buy {itemName}, you must allow the shop to use{' '}
                {orderPrice} of your $GOLD.
              </Text>
              <Button
                isLoading={isApprovingGoldShops}
                onClick={() => onApproveGoldAllowance(orderPrice, '1')}
              >
                Allow
              </Button>
            </VStack>
          )}
          {orderType === OrderType.Selling && (
            <VStack p={4} spacing={10}>
              <Text>
                In order to sell {itemName}, you must allow the shop to manage
                your items.
              </Text>
              <Button
                onClick={() => onSetApprovalForAllItems('1')}
                isLoading={isApprovingItemsShops}
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
