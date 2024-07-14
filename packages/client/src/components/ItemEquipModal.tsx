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
import { useMemo } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import type { Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';

export const ItemEquipModal = (weapon: Weapon): JSX.Element => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { character } = useCharacter();

  const isOwner = useMemo(
    () => character?.owner === weapon.owner,
    [character, weapon.owner],
  );

  return (
    <Box>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isOwner ? 'Equip' : 'Make an offer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={4}>
            <ItemCard {...weapon} />
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
        <ItemCard {...weapon} />
      </Box>
    </Box>
  );
};
