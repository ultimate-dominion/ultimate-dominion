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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAllowance } from '../contexts/AllowanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { ITEM_PATH } from '../Routes';
import { MAX_EQUIPPED_WEAPONS } from '../utils/constants';
import { type Consumable, OrderType, SystemToAllow } from '../utils/types';

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
  const { t } = useTranslation('ui');
  const { renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { equipItems, unequipItem, useWorldConsumableItem },
  } = useMUD();
  const { character, equippedConsumables, equippedSpells, equippedWeapons } =
    useCharacter();
  const { authMethod } = useAuth();
  const { isSpawned } = useMap();
  const { currentBattle } = useBattle();
  const { ensureItemsAllowance, itemsLootManagerAllowance } = useAllowance();

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
  const [statusText, setStatusText] = useState('');

  // Reset consumed state when modal opens so players can consume multiple
  useEffect(() => {
    if (isOpen) {
      setIsConsumed(false);
      setStatusText('');
      setItemBalance(item.balance);
    }
  }, [isOpen, item.balance]);

  const isOwner = useMemo(
    () => character?.owner === item.owner,
    [character, item.owner],
  );

  const totalEquippedSlots = useMemo(
    () => equippedWeapons.length + equippedSpells.length + equippedConsumables.length,
    [equippedConsumables.length, equippedSpells.length, equippedWeapons.length],
  );

  const maxSlotsReached = totalEquippedSlots >= MAX_EQUIPPED_WEAPONS;

  const isHealthRestore = useMemo(
    () => item.hpRestoreAmount !== BigInt(0),
    [item.hpRestoreAmount],
  );

  const onUseConsumable = useCallback(async () => {
    console.log('[CONSUME DEBUG]', { character: !!character, delegatorAddress, itemsLootManagerAllowance, authMethod });
    if (!character) { console.log('[CONSUME] bail: no character'); return; }
    if (!delegatorAddress) { console.log('[CONSUME] bail: no delegatorAddress'); return; }

    if (!itemsLootManagerAllowance) {
      console.log('[CONSUME] no allowance, authMethod:', authMethod);
      if (authMethod === 'embedded') {
        const ok = await ensureItemsAllowance(SystemToAllow.LootManager);
        if (!ok) return;
      } else {
        onOpenAllowanceModal();
        return;
      }
    }

    setStatusText(t('consume.consumingItem', { name: item.name }));
    const result = await consumeTx.execute(async () => {
      const { error, success } = await useWorldConsumableItem(character.id, item.tokenId);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      renderSuccess(t('consume.consumedSuccess', { name: item.name }));
      setItemBalance(prev => prev - BigInt(1));
      setIsConsumed(true);
    }
    setStatusText('');
  }, [
    authMethod,
    character,
    consumeTx,
    delegatorAddress,
    ensureItemsAllowance,
    item,
    itemsLootManagerAllowance,
    onOpenAllowanceModal,
    renderSuccess,
    useWorldConsumableItem,
  ]);

  const onEquipItem = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    setStatusText(t('equip.equippingItem', { name: item.name }));
    const result = await equipTx.execute(async () => {
      const { error, success } = await equipItems(character.id, [item.tokenId]);
      if (error && !success) {
        if (error.includes('Already equipped')) return 'already-equipped';
        throw new Error(error);
      }
      return 'ok';
    });

    if (result !== undefined) {
      if (result === 'already-equipped') {
        renderSuccess(t('equip.alreadyEquipped', { name: item.name }));
      } else {
        renderSuccess(t('consume.equippedSuccess', { name: item.name }));
      }
      setStatusText('');
      onClose();
    } else {
      setStatusText('');
    }
  }, [
    character,
    delegatorAddress,
    equipItems,
    equipTx,
    item,
    onClose,
    renderSuccess,
  ]);

  const onUnequipItem = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    const result = await unequipTx.execute(async () => {
      const { error, success } = await unequipItem(character.id, item.tokenId);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      renderSuccess(t('consume.unequippedSuccess', { name: item.name }));
      onClose();
    }
  }, [
    character,
    delegatorAddress,
    item,
    onClose,
    renderSuccess,
    unequipTx,
    unequipItem,
  ]);

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

  const isConsumeDisabled = useMemo(() => {
    if (!isOwner) return false;
    // All consumables go through battle panel during combat
    if (currentBattle) return true;
    if (isHealthFull) return true;
    if (!isSpawned) return true;
    if (maxStacksReached) return true;

    return false;
  }, [currentBattle, isHealthFull, isOwner, isSpawned, maxStacksReached]);

  const isAnyLoading = consumeTx.isLoading || equipTx.isLoading || unequipTx.isLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>{isOwner ? t('consume.consumable') : t('equip.makeOffer')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          {isOwner && character ? (
            <>
              {isConsumed ? (
                <Text mb={6}>{t('consume.consumed', { name: item.name })}</Text>
              ) : (
                <Text mb={6}>
                  {isEquipped ? t('consume.equippedReady') : t('consume.notEquipped')}{' '}
                  {item.validTime > BigInt(0) &&
                    t('consume.effectLasts', { duration: getMinutesAndSeconds(item.validTime) })}
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
            <Text mb={6}>{t('equip.wantOffer')}</Text>
          )}
          <ItemCard {...item} balance={itemBalance} isEquipped={isEquipped} />
          {isOwner && (
            <Text color="gray.500" fontSize="xs" mt={2}>
              {t('consume.slotCount', { current: totalEquippedSlots, max: MAX_EQUIPPED_WEAPONS })}
            </Text>
          )}
          {statusText && (
            <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
              {statusText}
            </Text>
          )}
          {!!currentBattle && isOwner && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              {t('consume.useThroughBattle')}
            </Text>
          )}
          {isOwner && !isSpawned && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              {t('consume.mustBeSpawned')}
            </Text>
          )}
          {isHealthRestore && isHealthFull && isOwner && !isConsumed && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              {t('consume.healthFull')}
            </Text>
          )}
          {maxStacksReached && isOwner && !isConsumed && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              {t('consume.maxStacks')}
            </Text>
          )}
        </ModalBody>
        {isConsumed ? (
          <ModalFooter flexWrap="wrap" justifyContent="center">
            <Button
              isDisabled={isAnyLoading}
              onClick={onClose}
              variant="ghost"
            >
              {t('common.close')}
            </Button>
          </ModalFooter>
        ) : (
          <ModalFooter gap={3} flexWrap="wrap" justifyContent="center">
            <Button isDisabled={isAnyLoading} onClick={onClose} variant="ghost">
              {t('common.cancel')}
            </Button>
            {isOwner && !isEquipped && (
              <Button
                isDisabled={!!currentBattle || maxSlotsReached}
                isLoading={equipTx.isLoading}
                loadingText={t('equip.equipping')}
                onClick={onEquipItem}
                variant="outline"
              >
                {t('equip.equip')}
              </Button>
            )}
            {isOwner && !isEquipped && maxSlotsReached && (
              <Text color="orange" fontSize="xs">
                {t('consume.unequipFirst')}
              </Text>
            )}
            {isOwner && isEquipped && (
              <Button
                isDisabled={!!currentBattle}
                isLoading={unequipTx.isLoading}
                loadingText={t('equip.unequipping')}
                onClick={onUnequipItem}
                variant="outline"
              >
                {t('equip.unequip')}
              </Button>
            )}
            <Button
              isDisabled={isConsumeDisabled}
              isLoading={consumeTx.isLoading}
              loadingText={t('consume.consuming')}
              onClick={() =>
                isOwner
                  ? onUseConsumable()
                  : navigate(
                      `${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`,
                    )
              }
            >
              {isOwner ? t('consume.consume') : t('consume.makeOffer')}
            </Button>
          </ModalFooter>
        )}
      </ModalContent>

      {authMethod !== 'embedded' && (
        <LootManagerAllowanceModal
          heading="Allow Consumables"
          isOpen={isAllowanceModalOpen}
          message="In order to consume items, you must allow the game to use your items."
          onClose={onCloseAllowanceModal}
          successMessage="You can now consume your item."
        />
      )}
    </Modal>
  );
};
