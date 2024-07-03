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
  agi,
  disabled,
  icon,
  image,
  int,
  isPlayer,
  name,
  str,
}: {
  agi: number;
  disabled: boolean;
  icon: string;
  image: string;
  int: number;
  isPlayer: boolean;
  name: string;
  str: number;
}): JSX.Element => {
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <Box>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isPlayer ? 'Equipt?' : 'Make an offer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={4}>
            <CharacterCardItem
              agi={agi}
              disabled={disabled}
              icon={icon}
              image={image}
              int={int}
              name={name}
              str={str}
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
          agi={agi}
          disabled={disabled}
          icon={icon}
          image={image}
          int={int}
          name={name}
          str={str}
        ></CharacterCardItem>
      </Box>
    </Box>
  );
};
