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

import { useTranslation } from 'react-i18next';

import { useAllowance } from '../contexts/AllowanceContext';
import { etherToFixedNumber } from '../utils/helpers';
import { OrderType, SystemToAllow } from '../utils/types';

import { PolygonalCard } from './PolygonalCard';

export const MarketplaceAllowanceModal = ({
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
  const { t } = useTranslation('ui');
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
          <PolygonalCard isModal />
          <ModalHeader>{t('allowance.marketplaceTitle')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody px={8}>
            <Text textAlign="center">{completeMessage}</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button onClick={onClose} variant="ghost">
              {t('common.close')}
            </Button>
            <Button isLoading={isCompleting} onClick={onComplete}>
              {t('common.complete')}
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
        <ModalHeader>{t('allowance.marketplaceTitle')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={8}>
          {orderType === OrderType.Buying && (
            <Text alignSelf="start">
              {t('allowance.buyPermission', { item: itemName, price: etherToFixedNumber(orderPrice) })}
            </Text>
          )}
          {orderType === OrderType.Selling && (
            <Text>
              {t('allowance.sellPermissionMarketplace', { item: itemName })}
            </Text>
          )}
        </ModalBody>
        <ModalFooter alignItems="start" gap={3}>
          <Button onClick={onClose} variant="ghost">
            {t('common.close')}
          </Button>
          {orderType === OrderType.Buying && (
            <VStack spacing={1}>
              <Button
                isLoading={isApprovingGold}
                onClick={() =>
                  onApproveGoldAllowance(SystemToAllow.Marketplace, orderPrice)
                }
              >
                {t('common.allowSpending')}
              </Button>
              {!isApprovingGold && (
                <Tooltip
                  bg="#14120F"
                  hasArrow
                  label={t('allowance.marketplaceAlwaysAllowTooltip')}
                  placement="top"
                  shouldWrapChildren
                >
                  <Button
                    color="blue400"
                    fontWeight={500}
                    isLoading={isApprovingGold}
                    onClick={() =>
                      onApproveMaxGoldAllowance(
                        SystemToAllow.Marketplace,
                        orderPrice,
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
                    {t('common.alwaysAllow')}
                  </Button>
                </Tooltip>
              )}
            </VStack>
          )}
          {orderType === OrderType.Selling && (
            <Button
              onClick={() =>
                onSetApprovalForAllItems(SystemToAllow.Marketplace)
              }
              isLoading={isApprovingItems}
            >
              {t('common.allowSpending')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
