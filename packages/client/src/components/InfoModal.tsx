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
import { ReactNode } from 'react';

type InfoModalProps = {
  children: ReactNode;
  heading: string;
  isOpen: boolean;
  onClose: () => void;
};

export const InfoModal: React.FC<InfoModalProps> = ({
  children,
  heading,
  isOpen,
  onClose,
}): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text>{heading}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>{children}</ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
