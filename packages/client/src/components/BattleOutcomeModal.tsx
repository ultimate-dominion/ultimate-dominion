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
  Text,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useCharacter } from '../contexts/CharacterContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';
import { useMUD } from '../contexts/MUDContext';
import { BATTLE_OUTCOME_SEEN_KEY } from '../utils/constants';
import { type CombatOutcomeType } from '../utils/types';

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
  const {
    components: { Levels },
  } = useMUD();
  const { character } = useCharacter();
  const { allMonsters, otherPlayers } = useMapNavigation();

  const opponent = useMemo(() => {
    if (!character) return null;
    const opponent =
      character.characterId === battleOutcome.defenders[0]
        ? battleOutcome.attackers[0]
        : battleOutcome.defenders[0];

    const monsterOpponent = allMonsters.find(
      monster => monster.monsterId === opponent,
    );
    if (monsterOpponent) {
      return monsterOpponent;
    }

    const characterOpponent = otherPlayers.find(
      player => player.characterId === opponent,
    );
    if (characterOpponent) {
      return characterOpponent;
    }

    return null;
  }, [allMonsters, battleOutcome, character, otherPlayers]);

  const onAcknowledge = useCallback(() => {
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, battleOutcome.encounterId);
    onClose();
  }, [battleOutcome.encounterId, onClose]);

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

  if (!character) {
    return <Box />;
  }

  const { expDropped, goldDropped, itemsDropped, winner } = battleOutcome;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader textAlign="center">
          {winner === character.characterId ? 'Victory!' : 'Defeat...'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4} textAlign="center">
          <VStack alignItems="center" pb={canLevel ? 4 : 8} spacing={4}>
            <Text>
              {winner === character.characterId
                ? `You defeated ${opponent?.name}!`
                : `You lost to ${opponent?.name}.`}
            </Text>
            {winner === character.characterId && (
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
            {itemsDropped.length > 0 && (
              <Text>
                You looted the following items:
                <ul>
                  {itemsDropped.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Text>
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
                  to={`/characters/${character?.characterId}`}
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
