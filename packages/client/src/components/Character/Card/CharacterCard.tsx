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

import { CharacterCardItem } from './CharacterCardItem';

export const CharacterCard = ({
  name,
  image,
  icon,
  disabled,
  str,
  agi,
  int,
}: {
  name: string;
  image: string;
  icon: string;
  disabled: boolean;
  str: number;
  agi: number;
  int: number;
}): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Equipt?</ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={4}>
            <CharacterCardItem
              name={name}
              image={image}
              disabled={disabled}
              str={str}
              int={int}
              agi={agi}
              icon={icon}
            ></CharacterCardItem>
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
        <CharacterCardItem
          name={name}
          image={image}
          disabled={disabled}
          str={str}
          int={int}
          agi={agi}
          icon={icon}
        ></CharacterCardItem>
      </Box>
    </Box>
  );
};
