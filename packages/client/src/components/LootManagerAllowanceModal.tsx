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
  const { t } = useTranslation('ui');
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
              {t('common.close')}
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
                  {t('allowance.goldSpendPermission', { amount })}
                </Text>
              )}
              {message && <Text>{message}</Text>}
            </VStack>
          </ModalBody>
          <ModalFooter alignItems="start" gap={3}>
            <Button onClick={onClose} size="sm" variant="ghost">
              {t('common.close')}
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
                {t('common.allowSpending')}
              </Button>
              {!isApprovingGold && (
                <Tooltip
                  bg="#14120F"
                  hasArrow
                  label={t('allowance.lootManagerAlwaysAllowTooltip')}
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
                    {t('common.alwaysAllow')}
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
              <Text>{t('allowance.itemPermission')}</Text>
            )}
            {message && <Text>{message}</Text>}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} size="sm" variant="ghost">
            {t('common.close')}
          </Button>
          <Button
            isLoading={isApprovingItems}
            onClick={() => onSetApprovalForAllItems(SystemToAllow.LootManager)}
          >
            {t('common.allowSpending')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
