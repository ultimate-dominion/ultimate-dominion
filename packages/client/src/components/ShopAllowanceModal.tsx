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
} from '@chakra-ui/react';

import { useAllowance } from '../contexts/AllowanceContext';
import { etherToFixedNumber } from '../utils/helpers';
import { OrderType, SystemToAllow } from '../utils/types';
import { PolygonalCard } from './PolygonalCard';

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
  orderPrice: bigint;
  orderType: OrderType;
}): JSX.Element => {
  const {
    goldShopAllowance,
    isApprovingGold,
    isApprovingItems,
    itemsShopAllowance,
    onApproveGoldAllowance,
    onSetApprovalForAllItems,
  } = useAllowance();

  if (
    (goldShopAllowance >= orderPrice && orderType === OrderType.Buying) ||
    (itemsShopAllowance && orderType === OrderType.Selling)
  ) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>Shop Allowances</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={8}>
            <Text textAlign="center">{completeMessage}</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button onClick={onClose} variant="ghost">
              Close
            </Button>
            <Button isLoading={isCompleting} onClick={onComplete}>
              Complete
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
        <PolygonalCard isModal />
        <ModalHeader>Shop Allowances</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={8}>
          {orderType === OrderType.Buying && (
            <Text alignSelf="start">
              In order to buy {itemName}, you must allow the shop to use{' '}
              {etherToFixedNumber(orderPrice)} of your $GOLD.
            </Text>
          )}
          {orderType === OrderType.Selling && (
            <Text>
              In order to sell {itemName}, you must allow the shop to manage
              your items.
            </Text>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
          {orderType === OrderType.Buying && (
            <Button
              isLoading={isApprovingGold}
              onClick={() =>
                onApproveGoldAllowance(SystemToAllow.Shop, orderPrice)
              }
            >
              Allow
            </Button>
          )}
          {orderType === OrderType.Selling && (
            <Button
              isLoading={isApprovingItems}
              onClick={() => onSetApprovalForAllItems(SystemToAllow.Shop)}
            >
              Allow
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
