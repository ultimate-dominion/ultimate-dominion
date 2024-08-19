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
import type { Armor, Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';

type ItemEquipModalProps = (Armor | Weapon) & {
  isEquipped: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const ItemEquipModal: React.FC<ItemEquipModalProps> = ({
  isEquipped,
  isOpen,
  onClose,
  ...item
}): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { equipItems, unequipItem },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [isEquipping, setIsEquipping] = useState(false);

  const isOwner = useMemo(
    () => character?.owner === item.owner,
    [character, item.owner],
  );

  const onEquipItem = useCallback(async () => {
    try {
      setIsEquipping(true);

      if (!character) {
        throw new Error('Character not found.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const { error, success } = await equipItems(character.id, [item.tokenId]);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess(`${item.name} equipped successfully!`);
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to equip item.', e);
    } finally {
      setIsEquipping(false);
    }
  }, [
    character,
    delegatorAddress,
    equipItems,
    item,
    onClose,
    refreshCharacter,
    renderError,
    renderSuccess,
  ]);

  const onUnequipItem = useCallback(async () => {
    try {
      setIsEquipping(true);

      if (!character) {
        throw new Error('Character not found.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const { error, success } = await unequipItem(character.id, item.tokenId);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess(`${item.name} unequipped successfully!`);
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to unequip item.', e);
    } finally {
      setIsEquipping(false);
    }
  }, [
    character,
    delegatorAddress,
    item,
    onClose,
    refreshCharacter,
    renderError,
    renderSuccess,
    unequipItem,
  ]);

  if (isEquipped) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {isOwner ? 'Unequip Item' : 'Make an offer'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={4}>
            {isOwner ? (
              <Text mb={6}>Do you want to unequip this item?</Text>
            ) : (
              <Text mb={6}>Do you want to make an offer for this item?</Text>
            )}
            <ItemCard {...item} />
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
        <ModalBody p={4}>
          {isOwner ? (
            <Text mb={6}>Do you want to equip this item?</Text>
          ) : (
            <Text mb={6}>Do you want to make an offer for this item?</Text>
          )}
          <ItemCard {...item} />
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
