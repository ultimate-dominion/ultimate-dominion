import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
        <ModalHeader>{heading}</ModalHeader>
        <ModalCloseButton />
        <ModalBody padding={4}>{children}</ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
