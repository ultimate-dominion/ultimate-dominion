import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { zeroAddress, zeroHash } from 'viem';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { BATTLE_OUTCOME_SEEN_KEY } from '../utils/constants';
import { etherToFixedNumber } from '../utils/helpers';
import {
  type Armor,
  type CombatOutcomeType,
  EncounterType,
  type Spell,
  type Weapon,
} from '../utils/types';

import { ItemCard } from './ItemCard';
import { ItemEquipModal } from './ItemEquipModal';
import { LevelingPanel } from './LevelingPanel';
import { PolygonalCard } from './PolygonalCard';

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
  const { armorTemplates, spellTemplates, weaponTemplates } = useItems();
  const {
    character,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    refreshCharacter,
  } = useCharacter();
  const { refreshEntities } = useMap();
  const { currentBattle, onContinueToBattleOutcome, opponent } = useBattle();

  const [armor, setArmor] = useState<Armor[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<
    Armor | Spell | Weapon | null
  >(null);
  const [initialLevel] = useState(() => character?.level);

  const hasLeveledUp = useMemo(
    () =>
      character != null &&
      initialLevel != null &&
      character.level > initialLevel,
    [character, initialLevel],
  );

  const {
    isOpen: isItemModalOpen,
    onClose: onCloseItemModal,
    onOpen: onOpenItemModal,
  } = useDisclosure();

  const onAcknowledge = useCallback(async () => {
    setArmor([]);
    setSpells([]);
    setWeapons([]);
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, battleOutcome.encounterId);
    onContinueToBattleOutcome(false);
    await refreshCharacter();
    refreshEntities();
    onClose();
  }, [
    battleOutcome.encounterId,
    onContinueToBattleOutcome,
    onClose,
    refreshCharacter,
    refreshEntities,
  ]);

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
              balance: BigInt(1),
              itemId: zeroHash,
              owner: zeroAddress,
            } as Armor;
          });

        const _spells = spellTemplates
          .filter(s => _lootedItemIds.includes(s.tokenId))
          .map(spell => {
            return {
              ...spell,
              balance: BigInt(1),
              itemId: zeroHash,
              owner: zeroAddress,
            } as Spell;
          });

        const _weapons = weaponTemplates
          .filter(w => _lootedItemIds.includes(w.tokenId))
          .map(weapon => {
            return {
              ...weapon,
              balance: BigInt(1),
              itemId: zeroHash,
              owner: zeroAddress,
            } as Weapon;
          });

        setArmor(_armor);
        setSpells(_spells);
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
    [armorTemplates, renderError, spellTemplates, weaponTemplates],
  );

  useEffect(() => {
    if (battleOutcome.itemsDropped.length > 0 && isOpen) {
      fetchLootedItems(battleOutcome.itemsDropped);
    } else {
      setIsLoadingItems(false);
    }
  }, [battleOutcome, fetchLootedItems, isOpen]);

  const sortedArmor = useMemo(() => {
    return [...armor].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
  }, [armor]);

  const sortedSpellsAndWeapons = useMemo(() => {
    return [...spells, ...weapons].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
  }, [spells, weapons]);

  const battleDraw = useMemo(() => {
    return currentBattle?.maxTurns === currentBattle?.currentTurn;
  }, [currentBattle]);

  if (!character) {
    return <Box />;
  }

  const { expDropped, goldDropped, playerFled, winner } = battleOutcome;

  if (playerFled) {
    return (
      <Modal isOpen={isOpen} onClose={onAcknowledge}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader textAlign="center">
            {winner === character.id ? 'Victory!' : 'Defeat...'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 6, sm: 8 }} textAlign="center">
            <VStack alignItems="center" pb={8} spacing={4}>
              <Text>
                {winner === character.id
                  ? `${opponent?.name} fled!`
                  : `You fled from ${opponent?.name}.`}
              </Text>
              {winner === character.id ? (
                <Text>
                  You earned{' '}
                  <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                    {etherToFixedNumber(goldDropped)}
                  </Text>{' '}
                  Gold.
                </Text>
              ) : (
                <Text>
                  Fleeing causes you to drop 25% of the Gold in your Adventure
                  Escrow. You lost{' '}
                  <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                    {etherToFixedNumber(goldDropped)}
                  </Text>{' '}
                  Gold.
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onAcknowledge}>Continue</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onAcknowledge}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader textAlign="center">
            {battleDraw
              ? 'Draw...'
              : winner === character.id
                ? 'Victory!'
                : 'Defeat...'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 6, sm: 8 }} textAlign="center">
            {battleDraw ? (
              <VStack alignItems="center" pb={canLevel ? 4 : 8} spacing={4}>
                <Text>
                  The battle ended in a draw! You both fled the battlefield.
                </Text>
              </VStack>
            ) : (
              <VStack alignItems="center" pb={canLevel ? 4 : 8} spacing={4}>
                <Text>
                  {winner === character.id
                    ? `You defeated ${opponent?.name}!`
                    : `You were killed by ${opponent?.name}.`}
                </Text>
                {winner !== character.id &&
                  currentBattle &&
                  currentBattle.encounterType === EncounterType.PvP && (
                    <Text>
                      You lost{' '}
                      <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                        {etherToFixedNumber(goldDropped)}
                      </Text>{' '}
                      Gold from your Adventure Escrow.
                    </Text>
                  )}
                {winner !== character.id && (
                  <Text>
                    When you die, your health is restored, but you are forced to
                    respawn at the Town Square.
                  </Text>
                )}
                {winner === character.id && (
                  <Text>
                    You earned{' '}
                    <Text as="span" color="green" fontFamily="mono" fontWeight="bold">
                      {expDropped.toString()}
                    </Text>{' '}
                    experience and your Adventure Escrow gained{' '}
                    <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                      {etherToFixedNumber(goldDropped)}
                    </Text>{' '}
                    Gold.
                  </Text>
                )}
                {isLoadingItems ? (
                  <Spinner />
                ) : (
                  <>
                    {sortedArmor.length > 0 && winner == character.id && (
                      <Text fontWeight="bold">Looted Armor:</Text>
                    )}
                    {winner == character.id &&
                      sortedArmor.map(item => (
                        <Box key={`armor-box-${item.tokenId}`}>
                          <ItemCard
                            key={item.tokenId}
                            onClick={
                              equippedArmor.some(
                                equippedItem =>
                                  equippedItem.tokenId === item.tokenId,
                              )
                                ? undefined
                                : () => {
                                    setSelectedItem(item);
                                    onOpenItemModal();
                                  }
                            }
                            {...item}
                          />
                        </Box>
                      ))}
                    {sortedSpellsAndWeapons.length > 0 && winner == character.id && (
                      <Text fontWeight="bold">Looted Weapons:</Text>
                    )}
                    {winner == character.id &&
                      sortedSpellsAndWeapons.map(item => (
                        <Box key={`spell-weapon-box-${item.tokenId}`}>
                          <ItemCard
                            key={item.tokenId}
                            onClick={
                              [...equippedSpells, ...equippedWeapons].some(
                                equippedItem =>
                                  equippedItem.tokenId === item.tokenId,
                              )
                                ? undefined
                                : () => {
                                    setSelectedItem(item);
                                    onOpenItemModal();
                                  }
                            }
                            {...item}
                          />
                        </Box>
                      ))}
                  </>
                )}
              </VStack>
            )}
            {hasLeveledUp && !canLevel && (
              <VStack
                alignItems="center"
                pb={4}
                spacing={2}
                border="2px solid"
                borderColor="yellow"
                borderRadius="md"
                p={4}
                boxShadow="0 0 15px rgba(239, 211, 28, 0.3)"
                bg="rgba(239, 211, 28, 0.05)"
              >
                <Text fontWeight="bold" color="yellow" fontSize="lg">
                  You reached Level {character.level.toString()}!
                </Text>
              </VStack>
            )}
            {canLevel && (
              <LevelingPanel canLevel character={character} compact />
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onAcknowledge}>Continue</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {selectedItem && (
        <ItemEquipModal
          isEquipped={[
            ...equippedArmor,
            ...equippedSpells,
            ...equippedWeapons,
          ].some(item => item.name == selectedItem.name)}
          isOpen={isItemModalOpen}
          onClose={() => {
            refreshCharacter();
            onCloseItemModal();
          }}
          {...{ ...selectedItem, owner: character.owner }}
        />
      )}
    </>
  );
};
