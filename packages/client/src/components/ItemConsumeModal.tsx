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
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAllowance } from '../contexts/AllowanceContext';
import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { ITEM_PATH } from '../Routes';
import { MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { type Consumable, OrderType } from '../utils/types';

import { HealthBar } from './HealthBar';
import { ItemCard } from './ItemCard';
import { LootManagerAllowanceModal } from './LootManagerAllowanceModal';
import { PolygonalCard } from './PolygonalCard';

const getMinutesAndSeconds = (seconds: bigint): string => {
  const secondsNumber = Number(seconds);
  const minutes = Math.floor(secondsNumber / 60);
  const remainingSeconds = secondsNumber % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

type ItemConsumeModalProps = Consumable & {
  isEquipped: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const ItemConsumeModal: React.FC<ItemConsumeModalProps> = ({
  isEquipped,
  isOpen,
  onClose,
  ...item
}): JSX.Element => {
  const navigate = useNavigate();
  const { renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { equipItems, unequipItem, useCombatConsumableItem, useWorldConsumableItem },
  } = useMUD();
  const { character, equippedConsumables, equippedSpells, equippedWeapons, refreshCharacter } =
    useCharacter();
  const { isSpawned } = useMap();
  const { currentBattle } = useBattle();
  const { itemsLootManagerAllowance } = useAllowance();

  const {
    isOpen: isAllowanceModalOpen,
    onOpen: onOpenAllowanceModal,
    onClose: onCloseAllowanceModal,
  } = useDisclosure();

  const consumeTx = useTransaction({ actionName: 'use item', showSuccessToast: false });
  const equipTx = useTransaction({ actionName: 'equip item', showSuccessToast: false });
  const unequipTx = useTransaction({ actionName: 'unequip item', showSuccessToast: false });

  const [itemBalance, setItemBalance] = useState(item.balance);
  const [isConsumed, setIsConsumed] = useState(false);

  const isOwner = useMemo(
    () => character?.owner === item.owner,
    [character, item.owner],
  );

  const totalEquippedSlots = useMemo(
    () => equippedWeapons.length + equippedSpells.length + equippedConsumables.length,
    [equippedConsumables.length, equippedSpells.length, equippedWeapons.length],
  );

  const maxSlotsReached = totalEquippedSlots >= MAX_EQUIPPED_WEAPONS;

  // Determine if equipping this consumable requires swapping out an existing item
  const conflictingItem = useMemo(() => {
    if (isEquipped) return null;
    if (!maxSlotsReached) return null;
    // Pick the lowest-rarity equipped weapon/spell/consumable to auto-swap
    const allEquipped = [...equippedWeapons, ...equippedSpells, ...equippedConsumables].sort(
      (a, b) => (a.rarity ?? 0) - (b.rarity ?? 0),
    );
    return allEquipped[0] ?? null;
  }, [equippedConsumables, equippedSpells, equippedWeapons, isEquipped, maxSlotsReached]);

  const needsSwap = conflictingItem != null;

  // Buff items (non-heal) require equipping before the contract will accept them.
  // Auto-equip transparently so the player just clicks "Consume" once.
  const needsAutoEquip = !isEquipped && !isHealthRestore && !currentBattle;

  const onUseConsumable = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    if (!itemsLootManagerAllowance) {
      onOpenAllowanceModal();
      return;
    }

    // If auto-equip needed and slots full, swap out conflicting item first
    if (needsAutoEquip && conflictingItem) {
      setStatusText(`Unequipping ${conflictingItem.name}...`);
      const unequipResult = await unequipTx.execute(async () => {
        const { error, success } = await unequipItem(character.id, conflictingItem.tokenId);
        if (error && !success) {
          if (error.includes('NOT EQUIPPED')) return 'skip';
          throw new Error(error);
        }
      });
      if (unequipResult === undefined) {
        setStatusText('');
        return;
      }
    }

    setStatusText(`Consuming ${item.name}...`);
    const result = await consumeTx.execute(async () => {
      // Auto-equip buff items that aren't equipped yet
      if (needsAutoEquip) {
        const equipResult = await equipItems(character.id, [item.tokenId]);
        if (equipResult.error && !equipResult.success) throw new Error(equipResult.error);
      }

      const { error, success } = currentBattle
        ? await useCombatConsumableItem(character.id, item.tokenId)
        : await useWorldConsumableItem(character.id, item.tokenId);
      if (error && !success) throw new Error(error);
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${item.name} was consumed!`);
      setItemBalance(prev => prev - BigInt(1));
      setIsConsumed(true);
    }
    setStatusText('');
  }, [
    character,
    conflictingItem,
    consumeTx,
    currentBattle,
    delegatorAddress,
    equipItems,
    item,
    itemsLootManagerAllowance,
    needsAutoEquip,
    onOpenAllowanceModal,
    refreshCharacter,
    renderSuccess,
    unequipItem,
    unequipTx,
    useCombatConsumableItem,
    useWorldConsumableItem,
  ]);

  const [statusText, setStatusText] = useState('');

  const onEquipItem = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    // If swap needed, unequip the conflicting item first
    if (conflictingItem) {
      setStatusText(`Unequipping ${conflictingItem.name}...`);
      const unequipResult = await unequipTx.execute(async () => {
        const { error, success } = await unequipItem(character.id, conflictingItem.tokenId);
        if (error && !success) {
          if (error.includes('NOT EQUIPPED')) return 'skip';
          throw new Error(error);
        }
      });
      if (unequipResult === undefined) {
        setStatusText('');
        return;
      }
    }

    setStatusText(`Equipping ${item.name}...`);
    const result = await equipTx.execute(async () => {
      const { error, success } = await equipItems(character.id, [item.tokenId]);
      if (error && !success) {
        if (error.includes('Already equipped')) return 'already-equipped';
        throw new Error(error);
      }
      return 'ok';
    });

    if (result !== undefined) {
      await refreshCharacter();
      if (result === 'already-equipped') {
        renderSuccess(`${item.name} is already equipped`);
      } else if (conflictingItem) {
        renderSuccess(`Swapped ${conflictingItem.name} for ${item.name}`);
      } else {
        renderSuccess(`${item.name} equipped successfully!`);
      }
      setStatusText('');
      onClose();
    } else {
      setStatusText('');
    }
  }, [
    character,
    conflictingItem,
    delegatorAddress,
    equipItems,
    equipTx,
    item,
    onClose,
    refreshCharacter,
    renderSuccess,
    unequipItem,
    unequipTx,
  ]);

  const onUnequipItem = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    const result = await unequipTx.execute(async () => {
      const { error, success } = await unequipItem(character.id, item.tokenId);
      if (error && !success) throw new Error(error);
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${item.name} unequipped successfully!`);
      onClose();
    }
  }, [
    character,
    delegatorAddress,
    item,
    onClose,
    refreshCharacter,
    renderSuccess,
    unequipTx,
    unequipItem,
  ]);

  const isHealthRestore = useMemo(
    () => item.hpRestoreAmount !== BigInt(0),
    [item.hpRestoreAmount],
  );

  const isHealthFull = useMemo(() => {
    if (!character) return false;
    if (!isHealthRestore) return false;
    return character.currentHp === character.maxHp;
  }, [character, isHealthRestore]);

  const buyingSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', OrderType.Buying);
    return searchParams;
  }, []);

  const maxStacksReached = useMemo(() => {
    if (!isOwner) return false;
    if (!character) return false;
    if (!item) return false;

    const effectsApplied = character.worldStatusEffects.filter(
      effect => effect.active && item.effects.includes(effect.effectId),
    );

    const effectsCounter = effectsApplied.reduce(
      (acc, effect) => {
        if (acc[effect.effectId as string]) {
          acc[effect.effectId as string] += 1;
        } else {
          acc[effect.effectId as string] = 1;
        }
        return acc;
      },

      {} as Record<string, number>,
    );

    const effectsAtMaxStacks = Object.values(effectsCounter).filter(
      count => count >= item.maxStacks,
    );

    return effectsAtMaxStacks.length > 0;
  }, [character, isOwner, item]);

  // Check if this is an instant heal consumable (can be used in combat)
  const isInstantHeal = useMemo(
    () => item.hpRestoreAmount !== BigInt(0),
    [item.hpRestoreAmount],
  );

  const isConsumeDisabled = useMemo(() => {
    if (!isOwner) return false;
    // Only allow instant heal items during combat
    if (currentBattle && !isInstantHeal) return true;
    if (isHealthFull) return true;
    if (!isSpawned) return true;
    if (maxStacksReached) return true;
    // Auto-equip would fail if slots are full and no swap candidate available
    if (needsAutoEquip && maxSlotsReached && !conflictingItem) return true;

    return false;
  }, [conflictingItem, currentBattle, isHealthFull, isInstantHeal, isOwner, isSpawned, maxStacksReached, maxSlotsReached, needsAutoEquip]);

  const isAnyLoading = consumeTx.isLoading || equipTx.isLoading || unequipTx.isLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>{isOwner ? 'Consumable' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          {isOwner && character ? (
            <>
              {isConsumed ? (
                <Text mb={6}>{item.name} was consumed!</Text>
              ) : (
                <Text mb={6}>
                  {isEquipped ? 'This consumable is equipped and ready for combat.' : 'This consumable is not equipped.'}{' '}
                  {item.validTime > BigInt(0) &&
                    `Its effect lasts ${getMinutesAndSeconds(item.validTime)}.`}
                </Text>
              )}
              {isHealthRestore && (
                <HealthBar
                  currentHp={character.currentHp}
                  maxHp={character.maxHp}
                  mb={4}
                  level={character.level}
                />
              )}
            </>
          ) : (
            <Text mb={6}>Do you want to make an offer for this item?</Text>
          )}
          <ItemCard {...item} balance={itemBalance} isEquipped={isEquipped} />
          {isOwner && (
            <Text color="gray.500" fontSize="xs" mt={2}>
              Slot {totalEquippedSlots}/{MAX_EQUIPPED_WEAPONS} equipped
            </Text>
          )}
          {needsSwap && isOwner && !isEquipped && (
            <Text color="#D4A54A" fontWeight="bold" fontSize="sm" mt={2}>
              Equipping will swap out {conflictingItem?.name}
            </Text>
          )}
          {statusText && (
            <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
              {statusText}
            </Text>
          )}
          {!!currentBattle && isOwner && !isInstantHeal && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You cannot consume this during battle.
            </Text>
          )}
          {!!currentBattle && isOwner && isInstantHeal && (
            <Text color="green" fontWeight="bold" mt={4} size="sm">
              This healing item can be used during combat!
            </Text>
          )}
          {isOwner && !isSpawned && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              You must be spawned to consume items.
            </Text>
          )}
          {isHealthRestore && isHealthFull && isOwner && !isConsumed && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              Your health is full.
            </Text>
          )}
          {maxStacksReached && isOwner && !isConsumed && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              You have reached the maximum of this item you can consume at once.
            </Text>
          )}
        </ModalBody>
        {isConsumed ? (
          <ModalFooter>
            <Button
              isDisabled={isAnyLoading}
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          </ModalFooter>
        ) : (
          <ModalFooter gap={3}>
            <Button isDisabled={isAnyLoading} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            {isOwner && !isEquipped && (
              <Button
                isDisabled={!!currentBattle || (maxSlotsReached && !conflictingItem)}
                isLoading={equipTx.isLoading || unequipTx.isLoading}
                loadingText={needsSwap ? 'Swapping...' : 'Equipping...'}
                onClick={onEquipItem}
                variant="outline"
              >
                {needsSwap ? 'Swap' : 'Equip'}
              </Button>
            )}
            {isOwner && isEquipped && (
              <Button
                isDisabled={!!currentBattle}
                isLoading={unequipTx.isLoading}
                loadingText="Unequipping..."
                onClick={onUnequipItem}
                variant="outline"
              >
                Unequip
              </Button>
            )}
            <Button
              isDisabled={isConsumeDisabled}
              isLoading={consumeTx.isLoading}
              loadingText="Consuming..."
              onClick={() =>
                isOwner
                  ? onUseConsumable()
                  : navigate(
                      `${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`,
                    )
              }
            >
              {isOwner ? 'Consume' : 'Make Offer'}
            </Button>
          </ModalFooter>
        )}
      </ModalContent>

      <LootManagerAllowanceModal
        heading="Allow Consumables"
        isOpen={isAllowanceModalOpen}
        message="In order to consume items, you must allow the game to use your items."
        onClose={onCloseAllowanceModal}
        successMessage="You can now consume your item."
      />
    </Modal>
  );
};
