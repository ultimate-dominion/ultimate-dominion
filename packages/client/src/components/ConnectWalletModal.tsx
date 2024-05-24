import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';

import { ConnectWalletButton } from './ConnectWalletButton';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Connect Wallet</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack p={10} spacing={10}>
            <Text textAlign="center">Connect your wallet to play.</Text>
            <ConnectWalletButton />
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
