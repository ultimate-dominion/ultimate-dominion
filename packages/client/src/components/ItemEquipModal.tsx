import {
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { GAME_BOARD_PATH, ITEM_PATH } from '../Routes';
import { MAX_EQUIPPED_ARMOR, MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import {
  type Armor,
  ItemType,
  OrderType,
  type Spell,
  type Weapon,
} from '../utils/types';

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
  const {
    character,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    optimisticEquip,
    optimisticUnequip,
    refreshCharacter,
  } = useCharacter();
  const { inSafetyZone, isSpawned } = useMap();
  const { currentBattle } = useBattle();

  const [statusText, setStatusText] = useState('');

  const equipTx = useTransaction({ actionName: 'equip item', showSuccessToast: false });
  const unequipTx = useTransaction({ actionName: 'unequip item', showSuccessToast: false });

  const isLoading = equipTx.isLoading || unequipTx.isLoading;

  const isOwner = useMemo(() => {
    return character?.owner === item.owner;
  }, [character, item.owner]);

  // Determine if equipping this item requires swapping out an existing one
  const conflictingItem = useMemo(() => {
    if (isEquipped) return null;
    if (item.itemType === ItemType.Armor) {
      if (equippedArmor.length >= MAX_EQUIPPED_ARMOR) {
        return equippedArmor[0];
      }
    } else if (
      item.itemType === ItemType.Weapon ||
      item.itemType === ItemType.Spell
    ) {
      const totalEquipped = equippedWeapons.length + equippedSpells.length;
      if (totalEquipped >= MAX_EQUIPPED_WEAPONS) {
        // Pick the lowest-rarity equipped weapon/spell to auto-swap
        const allEquipped = [...equippedWeapons, ...equippedSpells].sort(
          (a, b) => (a.rarity ?? 0) - (b.rarity ?? 0),
        );
        return allEquipped[0] ?? null;
      }
    }
    return null;
  }, [equippedArmor, equippedSpells, equippedWeapons, isEquipped, item.itemType]);

  const needsSwap = conflictingItem != null;

  const closeAndReset = useCallback(() => {
    setStatusText('');
    onClose();
  }, [onClose]);

  const onEquipItem = useCallback(async () => {
    if (!character) {
      renderError('No character found. Please select a character.');
      return;
    }
    if (!delegatorAddress) {
      renderError('Wallet not connected. Please reconnect your wallet.');
      return;
    }

    // If swap needed, unequip the conflicting item first
    if (conflictingItem) {
      setStatusText(`Unequipping ${conflictingItem.name}...`);
      const unequipResult = await unequipTx.execute(async () => {
        const { error, success } = await unequipItem(
          character.id,
          conflictingItem.tokenId,
        );
        if (error && !success) {
          // If item wasn't actually equipped (stale state), skip unequip
          if (error.includes('NOT EQUIPPED')) return 'skip';
          throw new Error(error);
        }
      });

      if (unequipResult === undefined) {
        setStatusText('');
        return; // unequip failed for a real reason
      }
    }

    setStatusText(`Equipping ${item.name}...`);
    const result = await equipTx.execute(async () => {
      const { error, success } = await equipItems(character.id, [item.tokenId]);
      if (error && !success) {
        // If item is already equipped on-chain (stale client state), treat as success
        if (error.includes('Already equipped')) return 'already-equipped';
        throw new Error(error);
      }
      return 'ok';
    });

    if (result !== undefined) {
      if (result === 'already-equipped') {
        // RECS is stale — optimistically update UI and clear cache
        optimisticEquip(item as Armor | Spell | Weapon);
        renderSuccess(`${item.name} is already equipped`);
      } else {
        await refreshCharacter();
        if (conflictingItem) {
          renderSuccess(`Swapped ${conflictingItem.name} for ${item.name}`);
        } else {
          renderSuccess(`${item.name} equipped`);
        }
      }
      closeAndReset();
    } else {
      setStatusText('');
    }
  }, [
    character,
    closeAndReset,
    conflictingItem,
    delegatorAddress,
    equipItems,
    equipTx,
    item,
    optimisticEquip,
    refreshCharacter,
    renderError,
    renderSuccess,
    unequipItem,
    unequipTx,
  ]);

  const onUnequipItem = useCallback(async () => {
    if (!character) {
      renderError('No character found. Please select a character.');
      return;
    }
    if (!delegatorAddress) {
      renderError('Wallet not connected. Please reconnect your wallet.');
      return;
    }

    setStatusText(`Unequipping ${item.name}...`);
    const result = await unequipTx.execute(async () => {
      const { error, success } = await unequipItem(character.id, item.tokenId);
      if (error && !success) {
        // If item isn't actually equipped on-chain (stale client state), treat as success
        if (error.includes('NOT EQUIPPED')) return 'not-equipped';
        throw new Error(error);
      }
      return 'ok';
    });

    if (result !== undefined) {
      if (result === 'not-equipped') {
        // RECS is stale — optimistically update UI and clear cache
        optimisticUnequip(item.tokenId, item.itemType);
        renderSuccess(`${item.name} is already unequipped`);
      } else {
        await refreshCharacter();
        renderSuccess(`${item.name} unequipped`);
      }
      closeAndReset();
    } else {
      setStatusText('');
    }
  }, [
    character,
    closeAndReset,
    delegatorAddress,
    item,
    optimisticUnequip,
    refreshCharacter,
    renderError,
    renderSuccess,
    unequipTx,
    unequipItem,
  ]);

  const isNotGameBoard = useMemo(() => {
    return !window.location.pathname.includes(GAME_BOARD_PATH);
  }, []);

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
    if (!isSpawned) return false;
    if (inSafetyZone) return false;
    if (item.itemType !== ItemType.Weapon && item.itemType !== ItemType.Spell)
      return false;
    return equippedWeapons.length + equippedSpells.length === 1;
  }, [
    equippedSpells.length,
    equippedWeapons.length,
    inSafetyZone,
    isSpawned,
    item,
  ]);

  const buyingSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', OrderType.Buying);
    return searchParams;
  }, []);

  if (isEquipped) {
    return (
      <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>
            {isOwner ? 'Unequip Item' : 'Make an offer'}
          </ModalHeader>
          {!isLoading && <ModalCloseButton />}
          <ModalBody px={{ base: 6, sm: 8 }}>
            {isOwner ? (
              <Text mb={6}>Do you want to unequip this item?</Text>
            ) : (
              <Text mb={6}>Do you want to make an offer for this item?</Text>
            )}
            <ItemCard {...item} />

            {!!currentBattle && isNotGameBoard && isOwner && (
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
            {statusText && (
              <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
                {statusText}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={isLoading} onClick={onClose} variant="ghost">
              No
            </Button>
            <Button
              isDisabled={
                (!!currentBattle || isOneMoveEquipped) &&
                isNotGameBoard &&
                isOwner
              }
              isLoading={unequipTx.isLoading}
              loadingText="Unequipping..."
              mr={3}
              onClick={() =>
                isOwner
                  ? onUnequipItem()
                  : navigate(
                      `${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`,
                    )
              }
            >
              Yes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          {isOwner
            ? needsSwap
              ? 'Swap Item'
              : 'Equip Item'
            : 'Make an offer'}
        </ModalHeader>
        {!isLoading && <ModalCloseButton />}
        <ModalBody px={{ base: 6, sm: 8 }}>
          {isOwner ? (
            needsSwap ? (
              <Text mb={6}>
                Equipping{' '}
                <Text as="span" fontWeight="bold">
                  {item.name}
                </Text>{' '}
                will unequip{' '}
                <Text as="span" fontWeight="bold">
                  {conflictingItem?.name}
                </Text>
                .
              </Text>
            ) : (
              <Text mb={6}>Do you want to equip this item?</Text>
            )
          ) : (
            <Text mb={6}>Do you want to make an offer for this item?</Text>
          )}
          <ItemCard {...item} />
          {isMissingRequirements && isOwner && character && (
            <VStack align="start" mt={4} spacing={1}>
              <Text color="red" fontWeight="bold" size="sm">
                Missing requirements:
              </Text>
              {BigInt(character.level) < BigInt(item.minLevel) && (
                <HStack>
                  <Text color="red" size="sm">Level {item.minLevel.toString()} required</Text>
                  <Text color="grey400" size="sm">(you: {character.level.toString()})</Text>
                </HStack>
              )}
              {BigInt(character.baseStats.agility) < BigInt(item.statRestrictions.minAgility) && (
                <HStack>
                  <Text color="red" size="sm">AGI {item.statRestrictions.minAgility.toString()} required</Text>
                  <Text color="grey400" size="sm">(you: {character.baseStats.agility.toString()})</Text>
                </HStack>
              )}
              {BigInt(character.baseStats.intelligence) < BigInt(item.statRestrictions.minIntelligence) && (
                <HStack>
                  <Text color="red" size="sm">INT {item.statRestrictions.minIntelligence.toString()} required</Text>
                  <Text color="grey400" size="sm">(you: {character.baseStats.intelligence.toString()})</Text>
                </HStack>
              )}
              {BigInt(character.baseStats.strength) < BigInt(item.statRestrictions.minStrength) && (
                <HStack>
                  <Text color="red" size="sm">STR {item.statRestrictions.minStrength.toString()} required</Text>
                  <Text color="grey400" size="sm">(you: {character.baseStats.strength.toString()})</Text>
                </HStack>
              )}
            </VStack>
          )}
          {!!currentBattle && isNotGameBoard && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You cannot equip items during a battle.
            </Text>
          )}
          {statusText && (
            <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
              {statusText}
            </Text>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button isDisabled={isLoading} onClick={onClose} variant="ghost">
            No
          </Button>
          <Button
            isDisabled={
              isOwner &&
              isNotGameBoard &&
              (isMissingRequirements || !!currentBattle)
            }
            isLoading={isLoading}
            loadingText={needsSwap ? 'Swapping...' : 'Equipping...'}
            onClick={() =>
              isOwner
                ? onEquipItem()
                : navigate(`${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`)
            }
          >
            {needsSwap ? 'Swap' : 'Yes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
