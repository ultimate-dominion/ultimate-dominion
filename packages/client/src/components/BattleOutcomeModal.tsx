import {
  Box,
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { BATTLE_OUTCOME_SEEN_KEY } from '../utils/constants';
import {
  type Armor,
  type CombatOutcomeType,
  type Weapon,
} from '../utils/types';
import { ItemCard } from './ItemCard';

type BattleOutcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  battleOutcome: CombatOutcomeType;
};

export const BattleOutcomeModal: React.FC<BattleOutcomeModalProps> = ({
  isOpen,
  onClose,
  battleOutcome,
}): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: { Levels },
  } = useMUD();
  const { armorTemplates, weaponTemplates } = useItems();
  const { character } = useCharacter();
  const { onContinueToBattleOutcome, opponent } = useBattle();

  const [armor, setArmor] = useState<Armor[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const onAcknowledge = useCallback(() => {
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, battleOutcome.encounterId);
    onContinueToBattleOutcome(false);
    onClose();
  }, [battleOutcome.encounterId, onContinueToBattleOutcome, onClose]);

  const nextLevelXpRequirement =
    useComponentValue(
      Levels,
      character
        ? encodeEntity({ level: 'uint256' }, { level: BigInt(character.level) })
        : undefined,
    )?.experience ?? BigInt(0);

  const canLevel = useMemo(() => {
    if (!character) return false;
    if (nextLevelXpRequirement === BigInt(0)) return false;
    return BigInt(character.experience) >= nextLevelXpRequirement;
  }, [character, nextLevelXpRequirement]);

  const fetchLootedItems = useCallback(
    (_lootedItemIds: string[]) => {
      try {
        const _armor = armorTemplates
          .filter(a => _lootedItemIds.includes(a.tokenId))
          .map(armor => {
            return {
              ...armor,
              balance: '1',
              itemId: zeroHash,
              owner: zeroAddress,
            } as Armor;
          });

        const _weapons = weaponTemplates
          .filter(w => _lootedItemIds.includes(w.tokenId))
          .map(weapon => {
            return {
              ...weapon,
              balance: '1',
              itemId: zeroHash,
              owner: zeroAddress,
            } as Weapon;
          });

        setArmor(_armor);
        setWeapons(_weapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch looted items.',
          e,
        );
      } finally {
        setIsLoadingItems(false);
      }
    },
    [armorTemplates, renderError, weaponTemplates],
  );

  useEffect(() => {
    if (battleOutcome.itemsDropped.length > 0 && isOpen) {
      fetchLootedItems(battleOutcome.itemsDropped);
    } else {
      setIsLoadingItems(false);
    }
  }, [battleOutcome, fetchLootedItems, isOpen]);

  if (!character) {
    return <Box />;
  }

  const { expDropped, goldDropped, winner } = battleOutcome;

  return (
    <Modal isOpen={isOpen} onClose={onAcknowledge}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader textAlign="center">
          {winner === character.id ? 'Victory!' : 'Defeat...'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4} textAlign="center">
          <VStack alignItems="center" pb={canLevel ? 4 : 8} spacing={4}>
            <Text>
              {winner === character.id
                ? `You defeated ${opponent?.name}!`
                : `You lost to ${opponent?.name}.`}
            </Text>
            {winner === character.id && (
              <Text>
                You earned{' '}
                <Text as="span" color="green" fontWeight="bold">
                  {expDropped}
                </Text>{' '}
                experience and{' '}
                <Text as="span" color="gold" fontWeight="bold">
                  {Number(goldDropped).toLocaleString()}
                </Text>{' '}
                $GOLD.
              </Text>
            )}
            {isLoadingItems ? (
              <Spinner />
            ) : (
              <>
                {armor.length > 0 && (
                  <Text fontWeight="bold">Looted Armor:</Text>
                )}
                {armor.map(item => (
                  <ItemCard key={item.tokenId} {...item} />
                ))}
                {weapons.length > 0 && (
                  <Text fontWeight="bold">Looted Weapons:</Text>
                )}
                {weapons.map(item => (
                  <ItemCard key={item.tokenId} {...item} />
                ))}
              </>
            )}
          </VStack>
          {canLevel && (
            <VStack alignItems="center" pb={8} spacing={4}>
              <Divider />
              <Text fontWeight="bold">
                You have enough experience to level up!
              </Text>
              <Text>
                Leveling involves spending{' '}
                <Text as="span" fontWeight="bold">
                  2 ability points
                </Text>{' '}
                on your character&apos;s stats.
              </Text>
              <Text>
                To level up, visit your{' '}
                <Text
                  as={Link}
                  color="blue"
                  to={`/characters/${character?.id}`}
                  onClick={onAcknowledge}
                  _hover={{
                    textDecoration: 'underline',
                  }}
                >
                  character page
                </Text>
                .
              </Text>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onAcknowledge}>Continue</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
