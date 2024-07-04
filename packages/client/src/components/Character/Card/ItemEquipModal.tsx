import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from '@chakra-ui/react';

import { ItemCard } from './ItemCard';

export const ItemEquipModal = ({
  agi,
  disabled,
  icon,
  image,
  int,
  isOwner,
  name,
  str,
}: {
  agi: number;
  disabled: boolean;
  icon: string;
  image: string;
  int: number;
  isOwner: boolean;
  name: string;
  str: number;
}): JSX.Element => {
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <Box>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isOwner ? 'Equip' : 'Make an offer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={4}>
            <ItemCard
              agi={agi}
              disabled={disabled}
              icon={icon}
              image={image}
              int={int}
              name={name}
              str={str}
            ></ItemCard>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Yes
            </Button>
            <Button variant="ghost">No</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Box onClick={onOpen}>
        <ItemCard
          agi={agi}
          disabled={disabled}
          icon={icon}
          image={image}
          int={int}
          name={name}
          str={str}
        ></ItemCard>
      </Box>
    </Box>
  );
};
