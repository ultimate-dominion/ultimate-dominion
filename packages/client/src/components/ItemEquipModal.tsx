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
import { useNavigate } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ITEM_PATH } from '../Routes';
import { type Armor, OrderType, type Spell, type Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';

type ItemEquipModalProps = (Armor | Spell | Weapon) & {
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
  const navigate = useNavigate();
  const { renderError, renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { equipItems, unequipItem },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { currentBattle } = useBattle();

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

  const isMissingRequirements = useMemo(() => {
    if (!character) return false;
    if (character.level < item.minLevel) return true;
    if (character.agility < item.statRestrictions.minAgility) return true;
    if (character.intelligence < item.statRestrictions.minIntelligence)
      return true;
    if (character.strength < item.statRestrictions.minStrength) return true;
    return false;
  }, [character, item]);

  const buyingSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', OrderType.Buying);
    return searchParams;
  }, []);

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

            {!!currentBattle && isOwner && (
              <Text color="red" fontWeight="bold" mt={4} size="sm">
                You cannot unequip items during a battle.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={!!currentBattle && isOwner}
              isLoading={isEquipping}
              loadingText="Unequipping..."
              mr={3}
              onClick={() =>
                isOwner
                  ? onUnequipItem()
                  : navigate(
                      `${ITEM_PATH}${item.tokenId}?${buyingSearchParams}`,
                    )
              }
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
          {isMissingRequirements && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You do not meet the requirements to equip this item.
            </Text>
          )}
          {!!currentBattle && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You cannot equip items during a battle.
            </Text>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={isOwner && (isMissingRequirements || !!currentBattle)}
            isLoading={isEquipping}
            loadingText="Equipping..."
            mr={3}
            onClick={() =>
              isOwner
                ? onEquipItem()
                : navigate(`${ITEM_PATH}${item.tokenId}?${buyingSearchParams}`)
            }
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
