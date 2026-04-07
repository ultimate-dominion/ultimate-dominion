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

import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('ui');
  const { renderError, renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { equipItems, unequipItem },
  } = useMUD();
  const {
    character,
    equippedArmor,
    equippedConsumables,
    equippedSpells,
    equippedWeapons,
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

  // Check if all slots are full (no swap — user must unequip first)
  const slotsFull = useMemo(() => {
    if (isEquipped) return false;
    if (item.itemType === ItemType.Armor) {
      return equippedArmor.length >= MAX_EQUIPPED_ARMOR;
    }
    if (item.itemType === ItemType.Weapon || item.itemType === ItemType.Spell) {
      return equippedWeapons.length + equippedSpells.length + equippedConsumables.length >= MAX_EQUIPPED_WEAPONS;
    }
    return false;
  }, [equippedArmor, equippedConsumables, equippedSpells, equippedWeapons, isEquipped, item.itemType]);

  const closeAndReset = useCallback(() => {
    setStatusText('');
    onClose();
  }, [onClose]);

  const onEquipItem = useCallback(async () => {
    if (!character) {
      renderError(t('common.noCharacter'));
      return;
    }
    if (!delegatorAddress) {
      renderError(t('common.walletNotConnected'));
      return;
    }

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
        renderSuccess(t('equip.equipped', { name: item.name }));
      }
      closeAndReset();
    } else {
      setStatusText('');
    }
  }, [
    character,
    closeAndReset,
    delegatorAddress,
    equipItems,
    equipTx,
    item,
    renderError,
    renderSuccess,
    t,
  ]);

  const onUnequipItem = useCallback(async () => {
    if (!character) {
      renderError(t('common.noCharacter'));
      return;
    }
    if (!delegatorAddress) {
      renderError(t('common.walletNotConnected'));
      return;
    }

    setStatusText(t('equip.unequippingItem', { name: item.name }));
    const result = await unequipTx.execute(async () => {
      const { error, success } = await unequipItem(character.id, item.tokenId);
      if (error && !success) {
        if (error.includes('NOT EQUIPPED')) return 'not-equipped';
        throw new Error(error);
      }
      return 'ok';
    });

    if (result !== undefined) {
      if (result === 'not-equipped') {
        renderSuccess(t('equip.alreadyUnequipped', { name: item.name }));
      } else {
        renderSuccess(t('equip.unequipped', { name: item.name }));
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
    renderError,
    renderSuccess,
    t,
    unequipTx,
    unequipItem,
  ]);

  const isNotGameBoard = useMemo(() => {
    return !window.location.pathname.includes(GAME_BOARD_PATH);
  }, []);

  const isMissingRequirements = useMemo(() => {
    if (!character) return false;
    if (BigInt(character.level) < BigInt(item.minLevel)) return true;
    // Use total stats (base + equipment bonuses) to match contract behavior
    if (
      BigInt(character.agility) <
      BigInt(item.statRestrictions.minAgility)
    )
      return true;
    if (
      BigInt(character.intelligence) <
      BigInt(item.statRestrictions.minIntelligence)
    )
      return true;
    if (character.strength < item.statRestrictions.minStrength)
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

  const sellingSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', OrderType.Selling);
    return searchParams;
  }, []);

  if (isEquipped) {
    return (
      <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>
            {isOwner ? t('equip.unequipItem') : t('equip.makeOffer')}
          </ModalHeader>
          {!isLoading && <ModalCloseButton />}
          <ModalBody px={{ base: 6, sm: 8 }}>
            {isOwner ? (
              <Text mb={6}>{t('equip.wantUnequip')}</Text>
            ) : (
              <Text mb={6}>{t('equip.wantOffer')}</Text>
            )}
            <ItemCard {...item} />

            {!!currentBattle && isNotGameBoard && isOwner && (
              <Text color="red" fontWeight="bold" mt={4} size="sm">
                {t('equip.cannotUnequipInBattle')}
              </Text>
            )}
            {isOneMoveEquipped && isOwner && (
              <Text color="red" fontWeight="bold" mt={4} size="sm">
                {t('equip.mustHaveWeapon')}
              </Text>
            )}
            {statusText && (
              <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
                {statusText}
              </Text>
            )}
          </ModalBody>
          <ModalFooter gap={3} flexWrap="wrap" justifyContent="center">
            <Button isDisabled={isLoading} onClick={onClose} variant="ghost">
              {t('common.no')}
            </Button>
            <Button
              isDisabled={
                (!!currentBattle || isOneMoveEquipped) &&
                isNotGameBoard &&
                isOwner
              }
              isLoading={unequipTx.isLoading}
              loadingText={t('equip.unequipping')}
              onClick={() =>
                isOwner
                  ? onUnequipItem()
                  : navigate(
                      `${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`,
                    )
              }
            >
              {isOwner ? t('equip.unequip') : t('common.yes')}
            </Button>
            {isOwner && (
              <Button
                isDisabled={isLoading}
                onClick={() => navigate(`${ITEM_PATH}/${item.tokenId}?${sellingSearchParams}`)}
                variant="outline"
                size="sm"
              >
                {t('equip.sellOnMarketplace')}
              </Button>
            )}
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
          {isOwner ? t('equip.equipItem') : t('equip.makeOffer')}
        </ModalHeader>
        {!isLoading && <ModalCloseButton />}
        <ModalBody px={{ base: 6, sm: 8 }}>
          {isOwner ? (
            <Text mb={6}>{t('equip.wantEquip')}</Text>
          ) : (
            <Text mb={6}>{t('equip.wantOffer')}</Text>
          )}
          <ItemCard {...item} />
          {isMissingRequirements && isOwner && character && (
            <VStack align="start" mt={4} spacing={1}>
              <Text color="red" fontWeight="bold" size="sm">
                {t('equip.missingRequirements')}
              </Text>
              {BigInt(character.level) < BigInt(item.minLevel) && (
                <HStack>
                  <Text color="red" size="sm">{t('equip.levelRequired', { level: item.minLevel.toString() })}</Text>
                  <Text color="grey400" size="sm">{t('equip.youStat', { value: character.level.toString() })}</Text>
                </HStack>
              )}
              {BigInt(character.agility) < BigInt(item.statRestrictions.minAgility) && (
                <HStack>
                  <Text color="red" size="sm">{t('equip.agiRequired', { agi: item.statRestrictions.minAgility.toString() })}</Text>
                  <Text color="grey400" size="sm">{t('equip.youStat', { value: character.agility.toString() })}</Text>
                </HStack>
              )}
              {BigInt(character.intelligence) < BigInt(item.statRestrictions.minIntelligence) && (
                <HStack>
                  <Text color="red" size="sm">{t('equip.intRequired', { int: item.statRestrictions.minIntelligence.toString() })}</Text>
                  <Text color="grey400" size="sm">{t('equip.youStat', { value: character.intelligence.toString() })}</Text>
                </HStack>
              )}
              {BigInt(character.strength) < BigInt(item.statRestrictions.minStrength) && (
                <HStack>
                  <Text color="red" size="sm">{t('equip.strRequired', { str: item.statRestrictions.minStrength.toString() })}</Text>
                  <Text color="grey400" size="sm">{t('equip.youStat', { value: character.strength.toString() })}</Text>
                </HStack>
              )}
            </VStack>
          )}
          {slotsFull && isOwner && (
            <Text color="orange" fontWeight="bold" mt={4} size="sm">
              {t('equip.slotsFull')}
            </Text>
          )}
          {!!currentBattle && isNotGameBoard && isOwner && (
            <Text color="red" fontWeight="bold" mt={4} size="sm">
              {t('equip.cannotEquipInBattle')}
            </Text>
          )}
          {statusText && (
            <Text color="#D4A54A" fontWeight="bold" mt={4} size="sm" textAlign="center">
              {statusText}
            </Text>
          )}
        </ModalBody>
        <ModalFooter gap={3} flexWrap="wrap" justifyContent="center">
          <Button isDisabled={isLoading} onClick={onClose} variant="ghost">
            {t('common.no')}
          </Button>
          <Button
            isDisabled={
              isOwner &&
              (isNotGameBoard && (isMissingRequirements || !!currentBattle) || slotsFull)
            }
            isLoading={isLoading}
            loadingText={t('equip.equipping')}
            onClick={() =>
              isOwner
                ? onEquipItem()
                : navigate(`${ITEM_PATH}/${item.tokenId}?${buyingSearchParams}`)
            }
          >
            {isOwner ? t('equip.equip') : t('common.yes')}
          </Button>
          {isOwner && (
            <Button
              isDisabled={isLoading}
              onClick={() => navigate(`${ITEM_PATH}/${item.tokenId}?${sellingSearchParams}`)}
              variant="outline"
              size="sm"
            >
              {t('equip.sellOnMarketplace')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
