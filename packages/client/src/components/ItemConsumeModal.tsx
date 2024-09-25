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
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ITEM_PATH } from '../Routes';
import { type Consumable, OrderType } from '../utils/types';
import { ItemCard } from './ItemCard';
import { LootManagerAllowanceModal } from './LootManagerAllowanceModal';

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
  const { currentBattle } = useBattle();
  const { itemsLootManagerAllowance } = useAllowance();

  const {
    isOpen: isAllowanceModalOpen,
    onOpen: onOpenAllowanceModal,
    onClose: onCloseAllowanceModal,
  } = useDisclosure();

  const [isConsuming, setIsConsuming] = useState(false);

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
      onClose();
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
    onClose,
    onOpenAllowanceModal,
    refreshCharacter,
    renderError,
    renderSuccess,
    useWorldConsumableItem,
  ]);

  const buyingSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', OrderType.Buying);
    return searchParams;
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isOwner ? 'Consume Item' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          {isOwner ? (
            <Text mb={6}>
              Do you want to consume this item? It will restore{' '}
              {item.hpRestoreAmount} HP.
            </Text>
          ) : (
            <Text mb={6}>Do you want to make an offer for this item?</Text>
          )}
          <ItemCard {...item} />
          {!!currentBattle && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              You cannot consume this during battle.
            </Text>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={isOwner && !!currentBattle}
            isLoading={isConsuming}
            loadingText="Consuming..."
            mr={3}
            onClick={() =>
              isOwner
                ? onUseConsumable()
                : navigate(`${ITEM_PATH}${item.tokenId}?${buyingSearchParams}`)
            }
          >
            Yes
          </Button>
          <Button isDisabled={isConsuming} onClick={onClose} variant="ghost">
            No
          </Button>
        </ModalFooter>
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
