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
import { ITEM_PATH } from '../Routes';
import { type Consumable, OrderType } from '../utils/types';
import { HealthBar } from './HealthBar';
import { ItemCard } from './ItemCard';
import { LootManagerAllowanceModal } from './LootManagerAllowanceModal';

const getMinutesAndSeconds = (seconds: bigint): string => {
  const secondsNumber = Number(seconds);
  const minutes = Math.floor(secondsNumber / 60);
  const remainingSeconds = secondsNumber % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

type ItemConsumeModalProps = Consumable & {
  isOpen: boolean;
  onClose: () => void;
};

export const ItemConsumeModal: React.FC<ItemConsumeModalProps> = ({
  isOpen,
  onClose,
  ...item
}): JSX.Element => {
  const navigate = useNavigate();
  const { renderError, renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { useWorldConsumableItem },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { isSpawned } = useMap();
  const { currentBattle } = useBattle();
  const { itemsLootManagerAllowance } = useAllowance();

  const {
    isOpen: isAllowanceModalOpen,
    onOpen: onOpenAllowanceModal,
    onClose: onCloseAllowanceModal,
  } = useDisclosure();

  const [itemBalance, setItemBalance] = useState(item.balance);
  const [isConsuming, setIsConsuming] = useState(false);
  const [isConsumed, setIsConsumed] = useState(false);

  const isOwner = useMemo(
    () => character?.owner === item.owner,
    [character, item.owner],
  );

  const onUseConsumable = useCallback(async () => {
    try {
      setIsConsuming(true);

      if (!character) {
        throw new Error('Character not found.');
      }

      if (!delegatorAddress) {
        throw new Error('Delegator address not found.');
      }

      if (!item) {
        throw new Error('Consumable item not found.');
      }

      if (!itemsLootManagerAllowance) {
        onOpenAllowanceModal();
        return;
      }

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { error, success } = await useWorldConsumableItem(
        character.id,
        item.tokenId,
      );

      if (error && !success) {
        throw new Error(error);
      }
      await refreshCharacter();
      renderSuccess(`${item.name} was consumed!`);
      setItemBalance(prev => prev - BigInt(1));
      setIsConsumed(true);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to consume item.', e);
    } finally {
      setIsConsuming(false);
    }
  }, [
    character,
    delegatorAddress,
    item,
    itemsLootManagerAllowance,
    onOpenAllowanceModal,
    refreshCharacter,
    renderError,
    renderSuccess,
    useWorldConsumableItem,
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

    const effectsApplied = character.worldStatusEffects.filter(effect =>
      item.effects.includes(effect.effectId),
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

  const isDisabled = useMemo(() => {
    if (!isOwner) return false;
    if (currentBattle) return true;
    if (isHealthFull) return true;
    if (!isSpawned) return true;
    if (maxStacksReached) return true;

    return false;
  }, [currentBattle, isHealthFull, isOwner, isSpawned, maxStacksReached]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isOwner ? 'Consume Item' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          {isOwner && character ? (
            <>
              {isConsumed ? (
                <Text mb={6}>{item.name} was consumed!</Text>
              ) : (
                <Text mb={6}>
                  Do you want to consume this item?{' '}
                  {item.validTime > BigInt(0) &&
                    `Its effect will last for ${getMinutesAndSeconds(item.validTime)}.`}
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
          <ItemCard {...item} balance={itemBalance} />
          {!!currentBattle && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You cannot consume this during battle.
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
              isDisabled={isConsuming}
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          </ModalFooter>
        ) : (
          <ModalFooter>
            <Button
              isDisabled={isDisabled}
              isLoading={isConsuming}
              loadingText="Consuming..."
              mr={3}
              onClick={() =>
                isOwner
                  ? onUseConsumable()
                  : navigate(
                      `${ITEM_PATH}${item.tokenId}?${buyingSearchParams}`,
                    )
              }
            >
              Yes
            </Button>
            <Button isDisabled={isConsuming} onClick={onClose} variant="ghost">
              No
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
