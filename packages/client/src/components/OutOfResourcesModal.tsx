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
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';

import { PolygonalCard } from './PolygonalCard';

/**
 * Shown when a level 3+ player has both 0 ETH and 0 Gold.
 *
 * - Embedded users: "Fight monsters to earn Gold" (gas is sponsored via
 *   EIP-7702, so they can always transact to earn Gold for GasStation).
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
  const { t } = useTranslation('ui');
  const { authMethod } = useAuth();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>{t('outOfResources.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} alignItems="start">
            <Text>
              {t('outOfResources.message')}
            </Text>
            {authMethod === 'embedded' ? (
              <>
                <Text fontWeight={700}>
                  {t('outOfResources.embeddedAdvice')}
                </Text>
                <Text fontSize="sm" color="gray.400">
                  {t('outOfResources.embeddedDetail')}
                </Text>
              </>
            ) : (
              <>
                <Text fontWeight={700}>
                  {t('outOfResources.externalAdvice')}
                </Text>
                <Button
                  onClick={() => {
                    onClose();
                    onOpenWalletDetails();
                  }}
                  size="sm"
                >
                  {t('outOfResources.openWallet')}
                </Button>
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
