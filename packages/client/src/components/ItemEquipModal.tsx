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
import { useCallback, useMemo, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import type { Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';

type ItemEquipModalProps = Weapon & {
  isEquipped: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const ItemEquipModal: React.FC<ItemEquipModalProps> = ({
  isEquipped,
  isOpen,
  onClose,
  ...weapon
}): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    burnerBalance,
    delegatorAddress,
    systemCalls: { equipItems, unequipItem },
  } = useMUD();
  const { character } = useCharacter();

  const [isEquipping, setIsEquipping] = useState(false);

  const isOwner = useMemo(
    () => character?.owner === weapon.owner,
    [character, weapon.owner],
  );

  const onEquipItem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsEquipping(true);

        if (!character) {
          throw new Error('Character not found.');
        }

        if (burnerBalance === '0') {
          throw new Error(
            'Insufficient funds. Please top off your session account.',
          );
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const success = await equipItems(character.characterId, [
          weapon.tokenId,
        ]);

        if (!success) {
          throw new Error('Contract call failed');
        }

        renderSuccess(`${weapon.name} equipped successfully!`);
        onClose();
      } catch (e) {
        renderError(e, 'Failed to equip item.');
      } finally {
        setIsEquipping(false);
      }
    },
    [
      burnerBalance,
      character,
      delegatorAddress,
      equipItems,
      onClose,
      renderError,
      renderSuccess,
      weapon,
    ],
  );

  const onUnequipItem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsEquipping(true);

        if (!character) {
          throw new Error('Character not found.');
        }

        if (burnerBalance === '0') {
          throw new Error(
            'Insufficient funds. Please top off your session account.',
          );
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const success = await unequipItem(
          character.characterId,
          weapon.tokenId,
        );

        if (!success) {
          throw new Error('Contract call failed');
        }

        renderSuccess(`${weapon.name} unequipped successfully!`);
        onClose();
      } catch (e) {
        renderError(e, 'Failed to unequip item.');
      } finally {
        setIsEquipping(false);
      }
    },
    [
      burnerBalance,
      character,
      delegatorAddress,
      onClose,
      renderError,
      renderSuccess,
      unequipItem,
      weapon,
    ],
  );

  if (isEquipped) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {isOwner ? 'Unequip Item' : 'Make an offer'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={4}>
            {isOwner ? (
              <Text mb={6}>Do you want to unequip this item?</Text>
            ) : (
              <Text mb={6}>Do you want to make an offer for this item?</Text>
            )}
            <ItemCard {...weapon} />
          </ModalBody>
          <ModalFooter>
            <Button
              isLoading={isEquipping}
              loadingText="Unequipping..."
              mr={3}
              onClick={isOwner ? onUnequipItem : onClose}
            >
              Yes
            </Button>
            <Button isDisabled={isEquipping} onClick={onClose} variant="ghost">
              No
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isOwner ? 'Equip Item' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody padding={4}>
          {isOwner ? (
            <Text mb={6}>Do you want to equip this item?</Text>
          ) : (
            <Text mb={6}>Do you want to make an offer for this item?</Text>
          )}
          <ItemCard {...weapon} />
        </ModalBody>
        <ModalFooter>
          <Button
            isLoading={isEquipping}
            loadingText="Equipping..."
            mr={3}
            onClick={isOwner ? onEquipItem : onClose}
          >
            Yes
          </Button>
          <Button isDisabled={isEquipping} onClick={onClose} variant="ghost">
            No
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
