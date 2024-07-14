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
import { useMemo } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import type { Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';

type ItemEquipModalProps = Weapon & {
  isOpen: boolean;
  onClose: () => void;
};

export const ItemEquipModal: React.FC<ItemEquipModalProps> = ({
  isOpen,
  onClose,
  ...weapon
}): JSX.Element => {
  const { character } = useCharacter();

  const isOwner = useMemo(
    () => character?.owner === weapon.owner,
    [character, weapon.owner],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isOwner ? 'Equip Item' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody padding={4}>
          <Text mb={6}>Do you want to equip this item?</Text>
          <ItemCard {...weapon} />
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Yes
          </Button>
          <Button onClick={onClose} variant="ghost">
            No
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
