import {
  Box,
  Button,
  Divider,
  Image,
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
import { useGameValue, encodeUint256Key, toBigInt } from '../lib/gameStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zeroAddress, zeroHash } from 'viem';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useToast } from '../hooks/useToast';
import { BATTLE_OUTCOME_SEEN_KEY, MAX_LEVEL } from '../utils/constants';
import { etherToFixedNumber } from '../utils/helpers';
import {
  type Armor,
  type CombatOutcomeType,
  type Consumable,
  EncounterType,
  type Monster,
  Rarity,
  RARITY_NAMES,
  type Spell,
  type Weapon,
} from '../utils/types';

import { OnboardingStage, useOnboardingStage } from '../hooks/useOnboardingStage';

import { ItemCard } from './ItemCard';
import { getItemImage } from '../utils/itemImages';
import { getMonsterImage } from '../utils/monsterImages';
import { LootReveal } from './LootReveal';
import { ShareButton } from './ShareButton';
import { ItemEquipModal } from './ItemEquipModal';
import { LevelUpBanner } from './LevelUpBanner';
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
  const { armorTemplates, consumableTemplates, spellTemplates, weaponTemplates } = useItems();
  const {
    character,
    equippedArmor,
    equippedConsumables,
    equippedSpells,
    equippedWeapons,
    refreshCharacter,
  } = useCharacter();
  const { currentBattle, onContinueToBattleOutcome, opponent } = useBattle();

  const opponentDisplayName = useMemo(() => {
    if (!opponent) return 'a monster';
    const isElite = 'isElite' in opponent && (opponent as Monster).isElite;
    return isElite ? `Elite ${opponent.name}` : opponent.name;
  }, [opponent]);
  const stage = useOnboardingStage();

  const [armor, setArmor] = useState<Armor[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<
    Armor | Consumable | Spell | Weapon | null
  >(null);
  const [initialLevel] = useState(() => character?.level);
  const [initialExperience] = useState(() => character?.experience);

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
    setConsumables([]);
    setSpells([]);
    setWeapons([]);
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, battleOutcome.encounterId);
    onContinueToBattleOutcome(false);
    await refreshCharacter();
    onClose();
  }, [
    battleOutcome.encounterId,
    onContinueToBattleOutcome,
    onClose,
    refreshCharacter,
  ]);

  const nextLevelRow = useGameValue(
    'Levels',
    character
      ? encodeUint256Key(BigInt(character.level))
      : undefined,
  );
  const nextLevelXpRequirement = toBigInt(nextLevelRow?.experience);

  const canLevel = useMemo(() => {
    if (!character) return false;
    if (Number(character.level) >= MAX_LEVEL) return false;
    if (nextLevelXpRequirement === BigInt(0)) return false;
    return BigInt(character.experience) >= nextLevelXpRequirement;
  }, [character, nextLevelXpRequirement]);

  // Did THIS battle's XP gain push the player over the level-up threshold?
  // False if they were already eligible before this battle started or already at max level.
  const justBecameEligible = useMemo(() => {
    if (!character || initialExperience == null) return false;
    if (Number(character.level) >= MAX_LEVEL) return false;
    return initialExperience < nextLevelXpRequirement &&
      BigInt(character.experience) >= nextLevelXpRequirement;
  }, [character, initialExperience, nextLevelXpRequirement]);

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

        const _consumables = consumableTemplates
          .filter(c => _lootedItemIds.includes(c.tokenId))
          .map(consumable => {
            return {
              ...consumable,
              balance: BigInt(1),
              itemId: zeroHash,
              owner: zeroAddress,
            } as Consumable;
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
        setConsumables(_consumables);
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
    [armorTemplates, consumableTemplates, renderError, spellTemplates, weaponTemplates],
  );

  useEffect(() => {
    if (battleOutcome.itemsDropped.length > 0 && isOpen) {
      fetchLootedItems(battleOutcome.itemsDropped);
    } else {
      setIsLoadingItems(false);
    }
  }, [battleOutcome, fetchLootedItems, isOpen]);

  // Analytics: track combat outcome once when modal opens
  const outcomeTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !character) return;
    if (outcomeTrackedRef.current === battleOutcome.encounterId) return;
    outcomeTrackedRef.current = battleOutcome.encounterId;

    const isPvp = currentBattle?.encounterType === EncounterType.PvP;
    const fled = battleOutcome.playerFled;
    let outcome: 'win' | 'loss' | 'draw' | 'flee';
    if (fled) {
      outcome = battleOutcome.winner === character.id ? 'win' : 'flee';
    } else if (battleOutcome.winner === character.id) {
      outcome = 'win';
    } else if (currentBattle && currentBattle.maxTurns === currentBattle.currentTurn) {
      outcome = 'draw';
    } else {
      outcome = 'loss';
    }
    import('../utils/analytics').then(({ trackCombatOutcome }) =>
      trackCombatOutcome(outcome, isPvp ? 'pvp' : 'pve', Number(character.level)),
    );
  }, [isOpen, battleOutcome, character, currentBattle]);

  const sortedLoot = useMemo(() => {
    return [...armor, ...consumables, ...spells, ...weapons].sort(
      (a, b) => (b.rarity ?? 0) - (a.rarity ?? 0),
    );
  }, [armor, consumables, spells, weapons]);

  const battleDraw = useMemo(() => {
    if (!currentBattle) return false;
    return currentBattle.maxTurns === currentBattle.currentTurn;
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
                  ? `${opponentDisplayName} fled!`
                  : `You fled from ${opponentDisplayName}.`}
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
                  Fleeing cost you{' '}
                  <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                    {etherToFixedNumber(goldDropped)}
                  </Text>{' '}
                  Carried Gold.
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
      <Modal isOpen={isOpen} onClose={onAcknowledge} scrollBehavior="inside">
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
              <VStack alignItems="center" pb={4} spacing={4}>
                <Text>
                  The battle ended in a draw! You both fled the battlefield.
                </Text>
              </VStack>
            ) : (
              <VStack alignItems="center" pb={4} spacing={4}>
                <Text>
                  {winner === character.id
                    ? `You defeated ${opponentDisplayName}!`
                    : `You were killed by ${opponentDisplayName}.`}
                </Text>
                {opponent && currentBattle?.encounterType !== EncounterType.PvP && getMonsterImage(opponent.name) && (
                  <Image
                    src={getMonsterImage(opponent.name)}
                    alt={opponent.name}
                    boxSize={{ base: '100px', sm: '120px' }}
                    objectFit="contain"
                    opacity={winner === character.id ? 1 : 0.4}
                    filter={winner !== character.id ? 'grayscale(0.6)' : undefined}
                  />
                )}
                {winner !== character.id && goldDropped > 0n && (
                  <Text>
                    You lost{' '}
                    <Text as="span" color="gold" fontFamily="mono" fontWeight="bold">
                      {etherToFixedNumber(goldDropped)}
                    </Text>{' '}
                    Carried Gold.
                  </Text>
                )}
                {winner !== character.id && (
                  <Text>
                    When you die, your health is restored, but you are forced to
                    respawn at the Town Square.
                  </Text>
                )}
                {winner === character.id && !battleDraw && (
                  <ShareButton
                    text={
                      currentBattle?.encounterType === EncounterType.PvP
                        ? `Defeated ${opponentDisplayName} in PvP combat in Ultimate Dominion.`
                        : `Slew ${opponentDisplayName} in the Dark Cave.`
                    }
                    shareParams={{
                      type: currentBattle?.encounterType === EncounterType.PvP ? 'pvp' : 'kill',
                      ...(currentBattle?.encounterType === EncounterType.PvP
                        ? { winner: character.name, loser: opponentDisplayName }
                        : { monster: opponentDisplayName, player: character.name, level: character.level.toString() }),
                    }}
                    imageSrc={currentBattle?.encounterType !== EncounterType.PvP && opponent ? getMonsterImage(opponent.name) : undefined}
                    colorAccent={currentBattle?.encounterType === EncounterType.PvP ? '#B85C3A' : '#6B8E6B'}
                  />
                )}
                {/* Level-up banner — only on victory when this battle triggered eligibility */}
                {winner === character.id && (hasLeveledUp || justBecameEligible) && (
                  <LevelUpBanner level={canLevel ? BigInt(character.level) + 1n : character.level} />
                )}
                {/* Inline LevelingPanel removed — all levels use the full LevelUpModal */}
                {(hasLeveledUp || justBecameEligible || canLevel) &&
                  winner === character.id &&
                  sortedLoot.length > 0 && (
                    <Divider borderColor="rgba(196,184,158,0.15)" my={1} />
                  )}
                {isLoadingItems ? (
                  <Spinner />
                ) : (
                  <>
                    {winner === character.id && sortedLoot.length > 0 && (
                      <LootReveal
                        items={sortedLoot}
                        onItemClick={(item) => {
                          const isEquipped = [
                            ...equippedArmor,
                            ...equippedConsumables,
                            ...equippedSpells,
                            ...equippedWeapons,
                          ].some(
                            equippedItem =>
                              equippedItem.tokenId === item.tokenId,
                          );
                          if (!isEquipped) {
                            setSelectedItem(item);
                            onOpenItemModal();
                          }
                        }}
                      />
                    )}
                    {winner === character.id && sortedLoot.length > 0 && (sortedLoot[0].rarity ?? 0) >= Rarity.Uncommon && (
                      <ShareButton
                        text={`Found ${sortedLoot[0].rarity !== undefined ? `a ${RARITY_NAMES[sortedLoot[0].rarity]} ` : ''}${sortedLoot[0].name} in Ultimate Dominion. Every item is permanent, on-chain, and mine.`}
                        shareParams={{
                          type: 'drop',
                          item: sortedLoot[0].name,
                          rarity: (sortedLoot[0].rarity ?? 0).toString(),
                          player: character.name,
                        }}
                        imageSrc={getItemImage(sortedLoot[0].name)}
                        colorAccent={sortedLoot[0].rarity !== undefined ? ('#C4A54A') : '#8A7E6A'}
                      />
                    )}
                  </>
                )}
              </VStack>
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
            ...equippedConsumables,
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
