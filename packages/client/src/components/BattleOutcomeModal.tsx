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
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMapNavigation } from '../contexts/MapNavigationContext';
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
        <ModalBody p={4}>
          <VStack alignItems="center" pb={8} spacing={4}>
            <Text>
              {winner === character.characterId
                ? `You defeated ${opponent?.name}!`
                : `You lost to ${opponent?.name}.`}
            </Text>
            {winner === character.characterId && (
              <Text textAlign="center">
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
        </ModalBody>
        <ModalFooter>
          <Button onClick={onAcknowledge}>Continue</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
