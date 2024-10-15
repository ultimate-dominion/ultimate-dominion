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
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ITEM_PATH } from '../Routes';
import { type Armor, OrderType, type Spell, type Weapon } from '../utils/types';
import { ItemCard } from './ItemCard';
import { PolygonalCard } from './PolygonalCard';

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
  const { character, equippedSpells, equippedWeapons, refreshCharacter } =
    useCharacter();
  const { inSafetyZone } = useMap();
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
    if (BigInt(character.level) < BigInt(item.minLevel)) return true;
    if (
      BigInt(character.baseStats.agility) <
      BigInt(item.statRestrictions.minAgility)
    )
      return true;
    if (
      BigInt(character.baseStats.intelligence) <
      BigInt(item.statRestrictions.minIntelligence)
    )
      return true;
    if (character.baseStats.strength < item.statRestrictions.minStrength)
      return true;
    return false;
  }, [character, item]);

  const isOneMoveEquipped = useMemo(() => {
    if (inSafetyZone) return false;
    return equippedWeapons.length + equippedSpells.length === 1;
  }, [equippedSpells.length, equippedWeapons.length, inSafetyZone]);

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
          <PolygonalCard isModal />
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
            {isOneMoveEquipped && isOwner && (
              <Text color="red" fontWeight="bold" mt={4} size="sm">
                You must have at least 1 weapon or spell equipped in the Outer
                Realms.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={(!!currentBattle || isOneMoveEquipped) && isOwner}
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
        <PolygonalCard isModal />
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
        <ModalFooter gap={3}>
          <Button isDisabled={isEquipping} onClick={onClose} variant="ghost">
            No
          </Button>
          <Button
            isDisabled={isOwner && (isMissingRequirements || !!currentBattle)}
            isLoading={isEquipping}
            loadingText="Equipping..."
            onClick={() =>
              isOwner
                ? onEquipItem()
                : navigate(`${ITEM_PATH}${item.tokenId}?${buyingSearchParams}`)
            }
          >
            Yes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
