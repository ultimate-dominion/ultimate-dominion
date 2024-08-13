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
import { getComponentValueStrict } from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { BATTLE_OUTCOME_SEEN_KEY } from '../utils/constants';
import {
  decodeArmorStats,
  decodeWeaponStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import {
  type Armor,
  type CombatOutcomeType,
  ItemType,
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
    components: { Items, ItemsBaseURI, ItemsTokenURI, Levels },
  } = useMUD();
  const { character } = useCharacter();
  const { allMonsters, otherCharactersOnTile } = useMap();
  const { onContinueToBattleOutcome } = useBattle();

  const [armor, setArmor] = useState<Armor[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const opponent = useMemo(() => {
    if (!character) return null;
    const opponent =
      character.id === battleOutcome.defenders[0]
        ? battleOutcome.attackers[0]
        : battleOutcome.defenders[0];

    const monsterOpponent = allMonsters.find(
      monster => monster.id === opponent,
    );
    if (monsterOpponent) {
      return monsterOpponent;
    }

    const characterOpponent = otherCharactersOnTile.find(
      c => c.id === opponent,
    );
    if (characterOpponent) {
      return characterOpponent;
    }

    return null;
  }, [allMonsters, battleOutcome, character, otherCharactersOnTile]);

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
    async (_lootedItems: string[]) => {
      try {
        const _items = _lootedItems
          .map(tokenId => {
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(tokenId) },
            );

            const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);

            return {
              balance: '1',
              itemId: tokenIdEntity,
              itemType: itemTemplate.itemType,
              owner: '',
              stats: itemTemplate.stats,
              tokenId: tokenId.toString(),
              tokenIdEntity,
            };
          })
          .sort((a, b) => {
            return Number(a.tokenId) - Number(b.tokenId);
          });

        const _armor = _items.filter(item => item.itemType === ItemType.Armor);
        const _weapons = _items.filter(
          item => item.itemType === ItemType.Weapon,
        );

        const fullArmor = await Promise.all(
          _armor.map(async item => {
            const decodedArmorStats = decodeArmorStats(item.stats);

            const baseURI = getComponentValueStrict(
              ItemsBaseURI,
              singletonEntity,
            ).uri;

            const tokenURI = getComponentValueStrict(
              ItemsTokenURI,
              item.tokenIdEntity,
            ).uri;

            const metadata = await fetchMetadataFromUri(
              uriToHttp(`${baseURI}${tokenURI}`)[0],
            );

            return {
              ...metadata,
              agiModifier: decodedArmorStats.agiModifier,
              armorModifier: decodedArmorStats.armorModifier,
              classRestrictions: decodedArmorStats.classRestrictions,
              hitPointModifier: decodedArmorStats.hitPointModifier,
              intModifier: decodedArmorStats.intModifier,
              itemId: item.itemId,
              owner: item.owner,
              strModifier: decodedArmorStats.strModifier,
              tokenId: item.tokenId,
            } as Armor;
          }),
        );

        const fullWeapons = await Promise.all(
          _weapons.map(async item => {
            const decodedWeaponStats = decodeWeaponStats(item.stats);

            const baseURI = getComponentValueStrict(
              ItemsBaseURI,
              singletonEntity,
            ).uri;

            const tokenURI = getComponentValueStrict(
              ItemsTokenURI,
              item.tokenIdEntity,
            ).uri;

            const metadata = await fetchMetadataFromUri(
              uriToHttp(`${baseURI}${tokenURI}`)[0],
            );

            return {
              ...metadata,
              agiModifier: decodedWeaponStats.agiModifier,
              balance: item.balance,
              classRestrictions: decodedWeaponStats.classRestrictions,
              hitPointModifier: decodedWeaponStats.hitPointModifier,
              intModifier: decodedWeaponStats.intModifier,
              itemId: item.itemId,
              maxDamage: decodedWeaponStats.maxDamage,
              minDamage: decodedWeaponStats.minDamage,
              minLevel: decodedWeaponStats.minLevel,
              owner: item.owner,
              strModifier: decodedWeaponStats.strModifier,
              tokenId: item.tokenId,
            } as Weapon;
          }),
        );

        setArmor(fullArmor);
        setWeapons(fullWeapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch looted items.',
          e,
        );
      } finally {
        setIsLoadingItems(false);
      }
    },
    [Items, ItemsBaseURI, ItemsTokenURI, renderError],
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
