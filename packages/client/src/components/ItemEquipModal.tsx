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
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { GAME_BOARD_PATH, ITEM_PATH } from '../Routes';
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
  const { character, equippedSpells, equippedWeapons, refreshCharacter } =
    useCharacter();
  const { inSafetyZone, isSpawned } = useMap();
  const { currentBattle } = useBattle();

  const equipTx = useTransaction({ actionName: 'equip item', showSuccessToast: false });
  const unequipTx = useTransaction({ actionName: 'unequip item', showSuccessToast: false });

  const isOwner = useMemo(() => {
    return character?.owner === item.owner;
  }, [character, item.owner]);

  const onEquipItem = useCallback(async () => {
    if (!character) {
      renderError('No character found. Please select a character.');
      return;
    }
    if (!delegatorAddress) {
      renderError('Wallet not connected. Please reconnect your wallet.');
      return;
    }

    // Close modal immediately for snappy feel
    onClose();

    const result = await equipTx.execute(async () => {
      const { error, success } = await equipItems(character.id, [item.tokenId]);
      if (error && !success) throw new Error(error);
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${item.name} equipped`);
    }
  }, [
    character,
    delegatorAddress,
    equipItems,
    equipTx,
    item,
    onClose,
    refreshCharacter,
    renderError,
    renderSuccess,
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

    // Close modal immediately for snappy feel
    onClose();

    const result = await unequipTx.execute(async () => {
      const { error, success } = await unequipItem(character.id, item.tokenId);
      if (error && !success) throw new Error(error);
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${item.name} unequipped`);
    }
  }, [
    character,
    delegatorAddress,
    item,
    onClose,
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
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>
            {isOwner ? 'Unequip Item' : 'Make an offer'}
          </ModalHeader>
          <ModalCloseButton />
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
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={equipTx.isLoading || unequipTx.isLoading} onClick={onClose} variant="ghost">
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
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>{isOwner ? 'Equip Item' : 'Make an offer'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          {isOwner ? (
            <Text mb={6}>Do you want to equip this item?</Text>
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
        </ModalBody>
        <ModalFooter gap={3}>
          <Button isDisabled={equipTx.isLoading || unequipTx.isLoading} onClick={onClose} variant="ghost">
            No
          </Button>
          <Button
            isDisabled={
              isOwner &&
              isNotGameBoard &&
              (isMissingRequirements || !!currentBattle)
            }
            isLoading={equipTx.isLoading}
            loadingText="Equipping..."
            onClick={() =>
              isOwner
                ? onEquipItem()
                : navigate(`${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`)
            }
          >
            Yes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
