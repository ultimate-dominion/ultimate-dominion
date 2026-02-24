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

import { useAllowance } from '../contexts/AllowanceContext';
import { etherToFixedNumber } from '../utils/helpers';
import { OrderType, SystemToAllow } from '../utils/types';

import { PolygonalCard } from './PolygonalCard';

export const ShopAllowanceModal = ({
  completeMessage = 'Permission granted!',
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
    onApproveMaxGoldAllowance,
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
          <ModalHeader>Shop Permissions</ModalHeader>
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
        <ModalHeader>Shop Permissions</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={8}>
          {orderType === OrderType.Buying && (
            <Text alignSelf="start">
              In order to buy {itemName}, you need to give permission to spend{' '}
              {etherToFixedNumber(orderPrice)} Gold.
            </Text>
          )}
          {orderType === OrderType.Selling && (
            <Text>
              In order to sell {itemName}, you must allow the shop to manage
              your items.
            </Text>
          )}
        </ModalBody>
        <ModalFooter alignItems="start" gap={3}>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
          {orderType === OrderType.Buying && (
            <VStack spacing={1}>
              <Button
                isLoading={isApprovingGold}
                onClick={() =>
                  onApproveGoldAllowance(SystemToAllow.Shop, orderPrice)
                }
              >
                Allow Spending
              </Button>
              {!isApprovingGold && (
                <Tooltip
                  bg="#070D2A"
                  hasArrow
                  label="This allows you to spend Gold on Shops without having to approve each transaction. It is a faster and smoother experience."
                  placement="top"
                  shouldWrapChildren
                >
                  <Button
                    color="blue400"
                    fontWeight={500}
                    isLoading={isApprovingGold}
                    onClick={() =>
                      onApproveMaxGoldAllowance(SystemToAllow.Shop, orderPrice)
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
          )}
          {orderType === OrderType.Selling && (
            <Button
              isLoading={isApprovingItems}
              onClick={() => onSetApprovalForAllItems(SystemToAllow.Shop)}
            >
              Allow Spending
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
